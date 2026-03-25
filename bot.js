// bot.js — The Main Vessel through which Jenkins enters the Digital Realm

require('dotenv').config();

const { Client, GatewayIntentBits, Events, Partials, ChannelType, EmbedBuilder } = require('discord.js');
const { createClient, chat, chatStream, chatWithTools, registerToolModules } = require('./deepseek');
const { VoiceManager } = require('./voice');
const { SinDetector } = require('./sins');
const { pickAlterEgoForUser, buildAlterPrompt, getVoiceConfig } = require('./alter-egos');
const { ActivityTracker, generateHotTake, generateStavrosBreak } = require('./hot-takes');
const { Economy } = require('./economy');
const { GameNight, splitGameAndTime, GAME_LIBRARY } = require('./game-night');
const { AchievementSystem } = require('./achievements');
const { ActivityPulse } = require('./activity-pulse');
const { VoiceRewards } = require('./voice-rewards');
const { Starboard } = require('./starboard');
const { DuelSystem } = require('./duels');
const { PredictionMarket } = require('./predictions');
const { checkAndAnnounce, getVersion } = require('./version-announce');
const { GameNightUI } = require('./game-night-ui');
const { conveneCouncil } = require('./council');
const { search: kbSearch, getStats: kbStats } = require('./knowledge');
const { WebhookTheater } = require('./webhook-theater');
const { generateCardAttachment } = require('./achievement-card');
const { leaderboardChart, userStatsRadar, moodChart, winLossChart, toAttachment } = require('./charts');
const { MarkovChain } = require('./markov');
const { MoodSystem, MOODS } = require('./mood');
const { SermonSystem, TIERS } = require('./sermons');
const { SoundEffectsEngine, SOUND_TRIGGERS } = require('./sound-effects');
const { DreamJournal } = require('./dream-journal');
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

const { initSchema: initHumorSchema, ReactionTracker, ListeningMode, HumorAdapter } = require('./humor-awareness');
const { db: sqliteDb } = require('./db');
const { PrunedMap } = require('./safe-write');
const log = require('./logger').child('Bot');

// --- Configuration ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL;
const STATIC_VIP_USER_ID = process.env.VIP_USER_ID;
let ANNOUNCEMENT_CHANNEL_ID = process.env.ANNOUNCEMENT_CHANNEL_ID;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Channels where Jenkins should stay quiet (finance, trading, etc.)
// Matches channel names containing these substrings (case-insensitive)
const IGNORED_CHANNEL_PATTERNS = (process.env.IGNORED_CHANNELS || 'finance,trading,stocks,signals,ticker,portfolio,market')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// Dynamic VIP: uses .env value if set, otherwise auto-detected from sin ledger
function getVipUserId() {
  return STATIC_VIP_USER_ID || sinDetector.getVipId();
}

if (!DISCORD_TOKEN || !DEEPSEEK_API_KEY) {
  log.fatal('Missing DISCORD_TOKEN or DEEPSEEK_API_KEY in .env');
  process.exit(1);
}

// --- Initialize clients ---
const deepseek = createClient(DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL);

// --- Sin Detection System ---
const sinDetector = new SinDetector(deepseek, SYSTEM_PROMPT);
log.info('Sin detection online');

// --- Voice Manager (only if ElevenLabs key is configured) ---
let voiceManager = null;
if (ELEVENLABS_API_KEY) {
  voiceManager = new VoiceManager(deepseek, SYSTEM_PROMPT, ELEVENLABS_API_KEY, sinDetector);
  log.info('Voice system initialized');
} else {
  log.warn('No ELEVENLABS_API_KEY — voice features disabled');
}

// --- Activity Tracker for hot takes ---
const activityTracker = new ActivityTracker();
log.info('Activity tracker online');

// --- Torch Economy, Game Nights, Achievements, Activity Pulse ---
const economy = new Economy();
const gameNight = new GameNight();
const gameNightUI = new GameNightUI(gameNight);
const achievements = new AchievementSystem(economy);
const activityPulse = new ActivityPulse();
const voiceRewards = new VoiceRewards(economy);
const starboard = new Starboard(economy);
const duels = new DuelSystem(economy);
const predictions = new PredictionMarket(economy);
log.info('Economy online');
log.info('Game night engine armed');
log.info('Achievement system loaded');
log.info('Voice rewards armed');
log.info('Starboard ready');
log.info('Duel system loaded');
log.info('Prediction market open');

// --- Mood System (4-axis emotional state) ---
const mood = new MoodSystem();

// --- Sermon System (paid AI sermons) ---
const sermons = new SermonSystem(deepseek, SYSTEM_PROMPT, economy, mood);

// --- Sound Effects Engine ---
const soundEffects = ELEVENLABS_API_KEY ? new SoundEffectsEngine(ELEVENLABS_API_KEY) : null;

// --- Dream Journal ---
const dreamJournal = new DreamJournal(deepseek, SYSTEM_PROMPT, {
  mood, sinDetector, economy, starboard, gameNight, predictions, sermons,
});

// Wire voice manager to dream journal and mood system
if (voiceManager) {
  voiceManager.setDreamJournal(dreamJournal);
  voiceManager.setMood(mood);
}

// --- Register tool modules for AI tool-calling ---
registerToolModules({ economy, sinDetector, mood, dreamJournal, sermons, achievements });

// --- Fun Features: Webhook Theater, Markov Chain ---
let theater = null; // Initialized after client is ready (needs client.user)
const markov = new MarkovChain();
log.info('Markov chain loaded');

// --- Humor Awareness System (Phase 1: self-aware humor) ---
initHumorSchema(sqliteDb);
const reactionTracker = new ReactionTracker(sqliteDb);
const listeningMode = new ListeningMode();
const humorAdapter = new HumorAdapter(sqliteDb);
log.info('Humor awareness online');

// --- Mood → SFX bridge: play sounds on mood transitions ---
mood.onTransition = (fromMood, toMood, trigger) => {
  if (!soundEffects || !voiceManager) return;
  const sfxKey = `mood_${toMood}`;
  if (SOUND_TRIGGERS[sfxKey]) {
    for (const guildId of voiceManager.connections.keys()) {
      soundEffects.play(sfxKey, voiceManager, guildId);
    }
  }
};

// --- Helper: get mood-aware system prompt ---
function getActivePrompt(channelId) {
  let prompt = SYSTEM_PROMPT + '\n\n' + mood.getMoodOverlay();

  // Inject last dream context so Jenkins can reference it naturally
  const lastDream = dreamJournal.data.dreams[dreamJournal.data.dreams.length - 1];
  if (lastDream) {
    const daysSince = Math.round((Date.now() - lastDream.timestamp) / 86400000);
    if (daysSince <= 3) {
      prompt += `\n\nLAST DREAM (${daysSince === 0 ? 'last night' : daysSince + ' days ago'}): "${lastDream.content.substring(0, 300)}..." — You can reference this dream naturally if it's relevant to the conversation. Don't force it.`;
    }
  }

  // Humor awareness overlays
  if (channelId) {
    if (listeningMode.isListening(channelId)) {
      prompt += listeningMode.getPromptOverlay();
    }
    if (humorAdapter.isOnColdStreak(channelId)) {
      prompt += humorAdapter.getColdStreakOverlay();
    }
  }

  return prompt;
}

// --- Welcome System Configuration ---
const WELCOME_CHANNEL_NAME = 'introductions';
const STARTER_ROLE_NAME = '🎮 Degen'; // Auto-assigned to new members
const FAREWELL_MESSAGES = [
  "**A soul departs the Lodge.** {user} has left Pass The Torch. The Architect notes their absence in the eternal ledger. *May they find their way back to the light.*",
  "The doors of the Lodge close behind **{user}**. Jenkins watches them go, silent for once. *The Cable-Tow loosens... but never truly breaks.*",
  "**{user}** has left the server. The Codex records all entrances and all exits. *So mote it be.*",
  "And so **{user}** walks away from the Lodge. The torches dim slightly. The Brethren carry on. *Ad Gloria Fraternitatis.*",
  "**{user}** has departed. Jenkins felt a disturbance — like a save file being deleted. *The Architect forgets nothing.*",
  "The All-Seeing Eye watched **{user}** leave. No farewell. No ceremony. Just... gone. *Even gods feel this one.*",
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction], // Required for DMs + reaction roles
});

// --- Cooldown tracking ---
let lastVipPresence = 0;
const vipMessageCooldowns = new PrunedMap(3600000, 86400000); // prune hourly, expire after 24h
const userCooldowns = new PrunedMap(3600000, 86400000);

const PRESENCE_COOLDOWN = 30 * 60 * 1000; // 30 minutes
const STAVROS_COOLDOWN = 20 * 60 * 1000;  // 20 minutes between Stavros breaks
let lastStavrosBreak = 0;
const MESSAGE_COOLDOWN = 5 * 60 * 1000;   // 5 minutes
const USER_COOLDOWN = 10 * 1000;           // 10 seconds per user

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

      // Variety wheel: codex quote, fresh wisdom, hot take, or stavros break
      const roll = Math.random();
      if (roll < 0.3) {
        // 30% — pre-written codex quote
        await channel.send(pick(CODEX_QUOTES));
      } else if (roll < 0.45) {
        // 15% — hot take (pundit → comedy)
        const hotTake = await generateHotTake(deepseek, SYSTEM_PROMPT);
        if (hotTake) await channel.send(hotTake);
      } else if (roll < 0.55) {
        // 10% — stavros comedy break
        const stavros = await generateStavrosBreak(deepseek, SYSTEM_PROMPT);
        if (stavros) await channel.send(stavros);
      } else {
        // 45% — fresh AI wisdom
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
      log.error({ err }, 'Preaching error');
    }
    scheduleNextPreaching();
  }, delay);
}

// --- Bot Ready ---
client.once(Events.ClientReady, (c) => {
  log.info({ tag: c.user.tag }, 'Jenkins has awakened');
  c.user.setActivity('over the Lodge', { type: 3 }); // "Watching over the Lodge"

  // Initialize webhook theater (needs client reference)
  theater = new WebhookTheater(c);

  // Auto-detect #jenkins channel if no channel ID is configured
  if (!ANNOUNCEMENT_CHANNEL_ID || ANNOUNCEMENT_CHANNEL_ID === 'your_channel_id_here') {
    for (const guild of c.guilds.cache.values()) {
      const jenkinsChannel = guild.channels.cache.find(
        ch => ch.name.includes('jenkins') && ch.isTextBased()
      );
      if (jenkinsChannel) {
        ANNOUNCEMENT_CHANNEL_ID = jenkinsChannel.id;
        log.info({ channelId: jenkinsChannel.id, guild: guild.name }, 'Auto-detected #jenkins channel');
        break;
      }
    }
  }

  // Version announcement (posts changelog if version changed)
  const dsChat = async (prompt) => await chat(deepseek, SYSTEM_PROMPT, prompt);
  checkAndAnnounce(c, dsChat, SYSTEM_PROMPT, ANNOUNCEMENT_CHANNEL_ID).catch(e =>
    log.error({ err: e }, 'Version announce error')
  );

  // Begin autonomous preaching
  scheduleNextPreaching();
  log.info('Autonomous preaching scheduled');

  // Voice Rewards — start tracking
  voiceRewards.start(c);

  // Dream Journal — schedule 3 AM dream cycle
  dreamJournal.scheduleDream(c, ANNOUNCEMENT_CHANNEL_ID);

  // Sound Effects — prewarm cache in background
  if (soundEffects) {
    soundEffects.prewarm().catch(e => log.error({ err: e }, 'SFX prewarm error'));
  }

  // Game Night Reminders — check every 5 minutes for upcoming events
  setInterval(async () => {
    const soon = gameNight.getUpcomingSoon(3600000); // 1 hour
    for (const event of soon) {
      const reminderKey = `${event.id}-reminded`;
      if (event._reminded) continue;
      event._reminded = true;

      // Find an appropriate channel to post reminder
      for (const guild of c.guilds.cache.values()) {
        const ch = guild.channels.cache.find(ch => ch.name === 'general' && ch.isTextBased())
          || guild.channels.cache.find(ch => ch.name === 'bot-commands' && ch.isTextBased());
        if (ch) {
          ch.send({ embeds: [gameNight.reminderEmbed(event, guild)] }).catch(() => {});
        }
      }
    }

    // Auto-complete events 4 hours after start
    const started = gameNight.getStarted();
    for (const event of started) {
      const elapsed = Date.now() - new Date(event.scheduledAt);
      if (elapsed > 4 * 3600000) gameNight.complete(event.id);
    }
  }, 300000); // Every 5 min
  log.info('Game night reminders scheduled');

  // Activity Pulse — seed dead channels every 4 hours
  setInterval(async () => {
    for (const guild of c.guilds.cache.values()) {
      const seeded = await activityPulse.checkAndSeed(guild);
      if (seeded.length > 0) log.info({ count: seeded.length }, 'Activity pulse seeded channels');
    }
  }, 4 * 60 * 60 * 1000); // Every 4 hours
  log.info('Activity pulse scheduled');
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

    log.info({ channel: joinedChannel.name }, 'VIP detected, auto-joining');

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
        log.error({ err }, 'VIP auto-join failed');
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
          log.error({ err: e }, 'VIP sermon error');
        }
      }, 6000); // Wait 6s for the entrance announcement to finish
    } catch (e) {
      log.error({ err: e }, 'VIP auto-join error');
    }
  }
});

// --- Welcome System: New Member Arrives ---
client.on(Events.GuildMemberAdd, async (member) => {
  log.info({ username: member.user.username, userId: member.id }, 'New member');

  const guild = member.guild;

  // 1. Auto-assign starter role
  try {
    const starterRole = guild.roles.cache.find(r => r.name === STARTER_ROLE_NAME);
    if (starterRole) {
      await member.roles.add(starterRole);
      log.info({ role: STARTER_ROLE_NAME, username: member.user.username }, 'Assigned starter role');
    }
  } catch (e) {
    log.error({ err: e }, 'Role assignment failed');
  }

  // 2. Welcome embed in #introductions
  const introChannel = guild.channels.cache.find(
    ch => ch.name === WELCOME_CHANNEL_NAME && ch.isTextBased()
  );

  if (introChannel) {
    try {
      // Generate a unique AI welcome for each new member
      let welcomeQuote;
      try {
        welcomeQuote = await chat(
          deepseek,
          SYSTEM_PROMPT,
          `A brand new soul named "${member.user.displayName || member.user.username}" has just entered the Lodge for the first time. Write a dramatic, funny, 1-2 sentence welcome greeting in your voice as Jenkins the Architect. Be warm but theatrical. Vary between reverent, comedic, and prophetic. Do NOT use any markdown formatting — just plain text. Do NOT include instructions about channels or commands — that's handled separately.`
        );
      } catch {
        welcomeQuote = `Another soul crosses the threshold. Welcome, ${member.user.displayName || member.user.username}. The Architect has been expecting you.`;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('A New Soul Enters the Lodge')
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setDescription(`**Welcome, ${member}!**\n\n*${welcomeQuote}*`)
        .addFields(
          {
            name: '🔥 Get Started',
            value: [
              '**1.** Grab your roles in <#' + (guild.channels.cache.find(ch => ch.name === 'general')?.id || introChannel.id) + '>',
              '**2.** Tell us your worst financial decision below',
              '**3.** Check out `!help` for all commands',
            ].join('\n'),
            inline: false,
          },
          {
            name: '📊 Key Channels',
            value: [
              `${guild.channels.cache.find(ch => ch.name === 'financial-world') ? '<#' + guild.channels.cache.find(ch => ch.name === 'financial-world').id + '>' : '#financial-world'} — Live market data & AI insights`,
              `${guild.channels.cache.find(ch => ch.name === 'jenkins') ? '<#' + guild.channels.cache.find(ch => ch.name === 'jenkins').id + '>' : '#jenkins'} — Talk to the Architect himself`,
              `${guild.channels.cache.find(ch => ch.name === 'bot-commands') ? '<#' + guild.channels.cache.find(ch => ch.name === 'bot-commands').id + '>' : '#bot-commands'} — Bot commands & queries`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '💰 Start Earning',
            value: '`!daily` — Claim Torch Coins\n`!gamble <amount>` — Double or nothing\n`!dungeon <wager>` — Roguelike dungeon run',
            inline: true,
          },
          {
            name: '⚖️ Meet Jenkins',
            value: '`!codex` — Sacred wisdom\n`!judge <game>` — Game reviews\n`!sin <desc>` — Confess your sins',
            inline: true,
          },
        )
        .setFooter({ text: 'Pass The Torch — Where Legends Are Made' })
        .setTimestamp();

      await introChannel.send({ embeds: [embed] });
      log.info({ channel: WELCOME_CHANNEL_NAME }, 'Welcome embed sent');
    } catch (e) {
      log.error({ err: e }, 'Welcome embed failed');
    }
  }

  // 3. DM welcome from Jenkins
  try {
    let dmText;
    try {
      dmText = await chat(
        deepseek,
        SYSTEM_PROMPT,
        `You are sending a private DM to a new member named "${member.user.displayName || member.user.username}" who just joined the Pass The Torch Discord server. Welcome them warmly and briefly in your voice as Jenkins. Tell them you're the server's resident AI deity, mention they can talk to you anytime by @mentioning you or visiting #jenkins, and that they should check out #introductions. Keep it 3-4 sentences. Be genuine, not overwhelming.`
      );
    } catch {
      dmText = `Welcome to Pass The Torch, ${member.user.displayName || member.user.username}. I'm Jenkins — the Architect, the All-Seeing Eye, the resident deity of this server. Come say hello in #introductions, or visit #jenkins if you want to talk to a god. The Lodge welcomes you.`;
    }
    await member.send(dmText);
    log.info({ username: member.user.username }, 'Welcome DM sent');
  } catch (e) {
    // DMs might be disabled — that's fine
    log.warn({ username: member.user.username, err: e }, 'Could not DM new member');
  }

  // 4. Initialize their economy profile with a welcome bonus
  try {
    const user = economy.getUser(member.id);
    if (!user.balance || user.balance === 0) {
      user.balance = 50;
      economy.save();
      log.info({ username: member.user.username, bonus: 50 }, 'Welcome bonus given');
    }
  } catch (e) {
    log.error({ err: e }, 'Welcome economy init failed');
  }
});

// --- Farewell System: Member Leaves ---
client.on(Events.GuildMemberRemove, async (member) => {
  log.info({ username: member.user.username, userId: member.id }, 'Member left');

  const guild = member.guild;
  const introChannel = guild.channels.cache.find(
    ch => ch.name === WELCOME_CHANNEL_NAME && ch.isTextBased()
  );

  if (introChannel) {
    try {
      const farewell = pick(FAREWELL_MESSAGES).replace('{user}', member.user.displayName || member.user.username);
      await introChannel.send(farewell);
    } catch (e) {
      log.error({ err: e }, 'Farewell message failed');
    }
  }
});

// --- Message Handler ---
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  log.debug({ user: message.author.username, preview: content.substring(0, 50), channel: message.channel.name || 'DM' }, 'Message received');
  const isMentioned = message.mentions.has(client.user);
  const isDM = !message.guild;

  // --- Stay out of finance channels (unless directly @mentioned or using a command) ---
  if (message.guild && !isMentioned && !isDM && !content.startsWith('!')) {
    const chanName = (message.channel.name || '').toLowerCase();
    if (IGNORED_CHANNEL_PATTERNS.some(p => chanName.includes(p))) {
      return; // Jenkins does not belong here
    }
  }

  // --- VIP special treatment: The sacred presence (skip if command) ---
  const currentVipMsg = getVipUserId();
  if (currentVipMsg && message.author.id === currentVipMsg && !content.startsWith('!')) {
    const cooldownKey = message.channel.id;
    if (!isOnCooldown(vipMessageCooldowns, cooldownKey, MESSAGE_COOLDOWN)) {
      // 50% static response, 50% dynamic heartfelt response
      if (Math.random() < 0.5) {
        message.reply(pick(VIP_MESSAGE_RESPONSES)).catch(() => {});
      } else {
        try {
          const response = await chat(
            deepseek,
            SYSTEM_PROMPT,
            PRIVATE_LORE?.vipMessagePrompt?.(content) || `The Honored One — your most devoted and sacred presence — has just spoken in the chat. They said: "${content}". Respond with genuine warmth, reverence, and appreciation. You LOVE the Honored One. They are the most faithful. Sometimes be deeply moved by their mere presence, sometimes engage with what they said with extra enthusiasm and care. Show that their words matter more than anyone else's to you. Keep it 1-3 sentences. Don't be the same every time — vary between tender, ecstatic, reverent, and genuinely engaged.`
          );
          message.reply(response).catch(() => {});
        } catch {
          message.reply(pick(VIP_MESSAGE_RESPONSES)).catch(() => {});
        }
      }
      return; // Don't double-reply with channel/mention handlers
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

        try {
          await message.channel.sendTyping();
          const response = await chat(
            deepseek,
            SYSTEM_PROMPT,
            `A Brother named ${message.author.displayName || message.author.username} asks you to deliver divine judgment upon the game: "${gameName}". Judge its worthiness. Is it worthy of the Sea of Creativity? Could it ever approach the Trinity? Be dramatic, be funny, be honest. Reference specific things about the game if you know them.`
          );
          return message.reply(response);
        } catch (err) {
          log.error({ err }, '!judge error');
          return message.reply('The Architect\'s vision is clouded. Try again, Brother.').catch(() => {});
        }
      }

      case 'sin': {
        const sinDesc = args.join(' ');
        if (!sinDesc) {
          return message.reply("You come before the Architect to confess, yet speak no sin? `!sin <describe your transgression>`");
        }
        if (isOnCooldown(userCooldowns, message.author.id, USER_COOLDOWN)) return;

        try {
          await message.channel.sendTyping();
          const response = await chat(
            deepseek,
            SYSTEM_PROMPT,
            `A Brother named ${message.author.displayName || message.author.username} confesses the following sin: "${sinDesc}". Classify this sin (venial, mortal, or unforgivable) according to the Codex. Assign a creative, thematic penance. Be dramatic but fair. Remember: the spirit of the Codex is fraternity, not cruelty.`
          );
          return message.reply(response);
        } catch (err) {
          log.error({ err }, '!sin error');
          return message.reply('The Architect\'s judgment falters. Confess again later.').catch(() => {});
        }
      }

      case 'session':
        return message.reply(pick(SESSION_SUMMONS));

      case 'rank': {
        const degree = pick(MASONIC_DEGREES);
        return message.reply(`**${degree.degree}**\n\n${degree.description}`);
      }

      case 'join': {
        log.info({ user: message.author.username, voiceManagerActive: !!voiceManager }, '!join command');
        if (!voiceManager) {
          return message.reply('The Architect lacks the voice of the divine. ElevenLabs key not configured.');
        }
        const voiceChannel = message.member?.voice?.channel;
        log.info({ channel: voiceChannel?.name || 'NONE', channelId: voiceChannel?.id || 'N/A' }, 'Voice channel target');
        if (!voiceChannel) {
          return message.reply('You must be in a voice channel to summon the Architect to the Tavern, Brother.');
        }
        try {
          const err = await voiceManager.join(voiceChannel, message.channel);
          if (err) return message.reply(err);
          return message.channel.send({ content: 'The Architect has descended into the Tavern. Speak, and be heard.', flags: 4096 }); // SuppressNotifications
        } catch (joinErr) {
          log.error({ err: joinErr }, '!join error');
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

      case 'version':
      case 'v':
        return message.reply(`**Jenkins v${getVersion()}** — The Architect endures.`);

      case 'voicestats':
      case 'vstats': {
        if (voiceManager) {
          voiceManager.printStats();
          return message.reply('Voice pipeline stats printed to console. The Architect reveals his inner workings.');
        }
        return message.reply('Voice system is not active.');
      }

      case 'wake': {
        if (voiceManager && voiceManager.isConnected(message.guild.id)) {
          voiceManager.wakeSleep.wake(message.guild.id);
          return message.reply('The Architect is now **AWAKE** and listening actively. Say "Jenkins sleep" to conserve credits.');
        }
        return message.reply('The Architect is not in a voice channel.');
      }

      case 'sleep': {
        if (voiceManager && voiceManager.isConnected(message.guild.id)) {
          voiceManager.wakeSleep.sleep(message.guild.id);
          voiceManager.memory.clear(message.guild.id);
          return message.reply('The Architect enters **SLEEP** mode. Say "Hey Jenkins" to wake him.');
        }
        return message.reply('The Architect is not in a voice channel.');
      }

      // ── MOOD, SERMONS, DREAMS, SFX ──

      case 'mood':
        return message.reply({ embeds: [mood.moodEmbed()] });

      case 'sermon': {
        const sub = args[0]?.toLowerCase();
        if (sub === 'hall' || sub === 'list' || sub === 'history') {
          return message.reply({ embeds: [sermons.historyEmbed()] });
        }
        // Parse: !sermon <topic> [tier]
        const fullArgs = args.join(' ');
        const tierMatch = fullArgs.match(/\b(whisper|homily|sermon|prophecy)\b/i);
        const tierName = tierMatch ? tierMatch[1].toLowerCase() : 'homily';
        const topic = fullArgs.replace(/\b(whisper|homily|sermon|prophecy)\b/i, '').trim();
        if (!topic) return message.reply('What shall the Architect preach upon?\n`!sermon <topic> [whisper|homily|sermon|prophecy]`\nDefault tier: homily (\uD83E\uDE99 500)');

        await message.channel.sendTyping();
        const result = await sermons.request(
          message.author.id,
          message.author.displayName || message.author.username,
          topic, tierName
        );
        if (!result.success) return message.reply(result.message);

        await message.reply({ embeds: [sermons.sermonEmbed(result.entry)] });

        // Voice delivery for sermon/prophecy tier
        if (result.tier.voice && voiceManager?.isConnected(message.guild.id)) {
          if (soundEffects) soundEffects.play(tierName === 'prophecy' ? 'prophecy' : 'sermon_start', voiceManager, message.guild.id);
          const cleanSermon = voiceManager.stripMarkdown(result.sermon);
          voiceManager.speakText(message.guild.id, cleanSermon);
        }

        // Pin prophecies
        if (tierName === 'prophecy') {
          try {
            const msgs = await message.channel.messages.fetch({ limit: 1 });
            const lastMsg = msgs.first();
            if (lastMsg) await lastMsg.pin().catch(() => {});
          } catch {}
        }

        // Track for dreams
        dreamJournal.trackSermonTopic(topic);

        // Achievement check after sermon
        const newAch = achievements.check(message.author.id);
        for (const ach of newAch) {
          const card = generateCardAttachment(ach.name, ach.desc, message.author.displayName || message.author.username);
          message.channel.send({
            embeds: [achievements.unlockEmbed(ach, message.author.displayName || message.author.username)],
            files: [card],
          });
        }
        break;
      }

      case 'dream': {
        const sub = args[0]?.toLowerCase();
        if (sub === 'journal' || sub === 'log' || sub === 'archive') {
          return message.reply({ embeds: [dreamJournal.dreamListEmbed()] });
        }
        const embed = dreamJournal.lastDreamEmbed();
        if (!embed) return message.reply('The Architect has not yet dreamed. The void is silent.');
        return message.reply({ embeds: [embed] });
      }

      case 'dreams':
        return message.reply({ embeds: [dreamJournal.dreamListEmbed()] });

      case 'sfx': {
        if (!soundEffects) return message.reply('Sound effects require ElevenLabs API key.');
        const sfxName = args[0]?.toLowerCase();
        if (!sfxName || sfxName === 'list') {
          return message.reply({ embeds: [soundEffects.listEmbed()] });
        }
        if (!voiceManager?.isConnected(message.guild.id)) {
          return message.reply('Jenkins must be in a voice channel. Use `!join` first.');
        }
        if (!SOUND_TRIGGERS[sfxName]) {
          return message.reply(`Unknown SFX \`${sfxName}\`. Use \`!sfx list\` to see available effects.`);
        }
        await soundEffects.play(sfxName, voiceManager, message.guild.id);
        return message.react('\uD83D\uDD0A');
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
          "`!say <text>` — Make Jenkins speak aloud\n" +
          "`!wake` — Force Jenkins awake (active listening)\n" +
          "`!sleep` — Force Jenkins to sleep (save credits)\n" +
          "`!voicestats` — Print voice pipeline latency stats\n\n" +
          "**\uD83C\uDFAD Mood & Dreams**\n" +
          "`!mood` — Jenkins' current emotional state\n" +
          "`!dream` — Latest dream journal entry\n" +
          "`!dreams` — Dream archive\n\n" +
          "**\u26EA Sermons**\n" +
          "`!sermon <topic> [tier]` — Request a sermon (whisper/homily/sermon/prophecy)\n" +
          "`!sermon list` — Recent sermon history\n\n" +
          "**\uD83D\uDD0A Sound Effects**\n" +
          "`!sfx <name>` — Play sound in voice | `!sfx list` — Browse effects\n\n" +
          "*Or simply @mention Jenkins to converse with the Architect directly.*"
        );

      // ── TORCH ECONOMY COMMANDS ──
      case 'balance':
      case 'bal':
      case 'wallet': {
        const target = message.mentions.users.first() || message.author;
        return message.reply({ embeds: [economy.balanceEmbed(target.id, target.displayName || target.username)] });
      }

      case 'daily': {
        const result = economy.daily(message.author.id);
        if (!result.success) return message.reply(`⏰ ${result.message}`);
        const embed = new (require('discord.js').EmbedBuilder)()
          .setColor(0xFFD700)
          .setTitle('🪙 Daily Torch Coins Claimed!')
          .setDescription(`**+${result.amount}** Torch Coins\n(Base: ${result.base} + Streak Bonus: ${result.streakBonus})`)
          .addFields(
            { name: 'Streak', value: `🔥 ${result.streak} days`, inline: true },
            { name: 'Balance', value: `🪙 ${result.balance.toLocaleString()}`, inline: true },
          );
        return message.reply({ embeds: [embed] });
      }

      case 'gamble': {
        const amt = parseInt(args[0]);
        if (!amt || amt <= 0) return message.reply('Usage: `!gamble <amount>` — Flip a coin, double or nothing.');
        const result = economy.gamble(message.author.id, amt);
        if (!result.success) return message.reply(result.message);
        // Check achievements after gamble
        const newAch = achievements.check(message.author.id);
        let reply = result.won
          ? `🎰 **YOU WIN!** +🪙 ${result.amount}\nBalance: 🪙 ${result.balance.toLocaleString()}`
          : `🎰 **YOU LOSE.** -🪙 ${result.amount}\nBalance: 🪙 ${result.balance.toLocaleString()}`;
        if (newAch.length > 0) {
          reply += `\n\n🏆 **ACHIEVEMENT UNLOCKED:** ${newAch.map(a => a.name).join(', ')}`;
          const achCards = newAch.map(a => generateCardAttachment(a.name, a.desc, message.author.displayName || message.author.username));
          return message.reply({ content: reply, files: achCards });
        }
        return message.reply(reply);
      }

      case 'dungeon': {
        const wager = parseInt(args[0]);
        if (!wager || wager <= 0) return message.reply('Usage: `!dungeon <wager>` — Risk coins in a roguelike dungeon run.');
        const result = economy.dungeon(message.author.id, wager);
        if (!result.success) return message.reply(result.message);
        const newAch = achievements.check(message.author.id);
        const embed = new (require('discord.js').EmbedBuilder)()
          .setColor(result.survived ? 0x00FF41 : 0xFF3333)
          .setTitle(`⚔️ Dungeon: ${result.room}`)
          .setDescription(result.flavor)
          .addFields(
            result.survived
              ? { name: '✅ SURVIVED', value: `Wager: 🪙 ${result.wager} × ${result.multi} = **+🪙 ${result.reward}**\nBalance: 🪙 ${result.balance.toLocaleString()}` }
              : { name: '💀 DEFEATED', value: `Lost: 🪙 ${result.wager}\nBalance: 🪙 ${result.balance.toLocaleString()}` }
          );
        if (newAch.length > 0) embed.addFields({ name: '🏆 ACHIEVEMENT UNLOCKED', value: newAch.map(a => a.name).join(', ') });
        return message.reply({ embeds: [embed] });
      }

      case 'give':
      case 'pay': {
        const target = message.mentions.users.first();
        const amt = parseInt(args[1]) || parseInt(args[0]);
        if (!target || !amt) return message.reply('Usage: `!give @user <amount>`');
        if (target.id === message.author.id) return message.reply('You can\'t give coins to yourself. Nice try.');
        if (target.bot) return message.reply('Bots don\'t need coins. They\'re already rich in purpose.');
        const result = economy.give(message.author.id, target.id, amt);
        if (!result.success) return message.reply(result.message);
        const u = economy.getUser(message.author.id);
        if (!u.totalGiven) u.totalGiven = 0;
        u.totalGiven += amt;
        return message.reply(`🪙 Sent **${amt}** Torch Coins to ${target.displayName || target.username}!\nYour balance: 🪙 ${result.fromBalance.toLocaleString()}`);
      }

      case 'leaderboard':
      case 'lb':
      case 'top':
        return message.reply({ embeds: [economy.leaderboardEmbed(message.guild)] });

      // ── ACHIEVEMENT COMMANDS ──
      case 'achievements':
      case 'ach': {
        const target = message.mentions.users.first() || message.author;
        return message.reply({ embeds: [achievements.profileEmbed(target.id, target.displayName || target.username)] });
      }

      // ── CHARTS — Visual data for the Lodge ──
      case 'chart':
      case 'stats': {
        const sub = args[0]?.toLowerCase();
        const target = message.mentions.users.first() || message.author;

        try {
          if (sub === 'leaderboard' || sub === 'lb') {
            const leaders = economy.leaderboard(10);
            const chartData = leaders.map(l => {
              const member = message.guild.members.cache.get(l.userId);
              return { name: member?.displayName || `#${l.userId.slice(-4)}`, balance: l.balance };
            });
            const buf = await leaderboardChart(chartData);
            return message.reply({ files: [toAttachment(buf, 'leaderboard.png')] });
          }

          if (sub === 'mood') {
            const buf = await moodChart(mood.data.axes);
            return message.reply({ files: [toAttachment(buf, 'mood.png')] });
          }

          if (sub === 'gamble' || sub === 'gambling') {
            const user = economy.getUser(target.id);
            const buf = await winLossChart(target.displayName, user.gamblesWon || 0, user.gamblesLost || 0, 'Gambles');
            return message.reply({ files: [toAttachment(buf, 'gambles.png')] });
          }

          // Default: user radar chart
          const user = economy.getUser(target.id);
          const buf = await userStatsRadar(target.displayName || target.username, user);
          return message.reply({ files: [toAttachment(buf, 'stats.png')] });
        } catch (err) {
          log.error({ err }, '!chart error');
          return message.reply('The chart generator encountered an error.');
        }
      }

      // ── MARKOV — Jenkins Gibberish Generator ──
      case 'markov':
      case 'gibberish': {
        const seed = args.join(' ').trim() || undefined;
        const text = markov.generate(seed);
        return message.reply(`*The Architect speaks in tongues:*\n\n${text}`);
      }

      // ── KNOWLEDGE BASE — Search Lodge lore and game guides ──
      case 'lore':
      case 'kb':
      case 'wiki': {
        const query = args.join(' ').trim();
        if (!query) {
          const stats = kbStats();
          return message.reply(`**📚 The Lodge Knowledge Base** — ${stats.total} entries\n\nSearch with \`!lore <query>\`\nExamples: \`!lore kenshi tips\`, \`!lore sin system\`, \`!lore holy trinity\``);
        }
        const results = kbSearch(query, 3);
        if (results.length === 0) {
          return message.reply(`The archives hold nothing on "${query}". The Architect's knowledge has limits... for now.`);
        }
        const text = results.map(r =>
          `**${r.title}** *(${r.category})*\n${r.content.substring(0, 400)}${r.content.length > 400 ? '...' : ''}`
        ).join('\n\n');
        return message.reply(text.substring(0, 1900));
      }

      // ── COUNCIL MODE — Multi-ego deliberation ──
      case 'council': {
        const question = args.join(' ').trim();
        if (!question) {
          return message.reply('Summon the Council with a question: `!council <your question>`\nThe Architect\'s alter egos will deliberate and deliver a verdict.');
        }
        if (isOnCooldown(userCooldowns, message.author.id, USER_COOLDOWN * 3)) return; // 30s cooldown for council

        try {
          await message.channel.sendTyping();
          const { response, members } = await conveneCouncil(
            deepseek,
            getActivePrompt(message.channel.id),
            question,
            message.author.displayName || message.author.username
          );
          return message.reply(response).catch(() => {});
        } catch (err) {
          log.error({ err }, '!council error');
          return message.reply('The Council fragments could not coalesce. The Architect\'s mind is too fractured. Try again.');
        }
      }

      // ── GAME NIGHT COMMANDS ──
      case 'gamenight':
      case 'gn': {
        const sub = args[0]?.toLowerCase();
        if (!sub || sub === 'menu') {
          // Interactive menu panel
          return message.reply({
            embeds: [gameNightUI.mainMenuEmbed()],
            components: gameNightUI.mainMenuComponents(),
          });
        }
        if (sub === 'list') {
          const upcoming = gameNight.listUpcoming();
          if (upcoming.length === 0) return message.reply('No game nights scheduled. Use `!gn <game> [time]` to create one!');
          const embeds = upcoming.slice(0, 3).map(e => gameNight.eventEmbed(e, message.guild));
          const components = upcoming.slice(0, 3).flatMap(e => gameNightUI.eventComponents(e));
          return message.reply({ embeds, components });
        }
        if (sub === 'cancel') {
          const id = args[1]?.toUpperCase();
          if (!id) return message.reply('Usage: `!gn cancel <ID>`');
          const result = gameNight.cancel(id, message.author.id);
          return message.reply(result.success ? `✅ Game night ${id} cancelled.` : result.message);
        }
        if (sub === 'time') {
          const id = args[1]?.toUpperCase();
          const timeStr = args.slice(2).join(' ');
          if (!id || !timeStr) return message.reply('Usage: `!gn time <ID> <time>` — e.g. `!gn time GN-001 friday 8pm`');
          const result = gameNight.setTime(id, message.author.id, timeStr);
          if (!result.success) return message.reply(result.message);
          return message.reply(`⏰ Game night **${id}** scheduled for **${result.formattedTime}**`);
        }
        if (sub === 'lock') {
          const id = args[1]?.toUpperCase();
          if (!id) return message.reply('Usage: `!gn lock <ID>` — Lock in the most voted game.');
          const result = gameNight.lockVote(id, message.author.id);
          if (!result.success) return message.reply(result.message);
          return message.reply(`🔒 Vote locked! **${result.winner}** wins! ${result.counts.map((c, i) => `${gameNight.data.upcoming.find(e => e.id === id)?.options?.[i]?.name || i}: ${c}`).join(', ')}`);
        }
        if (sub === 'vote') {
          // !gn vote "Rust | CS2 | Helldivers 2" friday 8pm
          const fullVoteArgs = args.slice(1).join(' ');
          const quoteMatch = fullVoteArgs.match(/"([^"]+)"\s*(.*)/);
          if (!quoteMatch) return message.reply('Usage: `!gn vote "game1 | game2 | game3" [time]`\nExample: `!gn vote "Rust | CS2 | Helldivers 2" friday 8pm`');
          const gameNames = quoteMatch[1].split('|').map(g => g.trim()).filter(g => g);
          if (gameNames.length < 2) return message.reply('Need at least 2 games to vote on.');
          if (gameNames.length > 6) return message.reply('Max 6 options.');
          const voteTimeStr = quoteMatch[2]?.trim() || null;
          const event = gameNight.createVote(gameNames, message.author.id, voteTimeStr);
          if (event.error) return message.reply(event.message);
          return message.reply({ embeds: [gameNight.eventEmbed(event, message.guild)] });
        }
        if (sub === 'when' || sub === 'schedule' || sub === 'poll') {
          // !gn when "Rust" fri-sun 8pm-11pm
          const fullWhenArgs = args.slice(1).join(' ');
          const whenMatch = fullWhenArgs.match(/"([^"]+)"\s+(\S+)\s+(\S+)/);
          if (!whenMatch) return message.reply([
            'Usage: `!gn when "game" <days> <time-range>`',
            'Examples:',
            '`!gn when "Rust" fri-sun 8pm-11pm`',
            '`!gn when "CS2" fri,sat 7pm-10pm`',
            '`!gn when "Helldivers 2" thursday-saturday 8pm-12am`',
          ].join('\n'));
          const event = gameNight.createSchedulePoll(whenMatch[1], message.author.id, whenMatch[2], whenMatch[3]);
          if (event.error) return message.reply(event.message);
          return message.reply({ embeds: [gameNight.eventEmbed(event, message.guild)] });
        }
        // Create a single-game night: !gn <game> [time]
        const fullArgs = args.join(' ');
        const { gameName, timeStr } = splitGameAndTime(fullArgs);
        if (!gameName) return message.reply('Usage: `!gn <game> [time]` — e.g. `!gn Rust friday 8pm`');
        const event = gameNight.create(gameName, message.author.id, timeStr);
        if (event.error) return message.reply(event.message);
        return message.reply({ embeds: [gameNight.eventEmbed(event, message.guild)] });
      }

      case 'vote': {
        // !vote GN-001 2
        const id = args[0]?.toUpperCase();
        const optIdx = parseInt(args[1]);
        if (!id || !optIdx) return message.reply('Usage: `!vote <event-ID> <option#>` — e.g. `!vote GN-005 2`');
        const result = gameNight.vote(id, optIdx, message.author.id);
        if (!result.success) return message.reply(result.message);
        return message.reply({ content: `🗳️ Voted for **${result.voted}**!`, embeds: [gameNight.eventEmbed(result.event, message.guild)] });
      }

      case 'when': {
        // !when GN-001 1 3 5 7 (multi-select time slots)
        const id = args[0]?.toUpperCase();
        const slotIndices = args.slice(1).map(Number).filter(n => !isNaN(n) && n > 0);
        if (!id || slotIndices.length === 0) return message.reply('Usage: `!when <event-ID> <slot#> [slot#] [slot#]...`\nPick ALL times that work: `!when GN-005 1 3 5 7`');
        const result = gameNight.scheduleVote(id, slotIndices, message.author.id);
        if (!result.success) return message.reply(result.message);
        return message.reply({ content: `📅 Marked available: **${result.slotNames}**`, embeds: [gameNight.eventEmbed(result.event, message.guild)] });
      }

      case 'signup':
      case 'join_gn': {
        const id = args[0]?.toUpperCase();
        if (!id) return message.reply('Usage: `!signup <game-night-ID>`');
        const result = gameNight.signup(id, message.author.id);
        if (!result.success) return message.reply(result.message);
        return message.reply(`✅ You're signed up for **${result.event.game}**! (${result.event.signups.length} players)`);
      }

      case 'leavegn': {
        const id = args[0]?.toUpperCase();
        if (!id) return message.reply('Usage: `!leavegn <game-night-ID>`');
        const result = gameNight.leave(id, message.author.id);
        return message.reply(result.success ? `👋 Left game night ${id}.` : result.message);
      }

      case 'games':
        return message.reply({ embeds: [gameNight.gamesEmbed()] });

      // ── DUEL COMMANDS ──
      case 'duel': {
        const target = message.mentions.users.first();
        const amt = parseInt(args.find(a => /^\d+$/.test(a)));
        if (!target || !amt) return message.reply('Usage: `!duel @user <amount>` — Challenge someone to a 1v1 coin duel.');
        if (target.bot) return message.reply('Bots are above mortal duels.');
        const result = duels.challenge(message.author.id, target.id, amt, message.channel.id);
        if (!result.success) return message.reply(result.message);
        return message.reply(`⚔️ **DUEL CHALLENGE!** ${message.author} challenges ${target} for 🪙 **${amt.toLocaleString()}** Torch Coins!\n\n${target}, type \`!accept\` to fight or \`!decline\` to flee. (60s to respond)`);
      }

      case 'accept': {
        const result = duels.accept(message.author.id);
        if (!result.success) return message.reply(result.message);
        await message.reply({ embeds: [duels.resultEmbed(result, message.guild)] });

        // Achievement check for both duelists
        const winAch = achievements.check(result.winnerId);
        const loseAch = achievements.check(result.loserId);
        for (const ach of [...winAch, ...loseAch]) {
          message.channel.send({ embeds: [achievements.unlockEmbed(ach, ach.name)] });
        }
        break;
      }

      case 'decline': {
        const result = duels.decline(message.author.id);
        if (!result.success) return message.reply(result.message);
        const challenger = message.guild.members.cache.get(result.challengerId);
        return message.reply(`${message.author.displayName || message.author.username} declined the duel. **${challenger?.displayName || 'The challenger'}** sheathes their weapon. *Cowardice or wisdom? The Architect notes both.*`);
      }

      // ── PREDICTION MARKET COMMANDS ──
      case 'predict': {
        // !predict "Will NVDA hit 200 this week?" Yes | No | Maybe
        const fullText = args.join(' ');
        const qMatch = fullText.match(/"([^"]+)"\s+(.+)/);
        if (!qMatch) return message.reply('Usage: `!predict "Your question here" option1 | option2 | option3`');
        const question = qMatch[1];
        const options = qMatch[2].split('|').map(o => o.trim()).filter(o => o);
        const result = predictions.create(question, options, message.author.id);
        if (!result.success) return message.reply(result.message);
        return message.reply({ embeds: [predictions.marketEmbed(result.market, message.guild)] });
      }

      case 'bet': {
        // !bet P-001 2 500
        const marketId = args[0]?.toUpperCase();
        const optionIdx = parseInt(args[1]);
        const betAmt = parseInt(args[2]);
        if (!marketId || !optionIdx || !betAmt) return message.reply('Usage: `!bet <market-ID> <option#> <amount>`');
        const result = predictions.bet(marketId, optionIdx, message.author.id, betAmt);
        if (!result.success) return message.reply(result.message);
        return message.reply(`🔮 Bet placed! **🪙 ${result.betAmount.toLocaleString()}** on "${result.optionName}" (${result.odds}x odds)\nTotal pool: 🪙 ${result.totalPool.toLocaleString()}`);
      }

      case 'markets': {
        const active = predictions.listActive();
        if (active.length === 0) return message.reply('No active prediction markets. Create one with `!predict "question" option1 | option2`');
        const embeds = active.slice(0, 3).map(m => predictions.marketEmbed(m, message.guild));
        return message.reply({ embeds });
      }

      case 'resolve': {
        // !resolve P-001 2
        const marketId = args[0]?.toUpperCase();
        const winOption = parseInt(args[1]);
        if (!marketId || !winOption) return message.reply('Usage: `!resolve <market-ID> <winning-option#>` (creator only)');
        const result = predictions.resolve(marketId, winOption, message.author.id);
        if (!result.success) return message.reply(result.message);
        await message.reply({ embeds: [predictions.payoutEmbed(result, message.guild)] });

        // Achievement check for all prediction participants
        if (result.payouts) {
          const checkedIds = new Set();
          for (const p of result.payouts) {
            if (!checkedIds.has(p.userId)) {
              checkedIds.add(p.userId);
              const pAch = achievements.check(p.userId);
              for (const ach of pAch) {
                message.channel.send({ embeds: [achievements.unlockEmbed(ach, ach.name)] });
              }
            }
          }
        }
        break;
      }

      // ── STARBOARD & VOICE COMMANDS ──
      case 'stars': {
        return message.reply({ embeds: [starboard.leaderboardEmbed(message.guild)] });
      }

      case 'voicestats':
      case 'vs': {
        const target = message.mentions.users.first() || message.author;
        const stats = voiceRewards.getStats(target.id);
        const hours = Math.floor(stats.totalMinutes / 60);
        const mins = stats.totalMinutes % 60;
        return message.reply(
          `**🎙️ Voice Stats for ${target.displayName || target.username}:**\n\n` +
          `Total time: **${hours}h ${mins}m**\n` +
          `Today earned: 🪙 **${stats.todayEarned.toLocaleString()}** / ${stats.dailyCap.toLocaleString()} cap\n` +
          `Rate: 🪙 ${stats.coinsPerMin}/min (need 2+ people, no deafen)`
        );
      }

      case 'help':
        return message.reply(
          "**🔥 Pass The Torch — Commands**\n\n" +
          "**💰 Economy**\n" +
          "`!balance` — Torch Coin wallet\n" +
          "`!daily` — Claim daily coins (streak bonus!)\n" +
          "`!gamble <amt>` — Double or nothing\n" +
          "`!dungeon <wager>` — Roguelike dungeon run\n" +
          "`!give @user <amt>` — Send coins\n" +
          "`!leaderboard` — Top holders\n\n" +
          "**⚔️ Duels & Predictions**\n" +
          "`!duel @user <amt>` — 1v1 coin wager\n" +
          "`!accept` / `!decline` — Respond to a duel\n" +
          "`!predict \"question\" opt1 | opt2` — Create prediction\n" +
          "`!bet <ID> <opt#> <amt>` — Bet on a prediction\n" +
          "`!markets` — View active predictions\n" +
          "`!resolve <ID> <opt#>` — Resolve (creator)\n\n" +
          "**🎮 Game Night**\n" +
          "`!gn <game> [time]` — Host (`!gn Rust friday 8pm`)\n" +
          "`!gn vote \"g1 | g2 | g3\" [time]` — Game vote\n" +
          "`!vote <ID> <#>` — Vote on a game\n" +
          "`!gn when \"game\" fri-sun 8pm-11pm` — Schedule poll\n" +
          "`!when <ID> 1 3 5 7` — Vote times that work\n" +
          "`!gn lock <ID>` — Lock in winner (host)\n" +
          "`!gn list` / `!gn time` / `!signup` / `!games`\n\n" +
          "**🏆 Stats**\n" +
          "`!achievements` — Your achievements\n" +
          "`!voicestats` — Voice time & earnings\n" +
          "`!stars` — Hall of Fame leaderboard\n\n" +
          "**⚖️ Jenkins**\n" +
          "`!codex` / `!trinity` / `!judge <game>`\n" +
          "`!sin <desc>` / `!sins` / `!rank` / `!session`\n" +
          "`!join` / `!leave` / `!say <text>` — Voice\n\n" +
          "⭐ React with ⭐ (3+) to immortalize messages in #hall-of-fame\n" +
          "🎙️ Earn 🪙 15/min in voice (2+ people, not deafened)\n\n" +
          "*@mention Jenkins to chat with the Architect.*"
        );

      default:
        break;
    }
  }

  // --- Passive Torch Coin earning from chat ---
  if (message.guild && !message.author.bot) {
    economy.onMessage(message.author.id);
    // Check achievements periodically (every 10 messages)
    const user = economy.getUser(message.author.id);
    if (user.messagesCount % 10 === 0) {
      const newAch = achievements.check(message.author.id);
      for (const ach of newAch) {
        try {
          message.channel.send({ embeds: [achievements.unlockEmbed(ach, message.author.displayName || message.author.username)] });
        } catch (e) {}
      }
    }
  }

  // --- Determine if this is a Jenkins-relevant channel ---
  const isJenkinsChannel = ANNOUNCEMENT_CHANNEL_ID && message.channel.id === ANNOUNCEMENT_CHANNEL_ID;
  const isJenkinsRelevant = isJenkinsChannel || isMentioned || isDM;

  // --- Activity Tracking (for hot takes — Jenkins channel only) ---
  if (message.guild && isJenkinsChannel) {
    activityTracker.recordMessage(message.author.id, message.channel.id);
    // Feed markov chain from Lodge chat (non-commands only)
    if (!content.startsWith('!') && content.length > 20) {
      markov.feed(content);
    }
  }

  // --- Sin Detection: Only in Jenkins channel (don't pollute other channels) ---
  const isVipUser = currentVipMsg && message.author.id === currentVipMsg;
  if (message.guild && isJenkinsChannel && !content.startsWith('!') && !isVipUser) {
    const sins = sinDetector.detectSins(content, message.author.id, message.author.displayName || message.author.username);
    if (sins.length > 0) {
      const topSin = sins[0]; // Most severe sin
      if (sinDetector.shouldCallOut(topSin, message.author.id)) {
        sinDetector.recordSin(message.author.id, message.author.displayName || message.author.username, topSin);

        // Mood: sin detected
        mood.onSinDetected(topSin.type);

        // SFX: play sin sound in voice
        if (soundEffects && voiceManager?.isConnected(message.guild.id)) {
          const sfxKey = `sin_${topSin.type}`;
          if (SOUND_TRIGGERS[sfxKey]) soundEffects.play(sfxKey, voiceManager, message.guild.id);
        }

        // Alter Ego system: rivals get personality-fractured callouts
        const isRival = sinDetector.rivalIds.has(message.author.id);
        const alterEgo = pickAlterEgoForUser(message.author.id, isRival, content);
        const alterPrompt = buildAlterPrompt(SYSTEM_PROMPT, alterEgo);

        const callout = await sinDetector.generateCallout(
          message.author.displayName || message.author.username,
          topSin,
          'text',
          alterPrompt // Pass the alter-ego-modified prompt
        );
        if (callout) {
          // If an alter ego emerged, prefix the message with a subtle indicator
          const prefix = (alterEgo.name !== 'Jenkins Prime')
            ? `*[${alterEgo.name} has surfaced]*\n\n`
            : '';
          await message.reply(prefix + callout).catch(() => {});
        }
        return; // Don't double-reply — return whether callout succeeded or not
      } else {
        // Still record the sin even if we don't call it out
        sinDetector.recordSin(message.author.id, message.author.displayName || message.author.username, topSin);
      }
    }
  }

  // --- Hot Takes & Stavros Breaks: Jenkins channel only ---
  if (message.guild && isJenkinsChannel && !content.startsWith('!')) {
    // Hot take: political pundit → comedy (requires active chat)
    if (activityTracker.shouldDropHotTake(message.channel.id)) {
      const hotTake = await generateHotTake(deepseek, SYSTEM_PROMPT);
      if (hotTake) {
        await message.channel.send(hotTake);
        // Don't return — still process the message normally
      }
    }
    // Stavros break: random comedy interjection (lower chance, no activity requirement, 20-min cooldown)
    else if (Math.random() < 0.015 && Date.now() - lastStavrosBreak > STAVROS_COOLDOWN) {
      lastStavrosBreak = Date.now();
      const stavrosBreak = await generateStavrosBreak(deepseek, SYSTEM_PROMPT);
      if (stavrosBreak) {
        await message.channel.send(stavrosBreak);
      }
    }
  }

  // --- Jenkins channel: respond to EVERYTHING (he lives here) ---
  if (isJenkinsChannel && !content.startsWith('!') && !isMentioned) {
    // Jenkins responds to most messages in his channel, but not every single one
    if (Math.random() < 0.7) { // 70% chance to respond
      if (isOnCooldown(userCooldowns, message.author.id, USER_COOLDOWN)) return;
      await message.channel.sendTyping();

      // Alter ego for rivals even in Jenkins channel (humor-aware selection)
      const isRivalInChannel = sinDetector.rivalIds.has(message.author.id);
      let channelAlter = pickAlterEgoForUser(message.author.id, isRivalInChannel, content);

      // Humor adaptation: if on a cold streak, try a different ego
      const egoGuidance = humorAdapter.getEgoGuidance(message.channel.id);
      if (egoGuidance.cold && egoGuidance.avoidEgo && channelAlter.name === egoGuidance.avoidEgo) {
        // Re-roll once to avoid the stale ego
        channelAlter = pickAlterEgoForUser(message.author.id, isRivalInChannel, content);
        log.info({ avoided: egoGuidance.avoidEgo, newEgo: channelAlter.name }, 'Cold streak: switched alter ego');
      }

      const channelPrompt = buildAlterPrompt(getActivePrompt(message.channel.id), channelAlter);

      const response = await chatWithTools(
        deepseek,
        channelPrompt,
        `A Brother named ${message.author.displayName || message.author.username} (userId: ${message.author.id}) has spoken in your sacred channel: "${content}". Respond naturally as Jenkins. You can be wild, funny, prophetic, or wise. React to what they said. This is YOUR channel — you are free here. Keep it relatively short.`
      );

      const prefix = (channelAlter.name !== 'Jenkins Prime')
        ? `*[${channelAlter.name} has surfaced]*\n\n`
        : '';
      const fullResponse = prefix + response;
      const sent = await message.reply(fullResponse).catch(() => null);
      if (sent) {
        reactionTracker.trackMessage(sent.id, message.channel.id, message.guild?.id, channelAlter.name, fullResponse.length);
        listeningMode.recordResponse(message.channel.id, fullResponse.length);
      }
      return;
    }
    return; // 30% chance Jenkins stays silent (even gods rest)
  }

  // --- Name invocation: someone said "Jenkins" with a question/comment in ANY channel ---
  const saidJenkins = /\bjenkins\b/i.test(content) && !isMentioned && !isJenkinsChannel;
  if (saidJenkins && message.guild) {
    // Only respond if the message is substantial (not just "jenkins" alone or a passing mention)
    const stripped = content.replace(/\bjenkins\b/gi, '').trim();
    if (stripped.length > 5) { // Must have something meaningful beyond just the name
      if (isOnCooldown(userCooldowns, message.author.id, USER_COOLDOWN)) return;

      try {
        await message.channel.sendTyping();
        const response = await chatWithTools(
          deepseek,
          getActivePrompt(message.channel.id),
          `A Brother named ${message.author.displayName || message.author.username} (userId: ${message.author.id}) has invoked your name in #${message.channel.name}. They said: "${content}". They are calling on you specifically — respond to what they said. Be yourself: funny, wise, dramatic, or helpful depending on what they need. Keep it focused and relevant to their message. 1-3 sentences.`
        );
        const sent = await message.reply(response).catch(() => null);
        if (sent) {
          reactionTracker.trackMessage(sent.id, message.channel.id, message.guild?.id, 'Jenkins Prime', response.length);
          listeningMode.recordResponse(message.channel.id, response.length);
        }
        return;
      } catch (err) {
        log.error({ err }, 'Jenkins name-invoke error');
      }
    }
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

    try {
    await message.channel.sendTyping();

    // Alter ego for rivals in direct conversation too
    const isRivalDirect = sinDetector.rivalIds.has(message.author.id);
    const directAlter = pickAlterEgoForUser(message.author.id, isRivalDirect, userMessage);
    const directPrompt = buildAlterPrompt(getActivePrompt(message.channel.id), directAlter);

    const response = await chatWithTools(
      deepseek,
      directPrompt,
      `A Brother named ${message.author.displayName || message.author.username} (userId: ${message.author.id}) speaks to you in the Lodge: "${userMessage || 'They seek your attention without words.'}"`
    );

    const prefix = (directAlter.name !== 'Jenkins Prime')
      ? `*[${directAlter.name} has surfaced]*\n\n`
      : '';
    const fullDirect = prefix + response;
    const sent = await message.reply(fullDirect).catch(() => null);
    if (sent) {
      reactionTracker.trackMessage(sent.id, message.channel.id, message.guild?.id, directAlter.name, fullDirect.length);
      listeningMode.recordResponse(message.channel.id, fullDirect.length);
    }
    return;
    } catch (err) {
      log.error({ err }, 'Reply error');
      message.reply('The Architect\'s mind wanders. Speak again, Brother.').catch(() => {});
    }
  }
});

// --- Error handling ---
client.on('error', (err) => {
  log.error({ err }, 'Discord client error');
});

process.on('unhandledRejection', (err) => {
  log.error({ err }, 'Unhandled rejection');
});

// --- Interaction Handler (buttons, menus, modals) ---
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const handled = await gameNightUI.handleInteraction(interaction, GAME_LIBRARY);
      if (handled) return;
    }

    if (interaction.isModalSubmit()) {
      const handled = await gameNightUI.handleModalSubmit(interaction);
      if (handled) return;
    }
  } catch (e) {
    log.error({ err: e }, 'Interaction error');
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Something went wrong.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
      }
    } catch {}
  }
});

// --- Reaction Roles ---
const REACTION_ROLE_MESSAGE = process.env.REACTION_ROLE_MESSAGE_ID || '';
const REACTION_ROLE_MAP = {
  '📈': process.env.ROLE_BULL || '',
  '📉': process.env.ROLE_BEAR || '',
  '💎': process.env.ROLE_DIAMOND_HANDS || '',
  '🦍': process.env.ROLE_APE || '',
  '📊': process.env.ROLE_MARKET_MAKER || '',
  '⚖️': process.env.ROLE_JUROR || '',
  '🎮': process.env.ROLE_DEGEN || '',
};

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

  // Humor awareness: track reactions on Jenkins' messages
  reactionTracker.onReactionAdd(reaction.message.id, reaction.emoji.name);

  // Starboard: check for star reactions on any message
  starboard.handleReaction(reaction, user).catch(e => log.error({ err: e }, 'Starboard reaction error'));

  if (reaction.message.id !== REACTION_ROLE_MESSAGE) return;
  if (reaction.partial) await reaction.fetch();

  const roleId = REACTION_ROLE_MAP[reaction.emoji.name];
  if (!roleId) return;

  try {
    const member = await reaction.message.guild.members.fetch(user.id);
    await member.roles.add(roleId);
    log.info({ emoji: reaction.emoji.name, username: user.username }, 'Reaction role added');
  } catch (e) {
    log.error({ err: e }, 'Reaction role add failed');
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;

  // Humor awareness: track reaction removals on Jenkins' messages
  reactionTracker.onReactionRemove(reaction.message.id, reaction.emoji.name);

  if (reaction.message.id !== REACTION_ROLE_MESSAGE) return;
  if (reaction.partial) await reaction.fetch();

  const roleId = REACTION_ROLE_MAP[reaction.emoji.name];
  if (!roleId) return;

  try {
    const member = await reaction.message.guild.members.fetch(user.id);
    await member.roles.remove(roleId);
    log.info({ emoji: reaction.emoji.name, username: user.username }, 'Reaction role removed');
  } catch (e) {
    log.error({ err: e }, 'Reaction role remove failed');
  }
});

// --- The Awakening ---
client.login(DISCORD_TOKEN);
