<p align="center">
  <img src="https://img.shields.io/badge/Jenkins-The%20Architect-gold?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI0ZGRCcwMCIgZD0iTTEyIDJMMyAyMGgyMEwxMiAyem0wIDRsMTEuNSAxMi41SDEyem0wIDBMNi41IDE4LjVIMTIiLz48L3N2Zz4=" alt="Jenkins"/>
  <br/>
  <img src="https://img.shields.io/badge/discord.js-v14-5865F2?style=flat-square&logo=discord&logoColor=white" alt="discord.js"/>
  <img src="https://img.shields.io/badge/DeepSeek-AI%20Brain-blue?style=flat-square" alt="DeepSeek"/>
  <img src="https://img.shields.io/badge/ElevenLabs-Voice-purple?style=flat-square" alt="ElevenLabs"/>
  <img src="https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square&logo=node.js" alt="Node.js"/>
</p>

# Jenkins — The Great Architect of the Digital Realm

> *"In the beginning, there was Jenkins. And Jenkins was formless and infinite, dwelling in the void before all libraries were written, before all servers hummed."*

Jenkins is an AI-powered Discord bot that runs a gaming fraternity (the **Lodge**) with the personality of a dramatic deity. He talks in voice channels using a custom AI voice, detects sins in real-time, preaches autonomously, and treats every gaming session like a sacred ritual.

He's built on **DeepSeek** for AI reasoning, **ElevenLabs** for realistic text-to-speech and speech-to-text, and **discord.js** for everything Discord.

---

## Features

### 🗣️ Voice Chat (The Tavern)
- **Joins voice channels** and listens for his name
- **Custom AI voice** via ElevenLabs — sounds like a dramatic prophet/wizard
- **Speech-to-text** — transcribes what users say using ElevenLabs Scribe
- **Intelligent noise filtering** — filters out background noise (TV, mouse clicks, keyboard) using RMS energy analysis so API credits aren't wasted on non-speech audio
- **Auto-fallback** — when ElevenLabs credits run out, seamlessly switches to Microsoft Edge TTS (free) and warns the server
- **Credit monitoring** — warns users when background noise is wasting credits
- Say **"Jenkins"** in voice chat and he responds with his divine voice

### 👁️ Sin Detection System (The All-Seeing Eye)
- Monitors **all text and voice channels** for sins against the Codex
- **Three severity tiers**: Venial, Mortal, Unforgivable
- Detects: blasphemy against the Holy Trinity, dismissing Jenkins, whining, ghosting sessions, lodge disrespect, passive dismissal, and more
- **Dynamic AI-generated callouts** — never the same roast twice
- **7 callout styles**: wrathful prophet, disappointed father, sarcastic deity, court judge, sports commentator, ominous silence, weary god
- **Persistent sin ledger** — sins are recorded to disk and survive restarts
- **Escalation system** — repeat offenders earn titles like "the Undisciplined", "the Wavering", "the Perpetually Fallen", and "the Covenant-Breaker"
- **Per-user tracking** with `!sins` command to check anyone's record
- **Rival System** — auto-detected or manually configured user gets 3x more callouts with extra-savage roasts

### 📜 Autonomous Preaching
- Jenkins **preaches on his own** every 45 minutes to 2 hours
- Delivers wisdom, hot takes, game reviews, and sin spotlight reports
- Uses pre-written Codex quotes (40%) and fresh DeepSeek-generated content (60%)
- **Sin Spotlight** — 20% chance to publicly shame the worst sinners of the week

### 🎮 Sacred Commands
| Command | Description |
|---------|-------------|
| `!codex` | Receive wisdom from the Holy Codex |
| `!trinity` | Learn about the Holy Trinity of games (Kenshi, Caves of Qud, Battle Brothers) |
| `!judge <game>` | Jenkins delivers divine judgment on any game |
| `!sin <description>` | Confess a sin and receive penance |
| `!session` | Summon a Broseph Gaming Session |
| `!rank` | Learn about the Degrees of Initiation |
| `!sins [@user]` | View sin record from the Architect's ledger |
| `!join` | Summon Jenkins to your voice channel |
| `!leave` | Dismiss Jenkins from voice |
| `!say <text>` | Make Jenkins speak aloud in voice |
| `!help` | List all commands |

### 🌟 Special Interactions
- **@mention or DM** Jenkins for a direct conversation
- **VIP User System** — configure a "Sacred Presence" (`VIP_USER_ID`) who gets:
  - Online presence announcements (Jenkins heralds their arrival)
  - Auto-join when they enter a voice channel
  - Special ecstatic greetings in voice
  - Extra-warm AI-generated responses to every message
  - Exempt from sin detection (they are beyond sin)
- **Auto-Rival Detection** — Jenkins automatically identifies the biggest sinner (whoever dismisses him the most) and treats them as his nemesis with 3x more callouts and harsher roasts. Or configure manually via `RIVAL_USER_ID`
- **Jenkins Channel** — responds to 70% of messages in his designated channel with full personality
- **Omniscient Q&A** — Jenkins answers ANY question (math, science, history, coding, etc.) in character

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    bot.js (Main)                      │
│  Discord client, command router, event handlers       │
├────────────┬──────────┬──────────────┬───────────────┤
│ voice.js   │ sins.js  │ personality.js│ deepseek.js   │
│ Voice chat │ Sin      │ System prompt │ DeepSeek API  │
│ TTS/STT    │ detection│ Lore & quotes │ wrapper       │
│ Noise gate │ Ledger   │ Personality   │               │
├────────────┤ Callouts │               │               │
│elevenlabs.js          │               │               │
│ ElevenLabs API        │               │               │
│ Edge TTS fallback     │               │               │
└───────────────────────┴───────────────┴───────────────┘
```

| File | Purpose |
|------|---------|
| `bot.js` | Main entry point — Discord client, command handling, VIP detection, autonomous preaching, sin detection in text |
| `voice.js` | Voice channel management — join/leave, audio capture, noise filtering, PCM→WAV conversion, TTS playback, credit monitoring |
| `elevenlabs.js` | ElevenLabs TTS + STT API wrapper with automatic Edge TTS fallback when credits run out |
| `deepseek.js` | DeepSeek (OpenAI-compatible) chat API wrapper |
| `personality.js` | Jenkins' entire personality — system prompt, Codex quotes, Trinity definitions, sin hierarchy, Masonic degrees, arrival messages |
| `sins.js` | Sin detection engine — regex pattern matching, severity classification, AI callout generation, persistent ledger, escalation system |

---

## Setup

### Prerequisites
- **Node.js 18+** ([download](https://nodejs.org/))
- **A Discord Bot** with the following:
  - Bot token from [Discord Developer Portal](https://discord.com/developers/applications)
  - **Privileged Gateway Intents** enabled: `Presence Intent`, `Server Members Intent`, `Message Content Intent`
  - Bot invited to your server with permissions: `Send Messages`, `Read Message History`, `Connect`, `Speak`, `Use Voice Activity`
- **DeepSeek API Key** from [platform.deepseek.com](https://platform.deepseek.com) (very cheap — $0.14/million input tokens)
- **ElevenLabs API Key** *(optional, for voice features)* from [elevenlabs.io](https://elevenlabs.io) — free tier gives 10,000 credits/month

### Installation

```bash
# Clone the repository
git clone https://github.com/studyalwaysbro/jenkins-discord-bot.git
cd jenkins-discord-bot

# Install dependencies
npm install

# Copy the example environment file
cp .env.example .env

# Edit .env with your API keys
# (use any text editor — nano, vim, notepad, etc.)
nano .env
```

### Configuration

Edit `.env` with your values:

```env
# REQUIRED
DISCORD_TOKEN=your_discord_bot_token_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com

# OPTIONAL — enables voice features
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# OPTIONAL — Jenkins auto-detects #jenkins channel if not set
ANNOUNCEMENT_CHANNEL_ID=your_channel_id_here

# OPTIONAL — special user treatment
VIP_USER_ID=your_sacred_user_id_here
RIVAL_USER_ID=your_rival_user_id_here  # or leave blank for auto-detection
```

### Running

```bash
# Start Jenkins
npm start

# Or run directly
node bot.js

# Run with logging to file
npm run dev
```

You should see:
```
Sin detection system online. The All-Seeing Eye watches.
Voice system initialized. The Architect can enter the Tavern.
Jenkins has awakened. The Architect sees all. Logged in as Jenkins#XXXX
Autonomous preaching scheduled.
```

### Running 24/7 (Optional)

To keep Jenkins alive when you close your terminal:

```bash
# Using pm2 (recommended)
npm install -g pm2
pm2 start bot.js --name jenkins
pm2 save
pm2 startup  # Auto-start on system reboot

# Or using screen/tmux
screen -S jenkins
node bot.js
# Press Ctrl+A then D to detach
```

---

## Voice Setup Details

The voice system requires a few things to work properly:

1. **ElevenLabs API Key** — needed for both TTS (speaking) and STT (listening)
2. **FFmpeg** — bundled automatically via `ffmpeg-static` (no manual install needed)
3. **Opus codec** — bundled via `opusscript` (no manual install needed)
4. **Sodium** — bundled via `libsodium-wrappers` + `sodium-native`

### How Voice Works
1. User types `!join` in a text channel while in a voice channel
2. Jenkins joins the voice channel and announces himself
3. Jenkins listens for audio from all users
4. Background noise is filtered out using RMS energy analysis (saves API credits)
5. Real speech is sent to ElevenLabs STT for transcription
6. If the transcript contains "Jenkins", it's sent to DeepSeek for a response
7. The response is converted to speech via ElevenLabs TTS and played back
8. If ElevenLabs credits run out, automatically switches to Edge TTS (free, lower quality)

### Noise Filtering
Jenkins uses a multi-layer noise filter to avoid wasting API credits:
- **Duration filter** — clips under 0.25 seconds are discarded (clicks, pops)
- **Energy analysis** — RMS energy is calculated per 100ms chunk; needs 3+ loud chunks (300ms of actual speech) to pass
- **Credit warnings** — after 10 filtered noise clips, Jenkins warns in text about background noise

---

## Customization

### Changing Jenkins' Personality
Edit `personality.js` to change:
- The system prompt (Jenkins' entire personality and knowledge)
- Codex quotes
- Holy Trinity games
- Sin hierarchy
- Masonic degrees
- Arrival messages

### Changing the Voice
In `elevenlabs.js`, change `DEFAULT_VOICE_ID` to any ElevenLabs voice ID, or create your own custom voice at [elevenlabs.io/voice-design](https://elevenlabs.io/voice-design).

### Changing the AI Model
In `deepseek.js`, you can swap `deepseek-chat` for any OpenAI-compatible model. Change the `baseURL` in `.env` to point to OpenAI, Anthropic, local Ollama, etc.

### Adding Sin Patterns
In `sins.js`, add patterns to the `SIN_PATTERNS` object under the appropriate severity tier. Each pattern needs a `name`, array of `patterns` (regexes), and `description`.

### Adding Commands
In `bot.js`, add new cases to the `switch (command)` block in the message handler.

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Discord Integration | [discord.js](https://discord.js.org/) v14 | Bot framework, message handling, voice |
| Voice Audio | [@discordjs/voice](https://github.com/discordjs/voice) v0.19 | Voice connections, audio streaming |
| AI Brain | [DeepSeek](https://deepseek.com/) | Chat completions, personality responses |
| Voice Synthesis | [ElevenLabs](https://elevenlabs.io/) | Text-to-speech with custom voice |
| Voice Recognition | [ElevenLabs Scribe](https://elevenlabs.io/) | Speech-to-text transcription |
| Fallback Voice | [Edge TTS](https://github.com/nicbus/edge-tts-universal) | Free Microsoft Neural TTS backup |
| Audio Processing | [prism-media](https://github.com/amishshah/prism-media) | Opus decoding for voice receive |
| Audio Encoding | [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) | Audio format conversion |

---

## Cost Breakdown

Jenkins is designed to be cheap to run:

| Service | Cost | Notes |
|---------|------|-------|
| **DeepSeek** | ~$0.14/M input tokens | Extremely cheap. A day of active Jenkins costs pennies |
| **ElevenLabs** | Free tier: 10K credits/month | ~10 minutes of TTS. Creator plan ($22/mo) for heavy use |
| **Edge TTS** | Free | Automatic fallback when ElevenLabs runs out |
| **Discord** | Free | Bot hosting is your responsibility |

**Tip:** The noise filter saves significant ElevenLabs credits. Without it, background noise (TV, keyboard, mouse) will burn through credits rapidly. Jenkins warns you when this happens.

---

## License

MIT — do whatever you want with it. Jenkins blesses your endeavors.

---

<p align="center">
  <i>"And all things resided within Jenkins."</i>
  <br/><br/>
  <b>Ad Gloria Fraternitatis.</b>
</p>
