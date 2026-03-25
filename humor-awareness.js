// humor-awareness.js — Phase 1: Make Jenkins self-aware about his humor
//
// Three systems:
// 1. Reaction Tracker: logs emoji reactions on Jenkins' messages in SQLite
// 2. Listening Mode: after 2 long responses in 5 min, go brief
// 3. Humor Adapter: detects cold streaks and adjusts behavior
//
// All state persists in SQLite via dedicated tables (not the JSON store).

const log = require('./logger').child('HumorAwareness');

// ── Schema (called once at startup) ─────────────────────────────

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jenkins_messages (
      message_id    TEXT PRIMARY KEY,
      channel_id    TEXT NOT NULL,
      guild_id      TEXT,
      alter_ego     TEXT DEFAULT 'Jenkins Prime',
      content_len   INTEGER DEFAULT 0,
      positive_rxns INTEGER DEFAULT 0,
      negative_rxns INTEGER DEFAULT 0,
      total_rxns    INTEGER DEFAULT 0,
      reaction_json TEXT DEFAULT '{}',
      created_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_jm_channel_time
      ON jenkins_messages(channel_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_jm_ego_time
      ON jenkins_messages(alter_ego, created_at DESC);
  `);
  log.info('Humor awareness tables ready');
}

// ── Reaction classification ─────────────────────────────────────

const POSITIVE_REACTIONS = new Set([
  '😂', '🤣', '💀', '😭', '🔥', '👍', '❤️', '💯', '⭐', '🙌',
  '👏', '🫡', '💪', 'KEKW', 'PogChamp', 'based', 'W',
  '😆', '🤙', '💜', '🧠', '👑', '✅',
]);

const NEGATIVE_REACTIONS = new Set([
  '😒', '👎', '🙄', '😐', '💤', '🤡', '❌', '🗑️', 'L', 'cringe',
  '😬', '🥱',
]);

function classifyReaction(emojiName) {
  if (POSITIVE_REACTIONS.has(emojiName)) return 'positive';
  if (NEGATIVE_REACTIONS.has(emojiName)) return 'negative';
  return 'neutral';
}

// ── Prepared statements (lazy-init) ─────────────────────────────

let _stmts = null;

function stmts(db) {
  if (_stmts) return _stmts;
  _stmts = {
    insertMsg: db.prepare(`
      INSERT OR IGNORE INTO jenkins_messages
        (message_id, channel_id, guild_id, alter_ego, content_len, created_at)
      VALUES (?, ?, ?, ?, ?, unixepoch())
    `),
    getMsg: db.prepare(`SELECT * FROM jenkins_messages WHERE message_id = ?`),
    updateReactions: db.prepare(`
      UPDATE jenkins_messages
      SET positive_rxns = ?, negative_rxns = ?, total_rxns = ?, reaction_json = ?
      WHERE message_id = ?
    `),
    recentInChannel: db.prepare(`
      SELECT * FROM jenkins_messages
      WHERE channel_id = ? AND created_at > unixepoch() - ?
      ORDER BY created_at DESC
      LIMIT ?
    `),
    recentByEgo: db.prepare(`
      SELECT alter_ego, AVG(positive_rxns) as avg_positive, COUNT(*) as count
      FROM jenkins_messages
      WHERE created_at > unixepoch() - 86400
      GROUP BY alter_ego
      HAVING count >= 3
      ORDER BY avg_positive DESC
    `),
    coldStreak: db.prepare(`
      SELECT COUNT(*) as cold_count FROM (
        SELECT message_id FROM jenkins_messages
        WHERE channel_id = ? AND created_at > unixepoch() - 1800
        ORDER BY created_at DESC LIMIT 3
      ) sub
      LEFT JOIN jenkins_messages jm ON sub.message_id = jm.message_id
      WHERE jm.total_rxns = 0
    `),
    lastEgo: db.prepare(`
      SELECT alter_ego FROM jenkins_messages
      WHERE channel_id = ?
      ORDER BY created_at DESC LIMIT 1
    `),
  };
  return _stmts;
}

// ── Reaction Tracker ────────────────────────────────────────────

class ReactionTracker {
  constructor(db) {
    this.db = db;
  }

  /** Call after Jenkins sends a message. Registers it for tracking. */
  trackMessage(messageId, channelId, guildId, alterEgo, contentLen) {
    try {
      stmts(this.db).insertMsg.run(messageId, channelId, guildId || null, alterEgo || 'Jenkins Prime', contentLen || 0);
    } catch (err) {
      log.warn({ err, messageId }, 'Failed to track message');
    }
  }

  /** Call on messageReactionAdd. Updates counts for Jenkins' messages only. */
  onReactionAdd(messageId, emojiName) {
    try {
      const row = stmts(this.db).getMsg.get(messageId);
      if (!row) return; // Not a Jenkins message

      const reactions = JSON.parse(row.reaction_json || '{}');
      reactions[emojiName] = (reactions[emojiName] || 0) + 1;

      const cls = classifyReaction(emojiName);
      const positive = cls === 'positive' ? row.positive_rxns + 1 : row.positive_rxns;
      const negative = cls === 'negative' ? row.negative_rxns + 1 : row.negative_rxns;

      stmts(this.db).updateReactions.run(positive, negative, row.total_rxns + 1, JSON.stringify(reactions), messageId);
    } catch (err) {
      log.warn({ err, messageId }, 'Failed to update reaction');
    }
  }

  /** Call on messageReactionRemove. Decrements counts. */
  onReactionRemove(messageId, emojiName) {
    try {
      const row = stmts(this.db).getMsg.get(messageId);
      if (!row) return;

      const reactions = JSON.parse(row.reaction_json || '{}');
      if (reactions[emojiName]) {
        reactions[emojiName]--;
        if (reactions[emojiName] <= 0) delete reactions[emojiName];
      }

      const cls = classifyReaction(emojiName);
      const positive = cls === 'positive' ? Math.max(0, row.positive_rxns - 1) : row.positive_rxns;
      const negative = cls === 'negative' ? Math.max(0, row.negative_rxns - 1) : row.negative_rxns;

      stmts(this.db).updateReactions.run(positive, negative, Math.max(0, row.total_rxns - 1), JSON.stringify(reactions), messageId);
    } catch (err) {
      log.warn({ err, messageId }, 'Failed to remove reaction');
    }
  }
}

// ── Listening Mode ──────────────────────────────────────────────

class ListeningMode {
  constructor() {
    // channelId → { longResponses: number, windowStart: timestamp }
    this._channels = new Map();
    this.LONG_THRESHOLD = 200;    // chars — responses longer than this count
    this.MAX_LONG = 2;            // after this many long responses, go brief
    this.WINDOW_MS = 5 * 60_000;  // 5-minute window
  }

  /** Record that Jenkins sent a response in a channel. */
  recordResponse(channelId, contentLen) {
    const now = Date.now();
    let state = this._channels.get(channelId);

    if (!state || now - state.windowStart > this.WINDOW_MS) {
      state = { longResponses: 0, windowStart: now };
      this._channels.set(channelId, state);
    }

    if (contentLen > this.LONG_THRESHOLD) {
      state.longResponses++;
    }
  }

  /** Check if Jenkins should be in listening mode for this channel. */
  isListening(channelId) {
    const state = this._channels.get(channelId);
    if (!state) return false;

    // Window expired — reset
    if (Date.now() - state.windowStart > this.WINDOW_MS) {
      this._channels.delete(channelId);
      return false;
    }

    return state.longResponses >= this.MAX_LONG;
  }

  /** Get a prompt modifier for listening mode. */
  getPromptOverlay() {
    return `\n\n[LISTENING MODE: You've been talking a lot recently. Keep this response VERY brief — one short sentence max. Be punchy, not preachy. A quick quip, a nod, or even just an emoji-worthy reaction. Show you're listening without dominating.]`;
  }
}

// ── Humor Adapter ───────────────────────────────────────────────

class HumorAdapter {
  constructor(db) {
    this.db = db;
  }

  /** Check if the last 3 messages in a channel got zero reactions (cold streak). */
  isOnColdStreak(channelId) {
    try {
      const result = stmts(this.db).coldStreak.get(channelId);
      return result && result.cold_count >= 3;
    } catch {
      return false;
    }
  }

  /** Get the last alter ego used in a channel. */
  getLastEgo(channelId) {
    try {
      const row = stmts(this.db).lastEgo.get(channelId);
      return row?.alter_ego || null;
    } catch {
      return null;
    }
  }

  /** Get ego performance rankings (last 24h). Returns array of { alter_ego, avg_positive, count }. */
  getEgoRankings() {
    try {
      return stmts(this.db).recentByEgo.all();
    } catch {
      return [];
    }
  }

  /** Get a prompt hint for cold streaks. */
  getColdStreakOverlay() {
    return `\n\n[HUMOR CALIBRATION: Your last few messages got zero reactions — the crowd is cold. Switch up your approach completely. Try a different tone, energy level, or angle. If you were being verbose, be terse. If you were being preachy, be absurd. If you were being dramatic, be deadpan. Read the room.]`;
  }

  /** Suggest which ego to avoid and which to try based on recent performance. */
  getEgoGuidance(channelId) {
    const lastEgo = this.getLastEgo(channelId);
    const rankings = this.getEgoRankings();
    const cold = this.isOnColdStreak(channelId);

    return {
      cold,
      avoidEgo: cold ? lastEgo : null,  // Don't repeat what's not working
      bestEgo: rankings.length > 0 ? rankings[0].alter_ego : null,
      rankings,
    };
  }
}

// ── Export ───────────────────────────────────────────────────────

module.exports = {
  initSchema,
  ReactionTracker,
  ListeningMode,
  HumorAdapter,
  classifyReaction,
};
