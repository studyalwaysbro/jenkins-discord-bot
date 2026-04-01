// ═══════════════════════════════════════════════════════════════
//  DUELS — 1v1 Torch Coin wagers between members
//  "In the Lodge, disputes are settled with coin, not words."
// ═══════════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');

const DUEL_TIMEOUT = 60_000; // 60 seconds to accept
const DUEL_COOLDOWN = 120_000; // 2 minutes between duels per user

class DuelSystem {
  constructor(economy) {
    this.economy = economy;
    this.pending = new Map(); // challengerId -> { targetId, amount, channelId, timestamp }
    this.cooldowns = new Map(); // userId -> timestamp
  }

  challenge(challengerId, targetId, amount, channelId) {
    // Validations
    if (challengerId === targetId) return { success: false, message: 'You can\'t duel yourself. That\'s just gambling with extra steps.' };

    const now = Date.now();
    const cooldown = this.cooldowns.get(challengerId);
    if (cooldown && now - cooldown < DUEL_COOLDOWN) {
      const secs = Math.ceil((DUEL_COOLDOWN - (now - cooldown)) / 1000);
      return { success: false, message: `Cooldown: ${secs}s. The Architect demands patience between duels.` };
    }

    if (amount <= 0) return { success: false, message: 'Wager must be positive.' };

    const challenger = this.economy.getUser(challengerId);
    if (amount > challenger.balance) return { success: false, message: `You only have 🪙 ${challenger.balance}. Don't write checks you can't cash.` };

    const target = this.economy.getUser(targetId);
    if (amount > target.balance) return { success: false, message: `Your opponent can't cover that wager. They only have 🪙 ${target.balance}.` };

    // Check for existing pending duel
    if (this.pending.has(challengerId)) return { success: false, message: 'You already have a pending duel. Wait for it to expire or be accepted.' };

    this.pending.set(challengerId, {
      targetId,
      amount,
      channelId,
      timestamp: now,
    });

    // Auto-expire
    setTimeout(() => {
      if (this.pending.has(challengerId)) {
        this.pending.delete(challengerId);
      }
    }, DUEL_TIMEOUT);

    return { success: true };
  }

  accept(targetId) {
    // Find a pending duel targeting this user
    let foundChallengerId = null;
    for (const [challengerId, duel] of this.pending) {
      if (duel.targetId === targetId) {
        foundChallengerId = challengerId;
        break;
      }
    }

    if (!foundChallengerId) return { success: false, message: 'No pending duel found for you.' };

    const duel = this.pending.get(foundChallengerId);
    this.pending.delete(foundChallengerId);

    // Re-validate balances
    const challenger = this.economy.getUser(foundChallengerId);
    const target = this.economy.getUser(targetId);

    if (duel.amount > challenger.balance) return { success: false, message: 'Challenger can no longer cover the wager!' };
    if (duel.amount > target.balance) return { success: false, message: 'You can no longer cover the wager!' };

    // FIGHT! Weighted coin flip with drama
    const roll = Math.random();
    const challengerWins = roll < 0.5;

    const winnerId = challengerWins ? foundChallengerId : targetId;
    const loserId = challengerWins ? targetId : foundChallengerId;

    const winner = this.economy.getUser(winnerId);
    const loser = this.economy.getUser(loserId);

    winner.balance += duel.amount;
    winner.totalEarned += duel.amount;
    if (!winner.duelsWon) winner.duelsWon = 0;
    winner.duelsWon++;

    loser.balance -= duel.amount;
    loser.totalLost += duel.amount;
    if (!loser.duelsLost) loser.duelsLost = 0;
    loser.duelsLost++;

    this.economy.save();

    // Set cooldowns for both
    this.cooldowns.set(foundChallengerId, Date.now());
    this.cooldowns.set(targetId, Date.now());

    return {
      success: true,
      challengerId: foundChallengerId,
      targetId,
      winnerId,
      loserId,
      amount: duel.amount,
      winnerBalance: winner.balance,
      loserBalance: loser.balance,
      roll,
    };
  }

  decline(targetId) {
    for (const [challengerId, duel] of this.pending) {
      if (duel.targetId === targetId) {
        this.pending.delete(challengerId);
        return { success: true, challengerId };
      }
    }
    return { success: false, message: 'No pending duel to decline.' };
  }

  resultEmbed(result, guild) {
    const winner = guild.members.cache.get(result.winnerId);
    const loser = guild.members.cache.get(result.loserId);
    const winnerName = winner?.displayName || 'Unknown';
    const loserName = loser?.displayName || 'Unknown';

    // Drama based on margin
    const close = result.roll > 0.45 && result.roll < 0.55;
    const decisive = result.roll < 0.1 || result.roll > 0.9;

    let flavor;
    if (decisive) {
      flavor = `**${winnerName}** absolutely DESTROYED **${loserName}**. It wasn't even close. The Architect is impressed.`;
    } else if (close) {
      flavor = `A razor-thin victory! **${winnerName}** barely scrapes past **${loserName}**. The Lodge holds its breath.`;
    } else {
      flavor = `**${winnerName}** defeats **${loserName}** in honorable combat. The Torch Coins change hands.`;
    }

    return new EmbedBuilder()
      .setColor(0xFF6B35)
      .setTitle('⚔️ DUEL RESULT')
      .setDescription(flavor)
      .addFields(
        { name: '🏆 Winner', value: `${winnerName}\n+🪙 ${result.amount.toLocaleString()}\nBalance: 🪙 ${result.winnerBalance.toLocaleString()}`, inline: true },
        { name: '💀 Loser', value: `${loserName}\n-🪙 ${result.amount.toLocaleString()}\nBalance: 🪙 ${result.loserBalance.toLocaleString()}`, inline: true },
      )
      .setFooter({ text: 'In the Lodge, disputes are settled with coin.' });
  }
}

module.exports = { DuelSystem };
