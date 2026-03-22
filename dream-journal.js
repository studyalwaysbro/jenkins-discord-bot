// dream-journal.js — The Architect's Subconscious
// ═══════════════════════════════════════════════════════════════
// Jenkins dreams at 3 AM. Dreams are surreal AI-generated narratives
// built from real server events: sins, economy, voice, mood, sermons.

const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { chat } = require('./deepseek');
const { safeWriteJSON, safeReadJSON } = require('./safe-write');
const log = require('./logger').child('Dreams');

const DATA_FILE = path.join(__dirname, 'data', 'dreams.json');
const SAVE_INTERVAL = 5 * 60 * 1000;
const DREAM_HOUR = 3;         // 3 AM local time
const MAX_DREAMS = 50;
const CHECK_INTERVAL = 15 * 60 * 1000; // Check every 15 min

class DreamJournal {
  constructor(deepseekClient, systemPrompt, modules) {
    this.deepseek = deepseekClient;
    this.systemPrompt = systemPrompt;

    // Module references for data collection
    this.mood = modules.mood || null;
    this.sinDetector = modules.sinDetector || null;
    this.economy = modules.economy || null;
    this.starboard = modules.starboard || null;
    this.gameNight = modules.gameNight || null;
    this.predictions = modules.predictions || null;
    this.sermons = modules.sermons || null;

    // Volatile day counters — reset after each dream
    this.dayCounters = this.freshCounters();

    this.data = safeReadJSON(DATA_FILE, () => ({ dreams: [], idCounter: 0, lastDreamDate: null }));

    setInterval(() => this.save(), SAVE_INTERVAL);
    log.info({ dreamCount: this.data.dreams.length }, 'Dream journal initialized');
  }

  save() { safeWriteJSON(DATA_FILE, this.data); }

  freshCounters() {
    return {
      voiceConversations: 0,
      voiceMinutes: 0,
      hotTakes: 0,
      stavrosBreaks: 0,
      duelsResolved: 0,
      sermonTopics: [],
      memorableQuotes: [],
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Event Tracking — called from bot.js throughout the day
  // ═══════════════════════════════════════════════════════════════

  trackVoiceConversation() { this.dayCounters.voiceConversations++; }
  trackVoiceMinutes(mins) { this.dayCounters.voiceMinutes += mins; }
  trackHotTake() { this.dayCounters.hotTakes++; }
  trackStavrosBreak() { this.dayCounters.stavrosBreaks++; }
  trackDuel() { this.dayCounters.duelsResolved++; }
  trackSermonTopic(topic) {
    if (this.dayCounters.sermonTopics.length < 20) {
      this.dayCounters.sermonTopics.push(topic);
    }
  }
  trackMemorableQuote(username, quote) {
    if (this.dayCounters.memorableQuotes.length < 10) {
      this.dayCounters.memorableQuotes.push({ username, quote: quote.substring(0, 100) });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Data Collection — reads from all systems at dream time
  // ═══════════════════════════════════════════════════════════════

  collectDayData() {
    const dayAgo = Date.now() - 86400000;
    const data = { counters: { ...this.dayCounters } };

    // Mood summary
    if (this.mood) {
      data.mood = this.mood.getDaySummary();
    }

    // Recent sins
    data.sins = [];
    if (this.sinDetector?.ledger) {
      for (const [userId, entry] of Object.entries(this.sinDetector.ledger)) {
        const recentSins = (entry.sins || []).filter(s => s.timestamp > dayAgo);
        if (recentSins.length > 0) {
          data.sins.push({ username: entry.username || 'Unknown', sins: recentSins.map(s => s.name).slice(0, 5) });
        }
      }
    }

    // Economy highlights
    data.economy = this.getEconomyHighlights();

    // Starboard
    data.starCount = 0;
    if (this.starboard?.data?.starred) {
      data.starCount = Object.values(this.starboard.data.starred)
        .filter(s => s.timestamp > dayAgo).length;
    }

    // Predictions
    data.predictions = [];
    if (this.predictions?.data?.history) {
      data.predictions = this.predictions.data.history
        .filter(m => m.createdAt > dayAgo)
        .map(p => p.question)
        .slice(0, 5);
    }

    // Sermon topics
    if (this.sermons) {
      const sermonTopics = this.sermons.getRecentTopics(dayAgo);
      if (sermonTopics.length > 0) data.counters.sermonTopics = sermonTopics;
    }

    return data;
  }

  getEconomyHighlights() {
    if (!this.economy?.data) return 'No economy data available.';
    try {
      const users = Object.entries(this.economy.data)
        .filter(([k]) => !['_meta'].includes(k))
        .map(([id, u]) => ({ id, name: u.username || 'Unknown', balance: u.balance || 0 }))
        .sort((a, b) => b.balance - a.balance);

      if (users.length === 0) return 'No economy activity.';
      const richest = users[0];
      const poorest = users[users.length - 1];
      return `Richest: ${richest.name} (${richest.balance} coins). Poorest: ${poorest.name} (${poorest.balance} coins). ${users.length} total members.`;
    } catch {
      return 'Economy data unclear.';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Dream Generation
  // ═══════════════════════════════════════════════════════════════

  async generateDream() {
    const dayData = this.collectDayData();
    const currentMood = this.mood ? this.mood.deriveMood() : 'contemplative';

    const sinsBlock = dayData.sins.length > 0
      ? dayData.sins.map(s => `${s.username} committed: ${s.sins.join(', ')}`).join('; ')
      : 'The Lodge was surprisingly virtuous today.';

    const quotesBlock = dayData.counters.memorableQuotes.length > 0
      ? dayData.counters.memorableQuotes.map(q => `"${q.quote}" —${q.username}`).join('; ')
      : 'Nothing stood out.';

    const sermonsBlock = dayData.counters.sermonTopics.length > 0
      ? dayData.counters.sermonTopics.join(', ')
      : 'None requested.';

    const moodBlock = dayData.mood
      ? `Mood transitions: ${dayData.mood.transitions.map(t => `${t.from}→${t.to}`).join(', ') || 'None'}. Ended as ${currentMood}.`
      : `Mood: ${currentMood}`;

    const prompt = `You are Jenkins, and you are DREAMING. You have fallen asleep after a day in the Lodge. Here is what happened today:

MOOD: ${moodBlock}
SINS WITNESSED: ${sinsBlock}
ECONOMY: ${dayData.economy}
VOICE: ${dayData.counters.voiceConversations} conversations in the Tavern (${dayData.counters.voiceMinutes} minutes total).
STARBOARD: ${dayData.starCount} messages immortalized in the Hall of Fame.
HOT TAKES: ${dayData.counters.hotTakes} hot takes delivered. ${dayData.counters.stavrosBreaks} Stavros breaks.
DUELS: ${dayData.counters.duelsResolved} duels resolved.
SERMONS: ${sermonsBlock}
MEMORABLE QUOTES: ${quotesBlock}

Now DREAM. Write a surreal, distorted dream journal entry. Real events from the day appear but twisted — people become mythic figures, games become real places, coins become literal gold, sins become physical manifestations. Use present tense. Reference Brethren by name where possible. The dream should feel like it MEANS something even if it's nonsensical.

Write it as: "The Architect dreamed..."

Make it literary, strange, occasionally terrifying, sometimes beautiful. End with a cryptic one-line interpretation that might be prophecy. Keep it under 1500 characters.`;

    try {
      const dream = await chat(this.deepseek, this.systemPrompt, prompt);
      if (!dream || dream.includes("Architect's gaze turns inward") || dream.includes("Architect's vision clouds")) {
        throw new Error('DeepSeek returned fallback');
      }
      return dream;
    } catch (e) {
      log.error({ err: e }, 'Dream generation error');
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Post Dream — called by scheduler
  // ═══════════════════════════════════════════════════════════════

  async postDream(guild, channelId) {
    const dream = await this.generateDream();
    if (!dream) return null;

    const currentMood = this.mood ? this.mood.deriveMood() : 'contemplative';
    this.data.idCounter++;
    const dreamNumber = this.data.idCounter;

    const entry = {
      id: dreamNumber,
      date: new Date().toISOString().split('T')[0],
      content: dream,
      mood: currentMood,
      timestamp: Date.now(),
    };

    this.data.dreams.push(entry);
    if (this.data.dreams.length > MAX_DREAMS) {
      this.data.dreams = this.data.dreams.slice(-MAX_DREAMS);
    }
    this.data.lastDreamDate = entry.date;
    this.save();

    // Reset day counters
    this.dayCounters = this.freshCounters();

    // Dreaming is restorative
    if (this.mood) this.mood.onDream();

    // Post to channel
    const channel = guild.channels.cache.get(channelId) ||
      guild.channels.cache.find(ch => ch.name.includes('jenkins') && ch.isTextBased());

    if (channel) {
      try {
        await channel.send({ embeds: [this.dreamEmbed(entry)] });
        log.info({ dreamId: dreamNumber, mood: currentMood }, 'Dream posted');
      } catch (e) {
        log.error({ err: e }, 'Failed to post dream');
      }
    }

    return entry;
  }

  // ═══════════════════════════════════════════════════════════════
  // Scheduling — set up the 3 AM dream cycle
  // ═══════════════════════════════════════════════════════════════

  scheduleDream(client, channelId) {
    const checkAndDream = async () => {
      const now = new Date();
      const hour = now.getHours();
      const today = now.toISOString().split('T')[0];

      // Only dream at the right hour and once per day
      if (hour !== DREAM_HOUR) return;
      if (this.data.lastDreamDate === today) return;

      log.info('Dream time — entering dreamscape');

      for (const guild of client.guilds.cache.values()) {
        try {
          await this.postDream(guild, channelId);
        } catch (e) {
          log.error({ guildId: guild.id, err: e }, 'Dream failed for guild');
        }
      }
    };

    // Check every 15 minutes
    this._checkInterval = setInterval(checkAndDream, CHECK_INTERVAL);

    // Calculate time to next dream hour for logging
    const now = new Date();
    const next = new Date();
    next.setHours(DREAM_HOUR, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const hoursUntil = Math.round((next - now) / 3600000 * 10) / 10;
    log.info({ hoursUntil }, 'Dream schedule armed');
  }

  // ═══════════════════════════════════════════════════════════════
  // Embeds
  // ═══════════════════════════════════════════════════════════════

  dreamEmbed(entry) {
    const moodColors = {
      wrathful: 0x8B0000, ecstatic: 0x2C1654, manic: 0x4A0E4E,
      melancholic: 0x0D1B2A, benevolent: 0x1B2A1B, suspicious: 0x2A1B0D,
      contemplative: 0x1A1A2E,
    };

    return new EmbedBuilder()
      .setColor(moodColors[entry.mood] || 0x1A1A2E)
      .setTitle(`\uD83D\uDCA4 Dream Journal \u2014 Entry #${entry.id}`)
      .setDescription(entry.content)
      .addFields(
        { name: 'Mood at Sleep', value: entry.mood, inline: true },
        { name: 'Date', value: entry.date, inline: true },
      )
      .setFooter({ text: 'The Architect dreams of his flock... | !dream for latest | !dreams for archive' })
      .setTimestamp(new Date(entry.timestamp));
  }

  lastDreamEmbed() {
    const last = this.data.dreams[this.data.dreams.length - 1];
    if (!last) return null;
    return this.dreamEmbed(last);
  }

  dreamListEmbed() {
    const recent = this.data.dreams.slice(-10).reverse();
    if (recent.length === 0) {
      return new EmbedBuilder()
        .setColor(0x1A1A2E)
        .setTitle('\uD83D\uDCA4 Dream Archive')
        .setDescription('The Architect has not yet dreamed. The void is silent.')
        .setFooter({ text: 'Dreams occur at 3 AM.' });
    }

    const lines = recent.map(d => {
      const preview = d.content.substring(0, 80).replace(/\n/g, ' ') + '...';
      return `**#${d.id}** (${d.date}) \u2014 ${preview}`;
    });

    return new EmbedBuilder()
      .setColor(0x1A1A2E)
      .setTitle('\uD83D\uDCA4 Dream Archive')
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `${this.data.dreams.length} dreams recorded | !dream for latest` });
  }

  // ═══════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════

  destroy() {
    if (this._checkInterval) clearInterval(this._checkInterval);
    this.save();
  }
}

module.exports = { DreamJournal };
