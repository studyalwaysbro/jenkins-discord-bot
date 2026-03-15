// voice.js — Jenkins enters the Tavern: Voice Channel Management
// With noise filtering, credit monitoring, and auto-fallback

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
const { textToSpeech, speechToText, isQuotaExhausted, isFallbackActive, getStats } = require('./elevenlabs');
const { chat } = require('./deepseek');
const prism = require('prism-media');
const path = require('path');

// Point to the bundled ffmpeg binary
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

// ═══════════════════════════════════════════════════════════════
// Audio Analysis — The Architect's ears filter the worthy from noise
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate RMS (Root Mean Square) energy of a PCM buffer.
 * PCM is 16-bit signed LE mono at 48kHz.
 * Returns a value between 0 and 1 (normalized).
 */
function calculateRMS(pcmBuffer) {
  const samples = pcmBuffer.length / 2; // 16-bit = 2 bytes per sample
  if (samples === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < pcmBuffer.length; i += 2) {
    const sample = pcmBuffer.readInt16LE(i);
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / samples);
  return rms / 32768; // Normalize to 0-1
}

/**
 * Check if audio has enough "speech-like" energy to be worth transcribing.
 * Analyzes the loudest portion of the audio to distinguish speech from background noise.
 */
function isLikelySpeech(pcmBuffer) {
  const CHUNK_SIZE = 9600; // 100ms chunks at 48kHz mono 16-bit
  const MIN_LOUD_CHUNKS = 3; // Need at least 3 loud chunks (300ms of speech)
  const SPEECH_THRESHOLD = 0.015; // RMS threshold for "this is speech, not noise"

  let loudChunks = 0;
  for (let i = 0; i < pcmBuffer.length; i += CHUNK_SIZE) {
    const chunk = pcmBuffer.subarray(i, Math.min(i + CHUNK_SIZE, pcmBuffer.length));
    const rms = calculateRMS(chunk);
    if (rms > SPEECH_THRESHOLD) {
      loudChunks++;
    }
  }

  return loudChunks >= MIN_LOUD_CHUNKS;
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
  // Speech Processing — with noise filter & credit intelligence
  // ═══════════════════════════════════════════════════════════════

  async handleSpeechEnd(guildId, userId, audioChunks, textChannel) {
    if (!audioChunks || audioChunks.length === 0) {
      console.log(`[Voice] handleSpeechEnd: no audio chunks for ${userId}`);
      return;
    }

    const pcmBuffer = Buffer.concat(audioChunks);
    const durationSec = pcmBuffer.length / 96000;
    console.log(`[Voice] handleSpeechEnd: PCM ${pcmBuffer.length} bytes (${durationSec.toFixed(1)}s)`);

    // ── Filter 1: Too short ──
    if (pcmBuffer.length < 24000) { // < 0.25s
      console.log(`[Voice] FILTERED: too short (${pcmBuffer.length} bytes)`);
      return;
    }

    // ── Filter 2: Noise detection via RMS energy analysis ──
    if (!isLikelySpeech(pcmBuffer)) {
      this.sessionNoiseCount++;
      const guildNoise = (this.noiseCount.get(guildId) || 0) + 1;
      this.noiseCount.set(guildId, guildNoise);
      console.log(`[Voice] FILTERED: noise (RMS too low). Session noise: ${this.sessionNoiseCount}, guild: ${guildNoise}`);

      // Warn about noise every 3 minutes if it's getting excessive
      this.maybeWarnNoise(guildId, textChannel);
      return;
    }

    this.sessionSpeechCount++;
    console.log(`[Voice] Audio passed noise filter. Speech #${this.sessionSpeechCount} (noise filtered: ${this.sessionNoiseCount})`);

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
            const callout = await this.sinDetector.generateCallout(displayName, topSin, 'voice');
            if (callout) {
              const cleanCallout = callout
                .replace(/\*\*([^*]+)\*\*/g, '$1')
                .replace(/\*([^*]+)\*/g, '$1')
                .replace(/__([^_]+)__/g, '$1')
                .replace(/_([^_]+)_/g, '$1')
                .replace(/~~([^~]+)~~/g, '$1')
                .replace(/`([^`]+)`/g, '$1')
                .replace(/#{1,6}\s/g, '')
                .trim();
              await this.speakText(guildId, cleanCallout);
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

      const response = await chat(
        this.deepseek,
        this.systemPrompt,
        voicePrompt
      );

      // Strip markdown for speech
      const cleanResponse = response
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .trim();

      console.log(`[Voice] Jenkins responds: "${cleanResponse}"`);

      // Speak the response
      const { usedFallback } = await this.speakText(guildId, cleanResponse);

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

      const ratio = this.sessionSpeechCount > 0
        ? Math.round(this.sessionNoiseCount / this.sessionSpeechCount)
        : this.sessionNoiseCount;

      textChannel.send(
        `⚠️ **The Architect senses interference in the Tavern.**\n` +
        `I've filtered out **${guildNoise} background noise clips** just now ` +
        `(TV, mouse clicks, keyboard, etc). These would've wasted API credits if I wasn't filtering them.\n` +
        `Session stats: **${this.sessionSpeechCount}** real speech vs **${this.sessionNoiseCount}** noise clips filtered.\n` +
        `*Consider muting your mic when not speaking to the Architect, Brother.*`
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

      // Also try to say it in voice
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
  // Text-to-Speech playback with safety timeout
  // ═══════════════════════════════════════════════════════════════

  async speakText(guildId, text) {
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
      console.log(`[Voice] Requesting TTS for: "${text.substring(0, 60)}..."`);
      const result = await textToSpeech(this.elevenlabsApiKey, text);
      const audioBuffer = result.buffer;
      usedFallback = result.usedFallback;

      if (usedFallback) {
        console.log(`[Voice] Using Edge TTS fallback (${audioBuffer.length} bytes)`);
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
