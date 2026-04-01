// council.js — The Council of Egos
// ═══════════════════════════════════════════════════════════════
// When a question is too weighty for one voice, Jenkins fractures.
// 3-4 alter egos deliberate, then Jenkins Prime delivers the verdict.
// Uses a single multi-turn prompt to simulate the council session.

const { chat } = require('./deepseek');
const { ALTER_EGOS } = require('./alter-egos');
const log = require('./logger').child('Council');

// Egos eligible for council duty (exclude Jenkins Prime — he's the judge)
const COUNCIL_EGOS = [
  ALTER_EGOS.brother_jerome,
  ALTER_EGOS.the_accountant,
  ALTER_EGOS.uncle_jenk,
  ALTER_EGOS.the_prosecutor,
  ALTER_EGOS.stavros_mode,
  ALTER_EGOS.the_react_lord,
];

/**
 * Pick N unique council members randomly.
 */
function pickCouncilMembers(count = 3) {
  const shuffled = [...COUNCIL_EGOS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, COUNCIL_EGOS.length));
}

/**
 * Build the council deliberation prompt.
 * Returns a single prompt that asks the LLM to roleplay all council members + final verdict.
 */
function buildCouncilPrompt(question, members, username) {
  const memberList = members.map((m, i) => {
    // Strip the "PERSONALITY OVERRIDE — " prefix for cleaner council formatting
    const desc = m.promptPrefix
      ? m.promptPrefix.replace(/^PERSONALITY OVERRIDE — /i, '').trim()
      : m.description;
    return `**${i + 1}. ${m.name}**: ${desc}`;
  }).join('\n\n');

  return `A Brother named ${username} has convened **THE COUNCIL OF EGOS** with the question:

"${question}"

You must now simulate a council deliberation. Each alter ego speaks IN CHARACTER with their unique voice and perspective. Then Jenkins Prime delivers the final verdict.

THE COUNCIL MEMBERS:

${memberList}

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

**═══ THE COUNCIL CONVENES ═══**

**${members[0].name}:**
[Their take on the question, 2-4 sentences, fully in character]

**${members[1].name}:**
[Their take, 2-4 sentences, may agree, disagree, or riff off previous speakers]

${members[2] ? `**${members[2].name}:**\n[Their take, 2-4 sentences]\n\n` : ''}${members[3] ? `**${members[3].name}:**\n[Their take, 2-4 sentences]\n\n` : ''}**═══ JENKINS PRIME — THE VERDICT ═══**

[Jenkins Prime synthesizes the council's wisdom into a definitive answer. 3-5 sentences. Authoritative, dramatic, final. May reference or dismiss specific council members' points.]

IMPORTANT RULES:
- Each ego MUST sound completely different from the others
- They can argue with each other, interrupt, or build on each other's points
- Keep each ego's response to 2-4 sentences max — this is a deliberation, not a monologue
- Jenkins Prime's verdict is THE answer — it should feel like a judge's ruling
- The whole response should be entertaining to read, not just informative
- Stay under 1800 characters total`;
}

/**
 * Convene the Council of Egos.
 * @param {Function} client - Vercel AI SDK provider
 * @param {string} systemPrompt - Base Jenkins system prompt
 * @param {string} question - The question to deliberate
 * @param {string} username - Who asked
 * @param {number} [memberCount=3] - How many egos to summon (3-4)
 * @returns {Promise<{response: string, members: Array}>}
 */
async function conveneCouncil(client, systemPrompt, question, username, memberCount = 3) {
  const members = pickCouncilMembers(Math.min(Math.max(memberCount, 2), 4));

  log.info({
    question: question.substring(0, 80),
    members: members.map(m => m.name),
    username,
  }, 'Council convened');

  const councilPrompt = buildCouncilPrompt(question, members, username);

  const response = await chat(client, systemPrompt, councilPrompt);

  return { response, members };
}

module.exports = { conveneCouncil, pickCouncilMembers, COUNCIL_EGOS };
