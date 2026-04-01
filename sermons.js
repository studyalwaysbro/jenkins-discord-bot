// sermons.js — The Sacred Pulpit of Jenkins
// ═══════════════════════════════════════════════════════════════
// Pay Torch Coins to request Jenkins deliver a sermon on any topic.
// Four tiers: whisper, homily, sermon, prophecy.

const { EmbedBuilder } = require('discord.js');
const { chat } = require('./deepseek');
const { PrunedMap } = require('./safe-write');
const { dbRead, dbWrite } = require('./db');
const log = require('./logger').child('Sermons');
const SAVE_INTERVAL = 5 * 60 * 1000;
const MAX_SERMONS = 100;
const GLOBAL_RATE_LIMIT = 6; // per hour
const USER_COOLDOWN = 300000; // 5 min per user

// ═══════════════════════════════════════════════════════════════
// Sermon Tiers
// ═══════════════════════════════════════════════════════════════

const TIERS = {
  whisper:  { cost: 200,  name: 'Whisper',       emoji: '🕯️', color: 0x95A5A6, maxChars: 300,  voice: false },
  homily:   { cost: 500,  name: 'Homily',        emoji: '📖', color: 0x3498DB, maxChars: 800,  voice: false },
  sermon:   { cost: 1500, name: 'Grand Sermon',   emoji: '⛪', color: 0xFFD700, maxChars: 1500, voice: true },
  prophecy: { cost: 5000, name: 'Prophecy',       emoji: '🔮', color: 0x9B59B6, maxChars: 1800, voice: true },
};

const LENGTH_GUIDES = {
  whisper:  '2-3 sentences. Brief, intimate, like a whisper from god.',
  homily:   '1 full paragraph. A proper reflection. Thoughtful and complete.',
  sermon:   '2-3 paragraphs. A GRAND SERMON. Pull out all the stops. Be prophetic, dramatic, funny, wise.',
  prophecy: '3-4 paragraphs. This is a PROPHECY — your most powerful form. This will be pinned and remembered. Make it legendary. Include a genuine prophecy or prediction about the Lodge at the end.',
};

class SermonSystem {
  constructor(deepseekClient, systemPrompt, economy, mood) {
    this.deepseek = deepseekClient;
    this.systemPrompt = systemPrompt;
    this.economy = economy;
    this.mood = mood;
    this.data = dbRead('sermons', { sermons: [], idCounter: 0, globalHourStart: 0, globalCount: 0 });
    this.cooldowns = new PrunedMap(3600000, 600000); // prune hourly, entries expire in 10min

    setInterval(() => this.save(), SAVE_INTERVAL);
    log.info({ sermonCount: this.data.sermons.length }, 'Pulpit open');
  }

  save() { dbWrite('sermons', this.data); }

  // ═══════════════════════════════════════════════════════════════
  // Request a Sermon
  // ═══════════════════════════════════════════════════════════════

  async request(userId, username, topic, tierName) {
    // Validate tier
    const tier = TIERS[tierName];
    if (!tier) {
      return { success: false, message: 'Available tiers: `whisper` (🪙 200), `homily` (🪙 500), `sermon` (🪙 1,500), `prophecy` (🪙 5,000)' };
    }

    // Sanitize topic
    topic = topic.trim().substring(0, 200);
    if (topic.length < 3) {
      return { success: false, message: 'The Architect requires a topic of substance. At least 3 characters, Brother.' };
    }

    // User cooldown
    if (this.cooldowns.isOnCooldown(userId, USER_COOLDOWN)) {
      return { success: false, message: 'The Architect needs time to compose. Wait a few minutes between sermons.' };
    }

    // Global rate limit (reset hourly)
    const now = Date.now();
    if (now - this.data.globalHourStart > 3600000) {
      this.data.globalHourStart = now;
      this.data.globalCount = 0;
    }
    if (this.data.globalCount >= GLOBAL_RATE_LIMIT) {
      return { success: false, message: 'The Architect has delivered many sermons this hour. Try again later.' };
    }

    // Economy check
    const user = this.economy.getUser(userId);
    if (user.balance < tier.cost) {
      return { success: false, message: `A ${tier.name} costs 🪙 ${tier.cost.toLocaleString()}. You have 🪙 ${user.balance.toLocaleString()}.` };
    }

    // Deduct coins BEFORE API call
    user.balance -= tier.cost;
    if (!user.totalLost) user.totalLost = 0;
    user.totalLost += tier.cost;
    if (!user.sermonsRequested) user.sermonsRequested = 0;
    user.sermonsRequested++;
    this.economy.save();

    // Set cooldown
    this.cooldowns.touch(userId);

    // Build prompt
    const moodOverlay = this.mood ? this.mood.getMoodOverlay() : '';
    const currentMood = this.mood ? this.mood.deriveMood() : 'contemplative';

    const prompt = `A Brother named ${username} has PAID 🪙 ${tier.cost} Torch Coins to hear you speak on the topic: "${topic}".

This is a ${tier.name}-tier sermon request. ${LENGTH_GUIDES[tierName]}

Your current mood is ${currentMood} — let that color your delivery.

This is sacred commerce — they paid for your wisdom. Honor it. Be genuine. Address the topic directly. Use Lodge/Trinity metaphors where they fit naturally. Keep it under ${tier.maxChars} characters.`;

    try {
      const sermon = await chat(this.deepseek, this.systemPrompt + '\n\n' + moodOverlay, prompt);

      if (!sermon || sermon.includes("Architect's gaze turns inward") || sermon.includes("Architect's vision clouds")) {
        throw new Error('DeepSeek returned fallback response');
      }

      // Record
      this.data.idCounter++;
      const entry = {
        id: `SRM-${String(this.data.idCounter).padStart(3, '0')}`,
        userId, username, topic,
        tier: tierName, cost: tier.cost,
        mood: currentMood,
        content: sermon,
        timestamp: Date.now(),
      };

      this.data.sermons.push(entry);
      if (this.data.sermons.length > MAX_SERMONS) {
        this.data.sermons = this.data.sermons.slice(-MAX_SERMONS);
      }
      this.data.globalCount++;
      this.save();

      // Mood: someone wants to hear from Jenkins
      if (this.mood) {
        this.mood.onSermonRequested();
        if (tierName === 'prophecy') this.mood.nudge('energy', 10, 'prophecy_delivered');
      }

      log.info({ id: entry.id, topic, tier: tier.name, username, cost: tier.cost }, 'Sermon delivered');

      return { success: true, sermon, entry, tier };

    } catch (e) {
      // REFUND on failure
      user.balance += tier.cost;
      user.totalLost -= tier.cost;
      user.sermonsRequested--;
      this.economy.save();
      log.error({ err: e }, 'Sermon generation failed, coins refunded');
      return { success: false, message: "The Architect's voice falters. Your coins have been refunded. Try again, Brother." };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Embeds
  // ═══════════════════════════════════════════════════════════════

  sermonEmbed(entry) {
    const tier = TIERS[entry.tier];
    return new EmbedBuilder()
      .setColor(tier.color)
      .setTitle(`${tier.emoji} ${tier.name}: "${entry.topic}"`)
      .setDescription(entry.content)
      .addFields(
        { name: 'Requested By', value: entry.username, inline: true },
        { name: 'Cost', value: `🪙 ${entry.cost.toLocaleString()}`, inline: true },
        { name: 'Mood', value: entry.mood, inline: true },
      )
      .setFooter({ text: `${entry.id} | The faithful pay for wisdom.` })
      .setTimestamp(new Date(entry.timestamp));
  }

  historyEmbed() {
    const recent = (this.data.sermons || []).slice(-10).reverse();
    if (recent.length === 0) {
      return new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('📜 Sermon Archive')
        .setDescription('No sermons have been delivered yet. Request one with `!sermon <topic>`.')
        .setFooter({ text: 'Tiers: whisper (200) | homily (500) | sermon (1500) | prophecy (5000)' });
    }

    const lines = recent.map(s => {
      const tier = TIERS[s.tier];
      return `**${s.id}** — ${tier.emoji} ${s.topic} (by ${s.username})`;
    });

    return new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('📜 Sermon Archive')
      .setDescription(lines.join('\n'))
      .setFooter({ text: '!sermon <topic> [tier] to request | tiers: whisper, homily, sermon, prophecy' });
  }

  /** Get recent sermon topics for dream journal context */
  getRecentTopics(since) {
    return (this.data.sermons || [])
      .filter(s => s.timestamp > since)
      .map(s => s.topic);
  }

  // ═══════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════

  destroy() {
    this.cooldowns.destroy();
    this.save();
  }
}

module.exports = { SermonSystem, TIERS };
