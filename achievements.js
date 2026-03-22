// ═══════════════════════════════════════════════════════════════
//  ACHIEVEMENT SYSTEM — Roguelike-inspired progression
//  "Every legend starts with a first message."
// ═══════════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');

// Achievement definitions
const ACHIEVEMENTS = [
  { id: 'first_blood', name: '🩸 First Blood', desc: 'Send your first message', check: u => u.messagesCount >= 1 },
  { id: 'chatterbox', name: '💬 Chatterbox', desc: 'Send 100 messages', check: u => u.messagesCount >= 100 },
  { id: 'motormouth', name: '🗣️ Motormouth', desc: 'Send 1,000 messages', check: u => u.messagesCount >= 1000 },
  { id: 'torch_lit', name: '🔥 Torch Lit', desc: 'Claim your first daily', check: u => u.dailyStreak >= 1 },
  { id: 'on_fire', name: '🔥🔥 On Fire', desc: '7-day daily streak', check: u => u.dailyStreak >= 7 },
  { id: 'eternal_flame', name: '🔥🔥🔥 Eternal Flame', desc: '30-day daily streak', check: u => u.dailyStreak >= 30 },
  { id: 'pocket_change', name: '🪙 Pocket Change', desc: 'Have 1,000 Torch Coins', check: u => u.balance >= 1000 },
  { id: 'stacked', name: '💰 Stacked', desc: 'Have 10,000 Torch Coins', check: u => u.balance >= 10000 },
  { id: 'whale_alert', name: '🐋 Whale Alert', desc: 'Have 100,000 Torch Coins', check: u => u.balance >= 100000 },
  { id: 'degen_baptism', name: '🎰 Degen Baptism', desc: 'Win your first gamble', check: u => u.gamblesWon >= 1 },
  { id: 'high_roller', name: '🎲 High Roller', desc: 'Win 25 gambles', check: u => u.gamblesWon >= 25 },
  { id: 'down_bad', name: '📉 Down Bad', desc: 'Lose 10 gambles', check: u => u.gamblesLost >= 10 },
  { id: 'dungeon_crawler', name: '⚔️ Dungeon Crawler', desc: 'Complete 5 dungeon runs', check: u => u.dungeonRuns >= 5 },
  { id: 'dungeon_master', name: '🏰 Dungeon Master', desc: 'Win 25 dungeon runs', check: u => u.dungeonWins >= 25 },
  { id: 'war_room', name: '🎮 War Room Veteran', desc: 'Attend 5 game nights', check: u => (u.gamesAttended || 0) >= 5 },
  { id: 'diamond_hands', name: '💎 Diamond Hands', desc: 'Hold 10k+ coins for 7 days without gambling', check: u => u.balance >= 10000 && (u.daysSinceGamble || 0) >= 7 },
  { id: 'paper_hands', name: '🧻 Paper Hands', desc: 'Go from 10k+ to under 1k', check: u => u.totalEarned >= 10000 && u.balance < 1000 },
  { id: 'objection', name: '⚖️ Objection!', desc: 'Get judged by Jenkins 10 times', check: u => (u.jenkinsJudgments || 0) >= 10 },
  { id: 'generous', name: '🎁 Generous', desc: 'Give away 5,000+ coins total', check: u => (u.totalGiven || 0) >= 5000 },
];

class AchievementSystem {
  constructor(economy) {
    this.economy = economy;
  }

  // Check and award new achievements, returns newly unlocked ones
  check(userId) {
    const user = this.economy.getUser(userId);
    if (!user.achievements) user.achievements = [];

    const newlyUnlocked = [];
    for (const ach of ACHIEVEMENTS) {
      if (user.achievements.includes(ach.id)) continue;
      if (ach.check(user)) {
        user.achievements.push(ach.id);
        newlyUnlocked.push(ach);
      }
    }

    if (newlyUnlocked.length > 0) this.economy.save();
    return newlyUnlocked;
  }

  // Build embed showing user's achievements
  profileEmbed(userId, username) {
    const user = this.economy.getUser(userId);
    if (!user.achievements) user.achievements = [];

    const unlocked = ACHIEVEMENTS.filter(a => user.achievements.includes(a.id));
    const locked = ACHIEVEMENTS.filter(a => !user.achievements.includes(a.id));

    const unlockedStr = unlocked.map(a => `${a.name}`).join('\n') || 'None yet — start chatting!';
    const lockedStr = locked.slice(0, 5).map(a => `🔒 ~~${a.name}~~ — *${a.desc}*`).join('\n');

    return new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`🏆 ${username}'s Achievements`)
      .setDescription(`**${unlocked.length}/${ACHIEVEMENTS.length}** unlocked`)
      .addFields(
        { name: 'Unlocked', value: unlockedStr, inline: false },
        { name: 'Next Up', value: lockedStr || 'All unlocked! You absolute legend.', inline: false },
      )
      .setFooter({ text: 'Earn achievements by chatting, gambling, dungeon runs, and game nights' });
  }

  // Notification embed for a newly unlocked achievement
  unlockEmbed(achievement, username) {
    return new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 ACHIEVEMENT UNLOCKED!')
      .setDescription(`**${username}** just unlocked:\n\n${achievement.name}\n*${achievement.desc}*`)
      .setFooter({ text: 'Pass The Torch — Achievement System' });
  }
}

module.exports = { AchievementSystem, ACHIEVEMENTS };
