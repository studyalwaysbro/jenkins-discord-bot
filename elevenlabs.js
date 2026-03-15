// elevenlabs.js — The Voice of the Architect, channeled through ElevenLabs + Edge TTS Fallback

const https = require('https');

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
  console.log('[ElevenLabs] Quota reset — trying ElevenLabs again');
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
      console.error('[ElevenLabs] QUOTA EXHAUSTED — switching to Edge TTS fallback');
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
 * ElevenLabs TTS — the custom Jenkins voice
 */
function elevenLabsTTS(apiKey, text, voiceId) {
  voiceId = voiceId || DEFAULT_VOICE_ID;

  const url = `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`;
  const body = JSON.stringify({
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.4,
      similarity_boost: 0.8,
      style: 0.6,
      use_speaker_boost: true,
    },
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
 * Edge TTS — free fallback voice (Microsoft Neural TTS)
 * Uses en-US-AndrewMultilingualNeural with lower pitch for dramatic effect
 */
async function edgeTTS(text) {
  // Dynamic import since edge-tts-universal is ESM
  const { Communicate } = await import('edge-tts-universal');
  // Communicate(text, voice, rate, pitch, volume)
  const comm = new Communicate(text, 'en-US-GuyNeural', '-5%', '-15Hz', '+0%');
  const buffers = [];
  for await (const chunk of comm.stream()) {
    if (chunk.type === 'audio' && chunk.data) buffers.push(chunk.data);
  }
  return Buffer.concat(buffers);
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
  speechToText,
  edgeTTS,
  DEFAULT_VOICE_ID,
  isQuotaExhausted,
  isFallbackActive,
  getStats,
  resetQuota,
};
