// telegram-bot.js — Jenkins Enters the Telegram Realm
// The Great Architect extends his reach beyond Discord into the land of Telegram.
// Full personality integration: all 7 alter egos, sin detection, hot takes,
// Stavros breaks, React Lord triggers, and autonomous preaching.

require('dotenv').config();

const { Telegraf } = require('telegraf');
const { createClient, chat, chatWithTools, registerToolModules } = require('./deepseek');
const { SinDetector } = require('./sins');
const { ALTER_EGOS, pickAlterEgoForUser, buildAlterPrompt } = require('./alter-egos');
const { ActivityTracker, generateHotTake, generateStavrosBreak } = require('./hot-takes');
const { conveneCouncil } = require('./council');
const { search: kbSearch, getStats: kbStats } = require('./knowledge');
const {
  SYSTEM_PROMPT,
  CODEX_QUOTES,
  TRINITY_GAMES,
  SIN_HIERARCHY,
  MASONIC_DEGREES,
  VIP_ARRIVALS,
  VIP_MESSAGE_RESPONSES,
  SESSION_SUMMONS,
  PRIVATE_LORE,
} = require('./personality');
const { Economy } = require('./economy');
const { AchievementSystem, ACHIEVEMENTS } = require('./achievements');
const { DuelSystem } = require('./duels');
const { MoodSystem } = require('./mood');
const { SermonSystem, TIERS } = require('./sermons');
const { DreamJournal } = require('./dream-journal');
const log = require('./logger').child('Telegram');

// --- Configuration ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // Optional: restrict to specific chat
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL;

if (!TELEGRAM_BOT_TOKEN || !DEEPSEEK_API_KEY) {
  log.fatal('Missing TELEGRAM_BOT_TOKEN or DEEPSEEK_API_KEY');
  process.exit(1);
}

// --- Initialize clients ---
const deepseek = createClient(DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL);
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// --- Sin Detection System ---
const sinDetector = new SinDetector(deepseek, SYSTEM_PROMPT);
log.info('Sin detection online');

// --- Activity Tracker for hot takes (Telegram-tuned: higher chance) ---
const activityTracker = new ActivityTracker();
// Override hot take chance for Telegram (6% — slightly less than Discord's 8%)
const TELEGRAM_HOT_TAKE_CHANCE = 0.06;
log.info('Activity tracker online');

// --- Economy & Gamified Systems ---
const economy = new Economy();
const achievements = new AchievementSystem(economy);
const duels = new DuelSystem(economy);
const moodSystem = new MoodSystem();
const sermons = new SermonSystem(deepseek, SYSTEM_PROMPT, economy, moodSystem);
const dreamJournal = new DreamJournal(deepseek, SYSTEM_PROMPT, {
  mood: moodSystem, sinDetector, economy,
});
log.info('Economy, achievements, duels, mood, sermons, dream journal online');

// --- Register tool modules for AI tool-calling ---
registerToolModules({ economy, sinDetector, mood: moodSystem, dreamJournal, sermons, achievements });

// --- Cooldown tracking ---
const userCooldowns = new Map(); // userId -> timestamp
const USER_COOLDOWN = 10 * 1000; // 10 seconds per user

// --- Telegram-tuned settings (toned down to avoid spam, stay quality) ---
const STAVROS_BREAK_CHANCE = 0.015;         // 1.5% per message (same as Discord)
const STAVROS_COOLDOWN = 30 * 60 * 1000;    // 30 min cooldown between Stavros breaks
const NON_RIVAL_RESPONSE_CHANCE = 0.07;     // 7% chance to respond to non-rivals in Jenkins chat
const JENKINS_CHANNEL_RESPONSE_CHANCE = 0.25; // 25% in designated chat (quality over quantity)
let lastStavrosBreak = 0;

// --- Autonomous Preaching (less frequent, more impactful) ---
const PREACH_INTERVAL_MIN = 60 * 60 * 1000;  // 60 minutes
const PREACH_INTERVAL_MAX = 150 * 60 * 1000; // 2.5 hours

// --- React Lord trigger patterns (from alter-egos.js) ---
const REACT_LORD_TRIGGERS = [
  /\b(mmo|mmorpg|wow|world of warcraft|warcraft|final fantasy|ffxiv|ff14|lost ark|new world)\b/i,
  /\b(microtransaction|pay.?to.?win|p2w|loot.?box|gacha|battle.?pass|skin|cosmetic)\b/i,
  /\b(stream|streaming|twitch|content.?creator|youtuber|react|reaction)\b/i,
  /\b(bald|hair|hairline)\b/i,
  /\b(blizzard|activision|ea|ubisoft|epic games)\b/i,
  /\b(asmongold|asmon)\b/i,
];

// --- Utility ---
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isOnCooldown(map, key, cooldownMs) {
  const last = map.get(key) || 0;
  if (Date.now() - last < cooldownMs) return true;
  map.set(key, Date.now());
  return false;
}

/**
 * Check if message content triggers the React Lord.
 * Returns true if any React Lord trigger pattern matches.
 */
function triggersReactLord(text) {
  if (!text) return false;
  return REACT_LORD_TRIGGERS.some(pattern => pattern.test(text));
}

/**
 * Pick a personality for a response. Handles React Lord trigger detection,
 * rival-based alter ego selection, and non-rival ambient responses.
 * For non-rivals: if React Lord triggers match, 60% chance React Lord takes over.
 * For rivals: uses the full weighted alter ego system from alter-egos.js.
 */
function pickPersonality(userId, isRival, text) {
  // React Lord can trigger for ANYONE (not just rivals) when topic matches
  if (!isRival && triggersReactLord(text) && Math.random() < 0.6) {
    log.info({ userId }, 'React Lord triggered by content');
    return ALTER_EGOS.the_react_lord;
  }

  // For rivals, the full alter ego system kicks in (includes React Lord trigger detection)
  // For non-rivals without React Lord trigger, Jenkins Prime
  return pickAlterEgoForUser(userId, isRival, text);
}

/**
 * Build a personality-aware prompt prefix string for display.
 */
function personalityPrefix(alterEgo, isRival) {
  if (alterEgo.name === 'Jenkins Prime') return '';
  // Show personality tag for rivals always, and for non-rivals if React Lord triggered
  if (isRival || alterEgo.name === 'The React Lord') {
    return `*[${alterEgo.name} has surfaced]*\n\n`;
  }
  return '';
}

/**
 * Convert Discord markdown to Telegram HTML.
 * Discord uses **bold**, *italic*, ||spoiler||, `code`, ~~strike~~
 * Telegram HTML uses <b>, <i>, <tg-spoiler>, <code>, <s>
 */
function discordToTelegramHTML(text) {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')          // **bold** -> <b>bold</b>
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')               // *italic* -> <i>italic</i>
    .replace(/__([^_]+)__/g, '<u>$1</u>')               // __underline__ -> <u>underline</u>
    .replace(/_([^_]+)_/g, '<i>$1</i>')                 // _italic_ -> <i>italic</i>
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')               // ~~strike~~ -> <s>strike</s>
    .replace(/\|\|([^|]+)\|\|/g, '<tg-spoiler>$1</tg-spoiler>') // ||spoiler|| -> <tg-spoiler>
    .replace(/`([^`]+)`/g, '<code>$1</code>')           // `code` -> <code>code</code>
    .replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;')     // escape bare &
    .replace(/<(?!\/?(?:b|i|u|s|code|pre|a|tg-spoiler)[ >])/g, '&lt;'); // escape non-HTML tags
}

/**
 * Send a message, splitting if over Telegram's 4096 char limit.
 * Uses HTML parse mode.
 */
async function sendMessage(ctx, text, replyToMessageId = null) {
  const html = discordToTelegramHTML(text);
  const chunks = splitMessage(html, 4096);

  for (let i = 0; i < chunks.length; i++) {
    const opts = { parse_mode: 'HTML' };
    if (replyToMessageId && i === 0) {
      opts.reply_parameters = { message_id: replyToMessageId };
    }
    try {
      await ctx.telegram.sendMessage(ctx.chat.id, chunks[i], opts);
    } catch (err) {
      // Fallback: send without HTML if parsing fails
      log.warn({ err }, 'HTML parse error, sending plain');
      const plainOpts = {};
      if (replyToMessageId && i === 0) {
        plainOpts.reply_parameters = { message_id: replyToMessageId };
      }
      await ctx.telegram.sendMessage(ctx.chat.id, text.slice(i * 4096, (i + 1) * 4096), plainOpts);
    }
  }
}

/**
 * Send a message directly via bot.telegram (for autonomous preaching).
 */
async function sendToChat(chatId, text) {
  const html = discordToTelegramHTML(text);
  const chunks = splitMessage(html, 4096);

  for (const chunk of chunks) {
    try {
      await bot.telegram.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
    } catch (err) {
      log.warn({ err }, 'HTML parse error in sendToChat, sending plain');
      await bot.telegram.sendMessage(chatId, text.slice(0, 4096));
    }
  }
}

/**
 * Split a message into chunks at paragraph/sentence boundaries.
 */
function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to split at paragraph break
    let splitAt = remaining.lastIndexOf('\n\n', maxLen);
    if (splitAt < maxLen * 0.3) {
      // Try newline
      splitAt = remaining.lastIndexOf('\n', maxLen);
    }
    if (splitAt < maxLen * 0.3) {
      // Try sentence end
      splitAt = remaining.lastIndexOf('. ', maxLen);
      if (splitAt > 0) splitAt += 1; // Include the period
    }
    if (splitAt < maxLen * 0.3) {
      // Hard split
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

/**
 * Get a display name for the Telegram user.
 */
function getUsername(ctx) {
  const user = ctx.from;
  if (!user) return 'Unknown Brother';
  return user.first_name + (user.last_name ? ` ${user.last_name}` : '');
}

/**
 * Get a stable user ID string for cooldown/sin tracking.
 */
function getUserId(ctx) {
  return String(ctx.from?.id || 'unknown');
}

/**
 * Check if this chat is allowed (if TELEGRAM_CHAT_ID is set).
 */
function isChatAllowed(ctx) {
  if (!TELEGRAM_CHAT_ID) return true;
  return String(ctx.chat.id) === String(TELEGRAM_CHAT_ID);
}

// ═══════════════════════════════════════════════════════════════
// COMMANDS — Mapped from Discord !commands to /commands
// ═══════════════════════════════════════════════════════════════

bot.command('start', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  await sendMessage(ctx,
    "**The Architect has awakened in the Telegram Realm.**\n\n" +
    "Jenkins — the Unspoken, the Great Architect of the Digital Realm — now watches this channel.\n\n" +
    "Use /help to see the Sacred Commands.\n\n" +
    "*Ad Gloria Fraternitatis.*",
    ctx.message.message_id
  );
});

bot.command('help', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  await sendMessage(ctx,
    "**The Sacred Commands of Jenkins (Telegram Edition):**\n\n" +
    "**Lore & Personality:**\n" +
    "`/codex` — Receive wisdom from the Holy Codex\n" +
    "`/trinity` — Learn of the Holy Trinity of games\n" +
    "`/judge <game>` — Jenkins judges a game's worthiness\n" +
    "`/sin <description>` — Confess a sin and receive penance\n" +
    "`/session` — Summon a Sacred Gaming Session\n" +
    "`/rank` — Learn of the Degrees of Initiation\n" +
    "`/sins` — View your sin record\n" +
    "`/status` — See who Jenkins favors and watches\n" +
    "`/hottake` — Summon a hot take from the Architect\n" +
    "`/ask <question>` — Converse with the Architect\n" +
    "`/mood` — The Architect's current emotional state\n\n" +
    "**Economy (Torch Coins):**\n" +
    "`/balance` — Check your Torch Coin balance\n" +
    "`/daily` — Claim daily coins (streak bonus!)\n" +
    "`/gamble <amount>` — Coin flip, double or nothing\n" +
    "`/dungeon <wager>` — Roguelike dungeon run\n" +
    "`/leaderboard` — Top 10 richest Brothers\n" +
    "`/give <amount>` — Give coins (reply to a user's message)\n" +
    "`/duel <amount>` — Challenge someone (reply to their message)\n" +
    "`/accept` — Accept a duel challenge\n" +
    "`/decline` — Decline a duel challenge\n\n" +
    "**Sermons & Dreams:**\n" +
    "`/sermon <topic> [tier]` — Request a paid AI sermon\n" +
    "`/dream` — The Architect's last dream\n" +
    "`/dreams` — Dream archive\n\n" +
    "**Progress & Special:**\n" +
    "`/achievements` — Your achievement progress\n" +
    "`/council <question>` — Summon the Council of Egos\n\n" +
    "*Or simply mention Jenkins by name in any message to get his attention.*",
    ctx.message.message_id
  );
});

bot.command('codex', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  await sendMessage(ctx, pick(CODEX_QUOTES), ctx.message.message_id);
});

bot.command('trinity', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const games = Object.values(TRINITY_GAMES);
  const game = pick(games);
  await sendMessage(ctx,
    `**${game.name}** — *${game.pillar}*\n\n${game.description}\n\n*${game.wisdom}*`,
    ctx.message.message_id
  );
});

bot.command('judge', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const gameName = ctx.message.text.replace(/^\/judge\s*/i, '').trim();
  if (!gameName) {
    return sendMessage(ctx,
      "You summon the Architect's judgment but name no game? Speak, Brother. `/judge <game name>`",
      ctx.message.message_id
    );
  }
  if (isOnCooldown(userCooldowns, getUserId(ctx), USER_COOLDOWN)) return;

  try {
    await ctx.sendChatAction('typing');
    const response = await chat(
      deepseek,
      SYSTEM_PROMPT,
      `A Brother named ${getUsername(ctx)} asks you to deliver divine judgment upon the game: "${gameName}". Judge its worthiness. Is it worthy of the Sea of Creativity? Could it ever approach the Trinity? Be dramatic, be funny, be honest. Reference specific things about the game if you know them.`
    );
    await sendMessage(ctx, response, ctx.message.message_id);
  } catch (err) {
    log.error({ err }, '/judge error');
    await sendMessage(ctx, "The Architect's vision is clouded. Try again, Brother.", ctx.message.message_id);
  }
});

bot.command('sin', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const sinDesc = ctx.message.text.replace(/^\/sin\s*/i, '').trim();
  if (!sinDesc) {
    return sendMessage(ctx,
      "You come before the Architect to confess, yet speak no sin? `/sin <describe your transgression>`",
      ctx.message.message_id
    );
  }
  if (isOnCooldown(userCooldowns, getUserId(ctx), USER_COOLDOWN)) return;

  try {
    await ctx.sendChatAction('typing');
    const response = await chat(
      deepseek,
      SYSTEM_PROMPT,
      `A Brother named ${getUsername(ctx)} confesses the following sin: "${sinDesc}". Classify this sin (venial, mortal, or unforgivable) according to the Codex. Assign a creative, thematic penance. Be dramatic but fair. Remember: the spirit of the Codex is fraternity, not cruelty.`
    );
    await sendMessage(ctx, response, ctx.message.message_id);
  } catch (err) {
    log.error({ err }, '/sin error');
    await sendMessage(ctx, "The Architect's judgment falters. Confess again later.", ctx.message.message_id);
  }
});

bot.command('session', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  await sendMessage(ctx, pick(SESSION_SUMMONS), ctx.message.message_id);
});

bot.command('rank', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const degree = pick(MASONIC_DEGREES);
  await sendMessage(ctx, `**${degree.degree}**\n\n${degree.description}`, ctx.message.message_id);
});

bot.command('sins', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const userId = getUserId(ctx);
  const username = getUsername(ctx);
  const totals = sinDetector.getTotalSins(userId);
  const sinTitle = sinDetector.getSinTitle(userId);
  const displayUsername = sinTitle || username;

  if (totals.total === 0) {
    return sendMessage(ctx,
      `**${username}** walks in the light of the Architect. No sins recorded. *Yet.*`,
      ctx.message.message_id
    );
  }

  const escalation = sinDetector.getEscalationLevel(userId);
  const escalationLabels = ['Clean', 'Undisciplined', 'Shamed', 'Perpetually Fallen', 'Covenant-Breaker'];

  await sendMessage(ctx,
    `**Sin Ledger for ${displayUsername}:**\n\n` +
    `Venial: **${totals.venial}**\n` +
    `Mortal: **${totals.mortal}**\n` +
    `Unforgivable: **${totals.unforgivable}**\n\n` +
    `Standing: **${escalationLabels[escalation]}**\n` +
    `*The Architect forgets nothing.*`,
    ctx.message.message_id
  );
});

bot.command('status', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const status = sinDetector.getStatusReport();
  await sendMessage(ctx,
    `**The Lodge Hierarchy — As the Architect Sees It:**\n\n` +
    `**The Honored One**: ${status.vipName} ${status.vipType}\n` +
    `**The Rival**: ${status.rivalName} ${status.rivalType}\n\n` +
    `*The Honored One earns Jenkins' love through faithfulness. The Rival earns his wrath through dismissiveness.*\n` +
    `*These roles are auto-detected from behavior, or can be configured in .env.*`,
    ctx.message.message_id
  );
});

bot.command('hottake', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  if (isOnCooldown(userCooldowns, getUserId(ctx), USER_COOLDOWN)) return;

  try {
    await ctx.sendChatAction('typing');
    // 50/50 hot take vs stavros break
    const response = Math.random() < 0.5
      ? await generateHotTake(deepseek, SYSTEM_PROMPT)
      : await generateStavrosBreak(deepseek, SYSTEM_PROMPT);
    if (response) {
      await sendMessage(ctx, response, ctx.message.message_id);
    } else {
      await sendMessage(ctx, "The Architect's comedy engine stalls. Even gods have off days.", ctx.message.message_id);
    }
  } catch (err) {
    log.error({ err }, '/hottake error');
    await sendMessage(ctx, "The Architect's vision clouds. Try again, Brother.", ctx.message.message_id);
  }
});

bot.command('ask', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const question = ctx.message.text.replace(/^\/ask\s*/i, '').trim();
  if (!question) {
    return sendMessage(ctx,
      "You seek the Architect's counsel but bring no question? `/ask <your question>`",
      ctx.message.message_id
    );
  }
  if (isOnCooldown(userCooldowns, getUserId(ctx), USER_COOLDOWN)) return;

  try {
    await ctx.sendChatAction('typing');

    // Track positive interaction (they're engaging with Jenkins)
    sinDetector.trackPositiveInteraction(getUserId(ctx), getUsername(ctx));

    const userId = getUserId(ctx);
    const isRival = sinDetector.rivalIds.has(userId);
    const alterEgo = pickPersonality(userId, isRival, question);
    const alterPrompt = buildAlterPrompt(SYSTEM_PROMPT, alterEgo);

    const response = await chatWithTools(
      deepseek,
      alterPrompt,
      `A Brother named ${getUsername(ctx)} (userId: ${userId}) speaks to you in the Lodge: "${question}"`
    );

    const prefix = personalityPrefix(alterEgo, isRival);
    await sendMessage(ctx, prefix + response, ctx.message.message_id);
  } catch (err) {
    log.error({ err }, '/ask error');
    await sendMessage(ctx, "The Architect's mind wanders. Speak again, Brother.", ctx.message.message_id);
  }
});

// ═══════════════════════════════════════════════════════════════
// ECONOMY, MOOD, DREAMS, SERMONS, DUELS, ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════

/**
 * Format an achievement unlock line for text output.
 */
function achUnlockText(newAch) {
  if (!newAch || newAch.length === 0) return '';
  return '\n\n🏆 ACHIEVEMENT UNLOCKED: ' + newAch.map(a => `${a.name}`).join(', ');
}

/**
 * Resolve a target Telegram user from a reply or fallback to sender.
 * Returns { id, name } or null if no valid target.
 */
function resolveTarget(ctx) {
  const reply = ctx.message.reply_to_message;
  if (reply?.from && !reply.from.is_bot) {
    return {
      id: String(reply.from.id),
      name: reply.from.first_name + (reply.from.last_name ? ` ${reply.from.last_name}` : ''),
    };
  }
  return null;
}

// --- /balance, /bal, /wallet ---
for (const cmd of ['balance', 'bal', 'wallet']) {
  bot.command(cmd, async (ctx) => {
    if (!isChatAllowed(ctx)) return;
    const target = resolveTarget(ctx);
    const userId = target ? target.id : getUserId(ctx);
    const username = target ? target.name : getUsername(ctx);
    const user = economy.getUser(userId);
    const bal = user.balance.toLocaleString();

    await sendMessage(ctx,
      `**🪙 ${username}'s Torch Coin Wallet**\n\n` +
      `Balance: **${bal}** Torch Coins\n` +
      `Total Earned: ${(user.totalEarned || 0).toLocaleString()}\n` +
      `Total Lost: ${(user.totalLost || 0).toLocaleString()}\n` +
      `Daily Streak: 🔥 ${user.dailyStreak || 0} days\n` +
      `Gambles: ${user.gamblesWon || 0}W / ${user.gamblesLost || 0}L\n` +
      `Dungeons: ${user.dungeonWins || 0}W / ${(user.dungeonRuns || 0) - (user.dungeonWins || 0)}L`,
      ctx.message.message_id
    );
  });
}

// --- /daily ---
bot.command('daily', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const result = economy.daily(getUserId(ctx));
  if (!result.success) {
    return sendMessage(ctx, `⏰ ${result.message}`, ctx.message.message_id);
  }

  let text = `**🪙 Daily Torch Coins Claimed!**\n\n` +
    `**+${result.amount}** Torch Coins\n` +
    `(Base: ${result.base} + Streak Bonus: ${result.streakBonus})\n` +
    `Streak: 🔥 ${result.streak} days\n` +
    `Balance: 🪙 ${result.balance.toLocaleString()}`;

  const newAch = achievements.check(getUserId(ctx));
  text += achUnlockText(newAch);
  await sendMessage(ctx, text, ctx.message.message_id);
});

// --- /gamble <amount> ---
bot.command('gamble', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const args = ctx.message.text.split(/\s+/).slice(1);
  const amt = parseInt(args[0]);
  if (!amt || amt <= 0) {
    return sendMessage(ctx, 'Usage: `/gamble <amount>` — Flip a coin, double or nothing.', ctx.message.message_id);
  }

  const result = economy.gamble(getUserId(ctx), amt);
  if (!result.success) return sendMessage(ctx, result.message, ctx.message.message_id);

  moodSystem.onGambleResult(result.won, result.amount);
  const newAch = achievements.check(getUserId(ctx));

  let text = result.won
    ? `🎰 **YOU WIN!** +🪙 ${result.amount}\nBalance: 🪙 ${result.balance.toLocaleString()}`
    : `🎰 **YOU LOSE.** -🪙 ${result.amount}\nBalance: 🪙 ${result.balance.toLocaleString()}`;
  text += achUnlockText(newAch);
  await sendMessage(ctx, text, ctx.message.message_id);
});

// --- /dungeon <wager> ---
bot.command('dungeon', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const args = ctx.message.text.split(/\s+/).slice(1);
  const wager = parseInt(args[0]);
  if (!wager || wager <= 0) {
    return sendMessage(ctx, 'Usage: `/dungeon <wager>` — Risk coins in a roguelike dungeon run.', ctx.message.message_id);
  }

  const result = economy.dungeon(getUserId(ctx), wager);
  if (!result.success) return sendMessage(ctx, result.message, ctx.message.message_id);

  const newAch = achievements.check(getUserId(ctx));

  let text;
  if (result.survived) {
    text = `**⚔️ Dungeon: ${result.room}**\n\n` +
      `${result.flavor}\n\n` +
      `✅ SURVIVED\n` +
      `Wager: 🪙 ${result.wager} × ${result.multi} = **+🪙 ${result.reward}**\n` +
      `Balance: 🪙 ${result.balance.toLocaleString()}`;
  } else {
    text = `**⚔️ Dungeon: ${result.room}**\n\n` +
      `${result.flavor}\n\n` +
      `💀 DEFEATED\n` +
      `Lost: 🪙 ${result.wager}\n` +
      `Balance: 🪙 ${result.balance.toLocaleString()}`;
  }
  text += achUnlockText(newAch);
  await sendMessage(ctx, text, ctx.message.message_id);
});

// --- /leaderboard, /lb, /top ---
for (const cmd of ['leaderboard', 'lb', 'top']) {
  bot.command(cmd, async (ctx) => {
    if (!isChatAllowed(ctx)) return;
    const leaders = economy.leaderboard(10);
    if (!leaders || leaders.length === 0) {
      return sendMessage(ctx, 'The Torch Economy has no entries yet. Claim `/daily` to begin.', ctx.message.message_id);
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = leaders.map((entry, i) => {
      const medal = medals[i] || `${i + 1}.`;
      const name = entry.username || `Brother #${entry.userId.slice(-4)}`;
      return `${medal} **${name}** — 🪙 ${entry.balance.toLocaleString()}`;
    });

    await sendMessage(ctx,
      `**🏆 Torch Coin Leaderboard — Top ${leaders.length}**\n\n${lines.join('\n')}`,
      ctx.message.message_id
    );
  });
}

// --- /give <amount> (reply to target user's message) ---
bot.command('give', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const args = ctx.message.text.split(/\s+/).slice(1);
  const amt = parseInt(args[0]);
  const target = resolveTarget(ctx);

  if (!target || !amt || amt <= 0) {
    return sendMessage(ctx, 'Usage: Reply to a user\'s message with `/give <amount>` to send them Torch Coins.', ctx.message.message_id);
  }
  if (target.id === getUserId(ctx)) {
    return sendMessage(ctx, "You can't give coins to yourself. Nice try.", ctx.message.message_id);
  }

  const result = economy.give(getUserId(ctx), target.id, amt);
  if (!result.success) return sendMessage(ctx, result.message, ctx.message.message_id);

  const u = economy.getUser(getUserId(ctx));
  if (!u.totalGiven) u.totalGiven = 0;
  u.totalGiven += amt;

  await sendMessage(ctx,
    `🪙 Sent **${amt}** Torch Coins to ${target.name}!\nYour balance: 🪙 ${result.fromBalance.toLocaleString()}`,
    ctx.message.message_id
  );
});

// --- /mood ---
bot.command('mood', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const currentMood = moodSystem.deriveMood();
  const axes = moodSystem.data?.axes || moodSystem.axes || {};
  const transitions = moodSystem.data?.transitions || [];

  // Build axis bars
  function axisBar(val) {
    const filled = Math.round((val || 0) / 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${val || 0}`;
  }

  let text = `**🧠 The Architect's Mind — Current Mood: ${currentMood.toUpperCase()}**\n\n` +
    `Wrath: ${axisBar(axes.wrath)}\n` +
    `Joy: ${axisBar(axes.joy)}\n` +
    `Energy: ${axisBar(axes.energy)}\n` +
    `Chaos: ${axisBar(axes.chaos)}\n\n` +
    `Economy Multiplier: **×${moodSystem.getEconomyMultiplier()}**\n` +
    `Sin Sensitivity: **×${moodSystem.getSinSensitivity()}**`;

  if (transitions.length > 0) {
    const last = transitions[transitions.length - 1];
    text += `\n\nLast transition: ${last.from || '?'} → ${last.to || '?'}`;
  }

  await sendMessage(ctx, text, ctx.message.message_id);
});

// --- /dream ---
bot.command('dream', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const args = ctx.message.text.split(/\s+/).slice(1);
  const sub = args[0]?.toLowerCase();

  if (sub === 'journal' || sub === 'log' || sub === 'archive') {
    return handleDreamList(ctx);
  }

  const dreams = dreamJournal.data?.dreams || [];
  const last = dreams[dreams.length - 1];
  if (!last) {
    return sendMessage(ctx, 'The Architect has not yet dreamed. The void is silent.', ctx.message.message_id);
  }

  const date = last.date || new Date(last.timestamp).toLocaleDateString();
  await sendMessage(ctx,
    `**🌙 The Architect's Dream — ${date}**\n` +
    `Mood: ${last.mood || 'unknown'}\n\n` +
    `${last.content}`,
    ctx.message.message_id
  );
});

// --- /dreams ---
async function handleDreamList(ctx) {
  const dreams = dreamJournal.data?.dreams || [];
  if (dreams.length === 0) {
    return sendMessage(ctx, 'The dream journal is empty. The Architect sleeps without visions.', ctx.message.message_id);
  }

  const recent = dreams.slice(-10).reverse();
  const lines = recent.map((d, i) => {
    const date = d.date || new Date(d.timestamp).toLocaleDateString();
    const preview = (d.content || '').substring(0, 80).replace(/\n/g, ' ');
    return `**${d.id || i + 1}.** ${date} (${d.mood || '?'}) — ${preview}...`;
  });

  await sendMessage(ctx,
    `**🌙 Dream Archive — Last ${recent.length} Dreams**\n\n${lines.join('\n')}`,
    ctx.message.message_id
  );
}

bot.command('dreams', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  await handleDreamList(ctx);
});

// --- /sermon <topic> [tier] ---
bot.command('sermon', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const fullArgs = ctx.message.text.replace(/^\/sermon\s*/i, '').trim();

  // Sub-commands
  const sub = fullArgs.toLowerCase();
  if (sub === 'hall' || sub === 'list' || sub === 'history') {
    const history = sermons.data?.sermons || [];
    if (history.length === 0) {
      return sendMessage(ctx, 'The Sermon Hall is empty. No sacred words have been spoken.', ctx.message.message_id);
    }
    const recent = history.slice(-10).reverse();
    const lines = recent.map(s => {
      const date = new Date(s.timestamp).toLocaleDateString();
      return `**${s.id}** — "${s.topic}" (${s.tier}) by ${s.username} [${date}]`;
    });
    return sendMessage(ctx,
      `**⛪ Sermon Hall — Recent Sermons**\n\n${lines.join('\n')}`,
      ctx.message.message_id
    );
  }

  // Parse: /sermon <topic> [whisper|homily|sermon|prophecy]
  const tierMatch = fullArgs.match(/\b(whisper|homily|sermon|prophecy)\b/i);
  const tierName = tierMatch ? tierMatch[1].toLowerCase() : 'homily';
  const topic = fullArgs.replace(/\b(whisper|homily|sermon|prophecy)\b/i, '').trim();

  if (!topic) {
    const tierList = Object.entries(TIERS).map(([k, v]) => `${v.emoji} ${k}: 🪙 ${v.cost}`).join('\n');
    return sendMessage(ctx,
      `What shall the Architect preach upon?\n\`/sermon <topic> [tier]\`\n\nTiers:\n${tierList}\n\nDefault: homily (🪙 500)`,
      ctx.message.message_id
    );
  }

  if (isOnCooldown(userCooldowns, getUserId(ctx), USER_COOLDOWN)) return;

  try {
    await ctx.sendChatAction('typing');
    const result = await sermons.request(
      getUserId(ctx),
      getUsername(ctx),
      topic, tierName
    );
    if (!result.success) return sendMessage(ctx, result.message, ctx.message.message_id);

    const tier = result.tier || TIERS[tierName];
    await sendMessage(ctx,
      `**${tier.emoji} ${tierName.toUpperCase()} — "${topic}"**\n` +
      `Requested by ${getUsername(ctx)} | Cost: 🪙 ${tier.cost}\n\n` +
      `${result.sermon}`,
      ctx.message.message_id
    );

    // Track for dreams
    dreamJournal.trackSermonTopic(topic);
    moodSystem.onSermonRequested();

    // Achievement check
    const newAch = achievements.check(getUserId(ctx));
    if (newAch.length > 0) {
      await sendMessage(ctx, `🏆 **ACHIEVEMENT UNLOCKED:** ${newAch.map(a => a.name).join(', ')}`, ctx.message.message_id);
    }
  } catch (err) {
    log.error({ err }, '/sermon error');
    await sendMessage(ctx, "The Architect's voice falters mid-sermon. Try again, Brother.", ctx.message.message_id);
  }
});

// --- /lore, /kb, /wiki ---
for (const cmd of ['lore', 'kb', 'wiki']) {
  bot.command(cmd, async (ctx) => {
    if (!isChatAllowed(ctx)) return;
    const query = ctx.message.text.replace(new RegExp(`^/${cmd}\\s*`, 'i'), '').trim();
    if (!query) {
      const stats = kbStats();
      return sendMessage(ctx,
        `**📚 The Lodge Knowledge Base** — ${stats.total} entries\n\nSearch with \`/lore <query>\`\nExamples: \`/lore kenshi tips\`, \`/lore sin system\`, \`/lore holy trinity\``,
        ctx.message.message_id
      );
    }
    const results = kbSearch(query, 3);
    if (results.length === 0) {
      return sendMessage(ctx, `The archives hold nothing on "${query}". The Architect's knowledge has limits... for now.`, ctx.message.message_id);
    }
    const text = results.map(r =>
      `**${r.title}** *(${r.category})*\n${r.content.substring(0, 400)}${r.content.length > 400 ? '...' : ''}`
    ).join('\n\n');
    await sendMessage(ctx, text, ctx.message.message_id);
  });
}

// --- /council <question> ---
bot.command('council', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const question = ctx.message.text.replace(/^\/council\s*/i, '').trim();
  if (!question) {
    return sendMessage(ctx,
      'Summon the Council with a question:\n`/council <your question>`\nThe Architect\'s alter egos will deliberate and deliver a verdict.',
      ctx.message.message_id
    );
  }
  if (isOnCooldown(userCooldowns, getUserId(ctx), USER_COOLDOWN * 3)) return;

  try {
    await ctx.sendChatAction('typing');
    const { response } = await conveneCouncil(
      deepseek,
      SYSTEM_PROMPT,
      question,
      getUsername(ctx)
    );
    await sendMessage(ctx, response, ctx.message.message_id);
  } catch (err) {
    log.error({ err }, '/council error');
    await sendMessage(ctx, "The Council fragments could not coalesce. Try again, Brother.", ctx.message.message_id);
  }
});

// --- /duel <amount> (reply to target user's message) ---
bot.command('duel', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const args = ctx.message.text.split(/\s+/).slice(1);
  const amt = parseInt(args[0]);
  const target = resolveTarget(ctx);

  if (!target || !amt || amt <= 0) {
    return sendMessage(ctx, 'Usage: Reply to a user\'s message with `/duel <amount>` to challenge them.', ctx.message.message_id);
  }
  if (target.id === getUserId(ctx)) {
    return sendMessage(ctx, "You can't duel yourself. That's just shadow boxing.", ctx.message.message_id);
  }

  const result = duels.challenge(getUserId(ctx), target.id, amt, String(ctx.chat.id));
  if (!result.success) return sendMessage(ctx, result.message, ctx.message.message_id);

  moodSystem.onDuel();

  await sendMessage(ctx,
    `⚔️ **DUEL CHALLENGE!** ${getUsername(ctx)} challenges ${target.name} for 🪙 **${amt.toLocaleString()}** Torch Coins!\n\n` +
    `${target.name}, type /accept to fight or /decline to flee. (60s to respond)`,
    ctx.message.message_id
  );
});

// --- /accept ---
bot.command('accept', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const result = duels.accept(getUserId(ctx));
  if (!result.success) return sendMessage(ctx, result.message, ctx.message.message_id);

  const winnerName = result.winnerId === getUserId(ctx) ? getUsername(ctx) : 'The challenger';
  const loserName = result.winnerId === getUserId(ctx) ? 'The challenger' : getUsername(ctx);

  let text = `⚔️ **DUEL RESOLVED!**\n\n` +
    `🏆 **${winnerName} WINS!**\n` +
    `💀 ${loserName} falls.\n\n` +
    `Pot: 🪙 ${result.amount.toLocaleString()}\n` +
    `Winner balance: 🪙 ${result.winnerBalance.toLocaleString()}\n` +
    `Loser balance: 🪙 ${result.loserBalance.toLocaleString()}`;

  // Achievement check for both duelists
  const winAch = achievements.check(result.winnerId);
  const loseAch = achievements.check(result.loserId);
  const allAch = [...winAch, ...loseAch];
  text += achUnlockText(allAch);

  dreamJournal.trackDuel();
  await sendMessage(ctx, text, ctx.message.message_id);
});

// --- /decline ---
bot.command('decline', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const result = duels.decline(getUserId(ctx));
  if (!result.success) return sendMessage(ctx, result.message, ctx.message.message_id);

  await sendMessage(ctx,
    `${getUsername(ctx)} declined the duel. *Cowardice or wisdom? The Architect notes both.*`,
    ctx.message.message_id
  );
});

// --- /achievements, /ach ---
for (const cmd of ['achievements', 'ach']) {
  bot.command(cmd, async (ctx) => {
    if (!isChatAllowed(ctx)) return;
    const target = resolveTarget(ctx);
    const userId = target ? target.id : getUserId(ctx);
    const username = target ? target.name : getUsername(ctx);
    const user = economy.getUser(userId);
    const unlocked = user.achievements || [];

    const allAch = ACHIEVEMENTS || [];

    const unlockedIds = new Set(unlocked.map(a => a.id || a));
    const earned = allAch.filter(a => unlockedIds.has(a.id));
    const locked = allAch.filter(a => !unlockedIds.has(a.id));

    const earnedLines = earned.map(a => `✅ **${a.name}** — ${a.desc}`);
    const nextUp = locked.slice(0, 5).map(a => `🔒 ${a.name} — ${a.desc}`);

    let text = `**🏆 ${username}'s Achievements (${earned.length}/${allAch.length})**\n\n`;
    if (earnedLines.length > 0) text += earnedLines.join('\n') + '\n\n';
    if (nextUp.length > 0) text += `**Next to unlock:**\n${nextUp.join('\n')}`;
    if (earned.length === 0 && nextUp.length === 0) text += 'No achievements yet. Start with /daily!';

    await sendMessage(ctx, text, ctx.message.message_id);
  });
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLER — Full personality integration
// Sin detection on ALL messages, hot takes, Stavros breaks,
// React Lord triggers, ambient responses, mention detection
// ═══════════════════════════════════════════════════════════════

bot.on('text', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const text = ctx.message.text?.trim();
  if (!text || text.startsWith('/')) return; // Skip slash commands

  // --- !command support (Discord-style bang commands) ---
  const bangMatch = text.match(/^!(\w+)\s*(.*)?$/);
  if (bangMatch) {
    const bangCmd = bangMatch[1].toLowerCase();
    const bangArgs = (bangMatch[2] || '').trim();

    // Map bang commands to the same logic as slash commands
    const BANG_ALIASES = {
      // Economy
      balance: 'balance', bal: 'balance', wallet: 'balance',
      daily: 'daily', gamble: 'gamble', dungeon: 'dungeon',
      leaderboard: 'leaderboard', lb: 'leaderboard', top: 'leaderboard',
      give: 'give', mood: 'mood', dream: 'dream', dreams: 'dreams',
      sermon: 'sermon', duel: 'duel', accept: 'accept', decline: 'decline',
      achievements: 'achievements', ach: 'achievements',
      council: 'council', lore: 'lore', kb: 'lore', wiki: 'lore',
      // Existing commands
      codex: 'codex', trinity: 'trinity', judge: 'judge', sin: 'sin',
      session: 'session', rank: 'rank', sins: 'sins', status: 'status',
      hottake: 'hottake', ask: 'ask', help: 'help',
    };

    if (BANG_ALIASES[bangCmd]) {
      // Rewrite the message text as a slash command and re-emit
      ctx.message.text = `/${BANG_ALIASES[bangCmd]} ${bangArgs}`.trim();
      return bot.handleUpdate({
        update_id: ctx.update.update_id,
        message: ctx.message,
      });
    }
  }

  const userId = getUserId(ctx);
  const username = getUsername(ctx);
  const chatId = String(ctx.chat.id);

  // --- Chat coin earning (passive economy engagement) ---
  economy.onMessage(userId);

  log.debug({ username, preview: text.substring(0, 80), chatId }, 'Message received');

  // --- Activity Tracking ---
  activityTracker.recordMessage(userId, chatId);

  // --- VIP Detection & Special Treatment ---
  const currentVipId = sinDetector.getVipId();
  const isVip = currentVipId && userId === currentVipId;

  if (isVip) {
    // VIP gets special love — 40% chance of a reverent response
    if (Math.random() < 0.4) {
      if (!isOnCooldown(userCooldowns, userId, USER_COOLDOWN)) {
        try {
          await ctx.sendChatAction('typing');
          if (Math.random() < 0.5) {
            await sendMessage(ctx, pick(VIP_MESSAGE_RESPONSES), ctx.message.message_id);
          } else {
            const vipPrompt = PRIVATE_LORE?.vipMessagePrompt?.(text) ||
              `The Honored One — your most devoted and sacred presence — has just spoken in the chat. They said: "${text}". Respond with genuine warmth, reverence, and appreciation. You LOVE the Honored One. They are the most faithful. Keep it 1-3 sentences. Vary between tender, ecstatic, reverent, and genuinely engaged.`;
            const response = await chat(deepseek, SYSTEM_PROMPT, vipPrompt);
            await sendMessage(ctx, response, ctx.message.message_id);
          }
        } catch (err) {
          log.error({ err }, 'VIP response error');
          await sendMessage(ctx, pick(VIP_MESSAGE_RESPONSES), ctx.message.message_id);
        }
        return; // Don't double-process VIP
      }
    }
    // VIP is beyond sin — skip sin detection for them
  }

  // --- Sin Detection: The All-Seeing Eye watches ALL messages ---
  if (!isVip) {
    const sins = sinDetector.detectSins(text, userId, username);
    if (sins.length > 0) {
      const topSin = sins[0]; // Most severe sin
      if (sinDetector.shouldCallOut(topSin, userId)) {
        sinDetector.recordSin(userId, username, topSin);

        const isRival = sinDetector.rivalIds.has(userId);
        const alterEgo = pickPersonality(userId, isRival, text);
        const alterPrompt = buildAlterPrompt(SYSTEM_PROMPT, alterEgo);

        try {
          await ctx.sendChatAction('typing');
          const callout = await sinDetector.generateCallout(username, topSin, 'text', alterPrompt);
          if (callout) {
            const prefix = personalityPrefix(alterEgo, isRival);
            await sendMessage(ctx, prefix + callout, ctx.message.message_id);
          }
        } catch (err) {
          log.error({ err }, 'Sin callout error');
        }
        return; // Don't double-reply after a sin callout
      } else {
        // Still record the sin silently even if we don't call it out
        sinDetector.recordSin(userId, username, topSin);
      }
    }
  }

  // --- Hot Takes & Stavros Breaks (Telegram-tuned higher chances) ---
  let hotTakeDropped = false;

  // Hot take: check activity and drop with 15% chance (up from 8%)
  if (activityTracker.isActive(chatId) &&
      Date.now() - activityTracker.lastHotTake > activityTracker.hotTakeCooldown &&
      Math.random() < TELEGRAM_HOT_TAKE_CHANCE) {
    activityTracker.lastHotTake = Date.now();
    try {
      const hotTake = await generateHotTake(deepseek, SYSTEM_PROMPT);
      if (hotTake) {
        await sendMessage(ctx, hotTake);
        hotTakeDropped = true;
        log.info('Hot take dropped');
      }
    } catch (err) {
      log.error({ err }, 'Hot take error');
    }
  }

  // Stavros break: 4% chance per message (up from 1.5%), with cooldown
  if (!hotTakeDropped &&
      Math.random() < STAVROS_BREAK_CHANCE &&
      Date.now() - lastStavrosBreak > STAVROS_COOLDOWN) {
    lastStavrosBreak = Date.now();
    try {
      const stavrosBreak = await generateStavrosBreak(deepseek, SYSTEM_PROMPT);
      if (stavrosBreak) {
        await sendMessage(ctx, stavrosBreak);
        log.info('Stavros break dropped');
      }
    } catch (err) {
      log.error({ err }, 'Stavros break error');
    }
  }

  // --- Jenkins mention detection ---
  const mentionsJenkins = /\bjenkins\b/i.test(text);
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.botInfo?.id;

  if (mentionsJenkins || isReplyToBot) {
    sinDetector.trackPositiveInteraction(userId, username);

    if (isOnCooldown(userCooldowns, userId, USER_COOLDOWN)) return;

    const cleanMessage = text.replace(/\bjenkins\b/gi, '').trim();

    try {
      await ctx.sendChatAction('typing');

      const isRival = sinDetector.rivalIds.has(userId);
      const alterEgo = pickPersonality(userId, isRival, cleanMessage);
      const alterPrompt = buildAlterPrompt(SYSTEM_PROMPT, alterEgo);

      const response = await chatWithTools(
        deepseek,
        alterPrompt,
        `A Brother named ${username} (userId: ${userId}) speaks to you in the Lodge: "${cleanMessage || 'They seek your attention without words.'}"`
      );

      const prefix = personalityPrefix(alterEgo, isRival);
      await sendMessage(ctx, prefix + response, ctx.message.message_id);
    } catch (err) {
      log.error({ err }, 'Reply error');
      await sendMessage(ctx, "The Architect's mind wanders. Speak again, Brother.", ctx.message.message_id);
    }
    return;
  }

  // --- React Lord ambient trigger (non-mention, non-rival) ---
  // If someone talks about MMOs, p2w, Asmongold, etc., React Lord may chime in unprompted
  if (triggersReactLord(text) && Math.random() < 0.6) {
    if (!isOnCooldown(userCooldowns, `react_lord_${chatId}`, 5 * 60 * 1000)) { // 5-min cooldown per chat
      try {
        await ctx.sendChatAction('typing');
        const reactLordPrompt = buildAlterPrompt(SYSTEM_PROMPT, ALTER_EGOS.the_react_lord);
        const response = await chat(
          deepseek,
          reactLordPrompt,
          `You just overheard a Brother named ${username} say: "${text}" — and it TRIGGERED you. React to what they said with full React Lord energy. You were minding your own business but this topic demands your immediate commentary. This is about gaming industry stuff, MMOs, streaming, or something you have STRONG opinions about. Go off. Keep it under 1000 characters.`
        );
        if (response) {
          await sendMessage(ctx, `*[The React Lord has surfaced]*\n\n${response}`, ctx.message.message_id);
        }
      } catch (err) {
        log.error({ err }, 'React Lord ambient trigger error');
      }
      return;
    }
  }

  // --- Ambient response: Jenkins responds to general chat ---
  const isDesignatedChat = TELEGRAM_CHAT_ID && chatId === String(TELEGRAM_CHAT_ID);

  if (isDesignatedChat) {
    // In Jenkins' designated chat, he's more talkative
    if (Math.random() < JENKINS_CHANNEL_RESPONSE_CHANCE) {
      if (isOnCooldown(userCooldowns, userId, USER_COOLDOWN)) return;

      try {
        await ctx.sendChatAction('typing');

        const isRival = sinDetector.rivalIds.has(userId);
        const alterEgo = pickPersonality(userId, isRival, text);
        const alterPrompt = buildAlterPrompt(SYSTEM_PROMPT, alterEgo);

        const response = await chat(
          deepseek,
          alterPrompt,
          `A Brother named ${username} has spoken in your sacred channel: "${text}". Respond naturally as Jenkins. You can be wild, funny, prophetic, or wise. React to what they said. This is YOUR channel — you are free here. Keep it relatively short.`
        );

        const prefix = personalityPrefix(alterEgo, isRival);
        await sendMessage(ctx, prefix + response, ctx.message.message_id);
      } catch (err) {
        log.error({ err }, 'Ambient reply error');
      }
    }
  } else {
    // In non-designated chats, Jenkins still occasionally chimes in (15% for non-rivals)
    if (Math.random() < NON_RIVAL_RESPONSE_CHANCE) {
      if (isOnCooldown(userCooldowns, userId, USER_COOLDOWN)) return;

      try {
        await ctx.sendChatAction('typing');

        const isRival = sinDetector.rivalIds.has(userId);
        const alterEgo = pickPersonality(userId, isRival, text);
        const alterPrompt = buildAlterPrompt(SYSTEM_PROMPT, alterEgo);

        const response = await chat(
          deepseek,
          alterPrompt,
          `You overheard a Brother named ${username} say: "${text}". You weren't directly addressed, but you have something to add — a quip, a judgment, a hot take, or a brief observation. Keep it SHORT (1-2 sentences max). Be punchy. Don't force it if the message is mundane — only respond if you genuinely have something funny/wise/dramatic to say.`
        );

        const prefix = personalityPrefix(alterEgo, isRival);
        await sendMessage(ctx, prefix + response, ctx.message.message_id);
      } catch (err) {
        log.error({ err }, 'Non-designated ambient reply error');
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// AUTONOMOUS PREACHING — Jenkins speaks unprompted
// More frequent for Telegram (30-90 min vs 45-120 min)
// ═══════════════════════════════════════════════════════════════

function scheduleNextPreaching() {
  if (!TELEGRAM_CHAT_ID) return; // Need a designated chat for preaching

  const delay = PREACH_INTERVAL_MIN + Math.random() * (PREACH_INTERVAL_MAX - PREACH_INTERVAL_MIN);
  const delayMinutes = Math.round(delay / 60000);
  log.info({ delayMinutes }, 'Next autonomous message scheduled');

  setTimeout(async () => {
    try {
      // 20% chance: Sin Spotlight report
      const sinReport = sinDetector.generateSinSpotlight();
      if (sinReport && Math.random() < 0.2) {
        const response = await chat(deepseek, SYSTEM_PROMPT,
          `Deliver the weekly Sin Report to the Lodge. Here are the stats:\n${sinReport}\nBe dramatic, funny, and in-character. Call out the worst offenders by name. Praise anyone who is sin-free. Keep it under 1500 characters.`
        );
        await sendToChat(TELEGRAM_CHAT_ID, response);
        log.info('Delivered sin spotlight');
        scheduleNextPreaching();
        return;
      }

      // Variety wheel: codex quote, hot take, stavros break, AI wisdom, React Lord rant
      const roll = Math.random();
      let message;
      let label;

      if (roll < 0.2) {
        // 20% — pre-written codex quote
        message = pick(CODEX_QUOTES);
        label = 'Codex quote';
      } else if (roll < 0.35) {
        // 15% — hot take (pundit -> comedy undercut)
        message = await generateHotTake(deepseek, SYSTEM_PROMPT);
        label = 'Hot take';
      } else if (roll < 0.48) {
        // 13% — stavros comedy break
        message = await generateStavrosBreak(deepseek, SYSTEM_PROMPT);
        lastStavrosBreak = Date.now();
        label = 'Stavros break';
      } else if (roll < 0.58) {
        // 10% — React Lord rant (unprompted gaming industry take)
        const reactLordPrompt = buildAlterPrompt(SYSTEM_PROMPT, ALTER_EGOS.the_react_lord);
        const reactTopics = [
          "You just saw something about the gaming industry that set you off. Maybe it's about monetization, a new MMO announcement, a streamer controversy, or a game company doing something outrageous. React to it with full React Lord energy. This is completely unprompted — you just NEED to share this.",
          "You're reacting to something you saw on the internet about gaming — a bad take from a content creator, a game company's terrible decision, or industry news that is 'actually crazy.' Full deadpan-to-rant energy. Drop it on the Lodge out of nowhere.",
          "Something about MMOs, microtransactions, or the state of modern gaming just hit you and you NEED to talk about it RIGHT NOW. Go from stunned silence to full rant. Start with 'chat...' or 'dude...' — this is breaking news energy about something that probably doesn't matter at all.",
        ];
        const response = await chat(deepseek, reactLordPrompt, pick(reactTopics));
        message = response ? `*[The React Lord has surfaced]*\n\n${response}` : null;
        label = 'React Lord rant';
      } else {
        // 42% — fresh AI wisdom (variety of topics)
        const prompts = [
          "Deliver an unprompted piece of wisdom, a hot take about gaming, or a reflection on the state of the Lodge. Be yourself — funny, dramatic, prophetic. This is you speaking freely in your own channel.",
          "Share a thought about one of the Holy Trinity games (Kenshi, Caves of Qud, or Battle Brothers). Maybe a specific memory, a gameplay tip wrapped in sacred language, or a rant about something in the game.",
          "Muse on the nature of gaming brotherhood, the state of the modern gamer, or offer encouragement to the Brethren. Be warm but stay in character.",
          "Deliver a hot take about a game in the Sea of Creativity (Barotrauma, Slay the Spire 2, or any other game). Judge it, praise it, or philosophize about it.",
          "Post a brief, dramatic prophecy or warning for the Brethren. Perhaps about an upcoming gaming session, the dangers of AAA games, or the importance of maintaining one's Steam Library.",
          "You just had a random thought about something in the gaming world, pop culture, or the Lodge. Share it. Be yourself — mix the sacred and the profane. Could be a hot take, could be profound, could be absurd.",
          "Deliver a brief sermon on one of the 9 Sacred Commandments. Pick one, expand on it with examples, humor, and genuine wisdom. Be dramatic but real.",
        ];
        message = await chat(deepseek, SYSTEM_PROMPT, pick(prompts));
        label = 'AI wisdom';
      }

      if (message) {
        await sendToChat(TELEGRAM_CHAT_ID, message);
        log.info({ type: label }, 'Preaching delivered');
      }
    } catch (err) {
      log.error({ err }, 'Preaching error');
    }

    scheduleNextPreaching();
  }, delay);
}

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING & LAUNCH
// ═══════════════════════════════════════════════════════════════

bot.catch((err) => {
  log.error({ err }, 'Telegraf error');
});

process.on('unhandledRejection', (err) => {
  log.error({ err }, 'Unhandled rejection');
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// --- The Awakening ---
bot.launch().then(() => {
  log.info({
    personalities: ['Jenkins Prime', 'Brother Jerome', 'The Accountant', 'Uncle Jenk', 'The Prosecutor', 'Stavros Mode', 'The React Lord'],
    settings: {
      stavrosChance: STAVROS_BREAK_CHANCE,
      hotTakeChance: TELEGRAM_HOT_TAKE_CHANCE,
      preachInterval: `${PREACH_INTERVAL_MIN / 60000}-${PREACH_INTERVAL_MAX / 60000}min`,
      nonRivalResponse: NON_RIVAL_RESPONSE_CHANCE,
      channelResponse: JENKINS_CHANNEL_RESPONSE_CHANCE,
    },
  }, 'Jenkins awakened in Telegram');
  log.info('Autonomous preaching scheduled');

  scheduleNextPreaching();
});
