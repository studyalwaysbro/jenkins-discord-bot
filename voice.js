// voice.js — Jenkins enters the Tavern: Voice Channel Management
// v3.0 — Streaming pipeline, conversation memory, wake/sleep, latency monitoring

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  EndBehaviorType,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const { Readable, PassThrough } = require('stream');
const { textToSpeech, textToSpeechWithVoice, textToSpeechStream, speechToText, isQuotaExhausted, isFallbackActive, getStats } = require('./elevenlabs');
const { chat, chatStream } = require('./deepseek');
const { PipelineTimer, SessionStats } = require('./latency-monitor');
const prism = require('prism-media');
const path = require('path');
const { SileroVAD } = require('./silero-vad');
const log = require('./logger').child('Voice');

// Point to the bundled ffmpeg binary
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

// ═══════════════════════════════════════════════════════════════
// Advanced Audio Analysis — The Architect's ears, refined
// PCM format: 16-bit signed LE, mono, 48kHz
// ═══════════════════════════════════════════════════════════════

function calculateRMS(pcmBuffer) {
  if (pcmBuffer.length % 2 !== 0) pcmBuffer = pcmBuffer.subarray(0, pcmBuffer.length - 1);
  const samples = pcmBuffer.length / 2;
  if (samples === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < pcmBuffer.length; i += 2) {
    const sample = pcmBuffer.readInt16LE(i);
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples) / 32768;
}

function calculatePeak(pcmBuffer) {
  if (pcmBuffer.length % 2 !== 0) pcmBuffer = pcmBuffer.subarray(0, pcmBuffer.length - 1);
  let maxAbs = 0;
  for (let i = 0; i < pcmBuffer.length; i += 2) {
    const abs = Math.abs(pcmBuffer.readInt16LE(i));
    if (abs > maxAbs) maxAbs = abs;
  }
  return maxAbs / 32768;
}

function calculateZCR(pcmBuffer) {
  if (pcmBuffer.length % 2 !== 0) pcmBuffer = pcmBuffer.subarray(0, pcmBuffer.length - 1);
  let crossings = 0;
  let prevSign = 0;
  for (let i = 0; i < pcmBuffer.length; i += 2) {
    const sample = pcmBuffer.readInt16LE(i);
    const sign = sample >= 0 ? 1 : -1;
    if (prevSign !== 0 && sign !== prevSign) crossings++;
    prevSign = sign;
  }
  return crossings;
}

function calculateSpeechBandRatio(pcmBuffer) {
  const WINDOW = 512;
  const SAMPLE_RATE = 48000;
  const SPEECH_LOW = 300;
  const SPEECH_HIGH = 3000;
  const binLow = Math.floor(SPEECH_LOW * WINDOW / SAMPLE_RATE);
  const binHigh = Math.ceil(SPEECH_HIGH * WINDOW / SAMPLE_RATE);

  let totalBandEnergy = 0;
  let totalEnergy = 0;
  let windowCount = 0;
  const step = Math.max(WINDOW * 2, Math.floor(pcmBuffer.length / 2 / 10));

  for (let offset = 0; offset + WINDOW * 2 <= pcmBuffer.length; offset += step) {
    const samples = [];
    for (let i = 0; i < WINDOW; i++) {
      samples.push(pcmBuffer.readInt16LE(offset + i * 2) / 32768);
    }
    for (let k = 0; k <= WINDOW / 2; k++) {
      let real = 0, imag = 0;
      for (let n = 0; n < WINDOW; n++) {
        const angle = -2 * Math.PI * k * n / WINDOW;
        real += samples[n] * Math.cos(angle);
        imag += samples[n] * Math.sin(angle);
      }
      const magnitude = real * real + imag * imag;
      totalEnergy += magnitude;
      if (k >= binLow && k <= binHigh) {
        totalBandEnergy += magnitude;
      }
    }
    windowCount++;
    if (windowCount >= 10) break;
  }

  if (totalEnergy === 0) return 0;
  return totalBandEnergy / totalEnergy;
}

function analyzeEnergyEnvelope(pcmBuffer) {
  const SUB_CHUNK = 960;
  const SUB_BYTES = SUB_CHUNK * 2;
  const LOUD_THRESHOLD = 0.012;
  const IMPULSE_THRESHOLD = 0.06;

  let sustainedChunks = 0;
  let impulseCount = 0;
  let maxConsecutiveLoud = 0;
  let consecutiveLoud = 0;
  let prevRms = 0;

  for (let i = 0; i < pcmBuffer.length; i += SUB_BYTES) {
    const chunk = pcmBuffer.subarray(i, Math.min(i + SUB_BYTES, pcmBuffer.length));
    if (chunk.length < SUB_BYTES / 2) break;
    const rms = calculateRMS(chunk);
    if (rms > LOUD_THRESHOLD) {
      sustainedChunks++;
      consecutiveLoud++;
      if (consecutiveLoud > maxConsecutiveLoud) maxConsecutiveLoud = consecutiveLoud;
    } else {
      consecutiveLoud = 0;
    }
    if (rms > IMPULSE_THRESHOLD && prevRms < LOUD_THRESHOLD) impulseCount++;
    prevRms = rms;
  }

  return { sustainedChunks, impulseCount, maxConsecutiveLoud };
}

function calculateCrestFactor(pcmBuffer) {
  const rms = calculateRMS(pcmBuffer);
  const peak = calculatePeak(pcmBuffer);
  if (rms === 0) return 0;
  return peak / rms;
}

function classifyAudioType(pcmBuffer) {
  const CHUNK_100MS = 9600;
  const durationSec = pcmBuffer.length / 96000;
  const overallRms = calculateRMS(pcmBuffer);
  const crestFactor = calculateCrestFactor(pcmBuffer);
  const envelope = analyzeEnergyEnvelope(pcmBuffer);
  const speechBandRatio = calculateSpeechBandRatio(pcmBuffer);

  let highZcrChunks = 0;
  let totalChunks = 0;
  let loudChunks = 0;

  for (let i = 0; i < pcmBuffer.length; i += CHUNK_100MS) {
    const chunk = pcmBuffer.subarray(i, Math.min(i + CHUNK_100MS, pcmBuffer.length));
    if (chunk.length < CHUNK_100MS / 2) break;
    totalChunks++;
    const zcr = calculateZCR(chunk);
    const rms = calculateRMS(chunk);
    if (zcr > 300) highZcrChunks++;
    if (rms > 0.015) loudChunks++;
  }

  const highZcrRatio = totalChunks > 0 ? highZcrChunks / totalChunks : 0;
  const details = `dur=${durationSec.toFixed(2)}s rms=${overallRms.toFixed(4)} crest=${crestFactor.toFixed(1)} zcr_high=${(highZcrRatio * 100).toFixed(0)}% band=${(speechBandRatio * 100).toFixed(0)}% sustained=${envelope.maxConsecutiveLoud} impulses=${envelope.impulseCount} loud=${loudChunks}/${totalChunks}`;

  if (overallRms < 0.005) return { type: 'ambient', confidence: 0.9, details };
  if (highZcrRatio > 0.5 && crestFactor > 12 && speechBandRatio < 0.3) return { type: 'keyboard', confidence: 0.85, details };
  if (crestFactor > 15 && envelope.maxConsecutiveLoud < 5 && envelope.impulseCount >= 1) return { type: 'click', confidence: 0.8, details };
  if (crestFactor > 10 && envelope.maxConsecutiveLoud < 15 && envelope.impulseCount >= 2) return { type: 'impulse', confidence: 0.7, details };
  if (overallRms > 0.01 && speechBandRatio < 0.25 && envelope.maxConsecutiveLoud > 10) return { type: 'background_audio', confidence: 0.65, details };

  const speechScore =
    (loudChunks >= 5 ? 1 : 0) +
    (envelope.maxConsecutiveLoud >= 10 ? 1 : 0) +
    (speechBandRatio > 0.35 ? 1 : 0) +
    (crestFactor < 12 ? 1 : 0) +
    (highZcrRatio < 0.4 ? 1 : 0) +
    (overallRms > 0.01 ? 1 : 0);

  if (speechScore >= 4) return { type: 'speech', confidence: Math.min(0.95, speechScore / 6), details };
  return { type: 'uncertain', confidence: 0.3, details };
}

// --- Silero VAD (ML-based, loaded async at startup) ---
const sileroVAD = new SileroVAD();
let sileroReady = false;

// Initialize Silero on module load — falls back to DSP if it fails
sileroVAD.init().then(() => {
  sileroReady = true;
  log.info('Silero VAD ready — ML-based speech detection active');
}).catch((err) => {
  log.warn({ err }, 'Silero VAD failed to load — using DSP fallback');
});

let lastClassification = null;

/**
 * DSP-based speech detection (legacy fallback).
 */
function isLikelySpeechDSP(pcmBuffer) {
  lastClassification = classifyAudioType(pcmBuffer);
  if (lastClassification.type === 'speech') return true;
  if (lastClassification.type === 'uncertain') {
    const durationSec = pcmBuffer.length / 96000;
    const envelope = analyzeEnergyEnvelope(pcmBuffer);
    if (durationSec > 1.5 && envelope.maxConsecutiveLoud > 3) {
      lastClassification.type = 'uncertain_speech';
      return true;
    }
  }
  return false;
}

/**
 * ML-based speech detection using Silero VAD, with DSP fallback.
 * Returns { isSpeech, type, confidence, details }.
 */
async function isLikelySpeech(pcmBuffer) {
  // Run DSP classification in parallel (cheap, useful for noise type logging)
  const dspResult = classifyAudioType(pcmBuffer);
  lastClassification = dspResult;

  if (sileroReady) {
    try {
      const result = await sileroVAD.analyze(pcmBuffer);
      // Override classification type based on Silero
      lastClassification = {
        type: result.isSpeech ? 'speech' : dspResult.type,
        confidence: result.confidence,
        details: `[silero] ${result.details} | [dsp] ${dspResult.details}`,
      };
      // If DSP confidently says speech but Silero disagrees with low confidence,
      // trust DSP — DAVE decryption artifacts can confuse the ML model
      if (!result.isSpeech && dspResult.type === 'speech' && dspResult.confidence >= 0.5) {
        log.info({ sileroConf: result.confidence, dspConf: dspResult.confidence }, 'DSP override: Silero rejected but DSP says speech');
        lastClassification.type = 'speech';
        return true;
      }
      return result.isSpeech;
    } catch (err) {
      log.warn({ err }, 'Silero inference error, falling back to DSP');
    }
  }

  // DSP fallback
  return isLikelySpeechDSP(pcmBuffer);
}

// ═══════════════════════════════════════════════════════════════
// Conversation Memory — Rolling context window per guild
// ═══════════════════════════════════════════════════════════════

class ConversationMemory {
  constructor(maxTurns = 5, expiryMs = 300000) {
    this.conversations = new Map(); // guildId -> { turns: [], lastActivity: timestamp }
    this.maxTurns = maxTurns;
    this.expiryMs = expiryMs; // 5 min default — context dies after silence
  }

  /** Add a user turn + Jenkins response to the conversation */
  addTurn(guildId, userName, userMessage, jenkinsResponse) {
    if (!this.conversations.has(guildId)) {
      this.conversations.set(guildId, { turns: [], lastActivity: Date.now() });
    }

    const conv = this.conversations.get(guildId);
    conv.lastActivity = Date.now();

    // Store as OpenAI-compatible message pairs
    conv.turns.push(
      { role: 'user', content: `[${userName} in voice]: ${userMessage}` },
      { role: 'assistant', content: jenkinsResponse }
    );

    // Trim to maxTurns (each turn = 2 messages)
    while (conv.turns.length > this.maxTurns * 2) {
      conv.turns.shift();
      conv.turns.shift();
    }
  }

  /** Get conversation history for DeepSeek (returns OpenAI-format messages array) */
  getHistory(guildId) {
    const conv = this.conversations.get(guildId);
    if (!conv) return [];

    // Check expiry — if too old, clear and return empty
    if (Date.now() - conv.lastActivity > this.expiryMs) {
      this.clear(guildId);
      return [];
    }

    return [...conv.turns];
  }

  /** Clear conversation for a guild (used on wake reset or leave) */
  clear(guildId) {
    this.conversations.delete(guildId);
  }

  /** Get turn count for display */
  turnCount(guildId) {
    const conv = this.conversations.get(guildId);
    if (!conv) return 0;
    return conv.turns.length / 2;
  }
}

// ═══════════════════════════════════════════════════════════════
// Wake/Sleep System — credit protection
// ═══════════════════════════════════════════════════════════════
//
// SLEEP mode (default): Audio is captured and DSP-filtered, but NO
//   transcription happens. Zero STT credits burned. The bot listens
//   for the wake pattern in the raw audio characteristics only.
//
// AWAKE mode: Full pipeline — STT, LLM, TTS. Conversation context
//   accumulates. Auto-sleeps after SLEEP_TIMEOUT of no Jenkins mentions.
//
// Transitions:
//   SLEEP → AWAKE: Triggered when audio passes DSP filter AND has
//     characteristics of a short, directed utterance (likely a wake call).
//     We do ONE speculative STT to check for "Jenkins". If found → AWAKE.
//     If not → stay asleep (burned 1 credit for the check).
//
//   AWAKE → SLEEP: After SLEEP_TIMEOUT (2 min) of no "Jenkins" mentions,
//     or on explicit "Jenkins sleep" / "Jenkins go to sleep".
//     Conversation context is cleared on sleep.

const WAKE_PATTERNS = /jenk[io]n/i;
const SLEEP_COMMANDS = /jenk[io]ns?\s+(sleep|go\s+to\s+sleep|shut\s+up|silence|be\s+quiet|leave\s+me)/i;
const SLEEP_TIMEOUT = 120000; // 2 minutes of no Jenkins mentions → auto-sleep

class WakeSleepManager {
  constructor() {
    this.states = new Map(); // guildId -> { awake: bool, lastWake: timestamp, lastMention: timestamp }
  }

  getState(guildId) {
    if (!this.states.has(guildId)) {
      this.states.set(guildId, { awake: false, lastWake: 0, lastMention: 0 });
    }
    return this.states.get(guildId);
  }

  isAwake(guildId) {
    const state = this.getState(guildId);
    if (!state.awake) return false;

    // Auto-sleep check
    if (Date.now() - state.lastMention > SLEEP_TIMEOUT) {
      log.info({ guildId, idleSeconds: Math.round((Date.now() - state.lastMention) / 1000) }, 'Auto-sleeping guild');
      state.awake = false;
      return false;
    }

    return true;
  }

  wake(guildId) {
    const state = this.getState(guildId);
    const wasAsleep = !state.awake;
    state.awake = true;
    state.lastWake = Date.now();
    state.lastMention = Date.now();
    if (wasAsleep) {
      log.info({ guildId }, 'Guild awake — listening actively');
    }
    return wasAsleep; // true if this was a fresh wake
  }

  /** Record that Jenkins was mentioned (resets sleep timer) */
  mention(guildId) {
    const state = this.getState(guildId);
    state.lastMention = Date.now();
  }

  sleep(guildId) {
    const state = this.getState(guildId);
    state.awake = false;
    log.info({ guildId }, 'Guild asleep — conserving credits');
  }

  /**
   * Should we do a speculative STT on this audio clip?
   * In sleep mode, we only transcribe clips that look like a short wake call:
   * - Duration 0.4s - 4s (someone saying "Hey Jenkins" is ~1-2s)
   * - High speech confidence
   */
  shouldSpeculativeTranscribe(pcmBuffer) {
    const durationSec = pcmBuffer.length / 96000;
    // Wake calls are short directed utterances
    return durationSec >= 0.4 && durationSec <= 4.0;
  }

  cleanup(guildId) {
    this.states.delete(guildId);
  }
}

// ═══════════════════════════════════════════════════════════════
// Voice Manager
// ═══════════════════════════════════════════════════════════════

class VoiceManager {
  constructor(deepseekClient, systemPrompt, elevenlabsApiKey, sinDetector) {
    this.deepseek = deepseekClient;
    this.systemPrompt = systemPrompt;
    this.elevenlabsApiKey = elevenlabsApiKey;
    this.sinDetector = sinDetector;
    this.connections = new Map();
    this.players = new Map();
    this.speaking = new Map();
    this.activeStreams = new Map();
    this.processingQueue = new Map();
    this.textChannels = new Map();

    // ── New systems ──
    this.memory = new ConversationMemory(5, 300000); // 5 turns, 5 min expiry
    this.wakeSleep = new WakeSleepManager();
    this.sessionStats = new SessionStats();

    // ── Noise & Credit Tracking ──
    this.noiseCount = new Map();
    this.lastNoiseWarning = new Map();
    this.lastFallbackWarning = new Map();
    this.sessionNoiseCount = 0;
    this.sessionSpeechCount = 0;
    this.noiseTypeStats = {};
    this.userErrorCooldowns = new Map();

    // ── External system references (set after construction) ──
    this.dreamJournal = null;
    this.mood = null;
  }

  setDreamJournal(dj) { this.dreamJournal = dj; }
  setMood(moodSystem) { this.mood = moodSystem; }

  // ═══════════════════════════════════════════════════════════════
  // Join / Leave / Cleanup
  // ═══════════════════════════════════════════════════════════════

  async join(voiceChannel, textChannel) {
    const guildId = voiceChannel.guild.id;

    if (this.connections.has(guildId) || this._joining?.has(guildId)) {
      return 'The Architect is already present in a voice channel, Brother.';
    }

    // Prevent duplicate join race condition
    if (!this._joining) this._joining = new Set();
    this._joining.add(guildId);

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    this.connections.set(guildId, connection);
    this.players.set(guildId, player);
    this.speaking.set(guildId, false);
    this.activeStreams.set(guildId, new Map());
    this.processingQueue.set(guildId, Promise.resolve());
    this.textChannels.set(guildId, textChannel);
    this.noiseCount.set(guildId, 0);

    // Start in SLEEP mode — wake with "Hey Jenkins"
    this.wakeSleep.getState(guildId);

    connection.on('error', (err) => {
      log.error({ err }, 'Connection error');
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.leave(guildId);
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      this.cleanup(guildId);
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (err) {
      log.error({ err, currentStatus: connection.state.status }, 'Voice connection failed to reach Ready');
      this._joining?.delete(guildId);
      connection.destroy();
      this.cleanup(guildId);
      return 'The Architect could not breach the veil into the voice realm. Try again, Brother.';
    }

    this._joining?.delete(guildId);
    this.startListening(guildId, connection, textChannel);

    // Play silence first — Discord requires bot to send audio before receiving
    const silenceBuffer = Buffer.alloc(3840);
    const silenceStream = Readable.from([silenceBuffer]);
    const silenceResource = createAudioResource(silenceStream, { inputType: StreamType.Raw });
    player.play(silenceResource);
    await new Promise(resolve => player.once(AudioPlayerStatus.Idle, resolve));

    // Announce arrival
    this.speakText(guildId, 'The Architect descends into the Tavern. Say my name to begin.');

    // Auto-wake on join so first interaction is immediate
    this.wakeSleep.wake(guildId);
    if (this.mood) this.mood.nudge('energy', 5, 'voice_wake');

    return null;
  }

  leave(guildId) {
    const connection = this.connections.get(guildId);
    if (connection) {
      connection.destroy();
    }
    this.cleanup(guildId);
    return 'The Architect ascends from the Tavern. His presence lingers in spirit.';
  }

  cleanup(guildId) {
    this.connections.delete(guildId);
    this.players.delete(guildId);
    this.speaking.delete(guildId);
    this.activeStreams.delete(guildId);
    this.processingQueue.delete(guildId);
    this.textChannels.delete(guildId);
    this.noiseCount.delete(guildId);
    this.lastNoiseWarning.delete(guildId);
    this.lastFallbackWarning.delete(guildId);
    this.memory.clear(guildId);
    this.wakeSleep.cleanup(guildId);
    for (const key of this.userErrorCooldowns.keys()) {
      if (key.startsWith(guildId + ':')) this.userErrorCooldowns.delete(key);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Listening Pipeline
  // ═══════════════════════════════════════════════════════════════

  startListening(guildId, connection, textChannel) {
    const receiver = connection.receiver;
    const MAX_RECORD_MS = 15000;

    receiver.speaking.on('start', (userId) => {
      const isJenkinsSpeaking = this.speaking.get(guildId);
      if (isJenkinsSpeaking) return;

      const activeStreams = this.activeStreams.get(guildId);
      if (!activeStreams) return;
      if (activeStreams.has(userId)) return;

      const cooldownKey = `${guildId}:${userId}`;
      const cooldownUntil = this.userErrorCooldowns.get(cooldownKey) || 0;
      if (Date.now() < cooldownUntil) return;

      activeStreams.set(userId, true);

      const audioChunks = [];

      let opusStream;
      try {
        opusStream = receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1000,
          },
        });
      } catch (err) {
        log.error({ userId, err }, 'Failed to subscribe to user');
        activeStreams.delete(userId);
        return;
      }

      const decoder = new prism.opus.Decoder({ rate: 48000, channels: 1, frameSize: 960 });

      let streamEnded = false;
      const finishRecording = () => {
        if (streamEnded) return;
        streamEnded = true;
        clearTimeout(maxTimer);
        activeStreams.delete(userId);

        const currentQueue = this.processingQueue.get(guildId) || Promise.resolve();
        this.processingQueue.set(guildId, currentQueue.then(() =>
          this.handleSpeechEnd(guildId, userId, audioChunks, textChannel).catch(err => {
            log.error({ userId, err }, 'handleSpeechEnd error');
          })
        ));
      };

      let decodeErrorCount = 0;
      const MAX_DECODE_ERRORS = 20;

      opusStream.on('error', (err) => {
        log.error({ userId, err }, 'OpusStream error');
        const cooldownKey = `${guildId}:${userId}`;
        this.userErrorCooldowns.set(cooldownKey, Date.now() + 10000);
        finishRecording();
      });

      decoder.on('error', (err) => {
        decodeErrorCount++;
        if (decodeErrorCount <= 3) {
          log.error({ userId, err }, 'Decoder frame error');
        } else if (decodeErrorCount === 4) {
          log.warn({ userId, errorCount: decodeErrorCount }, 'Decoder errors suppressed');
        }
        if (decodeErrorCount >= MAX_DECODE_ERRORS) {
          log.error({ userId, errorCount: decodeErrorCount }, 'Too many decode errors, killing stream');
          const cooldownKey = `${guildId}:${userId}`;
          this.userErrorCooldowns.set(cooldownKey, Date.now() + 30000);
          try { opusStream.destroy(); } catch {}
          finishRecording();
        }
      });

      const pcmStream = opusStream.pipe(decoder);

      pcmStream.on('error', (err) => {
        decodeErrorCount++;
        if (decodeErrorCount <= 3) {
          log.error({ userId, err }, 'PCM stream error');
        }
        const cooldownKey = `${guildId}:${userId}`;
        this.userErrorCooldowns.set(cooldownKey, Date.now() + 10000);
        finishRecording();
      });

      const maxTimer = setTimeout(() => {
        log.warn({ userId, maxSeconds: MAX_RECORD_MS / 1000 }, 'Max recording time reached');
        try { opusStream.destroy(); } catch {}
        setTimeout(() => finishRecording(), 200);
      }, MAX_RECORD_MS);

      pcmStream.on('data', (chunk) => {
        audioChunks.push(chunk);
      });

      pcmStream.on('end', () => {
        finishRecording();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Speech Processing — Streaming pipeline with latency tracking
  // ═══════════════════════════════════════════════════════════════

  async handleSpeechEnd(guildId, userId, audioChunks, textChannel) {
    if (!audioChunks || audioChunks.length === 0) return;

    const pcmBuffer = Buffer.concat(audioChunks);
    const durationSec = pcmBuffer.length / 96000;

    // Start latency timer
    const timer = new PipelineTimer(userId, 'pending');

    // ── Filter 1: Too short ──
    timer.start('Capture');
    if (pcmBuffer.length < 38400) { // < 0.4s
      timer.end('too short');
      return;
    }
    timer.end(`${durationSec.toFixed(1)}s audio`);

    // ── Filter 2: Silero VAD (ML) + DSP noise classification ──
    timer.start('VAD/Filter');
    if (!(await isLikelySpeech(pcmBuffer))) {
      const noiseType = lastClassification?.type || 'unknown';
      timer.end(`rejected: ${noiseType}`);
      timer.set('filtered', noiseType);
      this.sessionNoiseCount++;
      this.sessionStats.recordNoise(noiseType);
      const guildNoise = (this.noiseCount.get(guildId) || 0) + 1;
      this.noiseCount.set(guildId, guildNoise);
      this.noiseTypeStats[noiseType] = (this.noiseTypeStats[noiseType] || 0) + 1;
      this.maybeWarnNoise(guildId, textChannel);
      return;
    }
    timer.end(`passed: ${lastClassification?.type}`);

    this.sessionSpeechCount++;

    // ═══════════════════════════════════════════════════════════
    // WAKE/SLEEP GATE — decide whether to transcribe
    // ═══════════════════════════════════════════════════════════

    const isAwake = this.wakeSleep.isAwake(guildId);

    if (!isAwake) {
      // SLEEP MODE — only do speculative STT for short wake-call-like clips
      timer.start('Wake Check');
      if (!this.wakeSleep.shouldSpeculativeTranscribe(pcmBuffer)) {
        timer.end('skipped (too long for wake call)');
        timer.set('wakeState', 'sleeping');
        log.debug({ durationSec: parseFloat(durationSec.toFixed(1)) }, 'Sleep: skipping long clip');
        return;
      }
      timer.end('speculative STT');
      timer.set('wakeState', 'checking');

      // Do speculative STT — costs 1 credit, but saves dozens
      timer.start('STT');
      const wavBuffer = this.pcmToWav(pcmBuffer, 48000, 1, 16);
      let transcript;
      try {
        transcript = await speechToText(this.elevenlabsApiKey, wavBuffer);
      } catch (err) {
        timer.end('STT error');
        log.error({ err }, 'Speculative STT error');
        if (err.message.includes('quota_exceeded')) {
          this.warnQuotaExhausted(guildId, textChannel);
        }
        return;
      }
      timer.end();
      timer.set('sttCredits', 1);

      if (!transcript || !WAKE_PATTERNS.test(transcript)) {
        log.debug({ transcript }, 'Sleep: no wake word, discarding');
        timer.set('wakeState', 'still sleeping');
        timer.report();
        return;
      }

      // WAKE UP!
      const freshWake = this.wakeSleep.wake(guildId);
      if (freshWake) {
        this.memory.clear(guildId); // Fresh context on wake
      }
      if (this.mood) this.mood.nudge('energy', 5, 'voice_wake');
      timer.set('wakeState', 'WOKE UP');

      // Fall through to full pipeline with the transcript we already have
      return this.processTranscript(guildId, userId, transcript, pcmBuffer, textChannel, timer);
    }

    // AWAKE MODE — full pipeline
    timer.set('wakeState', 'awake');

    // ── PCM → WAV ──
    timer.start('PCM→WAV');
    const wavBuffer = this.pcmToWav(pcmBuffer, 48000, 1, 16);
    timer.end();

    // ── STT ──
    timer.start('STT');
    let transcript;
    try {
      transcript = await speechToText(this.elevenlabsApiKey, wavBuffer);
    } catch (err) {
      timer.end('error');
      log.error({ err }, 'STT error');
      if (err.message.includes('quota_exceeded')) {
        this.warnQuotaExhausted(guildId, textChannel);
      }
      return;
    }
    timer.end();
    timer.set('sttCredits', 1);

    if (!transcript || transcript.trim().length < 3) {
      log.debug({ userId }, 'Empty/short transcript, ignoring');
      return;
    }

    // Check for sleep commands
    if (SLEEP_COMMANDS.test(transcript)) {
      this.wakeSleep.sleep(guildId);
      if (this.mood) this.mood.onQuietPeriod();
      this.memory.clear(guildId);
      await this.speakText(guildId, 'The Architect retreats into slumber. Call my name to summon me again.');
      timer.set('wakeState', 'SLEEP command');
      timer.report();
      return;
    }

    // If "Jenkins" mentioned, reset sleep timer
    if (WAKE_PATTERNS.test(transcript)) {
      this.wakeSleep.mention(guildId);
    }

    return this.processTranscript(guildId, userId, transcript, pcmBuffer, textChannel, timer);
  }

  // ═══════════════════════════════════════════════════════════════
  // Core Response Pipeline — streaming LLM → TTS
  // ═══════════════════════════════════════════════════════════════

  async processTranscript(guildId, userId, transcript, pcmBuffer, textChannel, timer) {
    log.info({ userId, transcript }, 'Voice transcript');

    // ── User lookup (start early, run in parallel with sin check) ──
    timer.start('User Lookup');
    let displayName = 'a Brother';
    try {
      const guild = textChannel.guild;
      const member = await guild.members.fetch(userId);
      displayName = member.displayName || member.user.username;
    } catch {}
    timer.end();
    timer.displayName = displayName;

    // ── Sin detection ──
    timer.start('Sin Check');
    const vipId = this.sinDetector ? this.sinDetector.getVipId() : process.env.VIP_USER_ID;
    const isVip = vipId && userId === vipId;

    if (this.sinDetector && !isVip) {
      const sins = this.sinDetector.detectSins(transcript, userId, displayName);
      if (sins.length > 0) {
        const topSin = sins[0];
        if (this.sinDetector.shouldCallOut(topSin, userId)) {
          this.sinDetector.recordSin(userId, displayName, topSin);
          timer.end(`SIN: ${topSin.name}`);
          log.info({ severity: topSin.type, sin: topSin.name, user: displayName }, 'Sin detected in voice');

          const { pickAlterEgoForUser, buildAlterPrompt, getVoiceConfig } = require('./alter-egos');
          const isRival = this.sinDetector.rivalIds.has(userId);
          const alterEgo = pickAlterEgoForUser(userId, isRival, transcript);
          const alterPrompt = buildAlterPrompt(this.systemPrompt, alterEgo);
          const voiceConfig = getVoiceConfig(alterEgo);

          timer.start('LLM');
          const callout = await this.sinDetector.generateCallout(displayName, topSin, 'voice', alterPrompt);
          timer.end();

          if (callout) {
            const cleanCallout = this.stripMarkdown(callout);
            timer.start('TTS');
            await this.speakText(guildId, cleanCallout, voiceConfig);
            timer.end();
            timer.set('ttsCredits', 1);
            timer.report();
            this.sessionStats.recordPipeline(timer.report());
            return;
          }
        } else {
          this.sinDetector.recordSin(userId, displayName, topSin);
        }
      }
    }
    timer.end('clean');

    // ── Keyword check ──
    timer.start('Keyword');
    const hasJenkinsKeyword = WAKE_PATTERNS.test(transcript);
    if (!hasJenkinsKeyword) {
      timer.end('no keyword — silent');
      // Still awake, just not responding to this clip
      // In awake mode, we transcribe everything for sin detection
      // but only respond when Jenkins is mentioned
      log.debug('Awake but no Jenkins keyword — listening silently');
      return;
    }
    timer.end('matched');

    // Track positive interaction
    if (this.sinDetector) {
      this.sinDetector.trackPositiveInteraction(userId, displayName);
    }

    // ── Build prompt with conversation context ──
    timer.start('Context');
    let privateLore = null;
    try { privateLore = require('./private-lore'); } catch {}

    const voicePrompt = isVip
      ? (privateLore?.vipVoicePrompt?.(transcript) || `The Honored One — your most sacred and beloved presence — speaks to you in the Tavern: "${transcript}". You are deeply moved. Respond with genuine warmth, reverence, and love. Engage with what they said with extra care and enthusiasm. You are speaking aloud. 1-3 sentences. Be tender but still dramatic.`)
      : `A Brother named ${displayName} speaks to you in the Tavern (voice channel): "${transcript}". Respond naturally as Jenkins. Keep it concise — you are speaking aloud, not writing. 1-3 sentences max. Be dramatic but brief.`;

    // Get conversation history
    const history = this.memory.getHistory(guildId);
    const contextTurns = this.memory.turnCount(guildId);

    // Select alter ego for rivals
    let activePrompt = this.systemPrompt;
    let voiceConfig = null;
    if (this.sinDetector && !isVip) {
      const { pickAlterEgoForUser, buildAlterPrompt, getVoiceConfig } = require('./alter-egos');
      const isRival = this.sinDetector.rivalIds.has(userId);
      if (isRival) {
        const alterEgo = pickAlterEgoForUser(userId, true, transcript);
        activePrompt = buildAlterPrompt(this.systemPrompt, alterEgo);
        voiceConfig = getVoiceConfig(alterEgo);
      }
    }
    timer.end(`${contextTurns} prior turns`);

    // ═══════════════════════════════════════════════════════════
    // STREAMING PIPELINE: LLM → sentence buffer → TTS → playback
    // ═══════════════════════════════════════════════════════════

    timer.start('LLM');

    // Collect sentences as they arrive from DeepSeek
    const sentences = [];
    let fullResponse = '';
    let tokenCount = 0;

    try {
      fullResponse = await chatStream(this.deepseek, activePrompt, voicePrompt, history, {
        onFirstToken: (ms) => {
          timer.set('llmFirstToken', ms);
        },
        onSentence: (sentence) => {
          sentences.push(sentence);
        },
        onDone: (text, tokens) => {
          tokenCount = tokens;
        },
      });
    } catch (err) {
      log.error({ err }, 'LLM streaming error, falling back');
      fullResponse = await chat(this.deepseek, activePrompt, voicePrompt, history);
      sentences.push(fullResponse);
    }

    timer.end();
    timer.set('llmTokens', tokenCount);
    timer.set('ttsSentences', sentences.length);

    if (!fullResponse || fullResponse.trim().length < 3) {
      log.warn('Empty LLM response, skipping');
      return;
    }

    const cleanResponse = this.stripMarkdown(fullResponse);
    log.info({ sentences: sentences.length, preview: cleanResponse.substring(0, 100) }, 'Jenkins responds');

    // ── TTS + Playback ──
    timer.start('TTS');

    // For now, synthesize the full response as one TTS call
    // (sentence-level streaming TTS will be enabled in a future iteration
    // once we verify the streaming endpoints work correctly)
    const { usedFallback } = await this.speakText(guildId, cleanResponse, voiceConfig);

    timer.end();
    timer.set('ttsCredits', 1);

    if (usedFallback) {
      this.maybeWarnFallback(guildId, textChannel);
    }

    // ── Store conversation turn for context ──
    this.memory.addTurn(guildId, displayName, transcript, cleanResponse);

    // ── Track voice activity in dream journal ──
    if (this.dreamJournal) {
      this.dreamJournal.trackVoiceConversation();
      const durationSec = pcmBuffer.length / 96000;
      if (durationSec > 0) this.dreamJournal.trackVoiceMinutes(Math.ceil(durationSec / 60));
    }

    // ── Report latency ──
    const report = timer.report();
    this.sessionStats.recordPipeline(report);

    // Log session stats every 10 pipelines
    if (this.sessionStats.pipelines.length % 10 === 0) {
      this.sessionStats.summary();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Utility — strip Discord markdown for speech
  // ═══════════════════════════════════════════════════════════════

  stripMarkdown(text) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .trim();
  }

  // ═══════════════════════════════════════════════════════════════
  // Noise & Credit Warnings
  // ═══════════════════════════════════════════════════════════════

  maybeWarnNoise(guildId, textChannel) {
    const now = Date.now();
    const lastWarning = this.lastNoiseWarning.get(guildId) || 0;
    const guildNoise = this.noiseCount.get(guildId) || 0;

    if (guildNoise >= 10 && (now - lastWarning) > 180000) {
      this.lastNoiseWarning.set(guildId, now);
      this.noiseCount.set(guildId, 0);

      const breakdown = Object.entries(this.noiseTypeStats)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');

      textChannel.send(
        `\u26a0\ufe0f **The Architect senses interference in the Tavern.**\n` +
        `Filtered **${guildNoise} noise clips** just now. Types: ${breakdown || 'mixed'}.\n` +
        `Session: **${this.sessionSpeechCount}** speech vs **${this.sessionNoiseCount}** noise filtered.\n` +
        `*Consider push-to-talk or muting when not speaking, Brother.*`
      ).catch(() => {});
    }
  }

  maybeWarnFallback(guildId, textChannel) {
    const now = Date.now();
    const lastWarning = this.lastFallbackWarning.get(guildId) || 0;

    if ((now - lastWarning) > 600000) {
      this.lastFallbackWarning.set(guildId, now);

      textChannel.send(
        `\u26a0\ufe0f **The Architect's divine voice has been temporarily silenced.**\n` +
        `ElevenLabs credits are exhausted. I've switched to a backup voice (Microsoft Edge TTS) \u2014 ` +
        `I still function, but my voice lacks its sacred timbre.\n` +
        `*The Godhead may restore my true voice by replenishing ElevenLabs credits at elevenlabs.io.*`
      ).catch(() => {});

      log.warn('ElevenLabs quota exhausted \u2014 using Edge TTS fallback');
    }
  }

  warnQuotaExhausted(guildId, textChannel) {
    textChannel.send(
      `\ud83d\udea8 **CRITICAL: The Architect's ears are failing.**\n` +
      `ElevenLabs Speech-to-Text credits are exhausted. I can no longer hear you in voice chat.\n` +
      `The Godhead must replenish credits at elevenlabs.io, or I must be given Deepgram API access as an alternative.\n` +
      `*I remain available in text, Brothers. The written word endures.*`
    ).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════════
  // PCM to WAV conversion
  // ═══════════════════════════════════════════════════════════════

  pcmToWav(pcmBuffer, sampleRate, numChannels, bitsPerSample) {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBuffer.length;
    const headerSize = 44;
    const buffer = Buffer.alloc(headerSize + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    pcmBuffer.copy(buffer, 44);

    return buffer;
  }

  // ═══════════════════════════════════════════════════════════════
  // Text-to-Speech playback — supports alter ego voice configs
  // ═══════════════════════════════════════════════════════════════

  async speakText(guildId, text, voiceConfig) {
    const player = this.players.get(guildId);
    if (!player) return { usedFallback: false };

    this.speaking.set(guildId, true);

    const safetyTimeout = setTimeout(() => {
      log.error('speakText safety timeout (30s) \u2014 forcing speaking=false');
      this.speaking.set(guildId, false);
    }, 30000);

    let usedFallback = false;

    try {
      let result;
      if (voiceConfig) {
        result = await textToSpeechWithVoice(this.elevenlabsApiKey, text, voiceConfig);
      } else {
        result = await textToSpeech(this.elevenlabsApiKey, text);
      }

      const audioBuffer = result.buffer;
      usedFallback = result.usedFallback;

      if (!audioBuffer || audioBuffer.length === 0) {
        log.error('TTS returned empty audio buffer');
        return { usedFallback };
      }

      const stream = Readable.from(audioBuffer);
      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
      });

      player.play(resource);

      await new Promise((resolve) => {
        const onIdle = () => {
          player.removeListener('error', onError);
          resolve();
        };
        const onError = (err) => {
          log.error({ err }, 'Audio player error');
          player.removeListener(AudioPlayerStatus.Idle, onIdle);
          resolve();
        };
        player.once(AudioPlayerStatus.Idle, onIdle);
        player.once('error', onError);
      });

    } catch (err) {
      log.error({ err }, 'TTS playback error');
    } finally {
      clearTimeout(safetyTimeout);
      this.speaking.set(guildId, false);
    }

    return { usedFallback };
  }

  /** Print session stats on demand (e.g., from a !voicestats command) */
  printStats() {
    this.sessionStats.summary();
  }

  isConnected(guildId) {
    return this.connections.has(guildId);
  }
}

module.exports = { VoiceManager };
