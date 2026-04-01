// sound-effects.js — The Architect's Soundtrack
// ═══════════════════════════════════════════════════════════════
// Event-driven sound effects using ElevenLabs Sound Effects API.
// Generates cinematic audio, caches to disk, plays through voice pipeline.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { Readable } = require('stream');
const { createAudioResource, StreamType, AudioPlayerStatus } = require('@discordjs/voice');
const { PrunedMap } = require('./safe-write');
const { dbRead, dbWrite } = require('./db');
const log = require('./logger').child('SFX');

const CACHE_DIR = path.join(__dirname, 'data', 'sfx-cache');

// ═══════════════════════════════════════════════════════════════
// Sound Definitions — event triggers mapped to sound prompts
// ═══════════════════════════════════════════════════════════════

const SOUND_TRIGGERS = {
  // Sins
  sin_venial:       { prompt: 'short ominous church bell toll, single deep dong',                              duration: 2,   cooldown: 30000 },
  sin_mortal:       { prompt: 'dramatic thunder crack with distant church organ chord',                         duration: 3,   cooldown: 30000 },
  sin_unforgivable: { prompt: 'massive thunder strike with glass shattering and deep orchestral sting',         duration: 4,   cooldown: 60000 },

  // Economy
  economy_big_win:  { prompt: 'casino jackpot coins falling with brief crowd cheer',                           duration: 3,   cooldown: 15000 },
  economy_big_loss: { prompt: 'sad trombone wah wah waaah',                                                    duration: 2,   cooldown: 15000 },

  // Duels
  duel_clash:       { prompt: 'sword clash metal impact with ring',                                             duration: 1.5, cooldown: 10000 },
  duel_victory:     { prompt: 'crowd roaring briefly and sword sheathed',                                       duration: 2,   cooldown: 10000 },

  // Dungeon
  dungeon_enter:    { prompt: 'heavy stone door opening with creaking hinges in dark cavern',                   duration: 3,   cooldown: 10000 },
  dungeon_win:      { prompt: 'triumphant fantasy horn fanfare short',                                          duration: 2,   cooldown: 10000 },
  dungeon_death:    { prompt: 'dark deep chime and hollow wind',                                                duration: 3,   cooldown: 10000 },

  // VIP
  vip_entrance:     { prompt: 'angelic choir ahh with heavenly shimmer and deep reverberating gong',            duration: 4,   cooldown: 300000 },

  // Mood transitions
  mood_wrathful:    { prompt: 'deep ominous rumbling earthquake with distant thunder',                          duration: 3,   cooldown: 300000 },
  mood_ecstatic:    { prompt: 'heavenly harp glissando with soft church bells',                                 duration: 3,   cooldown: 300000 },
  mood_manic:       { prompt: 'chaotic carnival music sped up with crashing cymbals',                           duration: 3,   cooldown: 300000 },
  mood_melancholic: { prompt: 'single sad piano note with rain and distant thunder',                            duration: 3,   cooldown: 300000 },

  // Sermons
  sermon_start:     { prompt: 'church organ chord sustain with reverb in cathedral',                            duration: 3,   cooldown: 30000 },
  prophecy:         { prompt: 'mystical wind chimes with ethereal whispers and deep resonating drone',          duration: 4,   cooldown: 60000 },

  // Voice
  wake_up:          { prompt: 'dramatic orchestral hit sting short and powerful',                                duration: 1.5, cooldown: 120000 },
  sleep:            { prompt: 'gentle wind fading to silence with soft chime',                                   duration: 3,   cooldown: 120000 },

  // Misc
  achievement:      { prompt: 'video game achievement unlock bright ascending fanfare chime',                   duration: 2,   cooldown: 10000 },
  starboard:        { prompt: 'magical sparkle twinkle ascending chime',                                        duration: 2,   cooldown: 30000 },
  gavel:            { prompt: 'wooden gavel slam on desk three times with echo',                                duration: 2,   cooldown: 15000 },
};

// Maximum buffer size (5MB) to prevent OOM
const MAX_BUFFER_SIZE = 5 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 30;

class SoundEffectsEngine {
  constructor(elevenlabsApiKey) {
    this.apiKey = elevenlabsApiKey;
    this.cache = new Map();          // triggerName -> Buffer
    this.cooldowns = new PrunedMap(3600000, 600000);
    this.data = dbRead('sound_effects', { playCount: {}, totalPlays: 0, lastPrewarm: null });
    this.enabled = !!elevenlabsApiKey;
    this.prewarming = false;

    // Ensure cache directory exists
    if (!fs.existsSync(CACHE_DIR)) {
      try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
    }

    // Load disk cache
    this.loadDiskCache();

    setInterval(() => this.save(), 300000);
    log.info({ cacheSize: this.cache.size, enabled: this.enabled }, 'SFX engine loaded');
  }

  save() { dbWrite('sound_effects', this.data); }

  // ═══════════════════════════════════════════════════════════════
  // Disk Cache
  // ═══════════════════════════════════════════════════════════════

  loadDiskCache() {
    try {
      if (!fs.existsSync(CACHE_DIR)) return;
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        if (!file.endsWith('.mp3')) continue;
        const triggerName = file.replace('.mp3', '');
        try {
          const buffer = fs.readFileSync(path.join(CACHE_DIR, file));
          if (buffer.length > 0 && buffer.length < MAX_BUFFER_SIZE) {
            this.cache.set(triggerName, buffer);
          }
        } catch {}
      }
      log.info({ cacheSize: this.cache.size }, 'Loaded cached sounds from disk');
    } catch (e) {
      log.error({ err: e }, 'Cache load error');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Sound Generation — ElevenLabs Sound Effects API
  // ═══════════════════════════════════════════════════════════════

  /** Generate a sound effect via ElevenLabs API. Returns a Buffer. */
  generateSound(promptText, durationSeconds) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        text: promptText,
        duration_seconds: durationSeconds,
        prompt_influence: 0.5,
      });

      const req = https.request({
        hostname: 'api.elevenlabs.io',
        path: '/v1/sound-generation',
        method: 'POST',
        timeout: 30000,
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
      }, (res) => {
        if (res.statusCode !== 200) {
          let errData = '';
          res.on('data', chunk => errData += chunk);
          res.on('end', () => reject(new Error(`SFX API ${res.statusCode}: ${errData.substring(0, 200)}`)));
          return;
        }
        const chunks = [];
        let totalSize = 0;
        res.on('data', chunk => {
          totalSize += chunk.length;
          if (totalSize > MAX_BUFFER_SIZE) {
            req.destroy(new Error('SFX response too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('timeout', () => req.destroy(new Error('SFX request timed out (30s)')));
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Get Sound — cache-first, generate on miss
  // ═══════════════════════════════════════════════════════════════

  async getSound(triggerName) {
    // Memory cache
    if (this.cache.has(triggerName)) return this.cache.get(triggerName);

    // Disk cache
    const diskPath = path.join(CACHE_DIR, `${triggerName}.mp3`);
    if (fs.existsSync(diskPath)) {
      try {
        const buffer = fs.readFileSync(diskPath);
        if (buffer.length > 0) {
          this.cache.set(triggerName, buffer);
          return buffer;
        }
      } catch {}
    }

    // Generate
    const trigger = SOUND_TRIGGERS[triggerName];
    if (!trigger || !this.enabled) return null;

    try {
      const buffer = await this.generateSound(trigger.prompt, trigger.duration);
      if (buffer && buffer.length > 0) {
        this.cache.set(triggerName, buffer);
        // Evict oldest if cache too large
        if (this.cache.size > MAX_CACHE_ENTRIES) {
          const oldest = this.cache.keys().next().value;
          this.cache.delete(oldest);
        }
        // Save to disk
        try { fs.writeFileSync(diskPath, buffer); } catch {}
        log.info({ trigger: triggerName, bytes: buffer.length }, 'Generated and cached sound');
      }
      return buffer;
    } catch (e) {
      log.error({ trigger: triggerName, err: e }, 'Sound generation failed');
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Play Sound — through voice manager's audio player
  // ═══════════════════════════════════════════════════════════════

  /**
   * Play a sound effect in a guild's voice channel.
   * @param {string} triggerName - Key from SOUND_TRIGGERS
   * @param {VoiceManager} voiceManager - The voice manager instance
   * @param {string} guildId - Guild to play in
   */
  async play(triggerName, voiceManager, guildId) {
    if (!this.enabled) return;
    if (!voiceManager?.isConnected(guildId)) return;

    // Cooldown
    const trigger = SOUND_TRIGGERS[triggerName];
    if (!trigger) return;
    const cooldownKey = `${triggerName}:${guildId}`;
    if (this.cooldowns.isOnCooldown(cooldownKey, trigger.cooldown)) return;

    // Don't play while Jenkins is speaking
    if (voiceManager.speaking.get(guildId)) return;

    const buffer = await this.getSound(triggerName);
    if (!buffer) return;

    this.cooldowns.touch(cooldownKey);

    // Track stats
    this.data.playCount[triggerName] = (this.data.playCount[triggerName] || 0) + 1;
    this.data.totalPlays++;

    log.debug({ trigger: triggerName, guildId }, 'Playing sound');

    // Play through the voice manager's player
    const player = voiceManager.players.get(guildId);
    if (!player) return;

    try {
      voiceManager.speaking.set(guildId, true);
      const stream = Readable.from([buffer]);
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
      player.play(resource);

      await new Promise((resolve) => {
        const onIdle = () => { player.removeListener('error', onError); resolve(); };
        const onError = (err) => { log.error({ err }, 'Playback error'); player.removeListener(AudioPlayerStatus.Idle, onIdle); resolve(); };
        player.once(AudioPlayerStatus.Idle, onIdle);
        player.once('error', onError);
        setTimeout(resolve, 10000); // safety timeout
      });
    } finally {
      voiceManager.speaking.set(guildId, false);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Prewarm — generate all sounds on startup (background)
  // ═══════════════════════════════════════════════════════════════

  async prewarm() {
    if (this.prewarming || !this.enabled) return;
    this.prewarming = true;
    log.info('Pre-warming sound cache');
    let generated = 0;

    for (const triggerName of Object.keys(SOUND_TRIGGERS)) {
      if (this.cache.has(triggerName)) continue;
      try {
        await this.getSound(triggerName);
        generated++;
        // Rate limit: 2s between API calls to avoid hammering
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        log.error({ trigger: triggerName, err: e }, 'Prewarm failed');
      }
    }

    this.data.lastPrewarm = new Date().toISOString();
    this.save();
    this.prewarming = false;
    log.info({ generated, totalCached: this.cache.size }, 'Pre-warm complete');
  }

  // ═══════════════════════════════════════════════════════════════
  // List available effects
  // ═══════════════════════════════════════════════════════════════

  listEmbed() {
    const { EmbedBuilder } = require('discord.js');
    const categories = {};
    for (const [name, trigger] of Object.entries(SOUND_TRIGGERS)) {
      const cat = name.split('_')[0];
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(name);
    }

    const fields = Object.entries(categories).map(([cat, names]) => ({
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: names.map(n => `\`${n}\``).join(', '),
      inline: false,
    }));

    return new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('🔊 Jenkins Sound Effects')
      .setDescription('Play sound effects in voice: `!sfx <name>`\nJenkins must be in a voice channel.')
      .addFields(fields.slice(0, 25)) // Discord field limit
      .setFooter({ text: `${this.cache.size} sounds cached | ${this.data.totalPlays} total plays` });
  }

  destroy() {
    this.cooldowns.destroy();
    this.save();
  }
}

module.exports = { SoundEffectsEngine, SOUND_TRIGGERS };
