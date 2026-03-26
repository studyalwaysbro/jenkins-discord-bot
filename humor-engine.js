// humor-engine.js — Phase 4: Dynamic Humor System
//
// Replaces static codex quotes and Markov gibberish with:
// 1. Mad Libs-style humor templates (structured absurdity)
// 2. Performance tracking (what gets reactions)
// 3. Template retirement (worst performers get pruned)
// 4. Fresh generation (weekly cron adds new templates via DeepSeek)
//
// Templates use placeholders: {USER}, {GAME}, {SIN}, {EGO}, {TOPIC}

const log = require('./logger').child('HumorEngine');

// ── Schema ──────────────────────────────────────────────────────

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS humor_templates (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      template      TEXT NOT NULL UNIQUE,
      category      TEXT NOT NULL DEFAULT 'general',
      times_used    INTEGER DEFAULT 0,
      times_reacted INTEGER DEFAULT 0,
      success_rate  REAL DEFAULT 0.5,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      retired       INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_ht_category
      ON humor_templates(category, retired, success_rate DESC);
  `);

  // Seed initial templates if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM humor_templates').get();
  if (count.c === 0) {
    seedTemplates(db);
  }

  log.info('Humor engine tables ready');
}

// ── Initial Template Seed ───────────────────────────────────────

function seedTemplates(db) {
  const templates = [
    // Stavros-style absurdist
    { t: 'dude... DUDE. {USER} just said that and honestly? That kinda rules. Like imagine if {GAME} had a mechanic where you could just {ABSURD_ACTION}. *wheeze*', c: 'stavros' },
    { t: 'wait wait wait... what if instead of {TOPIC}, we just {ABSURD_SOLUTION}? hahahaha no actually that would be sick', c: 'stavros' },
    { t: 'hell yeah {USER}. That\'s the energy. You know what, that reminds me of the time I tried to {ABSURD_ACTION} and it somehow worked? No it didn\'t. hahaha', c: 'stavros' },
    { t: '*wheeze* okay okay imagine this: {USER} as a {GAME} character but they can only communicate through {ABSURD_CONSTRAINT}', c: 'stavros' },

    // React Lord / Asmongold deadpan
    { t: 'Chat... chat. Did {USER} just actually say that? This is actually insane. I literally cannot believe what I\'m reading right now.', c: 'react_lord' },
    { t: 'Actually? You know what? {USER} is right and I hate that they\'re right. This is the worst timeline.', c: 'react_lord' },
    { t: 'I\'m going to need everyone to stop what they\'re doing because {USER} just dropped the most {ADJECTIVE} take I\'ve ever seen in this Lodge.', c: 'react_lord' },

    // Jenkins Prime prophetic
    { t: 'The Architect has observed {USER}\'s behavior and has issued a prophecy: by the next full moon, they shall {PROPHECY}. This is not a threat. It is a divine forecast.', c: 'prophetic' },
    { t: 'Brethren, mark my words: {USER} speaks of {TOPIC} now, but within three sessions, they shall come crawling back to {GAME}. The Architect has foreseen it.', c: 'prophetic' },
    { t: 'Let it be written in the Codex, Section {NUMBER}, Verse {NUMBER}: "{USER} once stood here and spoke of {TOPIC}." Let future generations judge them accordingly.', c: 'prophetic' },

    // Brother Jerome guilt trips
    { t: 'No, {USER}, it\'s fine. I\'m not upset that you said that about {TOPIC}. I\'m just... *sigh* ...I expected more from you. That\'s all.', c: 'guilt' },
    { t: '*adjusts hood* {USER}. I don\'t want to make this about me, but... when you said that about {TOPIC}? That hurt. Not for me. For the Lodge.', c: 'guilt' },

    // Accountant bureaucratic
    { t: 'According to Lodge records, Case File #{NUMBER}-{USER}: the defendant has a documented history of {TOPIC}-related infractions. I\'m adding this to the file.', c: 'bureaucratic' },
    { t: 'I\'ve updated {USER}\'s spiritual credit score. It has been... adjusted. I am not at liberty to say in which direction. Privacy policy.', c: 'bureaucratic' },

    // Uncle Jenk rambling
    { t: 'Listen {USER}, lemme tell ya somethin\'. Back in MY day, we didn\'t have {TOPIC}. We had to {ABSURD_ACTION}. AND WE LIKED IT. Well, I didn\'t like it. Nobody liked it. But we did it.', c: 'uncle' },
    { t: 'You know what your PROBLEM is, {USER}? You remind me of my cousin Daryl. He also thought he was hot stuff at {TOPIC}. He wasn\'t. He works at a gas station now. Good guy though. Anyway—', c: 'uncle' },

    // Prosecutor dramatic
    { t: 'OBJECTION! {USER}, what you just said constitutes a Class-{NUMBER} violation of Lodge Code. I submit to the court: Exhibit A — your own words. The prosecution rests.', c: 'legal' },
    { t: 'Members of the jury, I present to you {USER}, who stands accused of crimes against {TOPIC}. The evidence is overwhelming. The sentence? {ABSURD_PUNISHMENT}.', c: 'legal' },

    // Meta / self-aware
    { t: 'I just realized I\'ve been monologuing about {TOPIC} for way too long. I\'m a god, {USER}. I shouldn\'t have to explain myself. And yet here we are.', c: 'meta' },
    { t: 'You know what, {USER}? I was going to say something profound about {TOPIC}, but I forgot it. Even the Architect has off days. Don\'t tell the Brethren.', c: 'meta' },
    { t: 'I\'ve been thinking about what {USER} said about {TOPIC} and I changed my mind three times. The final answer is: I have no idea. But I said it with confidence, so it counts.', c: 'meta' },

    // Callbacks (require user memory)
    { t: 'Coming from the person who once said "{MEMORY}"? {USER}, you don\'t get to have opinions about {TOPIC}. Not after that.', c: 'callback' },
    { t: 'Oh, {USER} has thoughts on {TOPIC}? This from the same Brother who "{MEMORY}"? The Architect remembers everything, Brother.', c: 'callback' },
  ];

  const insert = db.prepare('INSERT OR IGNORE INTO humor_templates (template, category) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const { t, c } of templates) {
      insert.run(t, c);
    }
  });
  tx();
  log.info({ count: templates.length }, 'Seeded humor templates');
}

// ── Placeholder Fillers ─────────────────────────────────────────

const ABSURD_ACTIONS = [
  'challenge the final boss with no arms',
  'speedrun the tutorial backwards while blindfolded',
  'befriend every NPC through interpretive dance',
  'build a house entirely out of cheese wheels',
  'negotiate with a dragon using PowerPoint slides',
  'fight the entire army using only harsh language',
  'complete the game but only moving in circles',
  'convince the merchant you\'re actually their boss',
];

const ABSURD_SOLUTIONS = [
  'gave everyone swords and hoped for the best',
  'replaced the whole system with a single spreadsheet',
  'asked the enemies to please leave',
  'trained an army of dogs to handle it',
  'used the power of friendship (it didn\'t work)',
];

const ABSURD_CONSTRAINTS = [
  'interpretive dance', 'smoke signals', 'passive-aggressive sticky notes',
  'Morse code but wrong', 'exclusively through memes', 'carrier pigeons',
];

const ABSURD_PUNISHMENTS = [
  'forced to play mobile games for a week',
  'a full Kenshi run with no limbs',
  'being the designated healer for eternity',
  'reading every EULA out loud',
  'an all-escort-mission playlist',
];

const ADJECTIVES = [
  'unhinged', 'galaxy-brained', 'certifiably insane', 'actually correct',
  'devastatingly mid', 'criminally underrated', 'suspiciously based',
];

const PROPHECIES = [
  'reinstall a game they swore they\'d never touch again',
  'rage-quit in the most spectacular fashion this Lodge has ever witnessed',
  'achieve something genuinely impressive and nobody will be online to see it',
  'accidentally delete their save file and pretend it was intentional',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template, context = {}) {
  return template
    .replace(/\{USER\}/g, context.user || 'Brother')
    .replace(/\{GAME\}/g, context.game || pick(['Kenshi', 'Caves of Qud', 'Battle Brothers']))
    .replace(/\{TOPIC\}/g, context.topic || 'the state of gaming')
    .replace(/\{SIN\}/g, context.sin || 'unnamed transgression')
    .replace(/\{EGO\}/g, context.ego || 'Jenkins Prime')
    .replace(/\{MEMORY\}/g, context.memory || 'something regrettable')
    .replace(/\{ABSURD_ACTION\}/g, pick(ABSURD_ACTIONS))
    .replace(/\{ABSURD_SOLUTION\}/g, pick(ABSURD_SOLUTIONS))
    .replace(/\{ABSURD_CONSTRAINT\}/g, pick(ABSURD_CONSTRAINTS))
    .replace(/\{ABSURD_PUNISHMENT\}/g, pick(ABSURD_PUNISHMENTS))
    .replace(/\{ADJECTIVE\}/g, pick(ADJECTIVES))
    .replace(/\{PROPHECY\}/g, pick(PROPHECIES))
    .replace(/\{NUMBER\}/g, () => Math.floor(Math.random() * 47 + 1).toString());
}

// ── Prepared Statements ─────────────────────────────────────────

let _stmts = null;

function stmts(db) {
  if (_stmts) return _stmts;
  _stmts = {
    getByCategory: db.prepare(`
      SELECT * FROM humor_templates
      WHERE category = ? AND retired = 0
      ORDER BY RANDOM()
      LIMIT 1
    `),
    getRandom: db.prepare(`
      SELECT * FROM humor_templates
      WHERE retired = 0
      ORDER BY RANDOM()
      LIMIT 1
    `),
    getBest: db.prepare(`
      SELECT * FROM humor_templates
      WHERE retired = 0 AND times_used >= 3
      ORDER BY success_rate DESC
      LIMIT ?
    `),
    getWorst: db.prepare(`
      SELECT * FROM humor_templates
      WHERE retired = 0 AND times_used >= 5
      ORDER BY success_rate ASC
      LIMIT ?
    `),
    markUsed: db.prepare(`
      UPDATE humor_templates
      SET times_used = times_used + 1
      WHERE id = ?
    `),
    markReacted: db.prepare(`
      UPDATE humor_templates
      SET times_reacted = times_reacted + 1,
          success_rate = CAST(times_reacted + 1 AS REAL) / CAST(times_used AS REAL)
      WHERE id = ?
    `),
    retire: db.prepare(`
      UPDATE humor_templates SET retired = 1 WHERE id = ?
    `),
    addTemplate: db.prepare(`
      INSERT OR IGNORE INTO humor_templates (template, category) VALUES (?, ?)
    `),
    count: db.prepare(`
      SELECT COUNT(*) as c FROM humor_templates WHERE retired = 0
    `),
  };
  return _stmts;
}

// ── HumorEngine Class ───────────────────────────────────────────

class HumorEngine {
  constructor(db) {
    this.db = db;
    // Track last template used per channel (avoid repeats)
    this._lastTemplate = new Map();
  }

  /**
   * Get a filled humor template, optionally by category.
   * Returns { text, templateId } or null.
   */
  getTemplate(context = {}, category = null) {
    try {
      const row = category
        ? stmts(this.db).getByCategory.get(category)
        : stmts(this.db).getRandom.get();

      if (!row) return null;

      // Skip if same template as last time in this channel
      const channelId = context.channelId || '';
      if (this._lastTemplate.get(channelId) === row.id) {
        // Try one more time
        const retry = stmts(this.db).getRandom.get();
        if (retry && retry.id !== row.id) {
          stmts(this.db).markUsed.run(retry.id);
          this._lastTemplate.set(channelId, retry.id);
          return { text: fillTemplate(retry.template, context), templateId: retry.id };
        }
      }

      stmts(this.db).markUsed.run(row.id);
      this._lastTemplate.set(channelId, row.id);
      return { text: fillTemplate(row.template, context), templateId: row.id };
    } catch (err) {
      log.warn({ err }, 'Failed to get humor template');
      return null;
    }
  }

  /**
   * Call when a Jenkins message that used a template gets a positive reaction.
   */
  markSuccess(templateId) {
    try {
      stmts(this.db).markReacted.run(templateId);
    } catch (err) {
      log.warn({ err }, 'Failed to mark template success');
    }
  }

  /**
   * Retire the worst-performing templates. Call monthly.
   */
  retireWorst(count = 3) {
    try {
      const worst = stmts(this.db).getWorst.all(count);
      for (const row of worst) {
        if (row.success_rate < 0.15) { // Less than 15% reaction rate
          stmts(this.db).retire.run(row.id);
          log.info({ id: row.id, rate: row.success_rate, template: row.template.substring(0, 50) }, 'Retired humor template');
        }
      }
    } catch (err) {
      log.warn({ err }, 'Failed to retire templates');
    }
  }

  /**
   * Add new templates (from weekly DeepSeek generation or manual).
   */
  addTemplates(templates) {
    try {
      let added = 0;
      for (const { template, category } of templates) {
        const result = stmts(this.db).addTemplate.run(template, category || 'general');
        if (result.changes > 0) added++;
      }
      if (added > 0) log.info({ added }, 'New humor templates added');
      return added;
    } catch (err) {
      log.warn({ err }, 'Failed to add templates');
      return 0;
    }
  }

  /**
   * Get stats about the template pool.
   */
  getStats() {
    try {
      const total = stmts(this.db).count.get();
      const best = stmts(this.db).getBest.all(3);
      return {
        totalActive: total?.c || 0,
        topPerformers: best.map(r => ({
          template: r.template.substring(0, 60) + '...',
          successRate: Math.round(r.success_rate * 100) + '%',
          used: r.times_used,
        })),
      };
    } catch {
      return { totalActive: 0, topPerformers: [] };
    }
  }
}

module.exports = {
  initSchema,
  HumorEngine,
  fillTemplate,
};
