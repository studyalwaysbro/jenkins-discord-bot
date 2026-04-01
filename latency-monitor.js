// latency-monitor.js — Real-time pipeline latency instrumentation
// Tracks every stage of the voice pipeline and produces formatted output
const log = require('./logger').child('Voice');

class PipelineTimer {
  constructor(userId, displayName) {
    this.userId = userId;
    this.displayName = displayName || 'Unknown';
    this.stages = [];
    this.pipelineStart = process.hrtime.bigint();
    this.currentStage = null;
    this.metadata = {};
    this.firstAudioAt = null;
  }

  /** Start timing a named stage */
  start(stageName) {
    if (this.currentStage) {
      this.end(); // auto-close previous
    }
    this.currentStage = {
      name: stageName,
      startTime: process.hrtime.bigint(),
      endTime: null,
      durationMs: null,
      notes: null,
    };
  }

  /** End the current stage with optional notes */
  end(notes) {
    if (!this.currentStage) return 0;
    this.currentStage.endTime = process.hrtime.bigint();
    this.currentStage.durationMs = Number(this.currentStage.endTime - this.currentStage.startTime) / 1e6;
    if (notes) this.currentStage.notes = notes;
    this.stages.push(this.currentStage);
    const ms = this.currentStage.durationMs;
    this.currentStage = null;
    return ms;
  }

  /** Mark when first audio chunk is sent to Discord (time-to-first-audio) */
  markFirstAudio() {
    if (!this.firstAudioAt) {
      this.firstAudioAt = process.hrtime.bigint();
    }
  }

  /** Add arbitrary metadata (credits used, tokens generated, etc.) */
  set(key, value) {
    this.metadata[key] = value;
  }

  /** Get total elapsed time from pipeline start */
  elapsed() {
    return Number(process.hrtime.bigint() - this.pipelineStart) / 1e6;
  }

  /** Get time-to-first-audio in ms (null if not marked) */
  timeToFirstAudio() {
    if (!this.firstAudioAt) return null;
    return Number(this.firstAudioAt - this.pipelineStart) / 1e6;
  }

  /** Format and print the pipeline report */
  report() {
    const totalMs = this.elapsed();
    const ttfa = this.timeToFirstAudio();

    const lines = [];
    lines.push(`[VOICE] ┌─ Pipeline: ${this.displayName} ──────────────────────────`);

    for (const stage of this.stages) {
      const ms = stage.durationMs;
      const bar = formatBar(ms);
      const icon = getStageIcon(stage.name);
      const noteStr = stage.notes ? ` (${stage.notes})` : '';
      const networkTag = isNetworkStage(stage.name) ? ' ← NETWORK' : '';
      lines.push(`[VOICE] │ ${icon} ${padRight(stage.name + ':', 16)} ${padLeft(formatMs(ms), 9)}  ${bar}${networkTag}${noteStr}`);
    }

    lines.push(`[VOICE] ├──────────────────────────────────────────────────`);
    lines.push(`[VOICE] │ Total:          ${padLeft(formatMs(totalMs), 9)}`);
    if (ttfa !== null) {
      lines.push(`[VOICE] │ First audio:    ${padLeft(formatMs(ttfa), 9)}  ← user hears Jenkins`);
    }

    // Metadata line
    const metaParts = [];
    if (this.metadata.sttCredits) metaParts.push(`STT=${this.metadata.sttCredits}`);
    if (this.metadata.ttsCredits) metaParts.push(`TTS=${this.metadata.ttsCredits}`);
    if (this.metadata.llmTokens) metaParts.push(`tokens=${this.metadata.llmTokens}`);
    if (this.metadata.llmFirstToken) metaParts.push(`first_token=${formatMs(this.metadata.llmFirstToken)}`);
    if (this.metadata.ttsSentences) metaParts.push(`sentences=${this.metadata.ttsSentences}`);
    if (this.metadata.filtered) metaParts.push(`filtered=${this.metadata.filtered}`);
    if (this.metadata.wakeState) metaParts.push(`wake=${this.metadata.wakeState}`);
    if (metaParts.length > 0) {
      lines.push(`[VOICE] │ ${metaParts.join(' │ ')}`);
    }

    lines.push(`[VOICE] └──────────────────────────────────────────────────`);

    log.info({ userId: this.userId, displayName: this.displayName, totalMs, ttfa, stages: this.stages.map(s => ({ name: s.name, ms: s.durationMs })), metadata: this.metadata }, 'Pipeline report');
    // Also print formatted to stdout for dev readability
    if (process.env.NODE_ENV !== 'production') console.log(lines.join('\n'));
    return { totalMs, ttfa, stages: this.stages.map(s => ({ name: s.name, ms: s.durationMs })), metadata: this.metadata };
  }
}

// ═══════════════════════════════════════════════════════════════
// Session-level stats — aggregated across all pipeline runs
// ═══════════════════════════════════════════════════════════════

class SessionStats {
  constructor() {
    this.pipelines = [];
    this.totalSpeech = 0;
    this.totalNoise = 0;
    this.totalSttCredits = 0;
    this.totalTtsCredits = 0;
    this.noiseTypes = {};
    this.stageAverages = {};
  }

  recordPipeline(report) {
    this.pipelines.push(report);
    this.totalSpeech++;
    if (report.metadata.sttCredits) this.totalSttCredits += report.metadata.sttCredits;
    if (report.metadata.ttsCredits) this.totalTtsCredits += report.metadata.ttsCredits;

    // Update running averages per stage
    for (const stage of report.stages) {
      if (!this.stageAverages[stage.name]) {
        this.stageAverages[stage.name] = { total: 0, count: 0 };
      }
      this.stageAverages[stage.name].total += stage.ms;
      this.stageAverages[stage.name].count++;
    }
  }

  recordNoise(type) {
    this.totalNoise++;
    this.noiseTypes[type] = (this.noiseTypes[type] || 0) + 1;
  }

  /** Print session summary */
  summary() {
    if (this.pipelines.length === 0) {
      log.info('No voice pipelines recorded this session');
      return;
    }

    const totals = this.pipelines.map(p => p.totalMs);
    const ttfas = this.pipelines.map(p => p.ttfa).filter(t => t !== null);
    const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
    const avgTtfa = ttfas.length > 0 ? ttfas.reduce((a, b) => a + b, 0) / ttfas.length : null;
    const p95Total = percentile(totals, 0.95);
    const p95Ttfa = ttfas.length > 0 ? percentile(ttfas, 0.95) : null;

    const lines = [];
    lines.push(`[STATS] ═══════════════════════════════════════════════════`);
    lines.push(`[STATS]  SESSION VOICE STATS`);
    lines.push(`[STATS] ═══════════════════════════════════════════════════`);
    lines.push(`[STATS]  Pipelines: ${this.pipelines.length} │ Noise filtered: ${this.totalNoise}`);
    lines.push(`[STATS]  Credits:   STT=${this.totalSttCredits}  TTS=${this.totalTtsCredits}`);
    lines.push(`[STATS]  Avg total:       ${formatMs(avgTotal)}`);
    lines.push(`[STATS]  P95 total:       ${formatMs(p95Total)}`);
    if (avgTtfa !== null) {
      lines.push(`[STATS]  Avg first-audio:  ${formatMs(avgTtfa)}`);
      lines.push(`[STATS]  P95 first-audio:  ${formatMs(p95Ttfa)}`);
    }

    // Per-stage averages
    lines.push(`[STATS] ───────────────────────────────────────────────────`);
    for (const [name, data] of Object.entries(this.stageAverages)) {
      const avg = data.total / data.count;
      lines.push(`[STATS]  ${padRight(name + ':', 16)} avg ${formatMs(avg)} (${data.count} samples)`);
    }

    // Noise breakdown
    if (this.totalNoise > 0) {
      lines.push(`[STATS] ───────────────────────────────────────────────────`);
      lines.push(`[STATS]  Noise: ${Object.entries(this.noiseTypes).map(([t, c]) => `${t}=${c}`).join(', ')}`);
    }

    lines.push(`[STATS] ═══════════════════════════════════════════════════`);
    log.info({ pipelines: this.pipelines.length, noise: this.totalNoise, sttCredits: this.totalSttCredits, ttsCredits: this.totalTtsCredits }, 'Session voice stats');
    if (process.env.NODE_ENV !== 'production') console.log(lines.join('\n'));
  }
}

// ═══════════════════════════════════════════════════════════════
// Formatting helpers
// ═══════════════════════════════════════════════════════════════

function formatMs(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function padRight(str, len) {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function padLeft(str, len) {
  return str.length >= len ? str : ' '.repeat(len - str.length) + str;
}

function formatBar(ms) {
  // Visual bar: each block = 200ms
  const blocks = Math.min(Math.round(ms / 200), 25);
  if (blocks === 0) return '▏';
  const color = ms < 500 ? '░' : ms < 2000 ? '▒' : '█';
  return color.repeat(blocks);
}

function getStageIcon(name) {
  const icons = {
    'Capture': '🎙️',
    'VAD/Filter': '🔇',
    'PCM→WAV': '📦',
    'STT': '👂',
    'Sin Check': '👁️',
    'Keyword': '🔑',
    'Context': '🧠',
    'LLM': '🤖',
    'TTS': '🔊',
    'Playback': '▶️',
    'Wake Check': '⏰',
    'User Lookup': '👤',
  };
  return icons[name] || '  ';
}

function isNetworkStage(name) {
  return ['STT', 'LLM', 'TTS', 'User Lookup'].includes(name);
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)];
}

module.exports = { PipelineTimer, SessionStats };
