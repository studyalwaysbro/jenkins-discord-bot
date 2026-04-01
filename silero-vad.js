// silero-vad.js — ML-based Voice Activity Detection using Silero VAD (ONNX)
// Replaces the handcrafted DSP heuristics with a trained neural network.
// Model: Silero VAD v5 (snakers4/silero-vad), 2.3MB ONNX
// Input: 16kHz mono float32 audio frames (512 samples = 32ms per frame)

const ort = require('onnxruntime-node');
const path = require('path');
const log = require('./logger').child('SileroVAD');

const MODEL_PATH = path.join(__dirname, 'models', 'silero_vad.onnx');
const SAMPLE_RATE = 16000; // Silero expects 16kHz
const FRAME_SIZE = 512;    // 32ms window at 16kHz

class SileroVAD {
  constructor() {
    this.session = null;
    this.ready = false;

    // LSTM hidden state (reset per audio clip)
    this._sr = null;
    this._h = null;
    this._c = null;
  }

  /**
   * Load the ONNX model. Call once at startup.
   */
  async init() {
    try {
      this.session = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
      });
      this.ready = true;
      log.info('Silero VAD model loaded');
    } catch (err) {
      log.error({ err }, 'Failed to load Silero VAD model');
      throw err;
    }
  }

  /**
   * Reset LSTM state. Call before processing each new audio clip.
   */
  resetState() {
    this._sr = new ort.Tensor('int64', BigInt64Array.from([BigInt(SAMPLE_RATE)]), [1]);
    this._state = new ort.Tensor('float32', new Float32Array(2 * 1 * 128).fill(0), [2, 1, 128]);
  }

  /**
   * Run inference on a single 512-sample float32 frame.
   * Returns speech probability [0, 1].
   */
  async processFrame(float32Frame) {
    if (!this.ready) throw new Error('SileroVAD not initialized');

    const input = new ort.Tensor('float32', float32Frame, [1, FRAME_SIZE]);

    const feeds = {
      input: input,
      state: this._state,
      sr: this._sr,
    };

    const result = await this.session.run(feeds);

    // Update LSTM state for next frame
    this._state = result.stateN;

    return result.output.data[0]; // speech probability
  }

  /**
   * Downsample 48kHz PCM16 buffer to 16kHz float32 array.
   * Simple 3:1 decimation (48000 / 16000 = 3).
   */
  static downsample48to16(pcmBuffer) {
    const inputSamples = pcmBuffer.length / 2; // 16-bit = 2 bytes
    const outputSamples = Math.floor(inputSamples / 3);
    const output = new Float32Array(outputSamples);

    for (let i = 0; i < outputSamples; i++) {
      // Average 3 adjacent samples for basic anti-aliasing
      const base = i * 3 * 2; // byte offset
      let sum = 0;
      let count = 0;
      for (let j = 0; j < 3; j++) {
        const offset = base + j * 2;
        if (offset + 1 < pcmBuffer.length) {
          sum += pcmBuffer.readInt16LE(offset);
          count++;
        }
      }
      output[i] = (sum / count) / 32768.0;
    }

    return output;
  }

  /**
   * Analyze a complete PCM buffer (48kHz, 16-bit mono) for speech.
   * Returns { isSpeech, confidence, speechRatio, peakProb, details }.
   *
   * @param {Buffer} pcmBuffer - Raw PCM audio (48kHz, 16-bit LE, mono)
   * @param {number} [threshold=0.5] - Probability threshold to count a frame as speech
   * @returns {Promise<{isSpeech: boolean, confidence: number, speechRatio: number, peakProb: number, details: string}>}
   */
  async analyze(pcmBuffer, threshold = 0.5) {
    if (!this.ready) {
      return { isSpeech: false, confidence: 0, speechRatio: 0, peakProb: 0, details: 'model not loaded' };
    }

    // Downsample to 16kHz float32
    const audio16k = SileroVAD.downsample48to16(pcmBuffer);

    // Reset LSTM state for fresh clip
    this.resetState();

    // Process in 512-sample frames
    let speechFrames = 0;
    let totalFrames = 0;
    let peakProb = 0;
    let probSum = 0;

    for (let i = 0; i + FRAME_SIZE <= audio16k.length; i += FRAME_SIZE) {
      const frame = audio16k.slice(i, i + FRAME_SIZE);
      const prob = await this.processFrame(frame);

      totalFrames++;
      probSum += prob;
      if (prob > peakProb) peakProb = prob;
      if (prob >= threshold) speechFrames++;
    }

    if (totalFrames === 0) {
      return { isSpeech: false, confidence: 0, speechRatio: 0, peakProb: 0, details: 'no frames' };
    }

    const speechRatio = speechFrames / totalFrames;
    const avgProb = probSum / totalFrames;

    // Speech if at least 20% of frames contain speech OR peak probability is very high
    const isSpeech = speechRatio >= 0.2 || peakProb >= 0.85;
    const confidence = Math.min(1, peakProb);

    const durationSec = pcmBuffer.length / 96000;
    const details = `dur=${durationSec.toFixed(2)}s frames=${totalFrames} speech=${speechFrames} ratio=${(speechRatio * 100).toFixed(0)}% peak=${peakProb.toFixed(3)} avg=${avgProb.toFixed(3)}`;

    return { isSpeech, confidence, speechRatio, peakProb, details };
  }
}

module.exports = { SileroVAD, SAMPLE_RATE, FRAME_SIZE };
