// ═══════════════════════════════════════════════════════════════
//  VOICE REWARDS — Earn Torch Coins for voice channel activity
//  "The Architect rewards those who speak, not those who lurk."
// ═══════════════════════════════════════════════════════════════
const log = require('./logger').child('VoiceRewards');

const TICK_INTERVAL = 60_000; // Check every 60 seconds
const COINS_PER_TICK = 15;   // 15 coins per minute in voice
const MIN_USERS = 2;         // Need at least 2 non-bot, non-deaf users
const DAILY_CAP = 3000;      // Max 3000 coins per day from voice (prevents AFK farming)
const AFK_CHANNEL_NAMES = ['afk', 'away']; // Don't reward AFK channels

class VoiceRewards {
  constructor(economy) {
    this.economy = economy;
    this.dailyEarnings = new Map(); // userId -> { date, earned }
    this.sessions = new Map();      // guildId:userId -> joinTime
    this.interval = null;
  }

  start(client) {
    this.client = client;
    this.interval = setInterval(() => this.tick(), TICK_INTERVAL);
    log.info('Voice rewards online');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  tick() {
    if (!this.client) return;

    const today = new Date().toISOString().split('T')[0];

    for (const guild of this.client.guilds.cache.values()) {
      for (const [, channel] of guild.channels.cache) {
        if (!channel.isVoiceBased()) continue;

        // Skip AFK channels
        if (AFK_CHANNEL_NAMES.some(n => channel.name.toLowerCase().includes(n))) continue;
        if (guild.afkChannelId && channel.id === guild.afkChannelId) continue;

        // Get eligible members (non-bot, non-deafened, non-muted)
        const eligible = channel.members.filter(
          m => !m.user.bot && !m.voice.deaf && !m.voice.selfDeaf
        );

        // Need minimum users for rewards
        if (eligible.size < MIN_USERS) continue;

        for (const [userId, member] of eligible) {
          // Check daily cap
          const dailyKey = this.dailyEarnings.get(userId);
          if (dailyKey && dailyKey.date === today && dailyKey.earned >= DAILY_CAP) continue;

          // Award coins
          const user = this.economy.getUser(userId);
          user.balance += COINS_PER_TICK;
          user.totalEarned += COINS_PER_TICK;
          if (!user.voiceMinutes) user.voiceMinutes = 0;
          user.voiceMinutes++;

          // Track daily earnings
          if (!dailyKey || dailyKey.date !== today) {
            this.dailyEarnings.set(userId, { date: today, earned: COINS_PER_TICK });
          } else {
            dailyKey.earned += COINS_PER_TICK;
          }
        }
      }
    }
  }

  // Get user's voice stats
  getStats(userId) {
    const user = this.economy.getUser(userId);
    const today = new Date().toISOString().split('T')[0];
    const daily = this.dailyEarnings.get(userId);
    return {
      totalMinutes: user.voiceMinutes || 0,
      todayEarned: (daily && daily.date === today) ? daily.earned : 0,
      dailyCap: DAILY_CAP,
      coinsPerMin: COINS_PER_TICK,
    };
  }
}

module.exports = { VoiceRewards };
