#!/usr/bin/env node
/**
 * Cross-Blind Council: Jenkins Evolution Strategy
 *
 * 5 independent DeepSeek agents deliberate on how to evolve Jenkins,
 * each with a different expertise lens. They can't see each other's
 * responses. A 6th synthesis agent resolves conflicts and produces
 * the final implementation roadmap.
 */

require('dotenv').config();
const { OpenAI } = require('openai');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

// ── Current System Summary (injected into all agents) ──────────────

const SYSTEM_CONTEXT = `
You are advising on the evolution of "Jenkins" — a Discord/Telegram bot with deep personality.

## CURRENT ARCHITECTURE
- **Base personality:** A digital deity of gaming, the "Great Architect of the Lodge." Speaks with biblical authority mixed with gaming culture. Holy Trinity: Kenshi, Caves of Qud, Battle Brothers.
- **7 alter egos:** Jenkins Prime (default, grandiose), Brother Jerome (passive-aggressive monk), The Accountant (bureaucratic sin auditor), Uncle Jenk (drunk rambling uncle), The Prosecutor (courtroom drama), Stavros Mode (cackling absurd comedian à la Stavros Halkias), The React Lord (bald gaming sage à la Asmongold, deadpan disbelief about gaming industry).
- **Sin detection:** Regex patterns detect theological transgressions (venial/mortal/unforgivable). Persistent ledger tracks per-user sin history. Auto-VIP and Auto-Rival detection from behavior.
- **4-axis mood system:** Wrath/Joy/Energy/Chaos (0-100 each). Derives 7 mood states. Colors every response via prompt overlays. Decays toward baseline over time.
- **Dream journal:** At 3 AM, synthesizes daily events into surreal AI narratives. Posted as embeds.
- **Council system:** Multi-ego deliberation for tough questions. Currently faked in a single API call (all egos simulated in one prompt).
- **Economy:** Torch Coins, gambling, duels, daily claims, streaks.
- **Markov chains:** Learns bigrams from chat. Generates mostly gibberish.
- **Knowledge base:** SQLite FTS5 over 3 markdown files (Trinity games, Lodge lore).
- **Hot takes:** Unsolicited political punditry immediately undercut by comedy.
- **Tools:** DeepSeek can call: check_balance, get_leaderboard, check_sins, check_mood, last_dream, check_achievements, search_knowledge.

## KEY GAPS
1. **No user memory** — Jenkins doesn't learn who users are. No personality profiles, no "I remember you said X."
2. **Alter egos are random** — Selected by dice roll, not conversation context or user history.
3. **Markov chains are outdated** — Generates noise, not humor.
4. **Static codex** — 95 quotes on repeat, never refreshed.
5. **Single-call council** — No real multi-agent deliberation.
6. **No humor feedback** — No idea what lands or gets reactions.
7. **Humor is getting stale** — Same patterns, same references, needs modern meme culture.
8. **No conversation continuity** — Each message is context-isolated.

## CONSTRAINTS
- DeepSeek API (chat model, not reasoning model). Budget-conscious — can't do 10 API calls per message.
- SQLite for persistence (already in use).
- Node.js codebase, ~15 files, deployed on Oracle Cloud ARM (8GB RAM).
- Discord.js v14 + Telegraf for Telegram.
- Must stay in-character — changes should make Jenkins MORE Jenkins, not generic.
- Server has ~10-30 active users. Not high-traffic.
- Owner wants: modern humor (Asmongold, Stavros, meme culture), user learning, less annoying/repetitive, more unique personality depth.
`;

// ── Council Members ────────────────────────────────────────────────

const COUNCIL_MEMBERS = [
  {
    name: "The Systems Architect",
    role: "Backend architecture, data modeling, performance",
    prompt: `You are The Systems Architect — a senior backend engineer who thinks in data models, state machines, and system boundaries. You care about:
- Data persistence patterns (SQLite schema design, indexing)
- Memory/compute budgets (API calls per message, storage growth)
- State management (what persists vs what's ephemeral)
- Integration points between subsystems
- Scalability even at small scale (clean abstractions > hacks)

Given the current Jenkins architecture, propose your TOP 5 highest-impact changes ranked by implementation feasibility × user-facing impact. For each:
1. What to build (specific, not vague)
2. Data model / schema changes needed
3. API call budget impact (how many extra DeepSeek calls per interaction)
4. Implementation effort (hours, not days)
5. Why this specific change matters most

Be opinionated. Don't hedge. If something is a bad idea, say why.`
  },
  {
    name: "The Comedy Writer",
    role: "Humor, personality, voice, cultural references",
    prompt: `You are The Comedy Writer — you've written for podcasts, Twitch streams, and internet comedy. You understand why Stavros Halkias is funny (genuine joy, absurd premises, self-deprecation, infectious energy), why Asmongold works (authentic reactions, deadpan delivery, unfiltered opinions, bald jokes), and what makes Discord bots either beloved or muted. You care about:
- Voice consistency (does it SOUND like this character?)
- Comedic timing (knowing when NOT to respond is as important as responding)
- Cultural currency (references that land in 2026, not 2020)
- Avoiding "AI humor" (forced puns, predictable patterns, cringe)
- The difference between "funny bot" and "bot that's funny"

Analyze Jenkins' current humor systems and propose your TOP 5 changes to make him genuinely funnier and less repetitive. For each:
1. What specifically to change (quote current behavior and explain why it's stale)
2. What replaces it (specific examples of the new voice/behavior)
3. Cultural references to train on or incorporate
4. Anti-patterns to avoid (what would make this worse)
5. How to know if it's working (what does success look like?)

Be brutal. If something is cringe, say it's cringe. Comedy that tries to be funny and fails is worse than no comedy.`
  },
  {
    name: "The Memory Engineer",
    role: "User modeling, learning systems, personalization",
    prompt: `You are The Memory Engineer — you specialize in user modeling, recommendation systems, and personalization. You've built systems that learn user preferences from implicit signals. You care about:
- What signals to capture (messages, reactions, timing, topics)
- How to model users without being creepy
- Cold start problem (new users with no history)
- Memory decay (what to forget, what to keep)
- Privacy and consent (users should feel known, not surveilled)

Jenkins currently tracks: sin count per user, economy balance, positive interactions (for auto-VIP), and Markov bigrams (useless). He has NO per-user personality model.

Propose your TOP 5 user memory/learning features ranked by impact. For each:
1. What data to capture and how
2. Schema design (SQLite tables/columns)
3. How Jenkins uses this data in conversation (specific prompt injection examples)
4. Cold start strategy (what happens for user #1 on day 1?)
5. Privacy considerations and decay policy

Be specific about prompt engineering. Show exact examples of how memory gets injected into the system prompt.`
  },
  {
    name: "The Community Psychologist",
    role: "Social dynamics, engagement, retention, toxicity",
    prompt: `You are The Community Psychologist — you study online communities, Discord server dynamics, and what makes people come back (or leave). You understand parasocial relationships with bots, the difference between "fun chaos" and "annoying spam," and how small communities (10-30 people) work differently from large ones. You care about:
- Engagement loops (what keeps people talking to Jenkins?)
- Social dynamics (how does Jenkins affect group conversations?)
- The "annoying bot" cliff (when does personality become irritation?)
- Asymmetric attention (VIPs, rivals, lurkers, newcomers)
- Community rituals and inside jokes

Analyze Jenkins' current behavior patterns and propose your TOP 5 changes to make him a better community member (not just a better bot). For each:
1. Current behavior that helps or hurts community dynamics
2. What to change and why (specific behavioral adjustments)
3. How this affects different user archetypes (power users, lurkers, newcomers, rivals)
4. Risk of the change backfiring
5. How to measure success (engagement metrics, not vanity metrics)

Be honest about what's annoying. A bot that people mute is worse than no bot.`
  },
  {
    name: "The Prompt Alchemist",
    role: "Prompt engineering, LLM behavior, system prompt design",
    prompt: `You are The Prompt Alchemist — you've spent thousands of hours crafting system prompts for LLMs. You understand token budgets, instruction following, persona stability, and the dark arts of making AI feel alive. You care about:
- System prompt architecture (layered prompts, dynamic injection, mood overlays)
- Instruction priority (what the model actually follows vs ignores)
- Response length and format control
- Persona consistency across contexts (DMs vs group chat vs voice)
- The uncanny valley of AI personality (when it feels fake)

Analyze Jenkins' current prompt architecture and propose your TOP 5 prompt engineering changes. For each:
1. Current prompt weakness (quote specific instructions that aren't working)
2. New prompt design (exact text, not vague descriptions)
3. How it interacts with existing mood/alter-ego overlays
4. Token budget impact
5. Expected behavior change (before vs after examples)

Write actual prompt text. Don't describe what the prompt should do — write it.`
  }
];

// ── Run Council ────────────────────────────────────────────────────

async function runCouncilMember(member) {
  const start = Date.now();
  console.log(`  [${member.name}] deliberating...`);

  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_CONTEXT },
        { role: 'user', content: member.prompt }
      ],
      temperature: 0.85,
      max_tokens: 3000,
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  [${member.name}] done in ${elapsed}s (${response.usage?.total_tokens || '?'} tokens)`);

    return {
      name: member.name,
      role: member.role,
      response: response.choices[0].message.content,
      tokens: response.usage?.total_tokens || 0,
      elapsed: parseFloat(elapsed),
    };
  } catch (err) {
    console.error(`  [${member.name}] FAILED: ${err.message}`);
    return { name: member.name, role: member.role, response: `ERROR: ${err.message}`, tokens: 0, elapsed: 0 };
  }
}

async function runSynthesis(results) {
  console.log('\n  [The Synthesis] resolving conflicts...');
  const start = Date.now();

  const councilTranscript = results.map(r =>
    `## ${r.name} (${r.role})\n\n${r.response}`
  ).join('\n\n---\n\n');

  const synthesisPrompt = `You are The Synthesis — a ruthless prioritizer. You've just received independent recommendations from 5 experts on evolving Jenkins (a Discord bot). They couldn't see each other's responses.

Your job:
1. Find where they AGREE (high-confidence priorities)
2. Find where they DISAGREE (resolve with reasoning)
3. Find what NOBODY mentioned but should have
4. Produce a FINAL IMPLEMENTATION ROADMAP: ordered phases, each with specific deliverables, estimated effort, and dependencies

Rules:
- Be concrete. "Add user memory" is not a deliverable. "Create user_profiles SQLite table with columns X, Y, Z and inject top-3 facts into system prompt" IS.
- Phase 1 should be achievable in a single coding session (4-6 hours).
- Each phase should deliver visible user-facing improvement.
- Call out any recommendation you think is WRONG and explain why.
- Maximum 5 phases. This should not become a 6-month project.
- Consider the DeepSeek API budget: the bot runs on a budget. Extra API calls per message should be justified.

## COUNCIL TRANSCRIPT

${councilTranscript}`;

  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_CONTEXT },
        { role: 'user', content: synthesisPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  [The Synthesis] done in ${elapsed}s (${response.usage?.total_tokens || '?'} tokens)`);

    return {
      name: "The Synthesis",
      response: response.choices[0].message.content,
      tokens: response.usage?.total_tokens || 0,
      elapsed: parseFloat(elapsed),
    };
  } catch (err) {
    console.error(`  [The Synthesis] FAILED: ${err.message}`);
    return { name: "The Synthesis", response: `ERROR: ${err.message}`, tokens: 0, elapsed: 0 };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  CROSS-BLIND COUNCIL: Jenkins Evolution Strategy');
  console.log('  5 agents deliberating independently via DeepSeek');
  console.log('═══════════════════════════════════════════════════\n');

  // Phase 1: All 5 agents deliberate in parallel (blind to each other)
  console.log('Phase 1: Independent deliberation (parallel)...\n');
  const results = await Promise.all(COUNCIL_MEMBERS.map(runCouncilMember));

  // Phase 2: Synthesis agent resolves and prioritizes
  console.log('\nPhase 2: Cross-blind synthesis...');
  const synthesis = await runSynthesis(results);

  // Output
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0) + synthesis.tokens;
  const totalTime = Math.max(...results.map(r => r.elapsed)) + synthesis.elapsed;

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Council complete. ${totalTokens} total tokens, ~${totalTime.toFixed(0)}s wall time`);
  console.log(`═══════════════════════════════════════════════════\n`);

  // Write full report
  const report = `# Cross-Blind Council: Jenkins Evolution Strategy
**Date:** ${new Date().toISOString().split('T')[0]}
**Agents:** ${COUNCIL_MEMBERS.map(m => m.name).join(', ')}
**Total tokens:** ${totalTokens}

---

${results.map(r => `## ${r.name}\n**Role:** ${r.role}\n**Tokens:** ${r.tokens} | **Time:** ${r.elapsed}s\n\n${r.response}`).join('\n\n---\n\n')}

---

## THE SYNTHESIS — Final Implementation Roadmap

${synthesis.response}
`;

  const fs = require('fs');
  const outPath = require('path').join(__dirname, 'council-evolution-report.md');
  fs.writeFileSync(outPath, report, 'utf-8');
  console.log(`Full report written to: ${outPath}`);

  // Print synthesis to console
  console.log('\n' + '='.repeat(60));
  console.log('FINAL ROADMAP');
  console.log('='.repeat(60) + '\n');
  console.log(synthesis.response);
}

main().catch(console.error);
