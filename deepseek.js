// deepseek.js — The Oracle's Voice, channeled through DeepSeek via Vercel AI SDK
// v3.0 — Vercel AI SDK with tool-calling support

const { createOpenAI } = require('@ai-sdk/openai');
const { generateText, streamText, tool } = require('ai');
const { z } = require('zod');
const log = require('./logger').child('DeepSeek');
const { logApiCall } = require('/home/yeeterson/.api-monitor/api-logger');

// ═══════════════════════════════════════════════════════════════
// Client Factory — returns an object with provider + raw OpenAI client
// ═══════════════════════════════════════════════════════════════

function createClient(apiKey, baseURL) {
  const provider = createOpenAI({
    apiKey,
    baseURL: baseURL || 'https://api.deepseek.com',
    compatibility: 'compatible',
  });
  // Return the provider — callers pass this to chat/chatStream
  return provider;
}

// ═══════════════════════════════════════════════════════════════
// Tool Definitions — Jenkins' abilities during conversation
// NOT financial tools. Jenkins gives opinions only.
// ═══════════════════════════════════════════════════════════════

// Tools are injected at call time by chatWithTools(). Defined here
// as a factory so they can access live module instances.
let _toolModules = null;

/**
 * Register live module instances for tool-calling.
 * Call once after all modules are constructed in bot.js.
 * @param {{ economy, sinDetector, mood, dreamJournal, sermons, achievements }} modules
 */
function registerToolModules(modules) {
  _toolModules = modules;
  log.info({ tools: Object.keys(modules) }, 'Tool modules registered');
}

/**
 * Build the Vercel AI SDK tool definitions from registered modules.
 */
function buildTools() {
  if (!_toolModules) return {};

  const tools = {};

  if (_toolModules.economy) {
    tools.check_balance = tool({
      description: 'Look up a user\'s Torch Coin balance and economy stats. Use when someone asks about their coins, balance, or wealth.',
      parameters: z.object({
        userId: z.string().describe('The user ID to look up'),
      }),
      execute: async ({ userId }) => {
        const user = _toolModules.economy.getUser(userId);
        return {
          balance: user.balance,
          totalEarned: user.totalEarned,
          totalLost: user.totalLost,
          dailyStreak: user.dailyStreak,
          gamblesWon: user.gamblesWon || 0,
          gamblesLost: user.gamblesLost || 0,
          dungeonWins: user.dungeonWins || 0,
          dungeonRuns: user.dungeonRuns || 0,
        };
      },
    });

    tools.get_leaderboard = tool({
      description: 'Get the top 10 richest users by Torch Coin balance. Use when someone asks about the leaderboard, richest, or top earners.',
      parameters: z.object({}),
      execute: async () => {
        const leaders = _toolModules.economy.leaderboard(10);
        return leaders.map(e => ({
          rank: e.rank,
          userId: e.userId,
          balance: e.balance,
        }));
      },
    });
  }

  if (_toolModules.sinDetector) {
    tools.check_sins = tool({
      description: 'Look up a user\'s sin record from the Architect\'s ledger. Use when someone asks about sins, penance, or standing.',
      parameters: z.object({
        userId: z.string().describe('The user ID to look up'),
      }),
      execute: async ({ userId }) => {
        const totals = _toolModules.sinDetector.getTotalSins(userId);
        const title = _toolModules.sinDetector.getSinTitle(userId);
        const escalation = _toolModules.sinDetector.getEscalationLevel(userId);
        const labels = ['Clean', 'Undisciplined', 'Shamed', 'Perpetually Fallen', 'Covenant-Breaker'];
        return {
          total: totals.total,
          venial: totals.venial,
          mortal: totals.mortal,
          unforgivable: totals.unforgivable,
          title: title || null,
          standing: labels[escalation] || 'Unknown',
        };
      },
    });
  }

  if (_toolModules.mood) {
    tools.check_mood = tool({
      description: 'Get Jenkins\' current emotional state and mood axes. Use when someone asks how Jenkins is feeling or about his mood.',
      parameters: z.object({}),
      execute: async () => {
        const currentMood = _toolModules.mood.deriveMood();
        const axes = _toolModules.mood.data?.axes || {};
        return {
          mood: currentMood,
          wrath: axes.wrath,
          joy: axes.joy,
          energy: axes.energy,
          chaos: axes.chaos,
          economyMultiplier: _toolModules.mood.getEconomyMultiplier(),
        };
      },
    });
  }

  if (_toolModules.dreamJournal) {
    tools.last_dream = tool({
      description: 'Get the Architect\'s most recent dream. Use when someone asks about Jenkins\' dreams or what he dreamt.',
      parameters: z.object({}),
      execute: async () => {
        const dreams = _toolModules.dreamJournal.data?.dreams || [];
        const last = dreams[dreams.length - 1];
        if (!last) return { hasDream: false };
        return {
          hasDream: true,
          date: last.date,
          mood: last.mood,
          content: last.content?.substring(0, 500),
        };
      },
    });
  }

  if (_toolModules.achievements) {
    tools.check_achievements = tool({
      description: 'Check a user\'s achievement progress. Use when someone asks about their achievements or badges.',
      parameters: z.object({
        userId: z.string().describe('The user ID to look up'),
      }),
      execute: async ({ userId }) => {
        const user = _toolModules.economy?.getUser(userId);
        const unlocked = user?.achievements || [];
        return {
          unlockedCount: unlocked.length,
          unlocked: unlocked.map(a => a.id || a),
        };
      },
    });
  }

  // Knowledge base search — always available (no module dependency)
  try {
    const { search: kbSearch } = require('./knowledge');
    tools.search_knowledge = tool({
      description: 'Search the Lodge knowledge base for game guides, lore, rules, strategy tips, Lodge-related information, AND mathematics. Use for: specific games, the Codex, Lodge customs, gameplay advice, AND any math question — calculus, linear algebra, differential equations, PDEs, real/complex analysis, topology, discrete math, probability, statistics, machine learning, information theory, network theory. Search for theorems, formulas, definitions, and techniques.',
      parameters: z.object({
        query: z.string().describe('Search query — game name, topic, or question keywords'),
      }),
      execute: async ({ query }) => {
        const results = kbSearch(query, 3);
        if (results.length === 0) return { found: false };
        return {
          found: true,
          results: results.map(r => ({
            title: r.title,
            category: r.category,
            content: r.content.substring(0, 500),
          })),
        };
      },
    });
  } catch {
    // Knowledge module not loaded — skip
  }

  // Math RAG — semantic/keyword search over textbook content
  try {
    const mathRag = require('./math-rag');
    const stats = mathRag.getStats();
    if (stats.total > 0) {
      tools.search_math = tool({
        description: 'Search the mathematical knowledge base for theorems, proofs, formulas, definitions, and worked examples from textbooks. Covers: calculus, linear algebra, ODEs, PDEs, real analysis, complex analysis, topology, discrete math, probability, statistics, ML, information theory, network theory. Use this for detailed mathematical content beyond what search_knowledge provides.',
        parameters: z.object({
          query: z.string().describe('Math topic, theorem name, formula, or concept to search for'),
        }),
        execute: async ({ query }) => {
          const results = mathRag.search(query, 5);
          if (results.length === 0) return { found: false };
          return {
            found: true,
            results: results.map(r => ({
              subject: r.subject,
              section: r.section,
              content: r.content.substring(0, 800),
            })),
          };
        },
      });
      log.info({ chunks: stats.total }, 'Math RAG tool registered');
    }
  } catch {
    // Math RAG module not loaded — skip
  }

  return tools;
}

// ═══════════════════════════════════════════════════════════════
// Chat Functions — Drop-in compatible with existing call sites
// ═══════════════════════════════════════════════════════════════

/**
 * Non-streaming chat completion.
 * Signature matches old API: chat(client, systemPrompt, userMessage, conversationHistory)
 */
async function chat(client, systemPrompt, userMessage, conversationHistory) {
  try {
    const messages = [];

    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    messages.push({ role: 'user', content: userMessage });

    const result = await generateText({
      model: client.chat('deepseek-chat'),
      system: systemPrompt,
      messages,
      temperature: 0.9,
      maxTokens: 1000,
    });
    logApiCall('deepseek', '/chat/completions', {
      project: 'jenkins',
      tokensIn: result.usage?.promptTokens || 0,
      tokensOut: result.usage?.completionTokens || 0,
    });

    const response = result.text;
    if (!response) {
      return "The Architect's gaze turns inward... Silence reigns. Try again, Brother.";
    }

    // Enforce Discord's 2000 char limit
    if (response.length > 1900) {
      return response.slice(0, 1897) + '...';
    }

    return response;
  } catch (err) {
    log.error({ err: err.message || err }, 'API error');
    return "The Architect's vision clouds... the Oracle is momentarily silent. The servers of the divine are under load. Try again, Brother.";
  }
}

/**
 * Chat with tool-calling enabled.
 * Use for conversational contexts where Jenkins should be able to look things up.
 * Falls through to regular chat if no tools are registered.
 */
async function chatWithTools(client, systemPrompt, userMessage, conversationHistory) {
  const tools = buildTools();

  if (Object.keys(tools).length === 0) {
    return chat(client, systemPrompt, userMessage, conversationHistory);
  }

  try {
    const messages = [];

    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    messages.push({ role: 'user', content: userMessage });

    const result = await generateText({
      model: client.chat('deepseek-chat'),
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 3, // Allow up to 3 tool calls per response
      temperature: 0.9,
      maxTokens: 1000,
    });
    logApiCall('deepseek', '/chat/completions', {
      project: 'jenkins',
      tokensIn: result.usage?.promptTokens || 0,
      tokensOut: result.usage?.completionTokens || 0,
    });

    const response = result.text;
    if (!response) {
      return "The Architect's gaze turns inward... Silence reigns. Try again, Brother.";
    }

    // Log tool usage
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls?.length > 0) {
          log.info({ tools: step.toolCalls.map(t => t.toolName) }, 'Tools invoked');
        }
      }
    }

    if (response.length > 1900) {
      return response.slice(0, 1897) + '...';
    }

    return response;
  } catch (err) {
    log.error({ err: err.message || err }, 'Tool-calling API error');
    // Fall back to regular chat
    return chat(client, systemPrompt, userMessage, conversationHistory);
  }
}

/**
 * Streaming chat — yields tokens as they arrive.
 * Buffers and yields complete sentences for TTS pipelining.
 * Signature matches old API.
 *
 * @param {Function} client - Vercel AI SDK provider
 * @param {string} systemPrompt - Jenkins system prompt
 * @param {string} userMessage - Current user message
 * @param {Array} conversationHistory - Rolling context window
 * @param {object} callbacks - { onToken, onSentence, onFirstToken, onDone }
 */
async function chatStream(client, systemPrompt, userMessage, conversationHistory, callbacks = {}) {
  const messages = [];

  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }

  messages.push({ role: 'user', content: userMessage });

  try {
    const result = streamText({
      model: client.chat('deepseek-chat'),
      system: systemPrompt,
      messages,
      temperature: 0.9,
      maxTokens: 1000,
    });

    let fullText = '';
    let sentenceBuffer = '';
    let tokenCount = 0;
    let firstTokenTime = null;
    const streamStart = process.hrtime.bigint();

    // Sentence boundary detection
    const SENTENCE_BOUNDARY = /[.!?]+[\s"')\]]*$/;
    const MIN_SENTENCE_LEN = 40;

    for await (const chunk of result.textStream) {
      if (!chunk) continue;

      tokenCount++;
      fullText += chunk;
      sentenceBuffer += chunk;

      // Track first token latency
      if (!firstTokenTime) {
        firstTokenTime = Number(process.hrtime.bigint() - streamStart) / 1e6;
        if (callbacks.onFirstToken) callbacks.onFirstToken(firstTokenTime);
      }

      if (callbacks.onToken) callbacks.onToken(chunk);

      // Flush complete sentences to TTS pipeline
      if (sentenceBuffer.length >= MIN_SENTENCE_LEN && SENTENCE_BOUNDARY.test(sentenceBuffer)) {
        const sentence = sentenceBuffer.trim();
        sentenceBuffer = '';
        if (sentence && callbacks.onSentence) {
          callbacks.onSentence(sentence);
        }
      }
    }

    // Flush remaining text
    if (sentenceBuffer.trim()) {
      if (callbacks.onSentence) callbacks.onSentence(sentenceBuffer.trim());
    }

    logApiCall('deepseek', '/chat/completions', { project: 'jenkins', tokensOut: tokenCount });
    if (callbacks.onDone) callbacks.onDone(fullText, tokenCount);

    return fullText;
  } catch (err) {
    log.error({ err: err.message || err }, 'Streaming error');
    return chat(client, systemPrompt, userMessage, conversationHistory);
  }
}

module.exports = { createClient, chat, chatStream, chatWithTools, registerToolModules };
