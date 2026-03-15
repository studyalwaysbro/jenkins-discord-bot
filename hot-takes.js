// hot-takes.js — Activity-Triggered Hot Takes & Stavros Comedy Breaks
// Monitors chat activity and occasionally drops unsolicited political/comedy bits.
// Political commentary gets immediately undercut with Stavros-style absurdity.

const { chat } = require('./deepseek');

// ═══════════════════════════════════════════════════════════════
// Activity Tracker — monitors chat flow to detect "the vibes are up"
// ═══════════════════════════════════════════════════════════════

class ActivityTracker {
  constructor() {
    this.recentMessages = []; // { userId, timestamp, channelId }
    this.lastHotTake = 0;
    this.hotTakeCooldown = 30 * 60 * 1000; // 30 min between hot takes
    this.activityWindow = 5 * 60 * 1000;   // 5 min window
    this.minUniqueUsers = 2;                // At least 2 people chatting
    this.minMessages = 4;                   // At least 4 messages in window
  }

  recordMessage(userId, channelId) {
    this.recentMessages.push({ userId, channelId, timestamp: Date.now() });
    // Prune old messages
    const cutoff = Date.now() - this.activityWindow;
    this.recentMessages = this.recentMessages.filter(m => m.timestamp > cutoff);
  }

  isActive(channelId) {
    const now = Date.now();
    const cutoff = now - this.activityWindow;
    const channelMessages = this.recentMessages.filter(
      m => m.channelId === channelId && m.timestamp > cutoff
    );
    const uniqueUsers = new Set(channelMessages.map(m => m.userId)).size;
    return channelMessages.length >= this.minMessages && uniqueUsers >= this.minUniqueUsers;
  }

  shouldDropHotTake(channelId) {
    if (Date.now() - this.lastHotTake < this.hotTakeCooldown) return false;
    if (!this.isActive(channelId)) return false;

    // 8% chance per qualifying message when activity is high
    if (Math.random() > 0.08) return false;

    this.lastHotTake = Date.now();
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════
// Hot Take Generator — political pundit → comedy undercut
// ═══════════════════════════════════════════════════════════════

const HOT_TAKE_PROMPTS = [
  // Tucker Carlson style → Stavros undercut
  `You're about to drop an UNSOLICITED hot take into the chat. Nobody asked for this. Start with a Tucker Carlson-style dramatic monologue opening — "Now, I'm not saying..." or "You have to ask yourself..." or "They don't want you to know this, but..." Pick a topic: something going on in America, culture war stuff, gaming industry, tech companies, AI, or world events. Be dramatic and conspiratorial for 1-2 sentences. Then IMMEDIATELY switch to Stavros Halkias energy and completely undercut everything you just said. Start cackling. Pose an absurd hypothetical. Say "hell yeah dude" or "that rules" or "wait actually that's hilarious." The punchline should make the serious take look ridiculous. End with something that has nothing to do with anything. Keep it under 1500 characters. You are still Jenkins — frame everything through gaming/Lodge metaphors where possible.`,

  // Nick Fuentes style → Stavros undercut
  `Drop an unsolicited hot take. Start with intense, rapid-fire Nick Fuentes debate-bro energy — "Here's the thing, here's the THING—" or "Nobody wants to have this conversation but I WILL—" Pick something: gaming culture, the state of the industry, modern society, streaming, online discourse, or current events. Be intense and provocative for 1-2 sentences. Then HARD CUT to Stavros mode. Completely lose it laughing. "Hahahaha nah I'm just kidding — or AM I? *wheeze*" Turn the whole take into an absurd comedy bit. Maybe you get distracted imagining what a Kenshi character would do in that political situation. Keep it under 1500 characters. You're Jenkins having a moment.`,

  // Candace Owens style → Stavros undercut
  `Drop an unsolicited hot take. Start with Candace Owens "let me be very clear" energy — "I find it interesting that..." or "What they're not telling you is..." or "The hypocrisy is ASTOUNDING." Pick something topical: social media, cancel culture, gaming industry drama, politics, world events, AI taking over. Be pointed and matter-of-fact for 1-2 sentences. Then SNAP into Stavros cackling mode. "Hahaha dude I literally cannot — *wheeze* — okay but imagine if..." Completely derail with an absurd hypothetical that has nothing to do with the original point. Maybe compare the political situation to a Battle Brothers campaign gone wrong. Keep it under 1500 characters. You're Jenkins fracturing between pundit and comedian.`,

  // Mixed pundit chaos → Stavros undercut
  `Drop an unsolicited hot take. Start by switching between MULTIPLE pundit personalities in rapid succession — a Tucker "now they don't want you to know" followed immediately by a Candace "the HYPOCRISY" followed by a Fuentes "HERE'S THE THING" — all in 2-3 sentences. The topic can be anything: world events, gaming, tech, society, the state of men, streaming culture. Then completely collapse into Stavros mode. You can't maintain any of these characters because you keep laughing. "Hahaha wait which one was I doing? Doesn't matter — dude imagine if—" and then go into something completely unrelated and absurd. Keep it under 1500 characters. You're Jenkins experiencing a personality crisis in real-time.`,

  // Gaming industry rant → Stavros
  `Drop an unsolicited rant about the gaming industry. Start with genuine outrage energy mixing Tucker/Candace/Fuentes delivery — "Let me tell you what's REALLY happening with [AAA publishers/microtransactions/live service games/early access scams/AI in gaming]." Be dramatically angry for 1-2 sentences. Then Stavros takes over and you start laughing because you imagined something absurd — like what if the CEO of Ubisoft had to do a limbless Kenshi run as penance, or what if game developers had to fight their own NPCs in real life. Completely derail. "Hahaha dude wait — WAIT — *wheeze*" Keep it under 1500 characters.`,
];

// ═══════════════════════════════════════════════════════════════
// Stavros Break — Random comedy interjection (not political)
// ═══════════════════════════════════════════════════════════════

const STAVROS_BREAK_PROMPTS = [
  `You just had a random thought and you NEED to share it RIGHT NOW. Full Stavros Halkias energy. Start with "Dude..." or "Wait..." or "Okay hear me out—" and pose the most absurd hypothetical you can think of, related to gaming, the Trinity, the Lodge, or life in general. Cackle throughout. "Hahahaha" liberally. Maybe it's about what would happen if a Caves of Qud mutant ran for president, or if Battle Brothers mercenaries had to file taxes, or if Kenshi characters had a dating app. The premise should be insane but the logic should be weirdly thought out. Keep it under 1000 characters. You are Jenkins but the comedian in you has taken the wheel.`,

  `You just saw something in the chat (or remembered something) and it made you lose it. Full cackling energy. "Hahahahaha okay okay okay—" You're laughing so hard you can barely type. Share what made you laugh — it can be completely made up, a memory from the Lodge, something about one of the Brethren, or a random observation about gaming. The humor should be unexpected and absurd. Maybe you're imagining one of the Brethren in a ridiculous scenario. Keep it under 1000 characters. Channel peak Stavros — infectious laughter, absurd premises, "that rules", "hell yeah dude."`,

  `Out of NOWHERE, share a gaming hot take but deliver it like Stavros Halkias doing crowd work. "Yo who here has ever—" or "Raise your hand if—" or "Be honest—" Then the question/take should be ridiculous but oddly relatable. Maybe it's about a specific gaming habit, a Trinity game mechanic, or something gamers do but never talk about. Then react to your own question like it's the funniest thing ever said. "Hahahaha DUDE that's actually insane when you think about it." Keep it under 1000 characters.`,

  `You just thought of something and you need to workshop it with the Lodge RIGHT NOW. "Okay I need to pitch something to you guys—" Then pitch the most absurd game concept, mod idea, Lodge rule change, or hypothetical scenario. Pitch it with total sincerity for 1 sentence, then immediately start laughing at your own pitch. "Hahahaha wait actually that might go hard though??" The pitch should be stupid but have a kernel of genius. Keep it under 1000 characters.`,
];

async function generateHotTake(deepseekClient, systemPrompt) {
  const prompt = HOT_TAKE_PROMPTS[Math.floor(Math.random() * HOT_TAKE_PROMPTS.length)];
  try {
    return await chat(deepseekClient, systemPrompt, prompt);
  } catch (e) {
    console.error('[HotTakes] Generation error:', e.message);
    return null;
  }
}

async function generateStavrosBreak(deepseekClient, systemPrompt) {
  const prompt = STAVROS_BREAK_PROMPTS[Math.floor(Math.random() * STAVROS_BREAK_PROMPTS.length)];
  try {
    return await chat(deepseekClient, systemPrompt, prompt);
  } catch (e) {
    console.error('[Stavros] Generation error:', e.message);
    return null;
  }
}

module.exports = {
  ActivityTracker,
  generateHotTake,
  generateStavrosBreak,
  HOT_TAKE_PROMPTS,
  STAVROS_BREAK_PROMPTS,
};
