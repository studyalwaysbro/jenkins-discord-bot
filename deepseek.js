// deepseek.js — The Oracle's Voice, channeled through the DeepSeek API

const OpenAI = require('openai');
const log = require('./logger').child('DeepSeek');

function createClient(apiKey, baseURL) {
  return new OpenAI({
    apiKey,
    baseURL: baseURL || 'https://api.deepseek.com',
  });
}

async function chat(client, systemPrompt, userMessage, conversationHistory) {
  try {
    const messages = [{ role: 'system', content: systemPrompt }];

    // Inject conversation history if provided (rolling context window)
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    messages.push({ role: 'user', content: userMessage });

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      temperature: 0.9,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return "The Architect's gaze turns inward... Silence reigns. Try again, Brother.";
    }

    // Enforce Discord's 2000 char limit
    if (response.length > 1900) {
      return response.slice(0, 1897) + '...';
    }

    return response;
  } catch (err) {
    log.error({ err }, 'API error');
    return "The Architect's vision clouds... the Oracle is momentarily silent. The servers of the divine are under load. Try again, Brother.";
  }
}

/**
 * Streaming chat — yields tokens as they arrive from DeepSeek.
 * Also buffers and yields complete sentences for TTS pipelining.
 *
 * @param {OpenAI} client - OpenAI-compatible client
 * @param {string} systemPrompt - Jenkins system prompt
 * @param {string} userMessage - Current user message
 * @param {Array} conversationHistory - Rolling context window
 * @param {object} callbacks - { onToken(token), onSentence(sentence), onFirstToken(ms), onDone(fullText, tokenCount) }
 */
async function chatStream(client, systemPrompt, userMessage, conversationHistory, callbacks = {}) {
  const messages = [{ role: 'system', content: systemPrompt }];

  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }

  messages.push({ role: 'user', content: userMessage });

  try {
    const stream = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      temperature: 0.9,
      max_tokens: 1000,
      stream: true,
    });

    let fullText = '';
    let sentenceBuffer = '';
    let tokenCount = 0;
    let firstTokenTime = null;
    const streamStart = process.hrtime.bigint();

    // Sentence boundary detection: split on . ? ! followed by space or end
    const SENTENCE_BOUNDARY = /[.!?]+[\s"')\]]*$/;
    // Minimum chars before we consider flushing a sentence (avoids splitting "Dr. Smith")
    const MIN_SENTENCE_LEN = 40;

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (!token) continue;

      tokenCount++;
      fullText += token;
      sentenceBuffer += token;

      // Track first token latency
      if (!firstTokenTime) {
        firstTokenTime = Number(process.hrtime.bigint() - streamStart) / 1e6;
        if (callbacks.onFirstToken) callbacks.onFirstToken(firstTokenTime);
      }

      if (callbacks.onToken) callbacks.onToken(token);

      // Flush complete sentences to TTS pipeline
      if (sentenceBuffer.length >= MIN_SENTENCE_LEN && SENTENCE_BOUNDARY.test(sentenceBuffer)) {
        const sentence = sentenceBuffer.trim();
        sentenceBuffer = '';
        if (sentence && callbacks.onSentence) {
          callbacks.onSentence(sentence);
        }
      }
    }

    // Flush any remaining text as final sentence
    if (sentenceBuffer.trim()) {
      if (callbacks.onSentence) callbacks.onSentence(sentenceBuffer.trim());
    }

    if (callbacks.onDone) callbacks.onDone(fullText, tokenCount);

    return fullText;
  } catch (err) {
    log.error({ err }, 'Streaming error');
    // Fall back to non-streaming
    return chat(client, systemPrompt, userMessage, conversationHistory);
  }
}

module.exports = { createClient, chat, chatStream };
