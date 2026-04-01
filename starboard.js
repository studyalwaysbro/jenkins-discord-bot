// ═══════════════════════════════════════════════════════════════
//  STARBOARD — The Hall of Fame for legendary messages
//  "The Architect immortalizes only the worthy."
// ═══════════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const log = require('./logger').child('Starboard');
const { dbRead, dbWrite } = require('./db');
const STAR_EMOJI = '⭐';
const STAR_THRESHOLD = 3;        // Reactions needed to get starred
const STARBOARD_CHANNEL = 'hall-of-fame';
const BONUS_COINS = 100;         // Coins for getting starred

class Starboard {
  constructor(economy) {
    this.economy = economy;
    this.data = this.load();
  }

  load() {
    return dbRead('starboard', { starred: {} });
  }

  save() {
    dbWrite('starboard', this.data);
  }

  async handleReaction(reaction, user) {
    if (user.bot) return;
    if (reaction.emoji.name !== STAR_EMOJI) return;

    const message = reaction.message;
    if (message.author.bot) return;

    // Don't star messages from the starboard channel itself
    if (message.channel.name === STARBOARD_CHANNEL) return;

    // Can't star your own message
    const starReaction = message.reactions.cache.get(STAR_EMOJI);
    if (!starReaction) return;

    // Count stars (excluding the author)
    let starCount;
    try {
      const users = await starReaction.users.fetch();
      starCount = users.filter(u => u.id !== message.author.id).size;
    } catch {
      starCount = starReaction.count || 0;
    }

    if (starCount < STAR_THRESHOLD) return;

    const guild = message.guild;
    const starboardChannel = guild.channels.cache.find(
      ch => ch.name === STARBOARD_CHANNEL && ch.isTextBased()
    );

    if (!starboardChannel) return;

    const embed = this.buildStarEmbed(message, starCount);

    // Already starred? Update the star count
    if (this.data.starred[message.id]) {
      try {
        const existing = await starboardChannel.messages.fetch(this.data.starred[message.id].starboardMsgId);
        await existing.edit({ embeds: [embed] });
        this.data.starred[message.id].stars = starCount;
        this.save();
      } catch {
        // Message was deleted, re-post
        delete this.data.starred[message.id];
      }
      return;
    }

    // New star! Post to starboard
    try {
      const starMsg = await starboardChannel.send({ embeds: [embed] });
      this.data.starred[message.id] = {
        starboardMsgId: starMsg.id,
        stars: starCount,
        authorId: message.author.id,
        channelId: message.channel.id,
        content: message.content?.substring(0, 100),
        timestamp: Date.now(),
      };
      this.save();

      // Reward the author
      const user = this.economy.getUser(message.author.id);
      user.balance += BONUS_COINS;
      user.totalEarned += BONUS_COINS;
      if (!user.starsReceived) user.starsReceived = 0;
      user.starsReceived++;
      this.economy.save();

      log.info({ username: message.author.username, stars: starCount, bonus: BONUS_COINS }, 'Message starred');
    } catch (e) {
      log.error({ err: e }, 'Post error');
    }
  }

  buildStarEmbed(message, starCount) {
    const starText = starCount >= 10 ? '🌟' : starCount >= 5 ? '✨' : '⭐';

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setAuthor({
        name: message.author.displayName || message.author.username,
        iconURL: message.author.displayAvatarURL({ size: 64 }),
      })
      .setDescription(message.content || '*[media/embed]*')
      .addFields(
        { name: 'Source', value: `[Jump to message](${message.url})`, inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      )
      .setFooter({ text: `${starText} ${starCount} | Hall of Fame` })
      .setTimestamp(message.createdAt);

    // Include first image attachment if any
    const img = message.attachments.find(a => a.contentType?.startsWith('image/'));
    if (img) embed.setImage(img.url);

    return embed;
  }

  // Leaderboard: most starred users
  leaderboardEmbed(guild) {
    const counts = {};
    for (const entry of Object.values(this.data.starred)) {
      counts[entry.authorId] = (counts[entry.authorId] || 0) + entry.stars;
    }

    const sorted = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const medals = ['🥇', '🥈', '🥉'];
    const lines = sorted.map(([userId, stars], i) => {
      const member = guild.members.cache.get(userId);
      const name = member ? member.displayName : 'Unknown';
      const medal = medals[i] || `**${i + 1}.**`;
      return `${medal} ${name} — ⭐ **${stars}** stars`;
    });

    return new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('⭐ Hall of Fame — Most Starred')
      .setDescription(lines.join('\n') || 'No starred messages yet! React ⭐ to immortalize a message.')
      .setFooter({ text: `${STAR_THRESHOLD}+ ⭐ reactions = Hall of Fame + 🪙 ${BONUS_COINS} Torch Coins` });
  }
}

module.exports = { Starboard };
