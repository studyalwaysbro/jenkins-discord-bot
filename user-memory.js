// user-memory.js — Phase 3: Jenkins Remembers
//
// Stores notable moments, user traits, and comedic ammunition.
// Jenkins can reference past interactions naturally ("Last time you said...").
//
// Memory types:
//   - self_own: user said something embarrassing or contradictory
//   - hot_take: strong opinion Jenkins can reference later
//   - preference: game/topic preferences
//   - achievement: notable moments (big wins, epic fails)
//   - tagline: auto-generated user title ("The Chronic Alt-Tabber")
//
// Privacy: !forgetme wipes all memories. Auto-purge after 90 days.

const log = require('./logger').child('UserMemory');

const MEMORY_TYPES = ['self_own', 'hot_take', 'preference', 'achievement', 'tagline'];
const MAX_MEMORIES_PER_USER = 20;
const PURGE_DAYS = 90;
const MAX_INJECT_MEMORIES = 3; // How many memories to inject into prompt

// ── Schema ──────────────────────────────────────────────────────

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_memories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      username    TEXT,
      memory_text TEXT NOT NULL,
      memory_type TEXT NOT NULL DEFAULT 'hot_take',
      confidence  INTEGER DEFAULT 1,
      times_used  INTEGER DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      last_used   INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_um_user
      ON user_memories(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_taglines (
      user_id     TEXT PRIMARY KEY,
      username    TEXT,
      tagline     TEXT NOT NULL,
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  log.info('User memory tables ready');
}

// ── Detection: What's worth remembering? ────────────────────────

// Patterns that signal something memorable
const MEMORY_SIGNALS = {
  self_own: [
    /i (actually|honestly|genuinely) (like|enjoy|play|love)\s+.{5,}/i,  // Confessions
    /unpopular opinion/i,
    /don't judge me/i,
    /i know .{3,} sucks? but/i,
    /i (used to|once|accidentally)\s+.{10,}/i,  // Stories
  ],
  hot_take: [
    /\b(best|worst|greatest|most overrated|most underrated)\b.{5,}/i,
    /\b(is better than|is worse than|beats|destroys|>)\b/i,
    /\b(should be|needs to be|has to)\b.{5,}/i,
    /\b(hot take|controversial|fight me)\b/i,
    /[A-Z]{3,}.{0,5}(is|are)\s+(trash|garbage|goat|peak|mid|ass)/i,  // CAPS + opinion
  ],
  preference: [
    /\b(my favorite|i main|i always pick|i prefer|i'm a .{3,} (guy|girl|person|player))\b/i,
    /\b(love|hate|can't stand|obsessed with|addicted to)\b\s+.{3,}/i,
  ],
  achievement: [
    /\b(finally|just (beat|finished|completed|100%|cleared))\b.{5,}/i,
    /\b(first time|first ever|new record|personal best)\b/i,
    /\b(won|lost|defeated|destroyed|carried|clutched)\b.{5,}/i,
  ],
};

/**
 * Analyze a message to determine if it contains something memorable.
 * Returns { type, text } or null.
 */
function detectMemory(content, username) {
  if (!content || content.length < 15) return null;
  if (content.startsWith('!')) return null; // Skip commands

  for (const [type, patterns] of Object.entries(MEMORY_SIGNALS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        // Extract a concise summary (max 200 chars)
        const summary = content.length > 200
          ? content.substring(0, 197) + '...'
          : content;
        return { type, text: summary };
      }
    }
  }

  // High-conviction signals: ALL CAPS (passion), long message + exclamation marks
  if (/[A-Z]{5,}/.test(content) && content.length > 30) {
    return { type: 'hot_take', text: content.substring(0, 200) };
  }

  return null;
}

// ── Tagline generation ──────────────────────────────────────────

const TAGLINE_TEMPLATES = {
  // Based on sin patterns
  high_venial: [
    'The Perpetual Whiner', 'The Chronically Unimpressed', 'The Lodge Skeptic',
    'The Background Grumbler', 'The Professional Eye-Roller',
  ],
  high_mortal: [
    'The Heretic', 'The Blasphemer-in-Chief', 'The Walking Mortal Sin',
    'The Covenant Tester', 'The Architect\'s Migraine',
  ],
  high_positive: [
    'The Faithful', 'The True Believer', 'The Lodge Champion',
    'Jenkins\' Favorite', 'The Chosen Brother',
  ],
  // Based on preferences
  kenshi_fan: ['The Limbless Wanderer', 'The Beep Disciple', 'Kenshi Enjoyer'],
  qud_fan: ['The Mutant Scholar', 'Qud Spelunker', 'The Cave Dweller'],
  bb_fan: ['The Tactical Genius', 'Brother of the Banner', 'The Mercenary'],
  // Generic
  generic: [
    'The Enigma', 'The Lurker', 'The Unknown Quantity', 'The New Blood',
    'The Silent Observer',
  ],
};

// ── Prepared Statements ─────────────────────────────────────────

let _stmts = null;

function stmts(db) {
  if (_stmts) return _stmts;
  _stmts = {
    addMemory: db.prepare(`
      INSERT INTO user_memories (user_id, username, memory_text, memory_type)
      VALUES (?, ?, ?, ?)
    `),
    getUserMemories: db.prepare(`
      SELECT * FROM user_memories
      WHERE user_id = ?
      ORDER BY confidence DESC, created_at DESC
      LIMIT ?
    `),
    getRecentMemories: db.prepare(`
      SELECT * FROM user_memories
      WHERE user_id = ? AND created_at > unixepoch() - ?
      ORDER BY created_at DESC
      LIMIT ?
    `),
    countUserMemories: db.prepare(`
      SELECT COUNT(*) as count FROM user_memories WHERE user_id = ?
    `),
    markUsed: db.prepare(`
      UPDATE user_memories SET times_used = times_used + 1, last_used = unixepoch()
      WHERE id = ?
    `),
    deleteUserMemories: db.prepare(`
      DELETE FROM user_memories WHERE user_id = ?
    `),
    pruneOld: db.prepare(`
      DELETE FROM user_memories WHERE created_at < unixepoch() - ?
    `),
    pruneExcess: db.prepare(`
      DELETE FROM user_memories WHERE id IN (
        SELECT id FROM user_memories WHERE user_id = ?
        ORDER BY confidence ASC, created_at ASC
        LIMIT max(0, (SELECT COUNT(*) FROM user_memories WHERE user_id = ?) - ?)
      )
    `),
    isDuplicate: db.prepare(`
      SELECT id FROM user_memories
      WHERE user_id = ? AND memory_text = ?
      LIMIT 1
    `),
    getTagline: db.prepare(`
      SELECT tagline FROM user_taglines WHERE user_id = ?
    `),
    setTagline: db.prepare(`
      INSERT INTO user_taglines (user_id, username, tagline, updated_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET tagline = excluded.tagline, username = excluded.username, updated_at = unixepoch()
    `),
    deleteTagline: db.prepare(`
      DELETE FROM user_taglines WHERE user_id = ?
    `),
  };
  return _stmts;
}

// ── UserMemory Class ────────────────────────────────────────────

class UserMemory {
  constructor(db) {
    this.db = db;
  }

  /**
   * Process a message — detect and store anything memorable.
   * Call this on every message in Jenkins' channel.
   */
  processMessage(userId, username, content) {
    const detected = detectMemory(content, username);
    if (!detected) return null;

    try {
      // Check for duplicate
      const existing = stmts(this.db).isDuplicate.get(userId, detected.text);
      if (existing) return null;

      // Prune excess if needed
      const count = stmts(this.db).countUserMemories.get(userId);
      if (count && count.count >= MAX_MEMORIES_PER_USER) {
        stmts(this.db).pruneExcess.run(userId, userId, MAX_MEMORIES_PER_USER - 1);
      }

      stmts(this.db).addMemory.run(userId, username, detected.text, detected.type);
      log.info({ userId, username, type: detected.type, preview: detected.text.substring(0, 50) }, 'Memory stored');
      return detected;
    } catch (err) {
      log.warn({ err, userId }, 'Failed to store memory');
      return null;
    }
  }

  /**
   * Get memories to inject into the system prompt for a user.
   * Returns a prompt fragment or empty string.
   */
  getPromptInjection(userId, username) {
    try {
      const memories = stmts(this.db).getUserMemories.all(userId, MAX_INJECT_MEMORIES);
      if (!memories || memories.length === 0) return '';

      const taglineRow = stmts(this.db).getTagline.get(userId);
      const tagline = taglineRow?.tagline || '';

      let injection = `\n\n[USER MEMORY — ${username}`;
      if (tagline) injection += ` aka "${tagline}"`;
      injection += `]\nYou remember these things about this Brother:`;

      for (const mem of memories) {
        const age = Math.round((Date.now() / 1000 - mem.created_at) / 86400);
        const ageStr = age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age}d ago`;
        injection += `\n- (${mem.memory_type}, ${ageStr}) "${mem.memory_text}"`;

        // Mark as used
        stmts(this.db).markUsed.run(mem.id);
      }

      injection += `\nYou can reference these naturally — callbacks, roasts, inside jokes. Don't force it. Only bring up a memory if it's relevant to what they just said. Never list them out or make it obvious you're reading from a file.`;

      return injection;
    } catch (err) {
      log.warn({ err, userId }, 'Failed to get memory injection');
      return '';
    }
  }

  /**
   * Set a tagline for a user (auto-generated or manual).
   */
  setTagline(userId, username, tagline) {
    try {
      stmts(this.db).setTagline.run(userId, username, tagline);
      log.info({ userId, tagline }, 'Tagline set');
    } catch (err) {
      log.warn({ err }, 'Failed to set tagline');
    }
  }

  /**
   * Get a user's tagline.
   */
  getTagline(userId) {
    try {
      return stmts(this.db).getTagline.get(userId)?.tagline || null;
    } catch {
      return null;
    }
  }

  /**
   * Auto-generate a tagline based on sin patterns and memories.
   */
  generateTagline(userId, sinData) {
    const memories = stmts(this.db).getUserMemories.all(userId, 50);

    // Check for game preferences in memories
    const allText = memories.map(m => m.memory_text).join(' ').toLowerCase();
    if (/kenshi|beep|limbless/.test(allText)) {
      return TAGLINE_TEMPLATES.kenshi_fan[Math.floor(Math.random() * TAGLINE_TEMPLATES.kenshi_fan.length)];
    }
    if (/caves of qud|qud|mutant/.test(allText)) {
      return TAGLINE_TEMPLATES.qud_fan[Math.floor(Math.random() * TAGLINE_TEMPLATES.qud_fan.length)];
    }
    if (/battle brothers|bb|mercenary|banner/.test(allText)) {
      return TAGLINE_TEMPLATES.bb_fan[Math.floor(Math.random() * TAGLINE_TEMPLATES.bb_fan.length)];
    }

    // Sin-based taglines
    if (sinData) {
      const totalMortal = sinData.mortal || 0;
      const totalVenial = sinData.venial || 0;
      const positive = sinData.positiveInteractions || 0;

      if (totalMortal >= 5) {
        return TAGLINE_TEMPLATES.high_mortal[Math.floor(Math.random() * TAGLINE_TEMPLATES.high_mortal.length)];
      }
      if (totalVenial >= 10) {
        return TAGLINE_TEMPLATES.high_venial[Math.floor(Math.random() * TAGLINE_TEMPLATES.high_venial.length)];
      }
      if (positive >= 10) {
        return TAGLINE_TEMPLATES.high_positive[Math.floor(Math.random() * TAGLINE_TEMPLATES.high_positive.length)];
      }
    }

    return TAGLINE_TEMPLATES.generic[Math.floor(Math.random() * TAGLINE_TEMPLATES.generic.length)];
  }

  /**
   * Forget everything about a user (!forgetme).
   */
  forgetUser(userId) {
    try {
      stmts(this.db).deleteUserMemories.run(userId);
      stmts(this.db).deleteTagline.run(userId);
      log.info({ userId }, 'User memories purged');
      return true;
    } catch (err) {
      log.warn({ err }, 'Failed to forget user');
      return false;
    }
  }

  /**
   * Run maintenance: purge old memories.
   */
  purgeOldMemories() {
    try {
      const result = stmts(this.db).pruneOld.run(PURGE_DAYS * 86400);
      if (result.changes > 0) {
        log.info({ purged: result.changes }, 'Old memories purged');
      }
    } catch (err) {
      log.warn({ err }, 'Failed to purge old memories');
    }
  }
}

module.exports = {
  initSchema,
  UserMemory,
  detectMemory,
};
