// telegram-bot.js — Jenkins Enters the Telegram Realm
// The Great Architect extends his reach beyond Discord into the land of Telegram.
// Full personality integration: all 7 alter egos, sin detection, hot takes,
// Stavros breaks, React Lord triggers, and autonomous preaching.

require('dotenv').config();

const { Telegraf } = require('telegraf');
const { createClient, chat } = require('./deepseek');
const { SinDetector } = require('./sins');
const { ALTER_EGOS, pickAlterEgoForUser, buildAlterPrompt } = require('./alter-egos');
const { ActivityTracker, generateHotTake, generateStavrosBreak } = require('./hot-takes');
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

// --- Configuration ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // Optional: restrict to specific chat
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL;

if (!TELEGRAM_BOT_TOKEN || !DEEPSEEK_API_KEY) {
  console.error('Missing TELEGRAM_BOT_TOKEN or DEEPSEEK_API_KEY in .env');
  process.exit(1);
}

// --- Initialize clients ---
const deepseek = createClient(DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL);
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// --- Sin Detection System ---
const sinDetector = new SinDetector(deepseek, SYSTEM_PROMPT);
console.log('Sin detection system online. The All-Seeing Eye watches Telegram.');

// --- Activity Tracker for hot takes (Telegram-tuned: higher chance) ---
const activityTracker = new ActivityTracker();
// Override hot take chance for Telegram (6% — slightly less than Discord's 8%)
const TELEGRAM_HOT_TAKE_CHANCE = 0.06;
console.log('Activity tracker online. Hot takes armed for Telegram (6% chance).');

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
    console.log(`[Personality] React Lord TRIGGERED for non-rival ${userId} by content match`);
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
      console.error('[Telegram] HTML parse error, sending plain:', err.message);
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
      console.error('[Telegram] HTML parse error in sendToChat, sending plain:', err.message);
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
    "`/codex` — Receive wisdom from the Holy Codex\n" +
    "`/trinity` — Learn of the Holy Trinity of games\n" +
    "`/judge <game>` — Jenkins judges a game's worthiness\n" +
    "`/sin <description>` — Confess a sin and receive penance\n" +
    "`/session` — Summon a Sacred Gaming Session\n" +
    "`/rank` — Learn of the Degrees of Initiation\n" +
    "`/sins` — View your sin record from the Architect's ledger\n" +
    "`/status` — See who Jenkins favors and who he watches\n" +
    "`/hottake` — Summon a hot take from the Architect\n" +
    "`/ask <question>` — Converse with the Architect directly\n\n" +
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
    console.error('[CMD] /judge error:', err.message);
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
    console.error('[CMD] /sin error:', err.message);
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
    console.error('[CMD] /hottake error:', err.message);
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

    const response = await chat(
      deepseek,
      alterPrompt,
      `A Brother named ${getUsername(ctx)} speaks to you in the Lodge: "${question}"`
    );

    const prefix = personalityPrefix(alterEgo, isRival);
    await sendMessage(ctx, prefix + response, ctx.message.message_id);
  } catch (err) {
    console.error('[CMD] /ask error:', err.message);
    await sendMessage(ctx, "The Architect's mind wanders. Speak again, Brother.", ctx.message.message_id);
  }
});

// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLER — Full personality integration
// Sin detection on ALL messages, hot takes, Stavros breaks,
// React Lord triggers, ambient responses, mention detection
// ═══════════════════════════════════════════════════════════════

bot.on('text', async (ctx) => {
  if (!isChatAllowed(ctx)) return;
  const text = ctx.message.text?.trim();
  if (!text || text.startsWith('/')) return; // Skip commands

  const userId = getUserId(ctx);
  const username = getUsername(ctx);
  const chatId = String(ctx.chat.id);

  console.log(`[MSG] ${username}: "${text.substring(0, 80)}" in chat ${chatId}`);

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
          console.error('[MSG] VIP response error:', err.message);
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
          console.error('[MSG] Sin callout error:', err.message);
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
        console.log('[HotTake] Dropped a hot take in Telegram chat');
      }
    } catch (err) {
      console.error('[HotTake] Error:', err.message);
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
        console.log('[Stavros] Dropped a Stavros break in Telegram chat');
      }
    } catch (err) {
      console.error('[Stavros] Error:', err.message);
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

      const response = await chat(
        deepseek,
        alterPrompt,
        `A Brother named ${username} speaks to you in the Lodge: "${cleanMessage || 'They seek your attention without words.'}"`
      );

      const prefix = personalityPrefix(alterEgo, isRival);
      await sendMessage(ctx, prefix + response, ctx.message.message_id);
    } catch (err) {
      console.error('[MSG] Reply error:', err.message);
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
        console.error('[ReactLord] Ambient trigger error:', err.message);
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
        console.error('[MSG] Ambient reply error:', err.message);
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
        console.error('[MSG] Non-designated ambient reply error:', err.message);
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
  console.log(`[Preaching] Next autonomous message in ~${delayMinutes} minutes`);

  setTimeout(async () => {
    try {
      // 20% chance: Sin Spotlight report
      const sinReport = sinDetector.generateSinSpotlight();
      if (sinReport && Math.random() < 0.2) {
        const response = await chat(deepseek, SYSTEM_PROMPT,
          `Deliver the weekly Sin Report to the Lodge. Here are the stats:\n${sinReport}\nBe dramatic, funny, and in-character. Call out the worst offenders by name. Praise anyone who is sin-free. Keep it under 1500 characters.`
        );
        await sendToChat(TELEGRAM_CHAT_ID, response);
        console.log('[Preaching] Delivered Sin Spotlight report');
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
        console.log(`[Preaching] Delivered: ${label}`);
      }
    } catch (err) {
      console.error('[Preaching] Error:', err.message);
    }

    scheduleNextPreaching();
  }, delay);
}

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING & LAUNCH
// ═══════════════════════════════════════════════════════════════

bot.catch((err) => {
  console.error('Telegraf error:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// --- The Awakening ---
bot.launch().then(() => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Jenkins has awakened in the Telegram Realm.');
  console.log('The Architect sees all. All 7 personalities active.');
  console.log(`  - Jenkins Prime (default)`);
  console.log(`  - Brother Jerome (passive-aggressive monk)`);
  console.log(`  - The Accountant (bureaucratic sin auditor)`);
  console.log(`  - Uncle Jenk (drunk uncle energy)`);
  console.log(`  - The Prosecutor (courtroom drama)`);
  console.log(`  - Stavros Mode (cackling comedian)`);
  console.log(`  - The React Lord (bald gaming sage)`);
  console.log('Telegram-tuned settings:');
  console.log(`  - Stavros break chance: ${STAVROS_BREAK_CHANCE * 100}%`);
  console.log(`  - Hot take chance: ${TELEGRAM_HOT_TAKE_CHANCE * 100}% (when active)`);
  console.log(`  - Preaching interval: ${PREACH_INTERVAL_MIN / 60000}-${PREACH_INTERVAL_MAX / 60000} min`);
  console.log(`  - Non-rival ambient response: ${NON_RIVAL_RESPONSE_CHANCE * 100}%`);
  console.log(`  - Designated chat response: ${JENKINS_CHANNEL_RESPONSE_CHANCE * 100}%`);
  console.log(`  - React Lord triggers: MMOs, p2w, Twitch, Asmongold, bald`);
  console.log('═══════════════════════════════════════════════════════');

  scheduleNextPreaching();
  console.log('Autonomous preaching scheduled for Telegram.');
});
