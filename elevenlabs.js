// elevenlabs.js — The Voice of the Architect, channeled through ElevenLabs + Edge TTS Fallback

const https = require('https');
const log = require('./logger').child('ElevenLabs');

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

// Jenkins The Architect — Custom designed: deep prophet + raspy wizard + cult leader + dramatic narrator
const DEFAULT_VOICE_ID = 'kspZtmdcoBwVH8S5bVE0';

// ═══════════════════════════════════════════════════════════════
// Credit Tracking — The Architect monitors his divine resources
// ═══════════════════════════════════════════════════════════════

let quotaExhausted = false;      // True when ElevenLabs returns 401/quota_exceeded
let lastQuotaError = null;       // Timestamp of last quota error
let ttsCallCount = 0;            // Total TTS calls this session
let sttCallCount = 0;            // Total STT calls this session
let ttsFallbackActive = false;   // Currently using Edge TTS?

function isQuotaExhausted() { return quotaExhausted; }
function isFallbackActive() { return ttsFallbackActive; }
function getStats() {
  return { ttsCallCount, sttCallCount, quotaExhausted, ttsFallbackActive, lastQuotaError };
}
function resetQuota() {
  quotaExhausted = false;
  ttsFallbackActive = false;
  lastQuotaError = null;
  log.info('Quota reset — trying ElevenLabs again');
}

// ═══════════════════════════════════════════════════════════════
// Text-to-Speech — ElevenLabs (primary) + Edge TTS (fallback)
// ═══════════════════════════════════════════════════════════════

/**
 * Convert text to speech — auto-fallback to Edge TTS if ElevenLabs quota is exhausted.
 * Returns { buffer: Buffer, usedFallback: boolean }
 */
async function textToSpeech(apiKey, text, voiceId) {
  // If quota is exhausted, go straight to fallback
  if (quotaExhausted) {
    const buffer = await edgeTTS(text);
    return { buffer, usedFallback: true };
  }

  try {
    const buffer = await elevenLabsTTS(apiKey, text, voiceId);
    ttsCallCount++;
    return { buffer, usedFallback: false };
  } catch (err) {
    // Check if this is a quota error
    if (err.message.includes('quota_exceeded') || err.message.includes('401')) {
      log.warn('Quota exhausted — switching to Edge TTS fallback');
      quotaExhausted = true;
      ttsFallbackActive = true;
      lastQuotaError = Date.now();

      // Fall back to Edge TTS
      const buffer = await edgeTTS(text);
      return { buffer, usedFallback: true };
    }
    throw err; // Re-throw non-quota errors
  }
}

/**
 * Convert text to speech with a specific voice configuration (from alter ego system).
 * voiceConfig: { type: 'elevenlabs', voiceId } | { type: 'edge', msVoice, rate, pitch }
 * Returns { buffer: Buffer, usedFallback: boolean }
 */
async function textToSpeechWithVoice(apiKey, text, voiceConfig) {
  if (!voiceConfig) return textToSpeech(apiKey, text);

  if (voiceConfig.type === 'edge') {
    // Edge TTS — FREE, used for alter ego voices
    const buffer = await edgeTTS(
      text,
      voiceConfig.msVoice || 'en-US-GuyNeural',
      voiceConfig.rate || '-5%',
      voiceConfig.pitch || '-15Hz'
    );
    return { buffer, usedFallback: false }; // Not a "fallback" — intentional Edge usage
  }

  // ElevenLabs — premium, used for Jenkins Prime
  if (quotaExhausted) {
    // If quota is gone, fall back to Edge TTS even for ElevenLabs voices
    const buffer = await edgeTTS(text);
    return { buffer, usedFallback: true };
  }

  try {
    const buffer = await elevenLabsTTS(apiKey, text, voiceConfig.voiceId, voiceConfig.settings);
    ttsCallCount++;
    return { buffer, usedFallback: false };
  } catch (err) {
    if (err.message.includes('quota_exceeded') || err.message.includes('401')) {
      log.warn('Quota exhausted — switching to Edge TTS fallback');
      quotaExhausted = true;
      ttsFallbackActive = true;
      lastQuotaError = Date.now();
      const buffer = await edgeTTS(text);
      return { buffer, usedFallback: true };
    }
    throw err;
  }
}

/**
 * ElevenLabs TTS — the custom Jenkins voice
 */
function elevenLabsTTS(apiKey, text, voiceId, settings) {
  voiceId = voiceId || DEFAULT_VOICE_ID;

  const voiceSettings = settings || {
    stability: 0.4,
    similarity_boost: 0.8,
    style: 0.6,
    use_speaker_boost: true,
  };

  const url = `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`;
  const body = JSON.stringify({
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: voiceSettings,
  });

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        timeout: 15000,
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          let errData = '';
          res.on('data', (chunk) => (errData += chunk));
          res.on('end', () => reject(new Error(`ElevenLabs TTS error ${res.statusCode}: ${errData}`)));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('timeout', () => { req.destroy(new Error('ElevenLabs TTS request timed out (15s)')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Edge TTS — free Microsoft Neural TTS with configurable voice/rate/pitch.
 * Used as fallback AND for alter ego voices (saves ElevenLabs credits).
 */
async function edgeTTS(text, voice, rate, pitch) {
  voice = voice || 'en-US-GuyNeural';
  rate = rate || '-5%';
  pitch = pitch || '-15Hz';

  try {
    // Dynamic import since edge-tts-universal is ESM
    const { Communicate } = await import('edge-tts-universal');
    const comm = new Communicate(text, voice, rate, pitch, '+0%');
    const buffers = [];
    for await (const chunk of comm.stream()) {
      if (chunk.type === 'audio' && chunk.data) buffers.push(chunk.data);
    }
    const result = Buffer.concat(buffers);
    if (result.length === 0) {
      throw new Error('Edge TTS returned empty audio');
    }
    return result;
  } catch (err) {
    log.error({ err }, 'Edge TTS error');
    throw new Error(`Edge TTS failed: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Streaming TTS — sentence-by-sentence for pipeline overlap
// ═══════════════════════════════════════════════════════════════

/**
 * Streaming ElevenLabs TTS — uses the /stream endpoint for chunked audio.
 * Returns a readable stream of audio chunks instead of a full buffer.
 */
function elevenLabsTTSStream(apiKey, text, voiceId, settings) {
  voiceId = voiceId || DEFAULT_VOICE_ID;
  const { PassThrough } = require('stream');
  const output = new PassThrough();

  const voiceSettings = settings || {
    stability: 0.4,
    similarity_boost: 0.8,
    style: 0.6,
    use_speaker_boost: true,
  };

  const url = `${ELEVENLABS_BASE}/text-to-speech/${voiceId}/stream`;
  const body = JSON.stringify({
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: voiceSettings,
    optimize_streaming_latency: 3,
  });

  const urlObj = new URL(url);
  const req = https.request(
    {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      timeout: 15000,
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
    },
    (res) => {
      if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', (chunk) => (errData += chunk));
        res.on('end', () => output.destroy(new Error(`ElevenLabs stream error ${res.statusCode}: ${errData}`)));
        return;
      }
      res.pipe(output);
    }
  );
  req.on('timeout', () => { req.destroy(new Error('ElevenLabs stream timed out')); });
  req.on('error', (err) => output.destroy(err));
  req.write(body);
  req.end();

  return output;
}

/**
 * Streaming Edge TTS — returns a PassThrough stream of audio chunks.
 */
async function edgeTTSStream(text, voice, rate, pitch) {
  const { PassThrough } = require('stream');
  const output = new PassThrough();

  voice = voice || 'en-US-GuyNeural';
  rate = rate || '-5%';
  pitch = pitch || '-15Hz';

  (async () => {
    try {
      const { Communicate } = await import('edge-tts-universal');
      const comm = new Communicate(text, voice, rate, pitch, '+0%');
      for await (const chunk of comm.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
          output.write(chunk.data);
        }
      }
      output.end();
    } catch (err) {
      output.destroy(new Error(`Edge TTS stream failed: ${err.message}`));
    }
  })();

  return output;
}

/**
 * Streaming TTS dispatcher — routes to ElevenLabs stream or Edge TTS stream.
 * Returns a PassThrough stream. Use voiceConfig to select voice type.
 */
async function textToSpeechStream(apiKey, text, voiceConfig) {
  // Edge TTS voices (alter egos) or fallback
  if (voiceConfig?.type === 'edge' || quotaExhausted) {
    const voice = voiceConfig?.msVoice || 'en-US-GuyNeural';
    const rate = voiceConfig?.rate || '-5%';
    const pitch = voiceConfig?.pitch || '-15Hz';
    return edgeTTSStream(text, voice, rate, pitch);
  }

  // ElevenLabs streaming
  try {
    ttsCallCount++;
    return elevenLabsTTSStream(apiKey, text, voiceConfig?.voiceId, voiceConfig?.settings);
  } catch (err) {
    if (err.message.includes('quota_exceeded') || err.message.includes('401')) {
      quotaExhausted = true;
      ttsFallbackActive = true;
      lastQuotaError = Date.now();
      return edgeTTSStream(text);
    }
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// Speech-to-Text — ElevenLabs Scribe
// ═══════════════════════════════════════════════════════════════

/**
 * Convert speech (audio buffer) to text using ElevenLabs Speech-to-Text API.
 */
async function speechToText(apiKey, audioBuffer) {
  sttCallCount++;

  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n` +
    `Content-Type: audio/wav\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

  // Add model_id field
  const modelField = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model_id"\r\n\r\n` +
    `scribe_v1\r\n`
  );

  const body = Buffer.concat([modelField, header, audioBuffer, footer]);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.elevenlabs.io',
        path: '/v1/speech-to-text',
        method: 'POST',
        timeout: 15000,
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`ElevenLabs STT error ${res.statusCode}: ${data}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.text || '');
          } catch (e) {
            reject(new Error(`Failed to parse STT response: ${data}`));
          }
        });
      }
    );
    req.on('timeout', () => { req.destroy(new Error('ElevenLabs STT request timed out (15s)')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  textToSpeech,
  textToSpeechWithVoice,
  textToSpeechStream,
  speechToText,
  edgeTTS,
  DEFAULT_VOICE_ID,
  isQuotaExhausted,
  isFallbackActive,
  getStats,
  resetQuota,
};
