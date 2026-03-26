// conversation-context.js — Phase 5: Conversation Continuity
//
// Tracks the last N messages per channel so Jenkins can reference
// what was said recently ("As I was saying about...").
//
// Lightweight in-memory ring buffer — no persistence needed.
// Context decays after 10 minutes of silence.

const log = require('./logger').child('ConvoContext');

const MAX_MESSAGES = 5;       // Rolling window size
const DECAY_MS = 10 * 60_000; // 10 minutes of silence = context reset

class ConversationContext {
  constructor() {
    // channelId → { messages: [], lastActivity: timestamp }
    this._channels = new Map();
  }

  /**
   * Record a message in the channel's context window.
   * Call on every message in Jenkins-relevant channels.
   */
  addMessage(channelId, userId, username, content, isJenkins = false) {
    if (!content || content.length < 5) return;
    if (content.startsWith('!')) return; // Skip commands

    const now = Date.now();
    let state = this._channels.get(channelId);

    // Decay: if too much silence, reset
    if (state && now - state.lastActivity > DECAY_MS) {
      state = null;
    }

    if (!state) {
      state = { messages: [], lastActivity: now, topic: null };
      this._channels.set(channelId, state);
    }

    state.lastActivity = now;
    state.messages.push({
      userId,
      username,
      content: content.substring(0, 300), // Cap length
      isJenkins,
      timestamp: now,
    });

    // Keep only last N
    if (state.messages.length > MAX_MESSAGES) {
      state.messages.shift();
    }

    // Simple topic extraction (most recent non-trivial noun phrase)
    if (!isJenkins && content.length > 20) {
      state.topic = extractTopic(content);
    }
  }

  /**
   * Get a prompt injection with recent conversation context.
   * Returns a string to append to the system prompt, or ''.
   */
  getContextOverlay(channelId) {
    const state = this._channels.get(channelId);
    if (!state || state.messages.length < 2) return '';

    // Check for decay
    if (Date.now() - state.lastActivity > DECAY_MS) {
      this._channels.delete(channelId);
      return '';
    }

    // Build context summary
    const recent = state.messages
      .filter(m => !m.isJenkins) // Only show what others said
      .slice(-3)                 // Last 3 non-Jenkins messages
      .map(m => `${m.username}: "${m.content.substring(0, 150)}"`)
      .join('\n');

    if (!recent) return '';

    let overlay = `\n\n[CONVERSATION CONTEXT — Recent messages in this channel:]\n${recent}`;

    if (state.topic) {
      overlay += `\n[Current topic appears to be: ${state.topic}]`;
    }

    overlay += `\nUse this context to respond more naturally. Reference what was just discussed. If someone changed the topic, acknowledge it. If there's a running thread, build on it. Don't repeat what was already said.`;

    return overlay;
  }

  /**
   * Get the current detected topic for a channel.
   */
  getTopic(channelId) {
    const state = this._channels.get(channelId);
    return state?.topic || null;
  }

  /**
   * Get message count in current window (for activity sensing).
   */
  getActivityLevel(channelId) {
    const state = this._channels.get(channelId);
    if (!state) return 0;
    if (Date.now() - state.lastActivity > DECAY_MS) return 0;
    return state.messages.length;
  }
}

// ── Topic Extraction (simple heuristic) ─────────────────────────

function extractTopic(content) {
  // Try to find the main subject
  const cleaned = content
    .replace(/<@!?\d+>/g, '')     // Remove mentions
    .replace(/https?:\/\/\S+/g, '') // Remove URLs
    .replace(/[^\w\s'-]/g, ' ')    // Remove special chars
    .trim();

  if (cleaned.length < 10) return null;

  // Look for "about X", "think about X", "talking about X"
  const aboutMatch = cleaned.match(/(?:about|regarding|on|discussing)\s+(.{5,40})/i);
  if (aboutMatch) return aboutMatch[1].trim();

  // Look for game names
  const gameMatch = cleaned.match(/\b(kenshi|caves? of qud|battle brothers|elden ring|baldur'?s gate|starfield|cyberpunk|gta|minecraft|valorant|league|dota|wow|ff14|ffxiv|diablo|path of exile|helldivers|palworld)\b/i);
  if (gameMatch) return gameMatch[1];

  // Fall back to first substantial phrase (skip filler words)
  const words = cleaned.split(/\s+/).filter(w => w.length > 3);
  if (words.length >= 2) {
    return words.slice(0, 4).join(' ');
  }

  return null;
}

module.exports = { ConversationContext };
