// ═══════════════════════════════════════════════════════════════
//  TORCH ECONOMY — Custom currency system for Pass The Torch
//  "Jenkins is the house. The house always wins."
// ═══════════════════════════════════════════════════════════════

const path = require('path');
const { EmbedBuilder } = require('discord.js');
const log = require('./logger').child('Economy');
const { safeWriteJSON, safeReadJSON } = require('./safe-write');

const DATA_FILE = path.join(__dirname, 'data', 'economy.json');
const CHAT_COOLDOWN = 60_000; // 1 min between chat earnings
const DAILY_AMOUNT = 500;
const CHAT_EARN = { min: 5, max: 25 };
const START_BALANCE = 100;

// Dungeon rooms (roguelike flavor)
const DUNGEON_ROOMS = [
  { name: 'Goblin Hoard', risk: 0.6, multi: 2, flavor: 'You stumble into a room full of goblins counting coins...' },
  { name: 'Dragon\'s Lair', risk: 0.3, multi: 5, flavor: 'A dragon sleeps atop a mountain of Torch Coins...' },
  { name: 'Mimic Chest', risk: 0.5, multi: 3, flavor: 'A suspicious chest sits in the center of the room...' },
  { name: 'Cursed Altar', risk: 0.4, multi: 4, flavor: 'Dark energy swirls around a sacrificial altar...' },
  { name: 'Merchant\'s Rest', risk: 0.8, multi: 1.5, flavor: 'A friendly merchant offers you a deal...' },
  { name: 'The Abyss', risk: 0.15, multi: 10, flavor: 'You peer into the infinite void... it stares back.' },
  { name: 'Jenkins\' Vault', risk: 0.25, multi: 7, flavor: 'You\'ve found Jenkins\' private stash. He won\'t be happy.' },
  { name: 'Torch Shrine', risk: 0.7, multi: 2, flavor: 'A warm flame illuminates ancient coins on the ground...' },
];

class Economy {
  constructor() {
    this.data = this.load();
    this.chatCooldowns = new Map();
    // Auto-save every 5 min
    setInterval(() => this.save(), 300_000);
  }

  load() {
    return safeReadJSON(DATA_FILE, {});
  }

  save() {
    safeWriteJSON(DATA_FILE, this.data);
  }

  getUser(userId) {
    if (!this.data[userId]) {
      this.data[userId] = {
        balance: START_BALANCE,
        totalEarned: START_BALANCE,
        totalLost: 0,
        dailyStreak: 0,
        lastDaily: null,
        messagesCount: 0,
        dungeonRuns: 0,
        dungeonWins: 0,
        betsWon: 0,
        betsLost: 0,
        gamblesWon: 0,
        gamblesLost: 0,
      };
    }
    return this.data[userId];
  }

  // Passive chat earning
  onMessage(userId) {
    const now = Date.now();
    const lastChat = this.chatCooldowns.get(userId) || 0;
    if (now - lastChat < CHAT_COOLDOWN) return 0;

    this.chatCooldowns.set(userId, now);
    const user = this.getUser(userId);
    const earned = Math.floor(Math.random() * (CHAT_EARN.max - CHAT_EARN.min + 1)) + CHAT_EARN.min;
    user.balance += earned;
    user.totalEarned += earned;
    user.messagesCount++;
    return earned;
  }

  // Daily claim
  daily(userId) {
    const user = this.getUser(userId);
    const today = new Date().toISOString().split('T')[0];

    if (user.lastDaily === today) {
      return { success: false, message: 'You already claimed your daily! Come back tomorrow.' };
    }

    // Check streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (user.lastDaily === yesterday) {
      user.dailyStreak++;
    } else {
      user.dailyStreak = 1;
    }

    const streakBonus = Math.min(user.dailyStreak * 50, 500);
    const total = DAILY_AMOUNT + streakBonus;
    user.balance += total;
    user.totalEarned += total;
    user.lastDaily = today;
    this.save();

    return {
      success: true,
      amount: total,
      base: DAILY_AMOUNT,
      streakBonus,
      streak: user.dailyStreak,
      balance: user.balance,
    };
  }

  // Coin flip gamble
  gamble(userId, amount) {
    const user = this.getUser(userId);
    if (amount <= 0) return { success: false, message: 'Nice try.' };
    if (amount > user.balance) return { success: false, message: `You only have 🪙 ${user.balance}. Can't bet what you don't have.` };

    const win = Math.random() < 0.48; // Slight house edge
    if (win) {
      user.balance += amount;
      user.totalEarned += amount;
      user.gamblesWon++;
      this.save();
      return { success: true, won: true, amount, balance: user.balance };
    } else {
      user.balance -= amount;
      user.totalLost += amount;
      user.gamblesLost++;
      this.save();
      return { success: true, won: false, amount, balance: user.balance };
    }
  }

  // Dungeon run (roguelike mechanic)
  dungeon(userId, wager) {
    const user = this.getUser(userId);
    if (wager <= 0) return { success: false, message: 'You need to wager something to enter the dungeon.' };
    if (wager > user.balance) return { success: false, message: `You only have 🪙 ${user.balance}. The dungeon demands more respect.` };

    const room = DUNGEON_ROOMS[Math.floor(Math.random() * DUNGEON_ROOMS.length)];
    const survived = Math.random() < room.risk;
    user.dungeonRuns++;

    if (survived) {
      const reward = Math.floor(wager * room.multi);
      user.balance += reward;
      user.totalEarned += reward;
      user.dungeonWins++;
      this.save();
      return {
        success: true, survived: true,
        room: room.name, flavor: room.flavor,
        wager, reward, multi: room.multi,
        balance: user.balance,
      };
    } else {
      user.balance -= wager;
      user.totalLost += wager;
      this.save();
      return {
        success: true, survived: false,
        room: room.name, flavor: room.flavor,
        wager, balance: user.balance,
      };
    }
  }

  // Give coins to another user
  give(fromId, toId, amount) {
    const from = this.getUser(fromId);
    if (amount <= 0) return { success: false, message: 'Nice try.' };
    if (amount > from.balance) return { success: false, message: `You only have 🪙 ${from.balance}.` };

    const to = this.getUser(toId);
    from.balance -= amount;
    to.balance += amount;
    to.totalEarned += amount;
    this.save();
    return { success: true, amount, fromBalance: from.balance, toBalance: to.balance };
  }

  // Leaderboard
  leaderboard(limit = 10) {
    return Object.entries(this.data)
      .sort(([, a], [, b]) => b.balance - a.balance)
      .slice(0, limit)
      .map(([id, data], i) => ({ rank: i + 1, userId: id, ...data }));
  }

  // Build embed for balance
  balanceEmbed(userId, username) {
    const user = this.getUser(userId);
    return new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`🪙 ${username}'s Torch Wallet`)
      .addFields(
        { name: 'Balance', value: `🪙 **${user.balance.toLocaleString()}**`, inline: true },
        { name: 'Total Earned', value: `📈 ${user.totalEarned.toLocaleString()}`, inline: true },
        { name: 'Total Lost', value: `📉 ${user.totalLost.toLocaleString()}`, inline: true },
        { name: 'Messages', value: `💬 ${user.messagesCount}`, inline: true },
        { name: 'Daily Streak', value: `🔥 ${user.dailyStreak}`, inline: true },
        { name: 'Dungeon W/L', value: `⚔️ ${user.dungeonWins}/${user.dungeonRuns - user.dungeonWins}`, inline: true },
        { name: 'Gambles W/L', value: `🎰 ${user.gamblesWon}/${user.gamblesLost}`, inline: true },
      )
      .setFooter({ text: 'The house always wins. — Jenkins' });
  }

  // Build leaderboard embed
  leaderboardEmbed(guild) {
    const top = this.leaderboard();
    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map((entry, i) => {
      const medal = medals[i] || `**${entry.rank}.**`;
      const member = guild.members.cache.get(entry.userId);
      const name = member ? member.displayName : 'Unknown';
      return `${medal} ${name} — 🪙 **${entry.balance.toLocaleString()}**`;
    });

    return new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Torch Coin Leaderboard')
      .setDescription(lines.join('\n') || 'No one has any coins yet!')
      .setFooter({ text: 'Earn coins by chatting, daily claims, gambling, and dungeon runs' });
  }
}

module.exports = { Economy };
