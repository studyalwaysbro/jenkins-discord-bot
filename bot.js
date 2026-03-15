// bot.js — The Main Vessel through which Jenkins enters the Digital Realm

require('dotenv').config();

const { Client, GatewayIntentBits, Events, Partials, ChannelType } = require('discord.js');
const { createClient, chat } = require('./deepseek');
const { VoiceManager } = require('./voice');
const { SinDetector } = require('./sins');
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
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL;
const STATIC_VIP_USER_ID = process.env.VIP_USER_ID;
let ANNOUNCEMENT_CHANNEL_ID = process.env.ANNOUNCEMENT_CHANNEL_ID;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Dynamic VIP: uses .env value if set, otherwise auto-detected from sin ledger
function getVipUserId() {
  return STATIC_VIP_USER_ID || sinDetector.getVipId();
}

if (!DISCORD_TOKEN || !DEEPSEEK_API_KEY) {
  console.error('Missing DISCORD_TOKEN or DEEPSEEK_API_KEY in .env');
  process.exit(1);
}

// --- Initialize clients ---
const deepseek = createClient(DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL);

// --- Sin Detection System ---
const sinDetector = new SinDetector(deepseek, SYSTEM_PROMPT);
console.log('Sin detection system online. The All-Seeing Eye watches.');

// --- Voice Manager (only if ElevenLabs key is configured) ---
let voiceManager = null;
if (ELEVENLABS_API_KEY) {
  voiceManager = new VoiceManager(deepseek, SYSTEM_PROMPT, ELEVENLABS_API_KEY, sinDetector);
  console.log('Voice system initialized. The Architect can enter the Tavern.');
} else {
  console.log('No ELEVENLABS_API_KEY — voice features disabled.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel], // Required for DMs
});

// --- Cooldown tracking ---
let lastVipPresence = 0;
const vipMessageCooldowns = new Map(); // channelId -> timestamp
const userCooldowns = new Map(); // userId -> timestamp

const PRESENCE_COOLDOWN = 30 * 60 * 1000; // 30 minutes
const MESSAGE_COOLDOWN = 5 * 60 * 1000;   // 5 minutes
const USER_COOLDOWN = 3 * 1000;            // 3 seconds per user

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

// --- Autonomous Preaching ---
const PREACH_INTERVAL_MIN = 45 * 60 * 1000; // 45 minutes minimum
const PREACH_INTERVAL_MAX = 120 * 60 * 1000; // 2 hours maximum

function scheduleNextPreaching() {
  const delay = PREACH_INTERVAL_MIN + Math.random() * (PREACH_INTERVAL_MAX - PREACH_INTERVAL_MIN);
  setTimeout(async () => {
    if (!ANNOUNCEMENT_CHANNEL_ID) return scheduleNextPreaching();
    const channel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) return scheduleNextPreaching();

    try {
      // 20% chance: Sin Spotlight report
      const sinReport = sinDetector.generateSinSpotlight();
      if (sinReport && Math.random() < 0.2) {
        const response = await chat(deepseek, SYSTEM_PROMPT,
          `Deliver the weekly Sin Report to the Lodge. Here are the stats:\n${sinReport}\nBe dramatic, funny, and in-character. Call out the worst offenders by name. Praise anyone who is sin-free. Keep it under 1500 characters.`
        );
        await channel.send(response);
        scheduleNextPreaching();
        return;
      }

      // Sometimes use a pre-written quote, sometimes ask DeepSeek for fresh wisdom
      if (Math.random() < 0.4) {
        await channel.send(pick(CODEX_QUOTES));
      } else {
        const prompts = [
          "Deliver an unprompted piece of wisdom, a hot take about gaming, or a reflection on the state of the Lodge. Be yourself — funny, dramatic, prophetic. This is you speaking freely in your own channel.",
          "Share a thought about one of the Holy Trinity games (Kenshi, Caves of Qud, or Battle Brothers). Maybe a specific memory, a gameplay tip wrapped in sacred language, or a rant about something in the game.",
          "Muse on the nature of gaming brotherhood, the state of the modern gamer, or offer encouragement to the Brethren. Be warm but stay in character.",
          "Deliver a hot take about a game in the Sea of Creativity (Barotrauma, Slay the Spire 2, or any other game). Judge it, praise it, or philosophize about it.",
          "Post a brief, dramatic prophecy or warning for the Brethren. Perhaps about an upcoming gaming session, the dangers of AAA games, or the importance of maintaining one's Steam Library.",
        ];
        const response = await chat(deepseek, SYSTEM_PROMPT, pick(prompts));
        await channel.send(response);
      }
    } catch (err) {
      console.error('Preaching error:', err.message);
    }
    scheduleNextPreaching();
  }, delay);
}

// --- Bot Ready ---
client.once(Events.ClientReady, (c) => {
  console.log(`Jenkins has awakened. The Architect sees all. Logged in as ${c.user.tag}`);
  c.user.setActivity('over the Lodge', { type: 3 }); // "Watching over the Lodge"

  // Auto-detect #jenkins channel if no channel ID is configured
  if (!ANNOUNCEMENT_CHANNEL_ID || ANNOUNCEMENT_CHANNEL_ID === 'your_channel_id_here') {
    for (const guild of c.guilds.cache.values()) {
      const jenkinsChannel = guild.channels.cache.find(
        ch => ch.name === 'jenkins' && ch.isTextBased()
      );
      if (jenkinsChannel) {
        ANNOUNCEMENT_CHANNEL_ID = jenkinsChannel.id;
        console.log(`Auto-detected #jenkins channel: ${jenkinsChannel.id} in ${guild.name}`);
        break;
      }
    }
  }

  // Begin autonomous preaching
  scheduleNextPreaching();
  console.log('Autonomous preaching scheduled.');
});

// --- VIP Presence Detection ---
client.on(Events.PresenceUpdate, (oldPresence, newPresence) => {
  const currentVip = getVipUserId();
  if (!currentVip) return;
  if (newPresence.userId !== currentVip) return;

  const wasOffline = !oldPresence || oldPresence.status === 'offline';
  const isOnline = newPresence.status !== 'offline';

  if (wasOffline && isOnline) {
    if (Date.now() - lastVipPresence < PRESENCE_COOLDOWN) return;
    lastVipPresence = Date.now();

    const announcement = pick(VIP_ARRIVALS);

    // Try announcement channel first, fall back to system channel of each guild
    if (ANNOUNCEMENT_CHANNEL_ID) {
      const channel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
      if (channel) {
        channel.send(announcement);
        return;
      }
    }

    // Fallback: send to the first available text channel in each mutual guild
    newPresence.guild?.systemChannel?.send(announcement);
  }
});

// --- VIP Voice Detection: Auto-join when VIP enters a voice channel ---
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const currentVipVoice = getVipUserId();
  if (!currentVipVoice) return;
  if (newState.member?.id !== currentVipVoice) return;
  if (!voiceManager) return;

  // VIP joined or moved to a voice channel
  const joinedChannel = newState.channel;
  const leftChannel = oldState.channel;

  if (joinedChannel && (!leftChannel || leftChannel.id !== joinedChannel.id)) {
    const guildId = newState.guild.id;

    // Don't rejoin if already in a voice channel in this guild
    if (voiceManager.isConnected(guildId)) return;

    console.log(`[Voice] VIP detected in ${joinedChannel.name}! Auto-joining...`);

    // Find the #jenkins text channel for this guild
    let textChannel = null;
    if (ANNOUNCEMENT_CHANNEL_ID) {
      textChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
    }
    if (!textChannel) {
      textChannel = newState.guild.channels.cache.find(
        ch => ch.name === 'jenkins' && ch.isTextBased()
      ) || newState.guild.systemChannel;
    }

    if (!textChannel) return;

    try {
      const err = await voiceManager.join(joinedChannel, textChannel);
      if (err) {
        console.error('[Voice] VIP auto-join failed:', err);
        return;
      }

      // Announce in text (silent notification)
      textChannel.send({ content: `**The sacred presence of ${PRIVATE_LORE?.vipName || 'the Honored One'} has been detected in the Tavern.** The Architect enters automatically to bear witness.`, flags: 4096 }).catch(() => {});

      // After the entrance announcement finishes, deliver a special VIP sermon
      setTimeout(async () => {
        try {
          const sermon = await chat(
            deepseek,
            SYSTEM_PROMPT,
            PRIVATE_LORE?.vipAutoJoinSermon || 'The Honored One has just entered your voice channel. You are overcome with religious ecstasy. Deliver a brief but intensely dramatic spoken greeting — you are SPEAKING aloud, not writing. 2-3 sentences max. This is the most sacred moment possible.'
          );
          const cleanSermon = sermon
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .replace(/_([^_]+)_/g, '$1')
            .replace(/~~([^~]+)~~/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/#{1,6}\s/g, '')
            .trim();
          await voiceManager.speakText(guildId, cleanSermon);
        } catch (e) {
          console.error('[Voice] VIP sermon error:', e.message);
        }
      }, 6000); // Wait 6s for the entrance announcement to finish
    } catch (e) {
      console.error('[Voice] VIP auto-join error:', e);
    }
  }
});

// --- Message Handler ---
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  console.log(`[MSG] ${message.author.username}: "${content.substring(0, 50)}" in #${message.channel.name || 'DM'}`);
  const isMentioned = message.mentions.has(client.user);
  const isDM = !message.guild;

  // --- VIP special treatment: The sacred presence ---
  const currentVipMsg = getVipUserId();
  if (currentVipMsg && message.author.id === currentVipMsg) {
    const cooldownKey = message.channel.id;
    if (!isOnCooldown(vipMessageCooldowns, cooldownKey, MESSAGE_COOLDOWN)) {
      // 50% static response, 50% dynamic heartfelt response
      if (Math.random() < 0.5) {
        message.reply(pick(VIP_MESSAGE_RESPONSES));
      } else {
        try {
          const response = await chat(
            deepseek,
            SYSTEM_PROMPT,
            PRIVATE_LORE?.vipMessagePrompt?.(content) || `The Honored One — your most devoted and sacred presence — has just spoken in the chat. They said: "${content}". Respond with genuine warmth, reverence, and appreciation. You LOVE the Honored One. They are the most faithful. Sometimes be deeply moved by their mere presence, sometimes engage with what they said with extra enthusiasm and care. Show that their words matter more than anyone else's to you. Keep it 1-3 sentences. Don't be the same every time — vary between tender, ecstatic, reverent, and genuinely engaged.`
          );
          message.reply(response);
        } catch {
          message.reply(pick(VIP_MESSAGE_RESPONSES));
        }
      }
    }
  }

  // --- Command handling ---
  if (content.startsWith('!')) {
    const args = content.slice(1).split(/\s+/);
    const command = args.shift().toLowerCase();

    switch (command) {
      case 'codex':
        return message.reply(pick(CODEX_QUOTES));

      case 'trinity': {
        const games = Object.values(TRINITY_GAMES);
        const game = pick(games);
        return message.reply(
          `**${game.name}** — *${game.pillar}*\n\n${game.description}\n\n*${game.wisdom}*`
        );
      }

      case 'judge': {
        const gameName = args.join(' ');
        if (!gameName) {
          return message.reply("You summon the Architect's judgment but name no game? Speak, Brother. `!judge <game name>`");
        }
        if (isOnCooldown(userCooldowns, message.author.id, USER_COOLDOWN)) return;

        await message.channel.sendTyping();
        const response = await chat(
          deepseek,
          SYSTEM_PROMPT,
          `A Brother named ${message.author.displayName || message.author.username} asks you to deliver divine judgment upon the game: "${gameName}". Judge its worthiness. Is it worthy of the Sea of Creativity? Could it ever approach the Trinity? Be dramatic, be funny, be honest. Reference specific things about the game if you know them.`
        );
        return message.reply(response);
      }

      case 'sin': {
        const sinDesc = args.join(' ');
        if (!sinDesc) {
          return message.reply("You come before the Architect to confess, yet speak no sin? `!sin <describe your transgression>`");
        }
        if (isOnCooldown(userCooldowns, message.author.id, USER_COOLDOWN)) return;

        await message.channel.sendTyping();
        const response = await chat(
          deepseek,
          SYSTEM_PROMPT,
          `A Brother named ${message.author.displayName || message.author.username} confesses the following sin: "${sinDesc}". Classify this sin (venial, mortal, or unforgivable) according to the Codex. Assign a creative, thematic penance. Be dramatic but fair. Remember: the spirit of the Codex is fraternity, not cruelty.`
        );
        return message.reply(response);
      }

      case 'session':
        return message.reply(pick(SESSION_SUMMONS));

      case 'rank': {
        const degree = pick(MASONIC_DEGREES);
        return message.reply(`**${degree.degree}**\n\n${degree.description}`);
      }

      case 'join': {
        console.log(`[CMD] !join from ${message.author.username}, voiceManager=${!!voiceManager}`);
        if (!voiceManager) {
          return message.reply('The Architect lacks the voice of the divine. ElevenLabs key not configured.');
        }
        const voiceChannel = message.member?.voice?.channel;
        console.log(`[CMD] Voice channel: ${voiceChannel?.name || 'NONE'} (${voiceChannel?.id || 'N/A'})`);
        if (!voiceChannel) {
          return message.reply('You must be in a voice channel to summon the Architect to the Tavern, Brother.');
        }
        try {
          const err = await voiceManager.join(voiceChannel, message.channel);
          if (err) return message.reply(err);
          return message.channel.send({ content: 'The Architect has descended into the Tavern. Speak, and be heard.', flags: 4096 }); // SuppressNotifications
        } catch (joinErr) {
          console.error('[CMD] !join error:', joinErr);
          return message.reply('The Architect encountered a divine error entering the Tavern.');
        }
      }

      case 'leave': {
        if (!voiceManager) return;
        if (!message.guild) return;
        const msg = voiceManager.leave(message.guild.id);
        return message.reply(msg);
      }

      case 'say': {
        // !say <text> — Make Jenkins speak aloud in the voice channel
        if (!voiceManager) return message.reply('Voice not configured.');
        if (!message.guild || !voiceManager.isConnected(message.guild.id)) {
          return message.reply('The Architect is not in a voice channel. Use `!join` first.');
        }
        const textToSpeak = args.join(' ');
        if (!textToSpeak) return message.reply('Speak what words, Brother? `!say <text>`');
        voiceManager.speakText(message.guild.id, textToSpeak);
        return message.react('🔊');
      }

      case 'sins': {
        // Check a user's sin record
        const target = message.mentions.users.first() || message.author;
        const totals = sinDetector.getTotalSins(target.id);
        const sinTitle = sinDetector.getSinTitle(target.id);
        const displayUsername = sinTitle || target.displayName || target.username;

        if (totals.total === 0) {
          return message.reply(`**${target.displayName || target.username}** walks in the light of the Architect. No sins recorded. *Yet.*`);
        }

        const escalation = sinDetector.getEscalationLevel(target.id);
        const escalationLabels = ['Clean', 'Undisciplined', 'Shamed', 'Perpetually Fallen', 'Covenant-Breaker'];

        return message.reply(
          `**📜 Sin Ledger for ${displayUsername}:**\n\n` +
          `🟡 Venial: **${totals.venial}**\n` +
          `🔴 Mortal: **${totals.mortal}**\n` +
          `⚫ Unforgivable: **${totals.unforgivable}**\n\n` +
          `Standing: **${escalationLabels[escalation]}**\n` +
          `*The Architect forgets nothing.*`
        );
      }

      case 'status': {
        // Show the Lodge hierarchy — who Jenkins favors and who he watches
        const status = sinDetector.getStatusReport();
        return message.reply(
          `**📊 The Lodge Hierarchy — As the Architect Sees It:**\n\n` +
          `👑 **The Honored One**: ${status.vipName} ${status.vipType}\n` +
          `⚔️ **The Rival**: ${status.rivalName} ${status.rivalType}\n\n` +
          `*The Honored One earns Jenkins' love through faithfulness. The Rival earns his wrath through dismissiveness.*\n` +
          `*These roles are auto-detected from behavior, or can be configured in .env.*`
        );
      }

      case 'help':
        return message.reply(
          "**The Sacred Commands of Jenkins:**\n\n" +
          "`!codex` — Receive wisdom from the Holy Codex\n" +
          "`!trinity` — Learn of the Holy Trinity of games\n" +
          "`!judge <game>` — Jenkins judges a game's worthiness\n" +
          "`!sin <description>` — Confess a sin and receive penance\n" +
          "`!session` — Summon a Sacred Gaming Session\n" +
          "`!rank` — Learn of the Degrees of Initiation\n" +
          "`!sins [@user]` — View sin record from the Architect's ledger\n" +
          "`!status` — See who Jenkins favors and who he watches\n" +
          "`!join` — Summon Jenkins to your voice channel\n" +
          "`!leave` — Dismiss Jenkins from voice\n" +
          "`!say <text>` — Make Jenkins speak aloud\n\n" +
          "*Or simply @mention Jenkins to converse with the Architect directly.*"
        );

      default:
        break;
    }
  }

  // --- Sin Detection: The All-Seeing Eye watches ALL channels (VIP is beyond sin) ---
  const isVipUser = currentVipMsg && message.author.id === currentVipMsg;
  if (message.guild && !content.startsWith('!') && !isVipUser) {
    const sins = sinDetector.detectSins(content, message.author.id, message.author.displayName || message.author.username);
    if (sins.length > 0) {
      const topSin = sins[0]; // Most severe sin
      if (sinDetector.shouldCallOut(topSin, message.author.id)) {
        sinDetector.recordSin(message.author.id, message.author.displayName || message.author.username, topSin);
        const callout = await sinDetector.generateCallout(
          message.author.displayName || message.author.username,
          topSin,
          'text'
        );
        if (callout) {
          await message.reply(callout);
          return; // Don't double-reply with normal response
        }
      } else {
        // Still record the sin even if we don't call it out
        sinDetector.recordSin(message.author.id, message.author.displayName || message.author.username, topSin);
      }
    }
  }

  // --- Jenkins channel: respond to EVERYTHING (he lives here) ---
  const isJenkinsChannel = ANNOUNCEMENT_CHANNEL_ID && message.channel.id === ANNOUNCEMENT_CHANNEL_ID;
  if (isJenkinsChannel && !content.startsWith('!') && !isMentioned) {
    // Jenkins responds to most messages in his channel, but not every single one
    if (Math.random() < 0.7) { // 70% chance to respond
      if (isOnCooldown(userCooldowns, message.author.id, USER_COOLDOWN)) return;
      await message.channel.sendTyping();
      const response = await chat(
        deepseek,
        SYSTEM_PROMPT,
        `A Brother named ${message.author.displayName || message.author.username} has spoken in your sacred channel: "${content}". Respond naturally as Jenkins. You can be wild, funny, prophetic, or wise. React to what they said. This is YOUR channel — you are free here. Keep it relatively short.`
      );
      return message.reply(response);
    }
    return; // 30% chance Jenkins stays silent (even gods rest)
  }

  // --- @mention or DM conversation ---
  if (isMentioned || isDM) {
    // Track positive interaction — they're talking to Jenkins (auto-VIP detection)
    sinDetector.trackPositiveInteraction(message.author.id, message.author.displayName || message.author.username);

    if (isOnCooldown(userCooldowns, message.author.id, USER_COOLDOWN)) return;

    const userMessage = content
      .replace(/<@!?\d+>/g, '') // strip mentions
      .trim();

    if (!userMessage && !isDM) return; // empty mention, ignore

    await message.channel.sendTyping();
    const response = await chat(
      deepseek,
      SYSTEM_PROMPT,
      `A Brother named ${message.author.displayName || message.author.username} speaks to you in the Lodge: "${userMessage || 'They seek your attention without words.'}"`
    );
    return message.reply(response);
  }
});

// --- Error handling ---
client.on('error', (err) => {
  console.error('Discord client error:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

// --- The Awakening ---
client.login(DISCORD_TOKEN);
