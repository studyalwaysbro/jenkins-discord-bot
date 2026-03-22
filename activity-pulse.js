// ═══════════════════════════════════════════════════════════════
//  ACTIVITY PULSE — Content seeding for dead channels
//  Jenkins drops content into channels that have gone quiet
// ═══════════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const log = require('./logger').child('ActivityPulse');

const MARKET_MEME_PROMPTS = [
  '📈 The market just did WHAT? Drop your best reaction below.',
  '🚀 Unpopular opinion time: What\'s the most overrated stock right now?',
  '💀 Show me your worst trade ever. No shame, only pain.',
  '📊 Bulls vs Bears: where are we heading this week?',
  '🤡 Name a stock that\'s basically a meme at this point.',
  '💎🙌 What are you holding NO MATTER WHAT?',
  '🔥 Hot take: crypto is ___________. Fill in the blank.',
  '📉 Post your loss porn. Misery loves company.',
  '🧠 Big brain take: What\'s the next 10-bagger and why?',
  '⚡ Rate my portfolio: 100% in one ticker. Which one is it?',
];

const DD_PROMPTS = [
  '🔬 **DD Challenge**: Pick any ticker and give us a 3-sentence bull case. GO.',
  '📊 **Sector Spotlight**: Which sector is about to pop off and why?',
  '🌍 **Macro Check**: What global event is the market sleeping on right now?',
  '📉 **Bear Case**: Give us the most bearish argument for a popular stock.',
  '💡 **Hidden Gem**: Drop a ticker nobody is talking about but should be.',
  '⚡ **Options Play**: What\'s the most degenerate options play you\'d make this week?',
  '🏦 **Fed Watch**: How are interest rates going to move and what does it mean?',
  '🛢️ **Commodities**: Oil, gold, copper — which one is the best play right now?',
  '📱 **Tech Check**: Which tech company is most overvalued? Most undervalued?',
  '🔮 **Crystal Ball**: Where does SPY end the year? Drop your number.',
];

const COURT_CASES = [
  '⚖️ **Case #001**: The defendant is accused of paper-handing NVDA at $120. Jenkins finds them...',
  '⚖️ **Case #002**: The defendant claims "this time is different." Jenkins has seen this before...',
  '⚖️ **Case #003**: Accused of checking their portfolio 47 times in one hour. Is this a crime?',
  '⚖️ **Case #004**: The defendant sold the bottom and bought the top. A classic.',
  '⚖️ **Case #005**: Caught saying "it\'s just a dip" for the 15th consecutive month.',
  '⚖️ **Case #006**: The defendant YOLO\'d their rent money into 0DTE calls. The house rules.',
  '⚖️ **Case #007**: Accused of being "in it for the tech" while checking price every 30 seconds.',
  '⚖️ **Case #008**: Claims to have "done their own research" but can\'t read a balance sheet.',
  '⚖️ **Case #009**: The defendant panic-sold at -5% and it\'s now up 200%. Emotional damages.',
  '⚖️ **Case #010**: Caught giving financial advice in a Discord server. Not financial advice BTW.',
];

const MEME_PROMPTS = [
  '🎭 Caption this: Jenkins just reviewed your portfolio.',
  '🎭 Wrong answers only: What does the Federal Reserve actually do?',
  '🎭 Meme battle: bulls vs bears. Post your best.',
  '🎭 If your trading strategy was a movie title, what would it be?',
  '🎭 Describe your portfolio in one emoji. No cheating.',
];

const GENERAL_PROMPTS = [
  '💬 What\'s everyone playing this weekend? Drop your game below 🎮',
  '💬 Hot take: What\'s the best game released in the last year?',
  '💬 If you could only play one game for the rest of 2026, what is it?',
  '💬 What song is stuck in your head right now? 🎵',
  '💬 What\'s the most slept-on game in your Steam library?',
];

// Channel ID → content pool mapping
const CHANNEL_CONTENT = {
  'market-memes': MARKET_MEME_PROMPTS,
  'dd-research': DD_PROMPTS,
  'court-records': COURT_CASES,
  'memes': MEME_PROMPTS,
  'general': GENERAL_PROMPTS,
};

class ActivityPulse {
  constructor() {
    this.lastPosted = new Map(); // channelName -> timestamp
  }

  // Check if a channel needs content (no messages in 24 hours)
  async checkAndSeed(guild) {
    const seeded = [];
    const channels = guild.channels.cache.filter(c => c.type === 0);

    for (const [channelName, prompts] of Object.entries(CHANNEL_CONTENT)) {
      const channel = channels.find(c => c.name.includes(channelName));
      if (!channel) continue;

      try {
        const messages = await channel.messages.fetch({ limit: 1 });
        const lastMsg = messages.first();
        const hoursSinceActivity = lastMsg
          ? (Date.now() - lastMsg.createdTimestamp) / 3600000
          : 999;

        // Only seed if no activity for 12+ hours
        if (hoursSinceActivity < 12) continue;

        // Don't seed more than once per 8 hours per channel
        const lastSeed = this.lastPosted.get(channelName) || 0;
        if (Date.now() - lastSeed < 8 * 3600000) continue;

        // Pick a random prompt
        const prompt = prompts[Math.floor(Math.random() * prompts.length)];

        await channel.send(prompt);
        this.lastPosted.set(channelName, Date.now());
        seeded.push(channelName);
        log.info({ channel: channelName }, 'Channel seeded');
      } catch (e) {
        log.error({ channel: channelName, err: e }, 'Error seeding channel');
      }
    }

    return seeded;
  }
}

module.exports = { ActivityPulse };
