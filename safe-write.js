// safe-write.js — Atomic persistence utilities for Jenkins
// Prevents data corruption from crashes mid-write

const fs = require('fs');
const path = require('path');
const log = require('./logger').child('SafeWrite');

/**
 * Atomically write JSON to a file using temp-file-then-rename.
 * Creates parent directories if they don't exist.
 * @param {string} filePath - Absolute path to the JSON file
 * @param {any} data - Data to serialize
 */
function safeWriteJSON(filePath, data) {
  const tmpPath = filePath + '.tmp';
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Write to temp file first
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));

    // Create backup of current file before overwriting
    if (fs.existsSync(filePath)) {
      try { fs.copyFileSync(filePath, filePath + '.bak'); } catch {}
    }

    // Atomic rename (on most filesystems)
    fs.renameSync(tmpPath, filePath);
  } catch (e) {
    log.error({ file: path.basename(filePath), err: e }, 'Write failed');
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

/**
 * Safely read and parse a JSON file with backup recovery.
 * Returns defaultValue if file doesn't exist or is corrupt.
 * @param {string} filePath - Absolute path to the JSON file
 * @param {any} defaultValue - Fallback value
 * @returns {any} Parsed data or defaultValue
 */
function safeReadJSON(filePath, defaultValue) {
  // Try primary file
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    log.error({ file: path.basename(filePath), err: e }, 'Corrupt file');
  }

  // Try backup
  const backup = filePath + '.bak';
  try {
    if (fs.existsSync(backup)) {
      log.warn({ file: path.basename(backup) }, 'Recovering from backup');
      const raw = fs.readFileSync(backup, 'utf-8');
      const data = JSON.parse(raw);
      // Restore the backup as the primary file
      try { fs.copyFileSync(backup, filePath); } catch {}
      return data;
    }
  } catch (e) {
    log.error({ file: path.basename(backup), err: e }, 'Backup also corrupt');
  }

  return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
}

/**
 * Auto-pruning Map that cleans stale entries periodically.
 * Prevents unbounded memory growth from cooldown/timestamp Maps.
 */
class PrunedMap {
  constructor(pruneIntervalMs = 3600000, maxAgeMs = 86400000) {
    this.map = new Map();
    this.maxAge = maxAgeMs;
    this._interval = setInterval(() => this.prune(), pruneIntervalMs);
  }

  set(key, value) { this.map.set(key, value); }
  get(key) { return this.map.get(key); }
  has(key) { return this.map.has(key); }
  delete(key) { return this.map.delete(key); }
  get size() { return this.map.size; }

  /** Check if a timestamp-based entry is still within cooldown */
  isOnCooldown(key, cooldownMs) {
    const ts = this.map.get(key);
    if (!ts) return false;
    return (Date.now() - ts) < cooldownMs;
  }

  /** Set the current timestamp for a key */
  touch(key) { this.map.set(key, Date.now()); }

  prune() {
    const cutoff = Date.now() - this.maxAge;
    for (const [key, val] of this.map) {
      if (typeof val === 'number' && val < cutoff) this.map.delete(key);
    }
  }

  destroy() {
    clearInterval(this._interval);
    this.map.clear();
  }
}

module.exports = { safeWriteJSON, safeReadJSON, PrunedMap };
