// markov.js — Jenkins Gibberish Generator
// ═══════════════════════════════════════════════════════════════
// Builds a Markov chain from Jenkins' past responses and Lodge chat.
// Generates pseudo-Jenkins nonsense for entertainment.
// Zero dependencies — pure JS.

const { dbRead, dbWrite } = require('./db');
const log = require('./logger').child('Markov');

const ORDER = 2; // Bigram chains (pairs of words)
const MAX_OUTPUT_WORDS = 60;
const MIN_OUTPUT_WORDS = 10;

class MarkovChain {
  constructor() {
    this.data = dbRead('markov', { chains: {}, wordCount: 0 });
    this.chains = this.data.chains;
    this.wordCount = this.data.wordCount || 0;
    this.dirty = false;

    // Auto-save every 10 min
    this._saveInterval = setInterval(() => {
      if (this.dirty) this.save();
    }, 600000);

    log.info({ wordCount: this.wordCount, chainKeys: Object.keys(this.chains).length }, 'Markov chain loaded');
  }

  save() {
    this.data.chains = this.chains;
    this.data.wordCount = this.wordCount;
    dbWrite('markov', this.data);
    this.dirty = false;
  }

  /**
   * Feed text into the chain to build associations.
   * @param {string} text - Raw text to learn from
   */
  feed(text) {
    if (!text || text.length < 20) return;

    // Clean: remove URLs, mentions, emojis, excessive punctuation
    const cleaned = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/<@!?\d+>/g, '')
      .replace(/\*\*|__|~~|\|\|/g, '')
      .replace(/[^\w\s.,!?'"()-]/g, '')
      .trim();

    if (cleaned.length < 15) return;

    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (words.length < ORDER + 1) return;

    for (let i = 0; i <= words.length - ORDER - 1; i++) {
      const key = words.slice(i, i + ORDER).join(' ').toLowerCase();
      const next = words[i + ORDER];

      if (!this.chains[key]) this.chains[key] = [];
      this.chains[key].push(next);

      // Cap array size to prevent unbounded growth
      if (this.chains[key].length > 50) {
        this.chains[key] = this.chains[key].slice(-30);
      }
    }

    this.wordCount += words.length;
    this.dirty = true;
  }

  /**
   * Generate pseudo-Jenkins text from the chain.
   * @param {string} [seed] - Optional seed word(s) to start from
   * @returns {string} Generated text
   */
  generate(seed) {
    const keys = Object.keys(this.chains);
    if (keys.length < 10) {
      return "The Markov chain hungers for more data. Speak more, Brethren, and the gibberish shall flow.";
    }

    // Find a starting key
    let currentKey;
    if (seed) {
      const seedLower = seed.toLowerCase();
      currentKey = keys.find(k => k.startsWith(seedLower)) ||
                   keys.find(k => k.includes(seedLower));
    }

    if (!currentKey) {
      // Pick a random key that starts with a capital letter (likely sentence start)
      const starters = keys.filter(k => /^[A-Z]/.test(this.chains[k]?.[0] || ''));
      currentKey = starters.length > 0
        ? starters[Math.floor(Math.random() * starters.length)]
        : keys[Math.floor(Math.random() * keys.length)];
    }

    const output = currentKey.split(' ');
    let iterations = 0;

    while (output.length < MAX_OUTPUT_WORDS && iterations < MAX_OUTPUT_WORDS * 2) {
      iterations++;
      const key = output.slice(-ORDER).join(' ').toLowerCase();
      const options = this.chains[key];

      if (!options || options.length === 0) {
        // Dead end — try to continue with a random key
        if (output.length >= MIN_OUTPUT_WORDS) break;
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        output.push('—', ...randomKey.split(' '));
        continue;
      }

      const next = options[Math.floor(Math.random() * options.length)];
      output.push(next);

      // End on sentence-ending punctuation if we have enough words
      if (output.length >= MIN_OUTPUT_WORDS && /[.!?]$/.test(next)) break;
    }

    return output.join(' ');
  }

  /**
   * Get stats about the chain.
   */
  getStats() {
    return {
      wordCount: this.wordCount,
      chainKeys: Object.keys(this.chains).length,
      canGenerate: Object.keys(this.chains).length >= 10,
    };
  }

  destroy() {
    clearInterval(this._saveInterval);
    if (this.dirty) this.save();
  }
}

module.exports = { MarkovChain };
