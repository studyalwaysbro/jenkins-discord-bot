// db.js — SQLite persistence layer for Jenkins
// Replaces 9 separate JSON files with a single WAL-mode SQLite database.
// Provides drop-in replacements for safeReadJSON/safeWriteJSON.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const log = require('./logger').child('DB');

const DB_PATH = path.join(__dirname, 'data', 'jenkins.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// --- Open database ---
const db = new Database(DB_PATH);

// WAL mode for concurrent reads + crash safety
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// --- Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS json_store (
    key   TEXT PRIMARY KEY,
    data  TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

log.info({ path: DB_PATH }, 'SQLite database open (WAL mode)');

// --- Prepared statements ---
const stmtRead = db.prepare('SELECT data FROM json_store WHERE key = ?');
const stmtWrite = db.prepare(`
  INSERT INTO json_store (key, data, updated_at) VALUES (?, ?, unixepoch())
  ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = unixepoch()
`);

// --- Public API ---

/**
 * Read a JSON value from the store.
 * Drop-in replacement for safeReadJSON(filePath, defaultValue).
 * @param {string} key - Store key (e.g. 'economy', 'sins', 'mood')
 * @param {*} defaultValue - Default if key doesn't exist (value or function)
 * @returns {*} Parsed JSON data
 */
function dbRead(key, defaultValue) {
  const row = stmtRead.get(key);
  if (row) {
    try {
      return JSON.parse(row.data);
    } catch (err) {
      log.warn({ key, err }, 'Corrupt JSON in store, returning default');
    }
  }
  return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
}

/**
 * Write a JSON value to the store.
 * Drop-in replacement for safeWriteJSON(filePath, data).
 * @param {string} key - Store key
 * @param {*} data - Data to serialize
 */
function dbWrite(key, data) {
  stmtWrite.run(key, JSON.stringify(data));
}

// --- JSON file migration ---

/**
 * Migrate a JSON file into the SQLite store if the key doesn't already exist.
 * After successful migration, renames the JSON file to .migrated.
 * @param {string} key - Store key
 * @param {string} jsonPath - Path to the JSON file
 * @param {*} defaultValue - Default if file doesn't exist
 */
function migrateFromJSON(key, jsonPath, defaultValue) {
  // Skip if already in SQLite
  if (stmtRead.get(key)) return;

  // Try to read the JSON file
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data = JSON.parse(raw);
      dbWrite(key, data);
      // Rename to .migrated so it's not re-imported
      fs.renameSync(jsonPath, jsonPath + '.migrated');
      log.info({ key, file: path.basename(jsonPath) }, 'Migrated JSON to SQLite');
      return;
    } catch (err) {
      log.warn({ key, err }, 'Failed to migrate JSON file, using default');
    }
  }

  // Also check .bak file (safe-write backup)
  const bakPath = jsonPath + '.bak';
  if (fs.existsSync(bakPath)) {
    try {
      const raw = fs.readFileSync(bakPath, 'utf8');
      const data = JSON.parse(raw);
      dbWrite(key, data);
      fs.renameSync(bakPath, bakPath + '.migrated');
      log.info({ key, file: path.basename(bakPath) }, 'Migrated JSON backup to SQLite');
      return;
    } catch (err) {
      log.warn({ key, err }, 'Failed to migrate backup JSON');
    }
  }

  // No file found — write default
  const val = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  dbWrite(key, val);
  log.info({ key }, 'Initialized with default data');
}

// --- Run all migrations ---
const MIGRATIONS = [
  { key: 'economy',       file: 'data/economy.json',       default: {} },
  { key: 'sins',          file: 'sin-ledger.json',         default: {} },
  { key: 'predictions',   file: 'data/predictions.json',   default: { markets: [], idCounter: 0, history: [] } },
  { key: 'game_nights',   file: 'data/game-nights.json',   default: { upcoming: [], history: [], idCounter: 0 } },
  { key: 'starboard',     file: 'data/starboard.json',     default: { starred: {} } },
  { key: 'sermons',       file: 'data/sermons.json',       default: { sermons: [], idCounter: 0, globalHourStart: 0, globalCount: 0 } },
  { key: 'dreams',        file: 'data/dreams.json',        default: { dreams: [], idCounter: 0, lastDreamDate: null } },
  { key: 'mood',          file: 'data/mood.json',          default: null }, // null = let module use its own default
  { key: 'sound_effects', file: 'data/sound-effects.json', default: { playCount: {}, totalPlays: 0, lastPrewarm: null } },
];

for (const m of MIGRATIONS) {
  const jsonPath = path.join(__dirname, m.file);
  migrateFromJSON(m.key, jsonPath, m.default);
}

// --- Cleanup on process exit ---
function close() {
  try {
    db.close();
    log.info('SQLite connection closed');
  } catch {}
}

process.on('exit', close);
process.on('SIGINT', close);
process.on('SIGTERM', close);

module.exports = { db, dbRead, dbWrite, DB_PATH };
