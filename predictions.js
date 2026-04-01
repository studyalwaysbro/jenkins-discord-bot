// ═══════════════════════════════════════════════════════════════
//  PREDICTIONS — Bet Torch Coins on outcomes
//  "The Architect sees all futures. Can you?"
// ═══════════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const log = require('./logger').child('Predictions');
const { dbRead, dbWrite } = require('./db');
const MIN_BET = 50;
const MAX_BET = 10000;

class PredictionMarket {
  constructor(economy) {
    this.economy = economy;
    this.data = this.load();
  }

  load() {
    return dbRead('predictions', { markets: [], idCounter: 0, history: [] });
  }

  save() {
    dbWrite('predictions', this.data);
  }

  // Create a new prediction market
  create(question, options, creatorId) {
    if (!question || options.length < 2) {
      return { success: false, message: 'Need a question and at least 2 options. Usage: `!predict "question" option1 | option2 | option3`' };
    }
    if (options.length > 6) {
      return { success: false, message: 'Maximum 6 options.' };
    }

    this.data.idCounter++;
    const id = `P-${String(this.data.idCounter).padStart(3, '0')}`;

    const market = {
      id,
      question,
      options: options.map(o => ({
        name: o.trim(),
        bets: {}, // userId -> amount
        totalPool: 0,
      })),
      creatorId,
      status: 'open', // open, closed, resolved
      createdAt: Date.now(),
      resolvedOption: null,
    };

    this.data.markets.push(market);
    this.save();
    return { success: true, market };
  }

  // Place a bet
  bet(marketId, optionIndex, userId, amount) {
    const market = this.data.markets.find(m => m.id === marketId);
    if (!market) return { success: false, message: 'Market not found.' };
    if (market.status !== 'open') return { success: false, message: 'This market is no longer accepting bets.' };
    if (optionIndex < 1 || optionIndex > market.options.length) {
      return { success: false, message: `Pick an option 1-${market.options.length}.` };
    }
    if (amount < MIN_BET) return { success: false, message: `Minimum bet: 🪙 ${MIN_BET}` };
    if (amount > MAX_BET) return { success: false, message: `Maximum bet: 🪙 ${MAX_BET}` };

    const user = this.economy.getUser(userId);
    if (amount > user.balance) return { success: false, message: `You only have 🪙 ${user.balance}.` };

    // Check if user already bet on a different option
    for (let i = 0; i < market.options.length; i++) {
      if (i !== optionIndex - 1 && market.options[i].bets[userId]) {
        return { success: false, message: `You already bet on "${market.options[i].name}". Can't bet on multiple options.` };
      }
    }

    const option = market.options[optionIndex - 1];

    // Deduct from wallet
    user.balance -= amount;
    user.totalLost += amount; // tracked as "at risk"

    // Add to existing bet or create new
    if (option.bets[userId]) {
      option.bets[userId] += amount;
    } else {
      option.bets[userId] = amount;
    }
    option.totalPool += amount;

    this.economy.save();
    this.save();

    const totalPool = market.options.reduce((sum, o) => sum + o.totalPool, 0);
    const odds = totalPool / (option.totalPool || 1);

    return {
      success: true,
      market,
      optionName: option.name,
      betAmount: option.bets[userId],
      odds: odds.toFixed(1),
      totalPool,
    };
  }

  // Close betting (no more bets accepted)
  close(marketId, userId) {
    const market = this.data.markets.find(m => m.id === marketId);
    if (!market) return { success: false, message: 'Market not found.' };
    if (market.creatorId !== userId) return { success: false, message: 'Only the creator can close this market.' };
    if (market.status !== 'open') return { success: false, message: 'Market is already closed.' };

    market.status = 'closed';
    this.save();
    return { success: true, market };
  }

  // Resolve a market — pay out winners
  resolve(marketId, winningOption, userId) {
    const market = this.data.markets.find(m => m.id === marketId);
    if (!market) return { success: false, message: 'Market not found.' };
    if (market.creatorId !== userId) return { success: false, message: 'Only the creator can resolve this market.' };
    if (market.status === 'resolved') return { success: false, message: 'Already resolved.' };
    if (winningOption < 1 || winningOption > market.options.length) {
      return { success: false, message: `Pick the winning option (1-${market.options.length}).` };
    }

    market.status = 'resolved';
    market.resolvedOption = winningOption - 1;

    const winner = market.options[market.resolvedOption];
    const totalPool = market.options.reduce((sum, o) => sum + o.totalPool, 0);

    // Pay out proportionally from the total pool
    const payouts = [];
    if (winner.totalPool > 0) {
      for (const [betUserId, betAmount] of Object.entries(winner.bets)) {
        const share = betAmount / winner.totalPool;
        const payout = Math.floor(totalPool * share);
        const profit = payout - betAmount;

        const user = this.economy.getUser(betUserId);
        user.balance += payout;
        user.totalEarned += profit > 0 ? profit : 0;
        // Undo the "at risk" tracking
        user.totalLost -= betAmount;
        if (!user.predictionsWon) user.predictionsWon = 0;
        user.predictionsWon++;

        payouts.push({ userId: betUserId, betAmount, payout, profit });
      }
    }

    // Track losses for non-winners
    for (let i = 0; i < market.options.length; i++) {
      if (i === market.resolvedOption) continue;
      for (const betUserId of Object.keys(market.options[i].bets)) {
        const user = this.economy.getUser(betUserId);
        if (!user.predictionsLost) user.predictionsLost = 0;
        user.predictionsLost++;
      }
    }

    this.economy.save();
    this.save();

    // Move to history
    this.data.history.push(market);
    this.data.markets = this.data.markets.filter(m => m.id !== marketId);
    this.save();

    return { success: true, market, winnerOption: winner.name, totalPool, payouts };
  }

  // List active markets
  listActive() {
    return this.data.markets.filter(m => m.status === 'open' || m.status === 'closed');
  }

  // Build market embed
  marketEmbed(market, guild) {
    const totalPool = market.options.reduce((sum, o) => sum + o.totalPool, 0);
    const statusEmoji = market.status === 'open' ? '🟢 OPEN' : market.status === 'closed' ? '🔴 CLOSED' : '✅ RESOLVED';

    const optionLines = market.options.map((o, i) => {
      const betCount = Object.keys(o.bets).length;
      const pct = totalPool > 0 ? Math.round((o.totalPool / totalPool) * 100) : 0;
      const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      return `**${i + 1}.** ${o.name}\n${bar} ${pct}% (🪙 ${o.totalPool.toLocaleString()}, ${betCount} bets)`;
    });

    const creator = guild?.members.cache.get(market.creatorId);

    return new EmbedBuilder()
      .setColor(market.status === 'open' ? 0x00FF41 : market.status === 'closed' ? 0xFF3333 : 0xFFD700)
      .setTitle(`🔮 ${market.question}`)
      .setDescription(optionLines.join('\n\n'))
      .addFields(
        { name: 'Status', value: statusEmoji, inline: true },
        { name: 'Total Pool', value: `🪙 ${totalPool.toLocaleString()}`, inline: true },
        { name: 'Market ID', value: `\`${market.id}\``, inline: true },
      )
      .setFooter({ text: `Created by ${creator?.displayName || 'Unknown'} | !bet ${market.id} <option#> <amount>` });
  }

  // Payout embed
  payoutEmbed(result, guild) {
    const lines = result.payouts
      .sort((a, b) => b.payout - a.payout)
      .slice(0, 10)
      .map(p => {
        const member = guild?.members.cache.get(p.userId);
        const name = member?.displayName || 'Unknown';
        return `${name}: bet 🪙 ${p.betAmount} → won 🪙 **${p.payout}** (+${p.profit})`;
      });

    return new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`🔮 RESOLVED: ${result.market.question}`)
      .setDescription(`**Winner: ${result.winnerOption}**\n\nTotal pool: 🪙 ${result.totalPool.toLocaleString()}\n\n${lines.join('\n') || 'No winners!'}`)
      .setFooter({ text: 'The Architect sees all futures.' });
  }
}

module.exports = { PredictionMarket };
