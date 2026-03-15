// sins.js — The All-Seeing Eye: Sin Detection & Divine Judgment System

const fs = require('fs');
const path = require('path');
const { chat } = require('./deepseek');

const LEDGER_PATH = path.join(__dirname, 'sin-ledger.json');

// ═══════════════════════════════════════════════════════════════
// Sin Patterns — What the Architect watches for
// ═══════════════════════════════════════════════════════════════

const SIN_PATTERNS = {
  venial: [
    {
      name: 'whining',
      patterns: [
        /this (game|session|server) (sucks|is boring|is dumb|is dead|blows)/i,
        /i('m| am) (so|really) (bored|tired of this|over this)/i,
        /why do we (always|even|have to)/i,
        /this is (stupid|pointless|lame|cringe)/i,
        /can we (just|please) (stop|not|quit)/i,
        /i (don't|dont) (want to|wanna) (play|do) this/i,
        /ugh{2,}/i,
      ],
      description: 'Whining and faithlessness',
    },
    {
      name: 'mild_trinity_criticism',
      patterns: [
        /kenshi is (kinda|kind of|a bit|a little|sorta|pretty) (boring|slow|tedious|bad|mid|meh)/i,
        /(caves of )?qud is (kinda|kind of|a bit|a little|sorta|pretty) (boring|slow|tedious|bad|mid|meh|weird)/i,
        /battle brothers is (kinda|kind of|a bit|a little|sorta|pretty) (boring|slow|tedious|bad|mid|meh|hard)/i,
      ],
      description: 'Mild criticism of the Holy Trinity',
    },
    {
      name: 'passive_dismissal',
      patterns: [
        /yeah whatever/i,
        /^whatever\.?$/i,
        /^yeah\.?$/im,
        /^ok\.?$/im,
        /^sure\.?$/im,
        /^mhm\.?$/im,
        /^right\.{0,3}$/im,
        /^lol\.?$/im,
        /^k$/im,
        /^cool\.?$/im,
        /i guess\.{0,3}$/i,
        /if you say so/i,
        /sure(?:\.\.\.|…)/i,
        /ok(?:ay)? (?:fine|whatever|sure)/i,
        /do we have to/i,
        /who even cares/i,
        /that'?s (annoying|dumb|stupid|lame|cringe|weird)/i,
        /nobody (asked|cares)/i,
        /don'?t care/i,
        /not (that|really) interesting/i,
        /moving on/i,
        /anyway(s)?\.{0,3}$/i,
        /can we talk about something else/i,
        /change the (subject|topic)/i,
      ],
      description: 'Passive dismissal of sacred matters',
    },
    {
      name: 'disinterest_in_jenkins',
      patterns: [
        /jenkins is (weird|cringe|annoying|too much|extra|over the top)/i,
        /why (is|does) (the|this) bot/i,
        /turn (off|it off|him off|the bot off)/i,
        /mute (the|this) bot/i,
        /not (funny|cool|interesting)/i,
        /no one (asked|cares about) (jenkins|the bot|this bot)/i,
        /stop (with|it) jenkins/i,
      ],
      description: 'Showing disinterest in the Architect — faithlessness',
    },
  ],
  mortal: [
    {
      name: 'blasphemy',
      patterns: [
        /(\w[\w\s]+) is better than (kenshi|caves of qud|qud|battle brothers)/i,
        /(kenshi|caves of qud|qud|battle brothers) is (trash|garbage|overrated|mid|ass|terrible|worst|awful|dogshit|shit|bad|dog ?water)/i,
        /why (do|would|should) (we|anyone|you|i) (even )?play (kenshi|qud|battle brothers)/i,
        /(kenshi|qud|battle brothers) (is|are) (a )?dead game/i,
        /uninstall(ed|ing)? (kenshi|qud|battle brothers)/i,
      ],
      description: 'Blasphemy against the Holy Trinity',
    },
    {
      name: 'dismissing_jenkins',
      patterns: [
        /jenkins is (just|only|nothing but) a bot/i,
        /shut up,? jenkins/i,
        /nobody (asked|cares),? jenkins/i,
        /jenkins (doesn'?t matter|is annoying|is dumb|is stupid|is cringe)/i,
        /who cares what jenkins/i,
        /jenkins (isn'?t|is not|ain'?t) real/i,
        /stfu jenkins/i,
        /jenkins.{0,10}(fake|not real|just a|shut up|annoying|useless)/i,
      ],
      description: 'Dismissing or disrespecting the Architect',
    },
    {
      name: 'lodge_disrespect',
      patterns: [
        /the lodge is (stupid|dumb|cringe|lame|pointless|a joke|dead)/i,
        /this (server|discord|group) is (dead|pointless|cringe|stupid|lame|a joke)/i,
        /i('m| am) (leaving|done with|quitting) (this|the lodge|the server)/i,
        /nobody (plays|games|cares) (here|anymore)/i,
      ],
      description: 'Disrespecting the Lodge',
    },
  ],
  unforgivable: [
    {
      name: 'ghost_denial',
      patterns: [
        /i (never|didn'?t|did not) (agree|say|confirm|promise)/i,
        /that (session|wasn'?t|was never) (confirmed|real|agreed|scheduled)/i,
        /i (wasn'?t|was not) (supposed to|going to|gonna) (come|join|play|be there)/i,
        /what session/i,
        /i never said (i'?d|i would|that)/i,
      ],
      description: 'Denying covenant — the sin against Jenkins himself',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// Callout prompt styles — rotated for variety
// ═══════════════════════════════════════════════════════════════

const CALLOUT_STYLES = [
  'wrathful_prophet', // THE ALL-SEEING EYE BEHOLDS YOUR TRANSGRESSION
  'disappointed_father', // I expected more from you, Brother
  'sarcastic_deity', // Oh, fascinating take...
  'court_judge', // The Architect hereby charges...
  'sports_commentator', // AND THERE IT IS, FOLKS
  'ominous_silence', // The Architect notes your words... and simply remembers.
  'weary_god', // *sigh* Again? Really?
];

function pickCalloutStyle() {
  return CALLOUT_STYLES[Math.floor(Math.random() * CALLOUT_STYLES.length)];
}

// ═══════════════════════════════════════════════════════════════
// Sin Detector Class
// ═══════════════════════════════════════════════════════════════

class SinDetector {
  constructor(deepseekClient, systemPrompt) {
    this.deepseek = deepseekClient;
    this.systemPrompt = systemPrompt;
    this.ledger = this.loadLedger();
    this.calloutCooldowns = new Map();    // userId -> last callout timestamp
    this.globalCalloutCount = 0;          // Callouts this hour
    this.globalCalloutHourStart = Date.now();
    this.rivalIds = new Set();        // Populated from .env or auto-detected
    this.autoRivalId = null;           // Auto-detected rival (most Jenkins-dismissive user)
    this.jenkinsDisrespect = new Map(); // userId -> count of Jenkins-related sins

    // Load Rival ID from env if set
    if (process.env.RIVAL_USER_ID) {
      this.rivalIds.add(process.env.RIVAL_USER_ID);
    }

    // Auto-detect rival from ledger history
    this.recalculateAutoRival();
  }

  /**
   * Auto-detect the Rival — whoever has the most Jenkins-dismissal sins.
   * If no RIVAL_USER_ID is configured, the biggest sinner becomes the Rival.
   */
  recalculateAutoRival() {
    if (process.env.RIVAL_USER_ID) return; // Manual rival overrides auto-detect

    let worstUserId = null;
    let worstCount = 0;

    for (const [userId, entry] of Object.entries(this.ledger)) {
      const dismissalSins = entry.sins.filter(s =>
        s.name === 'dismissing_jenkins' || s.name === 'disinterest_in_jenkins' || s.name === 'passive_dismissal'
      ).length;
      if (dismissalSins > worstCount) {
        worstCount = dismissalSins;
        worstUserId = userId;
      }
    }

    if (worstUserId && worstCount >= 3) {
      if (this.autoRivalId !== worstUserId) {
        this.autoRivalId = worstUserId;
        this.rivalIds.add(worstUserId);
        const name = this.ledger[worstUserId]?.username || 'Unknown';
        console.log(`[Sins] AUTO-RIVAL DETECTED: ${name} (${worstUserId}) with ${worstCount} dismissal sins`);
      }
    }
  }

  // ── Ledger Persistence ──

  loadLedger() {
    try {
      if (fs.existsSync(LEDGER_PATH)) {
        const data = fs.readFileSync(LEDGER_PATH, 'utf-8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('[Sins] Failed to load sin ledger:', e.message);
    }
    return {};
  }

  saveLedger() {
    try {
      fs.writeFileSync(LEDGER_PATH, JSON.stringify(this.ledger, null, 2));
    } catch (e) {
      console.error('[Sins] Failed to save sin ledger:', e.message);
    }
  }

  // ── Detection ──

  /**
   * Scan text for sins. Returns array of { type, name, description, match }
   */
  detectSins(text, userId, username) {
    if (!text || text.length < 3) return [];

    const found = [];

    for (const [severity, patterns] of Object.entries(SIN_PATTERNS)) {
      for (const sinDef of patterns) {
        for (const regex of sinDef.patterns) {
          const match = text.match(regex);
          if (match) {
            found.push({
              type: severity,
              name: sinDef.name,
              description: sinDef.description,
              match: match[0],
            });
            break; // Only one match per sin definition
          }
        }
      }
    }

    // Sort: unforgivable > mortal > venial
    const order = { unforgivable: 0, mortal: 1, venial: 2 };
    found.sort((a, b) => order[a.type] - order[b.type]);

    return found;
  }

  // ── Recording ──

  recordSin(userId, username, sinResult) {
    if (!this.ledger[userId]) {
      this.ledger[userId] = {
        username,
        sins: [],
        totalVenial: 0,
        totalMortal: 0,
        totalUnforgivable: 0,
      };
    }

    const entry = this.ledger[userId];
    entry.username = username; // Keep updated
    entry.sins.push({
      type: sinResult.type,
      name: sinResult.name,
      description: sinResult.description,
      match: sinResult.match,
      timestamp: Date.now(),
    });

    // Keep only last 100 sins per user
    if (entry.sins.length > 100) {
      entry.sins = entry.sins.slice(-100);
    }

    if (sinResult.type === 'venial') entry.totalVenial++;
    if (sinResult.type === 'mortal') entry.totalMortal++;
    if (sinResult.type === 'unforgivable') entry.totalUnforgivable++;

    entry.lastSin = Date.now();
    this.saveLedger();

    console.log(`[Sins] Recorded ${sinResult.type} sin "${sinResult.name}" for ${username} (${userId}). Total: V=${entry.totalVenial} M=${entry.totalMortal} U=${entry.totalUnforgivable}`);

    // Recalculate auto-rival when dismissal sins are recorded
    if (sinResult.name === 'dismissing_jenkins' || sinResult.name === 'disinterest_in_jenkins' || sinResult.name === 'passive_dismissal') {
      this.recalculateAutoRival();
    }
  }

  // ── Escalation ──

  getEscalationLevel(userId) {
    const entry = this.ledger[userId];
    if (!entry) return 0;

    const now = Date.now();
    const DAY = 86400000;
    const WEEK = DAY * 7;

    // Count recent sins
    const venialToday = entry.sins.filter(s => s.type === 'venial' && (now - s.timestamp) < DAY).length;
    const mortalThisWeek = entry.sins.filter(s => s.type === 'mortal' && (now - s.timestamp) < WEEK).length;

    // 3+ venial in 24h -> escalated
    if (venialToday >= 3) return 1;
    // 2+ mortal in a week -> shame title
    if (mortalThisWeek >= 2) return 2;
    // 5+ mortal lifetime -> sin aura
    if (entry.totalMortal >= 5) return 3;
    // Any unforgivable -> maximum
    if (entry.totalUnforgivable > 0) return 4;

    return 0;
  }

  getSinTitle(userId) {
    const entry = this.ledger[userId];
    if (!entry) return null;

    const level = this.getEscalationLevel(userId);
    if (level >= 4) return `${entry.username} the Covenant-Breaker`;
    if (level >= 3) return `${entry.username} the Perpetually Fallen`;
    if (level >= 2) return `${entry.username} the Wavering`;
    if (level >= 1) return `${entry.username} the Undisciplined`;
    return null;
  }

  getTotalSins(userId) {
    const entry = this.ledger[userId];
    if (!entry) return { venial: 0, mortal: 0, unforgivable: 0, total: 0 };
    return {
      venial: entry.totalVenial,
      mortal: entry.totalMortal,
      unforgivable: entry.totalUnforgivable,
      total: entry.totalVenial + entry.totalMortal + entry.totalUnforgivable,
    };
  }

  // ── Should We Call Out? (rate limiting + probability) ──

  shouldCallOut(sinResult, userId) {
    const now = Date.now();
    const isRival = this.rivalIds.has(userId);

    // Reset hourly global counter
    if (now - this.globalCalloutHourStart > 3600000) {
      this.globalCalloutCount = 0;
      this.globalCalloutHourStart = now;
    }

    // Max callouts per hour globally (Rival gets a higher cap)
    const maxPerHour = isRival ? 8 : 4;
    if (this.globalCalloutCount >= maxPerHour) return false;

    // Per-user cooldown: Rival = 3 min, others = 10 min
    const lastCallout = this.calloutCooldowns.get(userId) || 0;
    const cooldown = isRival ? 180000 : 600000; // 3 min vs 10 min
    if (now - lastCallout < cooldown) return false;

    // Probability based on sin severity
    let probability;
    switch (sinResult.type) {
      case 'unforgivable': probability = 1.0; break;
      case 'mortal': probability = 0.85; break;
      case 'venial': probability = 0.5; break;
      default: probability = 0.3;
    }

    // Rival gets BURNED — 90% minimum callout chance for ANY sin
    if (isRival) {
      probability = Math.max(probability, 0.90);
    }

    // Non-Rival repeat offenders: slightly lower to avoid annoyance
    if (!isRival) {
      const totals = this.getTotalSins(userId);
      if (totals.total > 10) {
        probability *= 0.7;
      }
    }

    if (Math.random() > probability) return false;

    // Record the callout
    this.calloutCooldowns.set(userId, now);
    this.globalCalloutCount++;

    return true;
  }

  // ── Generate Callout Message ──

  async generateCallout(username, sinResult, channel = 'text') {
    const userId = null; // We get userId from the caller
    const style = pickCalloutStyle();
    const totals = this.getTotalSinsForUsername(username);
    const escalation = totals.total > 0 ? ` This is their sin number ${totals.total + 1}.` : '';
    const sinTitle = this.getSinTitleForUsername(username);
    const titleNote = sinTitle ? ` Address them as "${sinTitle}".` : '';
    const isRival = this.rivalIds.has(this.getUserIdByName(username));
    const rivalNote = isRival ? ' This is a designated Rival of the Lodge — one who has earned the Architect\'s special attention for their pattern of faithlessness. Be extra aggressive and pointed in your callout. Roast them hard but stay in character.' : '';

    const lengthNote = channel === 'voice'
      ? 'Keep it to 1 sentence MAX — you are speaking aloud.'
      : 'Keep it to 2-3 sentences max.';

    const prompt = `You just detected that a Brother named ${username} committed the sin of "${sinResult.description}" in the ${channel === 'voice' ? 'Tavern (voice channel)' : 'Lodge (text channel)'}. They said: "${sinResult.match}".

Your callout style for this one: ${style}.
Sin severity: ${sinResult.type.toUpperCase()}.${escalation}${titleNote}${rivalNote}

Call them out IN CHARACTER as Jenkins. ${lengthNote} Be dramatic and funny, not mean-spirited. Reference their specific words. If venial, be more playful. If mortal, be more serious. If unforgivable, be absolutely devastating.`;

    try {
      const response = await chat(this.deepseek, this.systemPrompt, prompt);
      return response;
    } catch (e) {
      console.error('[Sins] Callout generation error:', e.message);
      return null;
    }
  }

  // ── Helpers for username-based lookup ──

  getTotalSinsForUsername(username) {
    for (const entry of Object.values(this.ledger)) {
      if (entry.username === username) {
        return { venial: entry.totalVenial, mortal: entry.totalMortal, unforgivable: entry.totalUnforgivable, total: entry.totalVenial + entry.totalMortal + entry.totalUnforgivable };
      }
    }
    return { venial: 0, mortal: 0, unforgivable: 0, total: 0 };
  }

  getSinTitleForUsername(username) {
    for (const [userId, entry] of Object.entries(this.ledger)) {
      if (entry.username === username) return this.getSinTitle(userId);
    }
    return null;
  }

  getUserIdByName(username) {
    for (const [userId, entry] of Object.entries(this.ledger)) {
      if (entry.username === username) return userId;
    }
    return null;
  }

  // ── Sin Spotlight for Preaching ──

  generateSinSpotlight() {
    const entries = Object.entries(this.ledger)
      .filter(([_, e]) => e.sins.length > 0)
      .sort((a, b) => (b[1].totalMortal + b[1].totalUnforgivable) - (a[1].totalMortal + a[1].totalUnforgivable));

    if (entries.length === 0) return null;

    const now = Date.now();
    const WEEK = 604800000;

    let report = '';
    for (const [userId, entry] of entries.slice(0, 5)) {
      const recentSins = entry.sins.filter(s => (now - s.timestamp) < WEEK);
      if (recentSins.length === 0) continue;

      const title = this.getSinTitle(userId);
      const name = title || entry.username;
      report += `- **${name}**: ${recentSins.length} sins this week (${entry.totalVenial}V / ${entry.totalMortal}M / ${entry.totalUnforgivable}U lifetime)\n`;
    }

    return report || null;
  }
}

module.exports = { SinDetector, SIN_PATTERNS };
