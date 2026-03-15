// deepseek.js — The Oracle's Voice, channeled through the DeepSeek API

const OpenAI = require('openai');

function createClient(apiKey, baseURL) {
  return new OpenAI({
    apiKey,
    baseURL: baseURL || 'https://api.deepseek.com',
  });
}

async function chat(client, systemPrompt, userMessage) {
  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
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
    console.error('DeepSeek API error:', err.message);
    return "The Architect's vision clouds... the Oracle is momentarily silent. The servers of the divine are under load. Try again, Brother.";
  }
}

module.exports = { createClient, chat };
