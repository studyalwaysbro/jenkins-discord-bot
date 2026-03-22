# Changelog

All notable changes to Jenkins will be documented in this file.

## [2.2.0] - 2026-03-22

### Added
- **Pino Structured Logging**: Replaced all 196 console.log/error calls across 22 files with Pino structured JSON logging. Child loggers per module (Bot, Voice, Sins, Economy, etc.) with appropriate log levels (fatal/error/warn/info/debug). JSON output in production, colorized pino-pretty in dev.
- **`logger.js`**: Shared Pino root logger with string-shorthand `.child('Module')` support
- **Dev scripts**: `npm run dev` now pipes through pino-pretty. Added `telegram:dev` and `all:dev` scripts.

### Changed
- **Integration Wiring (Phase 2)**: 9 of 10 integration gaps closed:
  - Achievement checks now fire after sermon delivery, duel results, and prediction resolution
  - Voice conversations tracked in dream journal (conversation count + minutes)
  - Wake/sleep state changes nudge mood system (energy boost on wake, quiet period on sleep)
  - Last dream (within 3 days) injected into system prompt for natural conversation references
  - `getActivePrompt()` used for Jenkins channel, name-invoke, and @mention responses (dream + mood aware)
- **Cooldown Maps → PrunedMap**: Fixed memory leak — bot.js cooldown Maps now auto-prune stale entries
- **Safe Write Migration**: Economy, game-night, starboard, predictions, and sins migrated from raw `fs.writeFileSync` to atomic `safeWriteJSON` with backup recovery
- Removed redundant `fs` imports from migrated modules

### Remaining
- Telegram feature parity (economy commands, mood, dreams, sermons) — deferred to separate session

## [2.1.0] - 2026-03-21

### Added
- **Mood System**: Jenkins now has a 4-axis emotional state (wrath, joy, energy, chaos) that shifts organically based on server activity, sins, VIP presence, and voice participation. Mood mechanically affects sin detection sensitivity, economy multipliers, hot take frequency, alter ego selection weights, and the tone of all AI responses. `!mood` to check.
- **Dream Journal**: Jenkins dreams at 3 AM daily, generating surreal AI narratives that reference real server events — sins committed, economy moves, voice conversations, mood transitions, sermon topics. Dreams are posted to the announcement channel and archived. `!dream` / `!dreams`
- **Sermon Requests**: Pay Torch Coins to request Jenkins deliver a dramatic sermon on any topic. Four tiers: Whisper (200), Homily (500), Grand Sermon (1500), Prophecy (5000). High-tier sermons are spoken aloud in voice and Prophecies get pinned. Refund on failure. `!sermon <topic> [tier]`
- **Sound Effects Engine**: Event-driven cinematic sound effects via ElevenLabs Sound Effects API. Thunder on mortal sins, fanfare for VIP arrivals, gavel strikes, achievement chimes, mood transition ambience. Effects cached to disk for instant replay. `!sfx <name>` / `!sfx list`
- **Streaming Voice Pipeline (v3.0)**: DeepSeek responses now stream token-by-token with sentence-boundary buffering. Conversation memory (5-turn rolling context per guild, 5-min expiry) — Jenkins remembers what was said. Wake/sleep system saves STT credits.
- **Latency Monitor**: Real-time voice pipeline instrumentation showing per-stage timing for every interaction. Session-level P95 averages. `!voicestats`
- **Safe Write Utility**: Atomic file persistence with temp-file-then-rename and backup recovery for all data files
- **Pruned Cooldown Maps**: All cooldown Maps now auto-prune stale entries to prevent memory growth

### Changed
- All DeepSeek prompts now include mood context overlay for dynamic personality
- Voice pipeline rebuilt with streaming LLM, conversation memory, and wake/sleep gate
- `deepseek.js` now supports streaming via `chatStream()` and conversation history
- `elevenlabs.js` now supports streaming TTS via `textToSpeechStream()`
- Help command updated with mood, sermon, dream, and SFX sections

## [2.0.0] - 2026-03-20

### Added
- **Torch Coin Economy**: Custom currency system with daily claims, streak bonuses, gambling, dungeon runs, transfers, and leaderboards
- **Duel System**: 1v1 coin wagers between members with dramatic result embeds
- **Prediction Market**: Create questions, bet coins on outcomes, pool-based payouts
- **Starboard / Hall of Fame**: Messages with 3+ star reactions get immortalized in #hall-of-fame (authors earn bonus coins)
- **Voice Rewards**: Earn 15 coins/min in voice channels (requires 2+ people, anti-AFK, daily cap)
- **Achievement System**: 29 unlockable achievements tied to chat, economy, gambling, and dungeon milestones
- **Game Night Scheduling**: Game nights now support real times (`friday 8pm`, `tomorrow 9pm`), auto-reminders 1hr before, auto-complete
- **Activity Pulse**: Dead channel revival — seeds quiet channels with engagement prompts every 4 hours
- **Welcome System**: New members get an AI-generated welcome embed, DM from Jenkins, auto-role, and 50 coin starter bonus
- **Farewell Messages**: Dramatic departure messages when members leave
- **Reaction Roles**: Emoji reactions assign Bull, Bear, Diamond Hands, Ape, Market Maker, Juror, Degen roles
- **Version Announce System**: Automatic changelog posts to Discord when the bot updates
- `!duel @user <amount>` / `!accept` / `!decline` commands
- `!predict` / `!bet` / `!markets` / `!resolve` commands
- `!voicestats` / `!stars` / `!version` commands
- `!gn time <ID> <time>` command for scheduling game nights

### Changed
- Game night `!gn` command now accepts optional time parameter
- Help command reorganized with all new systems
- Bot startup now initializes voice rewards, starboard, duels, and prediction market

## [1.1.0] - 2026-03-15

### Added
- Telegram bot support via `telegram-bot.js` using Telegraf
- All Jenkins personalities available on Telegram (Stavros, React Lord, etc.)
- Enhanced talkative mode for Telegram — no audio means more expressive text responses
- Stavros breaks, hot takes, and React Lord triggers all active on Telegram

## [1.0.0] - 2026-03-15

### Initial Release
- AI-powered Discord bot with DeepSeek integration
- Voice chat support with Edge TTS and ElevenLabs
- Sin detection and tracking system
- Autonomous preaching with scheduled sermons
- Full religious gaming lore system
- Alter-ego personality system (7 personalities)
- Hot takes generation
- Private lore management
