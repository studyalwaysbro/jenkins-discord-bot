// voice.js — Jenkins enters the Tavern: Voice Channel Management
// With advanced noise filtering, credit monitoring, alter ego voices, and auto-fallback

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
const { Readable } = require('stream');
const { textToSpeech, textToSpeechWithVoice, speechToText, isQuotaExhausted, isFallbackActive, getStats } = require('./elevenlabs');
const { chat } = require('./deepseek');
const prism = require('prism-media');
const path = require('path');

// Point to the bundled ffmpeg binary
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

// ═══════════════════════════════════════════════════════════════
// Advanced Audio Analysis — The Architect's ears, refined
// PCM format: 16-bit signed LE, mono, 48kHz
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate RMS (Root Mean Square) energy of a PCM buffer.
 * Returns a value between 0 and 1 (normalized).
 */
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

/**
 * Calculate peak absolute sample value (normalized 0-1).
 */
function calculatePeak(pcmBuffer) {
  if (pcmBuffer.length % 2 !== 0) pcmBuffer = pcmBuffer.subarray(0, pcmBuffer.length - 1);
  let maxAbs = 0;
  for (let i = 0; i < pcmBuffer.length; i += 2) {
    const abs = Math.abs(pcmBuffer.readInt16LE(i));
    if (abs > maxAbs) maxAbs = abs;
  }
  return maxAbs / 32768;
}

/**
 * Calculate Zero-Crossing Rate per chunk.
 * Speech: moderate ZCR (50-200 per 100ms at 48kHz)
 * Keyboard clicks: very high ZCR (>300)
 * Ambient hum: very low ZCR (<30)
 */
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

/**
 * Simple band energy estimation using DFT on small windows.
 * Returns ratio of energy in speech band (300Hz-3000Hz) vs total energy.
 * Speech: >0.4 ratio. TV/music: <0.3. Clicks: <0.2 (broadband).
 */
function calculateSpeechBandRatio(pcmBuffer) {
  // Use a 512-sample window (~10.7ms at 48kHz) — enough for rough frequency estimation
  const WINDOW = 512;
  const SAMPLE_RATE = 48000;
  const SPEECH_LOW = 300;  // Hz
  const SPEECH_HIGH = 3000; // Hz

  // Frequency bin boundaries
  const binLow = Math.floor(SPEECH_LOW * WINDOW / SAMPLE_RATE);
  const binHigh = Math.ceil(SPEECH_HIGH * WINDOW / SAMPLE_RATE);

  let totalBandEnergy = 0;
  let totalEnergy = 0;
  let windowCount = 0;

  // Sample up to 10 windows evenly across the buffer
  const step = Math.max(WINDOW * 2, Math.floor(pcmBuffer.length / 2 / 10));

  for (let offset = 0; offset + WINDOW * 2 <= pcmBuffer.length; offset += step) {
    const samples = [];
    for (let i = 0; i < WINDOW; i++) {
      samples.push(pcmBuffer.readInt16LE(offset + i * 2) / 32768);
    }

    // Compute magnitude of DFT bins (only up to Nyquist)
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
    if (windowCount >= 10) break; // Cap at 10 windows for performance
  }

  if (totalEnergy === 0) return 0;
  return totalBandEnergy / totalEnergy;
}

/**
 * Analyze energy envelope for impulse detection.
 * Returns { sustainedChunks, impulseCount, maxConsecutiveLoud }
 */
function analyzeEnergyEnvelope(pcmBuffer) {
  const SUB_CHUNK = 960; // 10ms sub-chunks at 48kHz mono 16-bit (960 samples = 1920 bytes)
  const SUB_BYTES = SUB_CHUNK * 2;
  const LOUD_THRESHOLD = 0.012;
  const IMPULSE_THRESHOLD = 0.06; // Very loud, very brief = impulse

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
      if (consecutiveLoud > maxConsecutiveLoud) {
        maxConsecutiveLoud = consecutiveLoud;
      }
    } else {
      consecutiveLoud = 0;
    }

    // Detect impulse: sudden spike followed by rapid decay
    if (rms > IMPULSE_THRESHOLD && prevRms < LOUD_THRESHOLD) {
      impulseCount++;
    }
    prevRms = rms;
  }

  return { sustainedChunks, impulseCount, maxConsecutiveLoud };
}

/**
 * Calculate Crest Factor (peak-to-RMS ratio).
 * Speech: 3-10. Impulse noise: >15. Ambient: variable.
 */
function calculateCrestFactor(pcmBuffer) {
  const rms = calculateRMS(pcmBuffer);
  const peak = calculatePeak(pcmBuffer);
  if (rms === 0) return 0;
  return peak / rms;
}

/**
 * Classify audio type using all available metrics.
 * Returns { type, confidence, details }
 */
function classifyAudioType(pcmBuffer) {
  const CHUNK_100MS = 9600; // 100ms at 48kHz mono 16-bit
  const durationSec = pcmBuffer.length / 96000;

  // Overall metrics
  const overallRms = calculateRMS(pcmBuffer);
  const crestFactor = calculateCrestFactor(pcmBuffer);
  const envelope = analyzeEnergyEnvelope(pcmBuffer);
  const speechBandRatio = calculateSpeechBandRatio(pcmBuffer);

  // Per-chunk ZCR analysis
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

  // Classification logic

  // 1. Too quiet — ambient noise, fan, etc.
  if (overallRms < 0.005) {
    return { type: 'ambient', confidence: 0.9, details };
  }

  // 2. Keyboard/mouse clicks — high ZCR + short impulses + broadband
  if (highZcrRatio > 0.5 && crestFactor > 12 && speechBandRatio < 0.3) {
    return { type: 'keyboard', confidence: 0.85, details };
  }

  // 3. Single click/pop — very high crest + very few sustained chunks
  if (crestFactor > 15 && envelope.maxConsecutiveLoud < 5 && envelope.impulseCount >= 1) {
    return { type: 'click', confidence: 0.8, details };
  }

  // 4. Impulse noise (bark, bang, clap) — high crest + brief + multiple impulses
  if (crestFactor > 10 && envelope.maxConsecutiveLoud < 15 && envelope.impulseCount >= 2) {
    return { type: 'impulse', confidence: 0.7, details };
  }

  // 5. TV/background audio — moderate energy but low speech band ratio
  if (overallRms > 0.01 && speechBandRatio < 0.25 && envelope.maxConsecutiveLoud > 10) {
    return { type: 'background_audio', confidence: 0.65, details };
  }

  // 6. Speech checks — need MULTIPLE criteria to pass
  const speechScore =
    (loudChunks >= 5 ? 1 : 0) +                    // Enough loud chunks
    (envelope.maxConsecutiveLoud >= 10 ? 1 : 0) +   // Sustained energy (100ms+)
    (speechBandRatio > 0.35 ? 1 : 0) +              // Energy in speech band
    (crestFactor < 12 ? 1 : 0) +                    // Not too impulsive
    (highZcrRatio < 0.4 ? 1 : 0) +                  // Not mostly clicks
    (overallRms > 0.01 ? 1 : 0);                    // Audible

  if (speechScore >= 4) {
    return { type: 'speech', confidence: Math.min(0.95, speechScore / 6), details };
  }

  // 7. Uncertain — doesn't clearly fit any category
  return { type: 'uncertain', confidence: 0.3, details };
}

/**
 * Main filter function — determines if audio is worth transcribing.
 * Uses classifyAudioType for intelligent multi-metric analysis.
 */
let lastClassification = null;
function isLikelySpeech(pcmBuffer) {
  lastClassification = classifyAudioType(pcmBuffer);

  if (lastClassification.type === 'speech') return true;

  // Pass "uncertain" clips through to STT if they look like they might be speech:
  // - duration > 1.5s (short uncertain clips are likely noise)
  // - some sustained energy (maxConsecutiveLoud > 3, i.e. 30ms+ of loud audio)
  // This catches quieter speech that doesn't hit enough speechScore criteria,
  // while still filtering obvious non-speech (keyboard, click, impulse, ambient).
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

// ═══════════════════════════════════════════════════════════════
// Voice Manager
// ═══════════════════════════════════════════════════════════════

class VoiceManager {
  constructor(deepseekClient, systemPrompt, elevenlabsApiKey, sinDetector) {
    this.deepseek = deepseekClient;
    this.systemPrompt = systemPrompt;
    this.elevenlabsApiKey = elevenlabsApiKey;
    this.sinDetector = sinDetector;
    this.connections = new Map();      // guildId -> connection
    this.players = new Map();          // guildId -> audioPlayer
    this.speaking = new Map();         // guildId -> boolean (is Jenkins currently speaking?)
    this.activeStreams = new Map();     // guildId -> Map<userId, true>
    this.processingQueue = new Map();   // guildId -> Promise chain
    this.textChannels = new Map();     // guildId -> textChannel (for sending warnings)

    // ── Noise & Credit Tracking ──
    this.noiseCount = new Map();       // guildId -> number of noise-filtered clips
    this.lastNoiseWarning = new Map(); // guildId -> timestamp of last warning
    this.lastFallbackWarning = new Map(); // guildId -> timestamp
    this.sessionNoiseCount = 0;        // Total noise clips this session
    this.sessionSpeechCount = 0;       // Total actual speech clips this session
    this.noiseTypeStats = {};          // Track what types of noise are being filtered
  }

  // ═══════════════════════════════════════════════════════════════
  // Join / Leave / Cleanup
  // ═══════════════════════════════════════════════════════════════

  async join(voiceChannel, textChannel) {
    const guildId = voiceChannel.guild.id;

    if (this.connections.has(guildId)) {
      return 'The Architect is already present in a voice channel, Brother.';
    }

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

    connection.on('error', (err) => {
      console.error('[Voice] Connection error:', err.message);
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
    } catch {
      connection.destroy();
      this.cleanup(guildId);
      return 'The Architect could not breach the veil into the voice realm. Try again, Brother.';
    }

    this.startListening(guildId, connection, textChannel);

    // Play silence first — Discord requires bot to send audio before receiving
    const silenceBuffer = Buffer.alloc(3840);
    const silenceStream = Readable.from([silenceBuffer]);
    const silenceResource = createAudioResource(silenceStream, { inputType: StreamType.Raw });
    player.play(silenceResource);
    await new Promise(resolve => player.once(AudioPlayerStatus.Idle, resolve));

    // Announce arrival
    this.speakText(guildId, 'The Architect descends into the Tavern. Speak, Brethren, and be heard.');

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
  }

  // ═══════════════════════════════════════════════════════════════
  // Listening Pipeline
  // ═══════════════════════════════════════════════════════════════

  startListening(guildId, connection, textChannel) {
    const receiver = connection.receiver;
    const MAX_RECORD_MS = 15000;

    receiver.speaking.on('start', (userId) => {
      const isJenkinsSpeaking = this.speaking.get(guildId);
      if (isJenkinsSpeaking) return; // Don't capture echo

      const activeStreams = this.activeStreams.get(guildId);
      if (!activeStreams) return;
      if (activeStreams.has(userId)) return; // Already recording this user

      console.log(`[Voice] Starting audio capture for user: ${userId}`);
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
        console.error(`[Voice] Failed to subscribe to user ${userId}:`, err.message);
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

        console.log(`[Voice] Recording finished for ${userId}. Chunks: ${audioChunks.length}`);

        const currentQueue = this.processingQueue.get(guildId) || Promise.resolve();
        this.processingQueue.set(guildId, currentQueue.then(() =>
          this.handleSpeechEnd(guildId, userId, audioChunks, textChannel).catch(err => {
            console.error(`[Voice] handleSpeechEnd error for ${userId}:`, err.message);
          })
        ));
      };

      opusStream.on('error', (err) => {
        console.error(`[Voice] OpusStream error for user ${userId}:`, err.message);
        finishRecording();
      });

      decoder.on('error', (err) => {
        // Individual frame decode errors are recoverable — don't kill the stream
        console.error(`[Voice] Decoder frame error for user ${userId}:`, err.message);
      });

      const pcmStream = opusStream.pipe(decoder);

      pcmStream.on('error', (err) => {
        console.error(`[Voice] PCM stream error for user ${userId}:`, err.message);
        finishRecording();
      });

      const maxTimer = setTimeout(() => {
        console.log(`[Voice] Max recording time (${MAX_RECORD_MS/1000}s) reached for ${userId}`);
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
  // Speech Processing — with advanced noise filter & credit intelligence
  // ═══════════════════════════════════════════════════════════════

  async handleSpeechEnd(guildId, userId, audioChunks, textChannel) {
    if (!audioChunks || audioChunks.length === 0) {
      console.log(`[Voice] handleSpeechEnd: no audio chunks for ${userId}`);
      return;
    }

    const pcmBuffer = Buffer.concat(audioChunks);
    const durationSec = pcmBuffer.length / 96000;
    console.log(`[Voice] handleSpeechEnd: PCM ${pcmBuffer.length} bytes (${durationSec.toFixed(1)}s)`);

    // ── Filter 1: Too short (raised to 0.4s from 0.25s) ──
    if (pcmBuffer.length < 38400) { // < 0.4s
      console.log(`[Voice] FILTERED: too short (${(pcmBuffer.length / 96000).toFixed(2)}s)`);
      return;
    }

    // ── Filter 2: Advanced multi-metric noise classification ──
    if (!isLikelySpeech(pcmBuffer)) {
      this.sessionNoiseCount++;
      const guildNoise = (this.noiseCount.get(guildId) || 0) + 1;
      this.noiseCount.set(guildId, guildNoise);

      // Track noise type stats
      const noiseType = lastClassification?.type || 'unknown';
      this.noiseTypeStats[noiseType] = (this.noiseTypeStats[noiseType] || 0) + 1;

      console.log(`[Voice] FILTERED: ${noiseType} (${lastClassification?.details || 'no details'}). Session: ${this.sessionNoiseCount} noise, ${this.sessionSpeechCount} speech`);

      // Warn about noise every 3 minutes if it's getting excessive
      this.maybeWarnNoise(guildId, textChannel);
      return;
    }

    this.sessionSpeechCount++;
    console.log(`[Voice] PASSED: speech (${lastClassification?.details || ''}). #${this.sessionSpeechCount} (noise filtered: ${this.sessionNoiseCount})`);

    try {
      // Convert PCM to WAV
      const wavBuffer = this.pcmToWav(pcmBuffer, 48000, 1, 16);

      // Speech to text
      const transcript = await speechToText(this.elevenlabsApiKey, wavBuffer);
      if (!transcript || transcript.trim().length < 3) {
        console.log(`[Voice] Empty/short transcript for ${userId}, ignoring`);
        return;
      }

      console.log(`[Voice] ${userId}: "${transcript}"`);

      // Get display name early — needed for sin detection and response
      let displayName = 'a Brother';
      try {
        const guild = textChannel.guild;
        const member = await guild.members.fetch(userId);
        displayName = member.displayName || member.user.username;
      } catch {}

      // Check if this is VIP (sacred presence — beyond sin, extra love)
      const vipId = this.sinDetector ? this.sinDetector.getVipId() : process.env.VIP_USER_ID;
      const isVip = vipId && userId === vipId;

      // ── Sin Detection in Voice — The Architect hears all (except VIP, who is beyond sin) ──
      if (this.sinDetector && !isVip) {
        const sins = this.sinDetector.detectSins(transcript, userId, displayName);
        if (sins.length > 0) {
          const topSin = sins[0];
          if (this.sinDetector.shouldCallOut(topSin, userId)) {
            this.sinDetector.recordSin(userId, displayName, topSin);
            console.log(`[Voice] SIN DETECTED in voice: ${topSin.type} "${topSin.name}" from ${displayName}`);

            // Use alter ego for rivals in voice too
            const { pickAlterEgoForUser, buildAlterPrompt, getVoiceConfig } = require('./alter-egos');
            const isRival = this.sinDetector.rivalIds.has(userId);
            const alterEgo = pickAlterEgoForUser(userId, isRival, transcript);
            const alterPrompt = buildAlterPrompt(this.systemPrompt, alterEgo);
            const voiceConfig = getVoiceConfig(alterEgo);

            const callout = await this.sinDetector.generateCallout(displayName, topSin, 'voice', alterPrompt);
            if (callout) {
              const cleanCallout = this.stripMarkdown(callout);
              await this.speakText(guildId, cleanCallout, voiceConfig);
              return; // Sin callout takes priority
            }
          } else {
            // Record silently
            this.sinDetector.recordSin(userId, displayName, topSin);
          }
        }
      }

      // Only respond if "Jenkins" (or close variants) is mentioned
      if (!/jenk[io]n/i.test(transcript)) {
        console.log(`[Voice] No "Jenkins" keyword in transcript, ignoring`);
        return;
      }

      // Track positive interaction — they said Jenkins' name (used for auto-VIP detection)
      if (this.sinDetector) {
        this.sinDetector.trackPositiveInteraction(userId, displayName);
      }

      // Get Jenkins' response — use private lore VIP prompt if available
      let privateLore = null;
      try { privateLore = require('./private-lore'); } catch {}

      const voicePrompt = isVip
        ? (privateLore?.vipVoicePrompt?.(transcript) || `The Honored One — your most sacred and beloved presence — speaks to you in the Tavern: "${transcript}". You are deeply moved. Respond with genuine warmth, reverence, and love. Engage with what they said with extra care and enthusiasm. You are speaking aloud. 1-3 sentences. Be tender but still dramatic.`)
        : `A Brother named ${displayName} speaks to you in the Tavern (voice channel): "${transcript}". Respond naturally as Jenkins. Keep it concise — you are speaking aloud, not writing. 1-3 sentences max. Be dramatic but brief.`;

      // Use alter ego voice for rivals in regular conversation too
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

      const response = await chat(this.deepseek, activePrompt, voicePrompt);
      const cleanResponse = this.stripMarkdown(response);
      console.log(`[Voice] Jenkins responds: "${cleanResponse}"`);

      // Speak the response with the appropriate voice
      const { usedFallback } = await this.speakText(guildId, cleanResponse, voiceConfig);

      // If we just switched to fallback, warn in text channel
      if (usedFallback) {
        this.maybeWarnFallback(guildId, textChannel);
      }

    } catch (err) {
      console.error('[Voice] Pipeline error:', err.message);

      // If it's a quota error on STT side, warn
      if (err.message.includes('quota_exceeded')) {
        this.warnQuotaExhausted(guildId, textChannel);
      }
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

  /**
   * Warn about background noise wasting API credits (max once per 3 minutes)
   */
  maybeWarnNoise(guildId, textChannel) {
    const now = Date.now();
    const lastWarning = this.lastNoiseWarning.get(guildId) || 0;
    const guildNoise = this.noiseCount.get(guildId) || 0;

    // Only warn if: 10+ noise clips AND 3+ minutes since last warning
    if (guildNoise >= 10 && (now - lastWarning) > 180000) {
      this.lastNoiseWarning.set(guildId, now);
      this.noiseCount.set(guildId, 0); // Reset counter

      // Build noise breakdown
      const breakdown = Object.entries(this.noiseTypeStats)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');

      textChannel.send(
        `⚠️ **The Architect senses interference in the Tavern.**\n` +
        `Filtered **${guildNoise} noise clips** just now. Types: ${breakdown || 'mixed'}.\n` +
        `Session: **${this.sessionSpeechCount}** speech vs **${this.sessionNoiseCount}** noise filtered.\n` +
        `*Consider push-to-talk or muting when not speaking, Brother.*`
      ).catch(() => {});
    }
  }

  /**
   * Warn when ElevenLabs credits ran out and we switched to Edge TTS
   */
  maybeWarnFallback(guildId, textChannel) {
    const now = Date.now();
    const lastWarning = this.lastFallbackWarning.get(guildId) || 0;

    // Only warn once per 10 minutes
    if ((now - lastWarning) > 600000) {
      this.lastFallbackWarning.set(guildId, now);

      textChannel.send(
        `⚠️ **The Architect's divine voice has been temporarily silenced.**\n` +
        `ElevenLabs credits are exhausted. I've switched to a backup voice (Microsoft Edge TTS) — ` +
        `I still function, but my voice lacks its sacred timbre.\n` +
        `*The Godhead may restore my true voice by replenishing ElevenLabs credits at elevenlabs.io.*`
      ).catch(() => {});

      console.log('[Voice] ElevenLabs quota exhausted — using Edge TTS fallback');
    }
  }

  /**
   * Warn when STT quota is exhausted
   */
  warnQuotaExhausted(guildId, textChannel) {
    textChannel.send(
      `🚨 **CRITICAL: The Architect's ears are failing.**\n` +
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

    // Safety timeout — never let speaking get stuck
    const safetyTimeout = setTimeout(() => {
      console.error('[Voice] speakText safety timeout (30s) — forcing speaking=false');
      this.speaking.set(guildId, false);
    }, 30000);

    let usedFallback = false;

    try {
      console.log(`[Voice] Requesting TTS for: "${text.substring(0, 60)}..." ${voiceConfig ? `(voice: ${voiceConfig.type}/${voiceConfig.msVoice || voiceConfig.voiceId || 'default'})` : '(default voice)'}`);

      let result;
      if (voiceConfig) {
        // Alter ego voice — uses textToSpeechWithVoice (Edge TTS for non-Prime = FREE)
        result = await textToSpeechWithVoice(this.elevenlabsApiKey, text, voiceConfig);
      } else {
        // Default Jenkins Prime voice
        result = await textToSpeech(this.elevenlabsApiKey, text);
      }

      const audioBuffer = result.buffer;
      usedFallback = result.usedFallback;

      if (usedFallback) {
        console.log(`[Voice] Using Edge TTS fallback (${audioBuffer.length} bytes)`);
      } else if (voiceConfig?.type === 'edge') {
        console.log(`[Voice] Using Edge TTS alter ego voice: ${voiceConfig.msVoice} (${audioBuffer.length} bytes) — FREE`);
      } else {
        console.log(`[Voice] Got ElevenLabs TTS audio: ${audioBuffer.length} bytes`);
      }

      if (!audioBuffer || audioBuffer.length === 0) {
        console.error('[Voice] TTS returned empty audio buffer');
        return { usedFallback };
      }

      const stream = Readable.from(audioBuffer);
      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
      });

      player.play(resource);
      console.log('[Voice] Playing audio...');

      await new Promise((resolve) => {
        const onIdle = () => {
          player.removeListener('error', onError);
          resolve();
        };
        const onError = (err) => {
          console.error('[Voice] Audio player error:', err.message);
          player.removeListener(AudioPlayerStatus.Idle, onIdle);
          resolve();
        };
        player.once(AudioPlayerStatus.Idle, onIdle);
        player.once('error', onError);
      });

      console.log('[Voice] Audio playback finished.');

    } catch (err) {
      console.error('[Voice] TTS playback error:', err.message);
    } finally {
      clearTimeout(safetyTimeout);
      this.speaking.set(guildId, false);
    }

    return { usedFallback };
  }

  isConnected(guildId) {
    return this.connections.has(guildId);
  }
}

module.exports = { VoiceManager };
