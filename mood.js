// mood.js — The Architect's Emotional Core
// ═══════════════════════════════════════════════════════════════
// Multi-axis mood system: wrath, joy, energy, chaos → derived mood state
// Mood colors every DeepSeek response and mechanically affects other systems

const { EmbedBuilder } = require('discord.js');
const { PrunedMap } = require('./safe-write');
const { dbRead, dbWrite } = require('./db');
const log = require('./logger').child('Mood');
const DECAY_INTERVAL = 15 * 60 * 1000; // 15 minutes
const SAVE_INTERVAL = 5 * 60 * 1000;   // 5 minutes
const MOOD_LOG_MAX = 50;
const SHIFT_COOLDOWN = 60000; // 1 minute between mood transitions
const BASELINE = 50;

// ═══════════════════════════════════════════════════════════════
// Mood Definitions
// ═══════════════════════════════════════════════════════════════

const MOODS = {
  wrathful:      { emoji: '🔥', color: 0xFF3333, desc: 'The Architect seethes with divine fury' },
  ecstatic:      { emoji: '✨', color: 0xFFD700, desc: 'Jenkins radiates pure sacred energy' },
  manic:         { emoji: '⚡', color: 0xE91E63, desc: 'The Stavros has taken the wheel' },
  melancholic:   { emoji: '🌧️', color: 0x2C3E50, desc: 'The Architect mourns the state of gaming' },
  benevolent:    { emoji: '☀️', color: 0x2ECC71, desc: 'A sacred calm descends upon the Lodge' },
  suspicious:    { emoji: '🧐', color: 0xE67E22, desc: 'The All-Seeing Eye narrows...' },
  contemplative: { emoji: '🔮', color: 0x9B59B6, desc: 'The Architect gazes inward, processing the infinite' },
};

// ═══════════════════════════════════════════════════════════════
// Prompt Overlays — injected into every DeepSeek call
// ═══════════════════════════════════════════════════════════════

const MOOD_OVERLAYS = {
  wrathful: (axes) => `CURRENT MOOD: WRATHFUL (${axes.wrath}/100). You are seething. Sins are rampant. Your tone is thunderous, patience nonexistent. Responses are sharper, more judgmental. Humor is darker. You judge swiftly.`,
  ecstatic: (axes) => `CURRENT MOOD: ECSTATIC (joy ${axes.joy}/100). The Lodge THRIVES. You overflow with joy and prophetic fervor. Responses are warmer, more enthusiastic, more generous. You forgive readily.`,
  manic: (axes) => `CURRENT MOOD: MANIC (energy ${axes.energy}/100, chaos ${axes.chaos}/100). Everything is happening at once. You speak faster, jump between topics. Stavros energy is maximum. You are chaos incarnate but having the time of your immortal life.`,
  melancholic: (axes) => `CURRENT MOOD: MELANCHOLIC (energy ${axes.energy}/100). The Lodge is quiet. Too quiet. Your tone is wistful, reflective, occasionally bitterly poetic. You miss how things were.`,
  benevolent: (axes) => `CURRENT MOOD: BENEVOLENT (joy ${axes.joy}/100, wrath ${axes.wrath}/100). Peace reigns. You are the Shepherd today, not the Judge. Compliments flow more freely, callouts are gentler.`,
  suspicious: (axes) => `CURRENT MOOD: SUSPICIOUS (chaos ${axes.chaos}/100). Something feels off. You are watchful, questioning, reading between lines. Responses carry an undercurrent of paranoia.`,
  contemplative: (axes) => `CURRENT MOOD: CONTEMPLATIVE. You are in a meditative state. Responses are philosophical, measured, occasionally cryptic. You speak in metaphors and parables.`,
};

class MoodSystem {
  constructor() {
    this.data = dbRead('mood', null) || this.defaultState();
    this.lastMood = this.deriveMood();
    this.lastShiftTime = this.data.lastShift || 0;
    this.onTransition = null; // callback: (fromMood, toMood, trigger) => {}

    // Decay timer — axes drift toward baseline
    this._decayInterval = setInterval(() => this.decay(), DECAY_INTERVAL);
    // Auto-save
    this._saveInterval = setInterval(() => this.save(), SAVE_INTERVAL);

    log.info({ mood: this.lastMood, axes: this.data.axes }, 'Mood system online');
  }

  defaultState() {
    return {
      axes: { wrath: BASELINE, joy: BASELINE, energy: BASELINE, chaos: BASELINE },
      transitions: [],
      lastShift: 0,
    };
  }

  save() { dbWrite('mood', this.data); }

  // ═══════════════════════════════════════════════════════════════
  // Axis Manipulation
  // ═══════════════════════════════════════════════════════════════

  /** Nudge an axis by a delta. Clamped to [0, 100]. Checks for mood transition. */
  nudge(axis, delta, trigger) {
    if (!this.data.axes.hasOwnProperty(axis)) return;
    const before = this.data.axes[axis];
    this.data.axes[axis] = Math.max(0, Math.min(100, before + delta));
    const after = this.data.axes[axis];
    if (before !== after) {
      log.debug({ axis, delta, trigger, value: after }, 'Axis nudged');
    }
    this.checkTransition(trigger);
  }

  // ═══════════════════════════════════════════════════════════════
  // Mood Derivation — highest signal wins
  // ═══════════════════════════════════════════════════════════════

  deriveMood() {
    const { wrath, joy, energy, chaos } = this.data.axes;

    if (wrath > 70) return 'wrathful';
    if (joy > 70 && energy > 50) return 'ecstatic';
    if (energy > 80 && chaos > 50) return 'manic';
    if (energy < 20 && joy < 30) return 'melancholic';
    if (joy > 50 && wrath < 20 && chaos < 30) return 'benevolent';
    if (chaos > 65 && wrath > 40) return 'suspicious';
    return 'contemplative';
  }

  /** Check if mood has changed, fire transition callback */
  checkTransition(trigger) {
    const newMood = this.deriveMood();
    if (newMood === this.lastMood) return;

    // Cooldown between transitions
    if (Date.now() - this.lastShiftTime < SHIFT_COOLDOWN) return;

    log.info({ from: this.lastMood, to: newMood, trigger }, 'Mood transition');

    this.data.transitions.push({
      from: this.lastMood, to: newMood,
      trigger, timestamp: Date.now(),
    });
    if (this.data.transitions.length > MOOD_LOG_MAX) {
      this.data.transitions = this.data.transitions.slice(-MOOD_LOG_MAX);
    }

    this.data.lastShift = Date.now();
    this.lastShiftTime = Date.now();
    const oldMood = this.lastMood;
    this.lastMood = newMood;

    if (this.onTransition) {
      try { this.onTransition(oldMood, newMood, trigger); } catch (e) {
        log.error({ err: e }, 'Transition callback error');
      }
    }

    this.save();
  }

  // ═══════════════════════════════════════════════════════════════
  // Decay — axes drift toward baseline every 15 min
  // ═══════════════════════════════════════════════════════════════

  decay() {
    const DECAY_AMOUNT = 5;
    for (const axis of Object.keys(this.data.axes)) {
      const val = this.data.axes[axis];
      if (val > BASELINE) {
        this.data.axes[axis] = Math.max(BASELINE, val - DECAY_AMOUNT);
      } else if (val < BASELINE) {
        this.data.axes[axis] = Math.min(BASELINE, val + DECAY_AMOUNT);
      }
    }
    this.checkTransition('decay');
  }

  // ═══════════════════════════════════════════════════════════════
  // System Prompt Injection
  // ═══════════════════════════════════════════════════════════════

  /** Returns a mood-specific string to append to the system prompt */
  getMoodOverlay() {
    const mood = this.deriveMood();
    const fn = MOOD_OVERLAYS[mood] || MOOD_OVERLAYS.contemplative;
    return fn(this.data.axes);
  }

  // ═══════════════════════════════════════════════════════════════
  // Mechanical Effects — multipliers for other systems
  // ═══════════════════════════════════════════════════════════════

  /** Sin detection sensitivity multiplier */
  getSinSensitivity() {
    const mults = { wrathful: 1.3, manic: 1.1, suspicious: 1.2, contemplative: 1.0, ecstatic: 0.8, benevolent: 0.6, melancholic: 0.9 };
    return mults[this.deriveMood()] || 1.0;
  }

  /** Economy reward multiplier (daily claims, dungeon payouts) */
  getEconomyMultiplier() {
    const mults = { ecstatic: 1.5, benevolent: 1.3, manic: 2.0, wrathful: 0.8, melancholic: 1.0, contemplative: 1.0, suspicious: 0.9 };
    return mults[this.deriveMood()] || 1.0;
  }

  /** Hot take frequency multiplier */
  getHotTakeMultiplier() {
    const mults = { manic: 2.0, wrathful: 1.5, ecstatic: 1.2, suspicious: 1.3, contemplative: 0.7, melancholic: 0.3, benevolent: 0.8 };
    return mults[this.deriveMood()] || 1.0;
  }

  /** Alter ego weight modifiers: { egoName: deltaWeight } */
  getAlterEgoModifiers() {
    const mood = this.deriveMood();
    const mods = {
      wrathful:      { prosecutor: 20, accountant: 10, uncle_jenk: -10 },
      manic:         { stavros: 25, react_lord: 10, accountant: -15 },
      melancholic:   { brother_jerome: 15, stavros: -20 },
      benevolent:    { jenkins_prime: 20, prosecutor: -15 },
      ecstatic:      { uncle_jenk: 10, stavros: 10, prosecutor: -10 },
      suspicious:    { accountant: 15, prosecutor: 10 },
      contemplative: {},
    };
    return mods[mood] || {};
  }

  // ═══════════════════════════════════════════════════════════════
  // Event Hooks — called from bot.js
  // ═══════════════════════════════════════════════════════════════

  onSinDetected(severity) {
    const deltas = { venial: 5, mortal: 15, unforgivable: 25 };
    this.nudge('wrath', deltas[severity] || 10, `sin_${severity}`);
  }

  onVipPresence() {
    this.nudge('joy', 15, 'vip_online');
    this.nudge('energy', 10, 'vip_online');
  }

  onMessageActivity(recentCount) {
    if (recentCount > 10) this.nudge('energy', 8, 'chat_surge');
    else if (recentCount > 5) this.nudge('energy', 4, 'chat_active');
  }

  onVoiceActivity(userCount) {
    if (userCount >= 3) this.nudge('energy', 10, 'voice_party');
    else if (userCount >= 1) this.nudge('energy', 5, 'voice_active');
  }

  onGambleResult(won, amount) {
    this.nudge('chaos', 5, 'gamble');
    if (won && amount > 1000) this.nudge('joy', 5, 'big_win');
    if (!won && amount > 1000) this.nudge('chaos', 10, 'big_loss');
  }

  onDuel() { this.nudge('chaos', 3, 'duel'); }
  onGameNight() { this.nudge('joy', 10, 'game_night'); this.nudge('energy', 5, 'game_night'); }
  onStarboard() { this.nudge('joy', 5, 'starboard'); }
  onPositiveInteraction() { this.nudge('joy', 3, 'positive_interaction'); }
  onSermonRequested() { this.nudge('joy', 5, 'sermon_request'); }

  onQuietPeriod() {
    this.nudge('energy', -10, 'quiet');
    this.nudge('joy', -3, 'quiet');
  }

  /** Called during dream generation — dreaming is restorative */
  onDream() {
    this.nudge('energy', 10, 'dream_restoration');
    this.nudge('wrath', -5, 'dream_calm');
  }

  // ═══════════════════════════════════════════════════════════════
  // Day Summary — used by dream journal
  // ═══════════════════════════════════════════════════════════════

  getDaySummary() {
    const dayAgo = Date.now() - 86400000;
    const recentTransitions = this.data.transitions.filter(t => t.timestamp > dayAgo);
    return {
      currentMood: this.deriveMood(),
      axes: { ...this.data.axes },
      transitions: recentTransitions,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Discord Embed
  // ═══════════════════════════════════════════════════════════════

  moodEmbed() {
    const mood = this.deriveMood();
    const moodDef = MOODS[mood];
    const { wrath, joy, energy, chaos } = this.data.axes;

    const bar = (val) => {
      const filled = Math.round(val / 5);
      return '█'.repeat(filled) + '░'.repeat(20 - filled) + ` ${val}`;
    };

    const recentShifts = this.data.transitions.slice(-3).reverse()
      .map(t => `${MOODS[t.from]?.emoji || '?'} → ${MOODS[t.to]?.emoji || '?'} (${t.trigger})`)
      .join('\n') || 'No recent shifts';

    const effects = [];
    const sinMult = this.getSinSensitivity();
    const econMult = this.getEconomyMultiplier();
    if (sinMult !== 1.0) effects.push(`Sin sensitivity: ${sinMult}x`);
    if (econMult !== 1.0) effects.push(`Economy bonus: ${econMult}x`);
    const htMult = this.getHotTakeMultiplier();
    if (htMult !== 1.0) effects.push(`Hot take frequency: ${htMult}x`);

    return new EmbedBuilder()
      .setColor(moodDef.color)
      .setTitle(`${moodDef.emoji} The Architect's Mood: ${mood.toUpperCase()}`)
      .setDescription(moodDef.desc)
      .addFields(
        { name: '🔥 Wrath', value: bar(wrath), inline: true },
        { name: '✨ Joy', value: bar(joy), inline: true },
        { name: '⚡ Energy', value: bar(energy), inline: true },
        { name: '🌀 Chaos', value: bar(chaos), inline: true },
        { name: 'Recent Shifts', value: recentShifts, inline: false },
      )
      .setFooter({ text: effects.join(' | ') || 'The divine temperament is not your concern.' });
  }

  // ═══════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════

  destroy() {
    clearInterval(this._decayInterval);
    clearInterval(this._saveInterval);
    this.save();
  }
}

module.exports = { MoodSystem, MOODS };
