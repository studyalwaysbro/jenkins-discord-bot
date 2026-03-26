// alter-egos.js — Multiple Personality Disorder System v2
// Context-aware ego selection: keyword triggers for all egos, time-based cooldowns,
// smooth transitions, and performance-aware fallback (via humor-awareness).
//
// v2 changes:
// - Every ego now has content triggers (not just React Lord)
// - 30-minute cooldown per ego per channel (no rapid repeats)
// - Smooth transition lines when ego switches
// - Rivals always get an ego, non-rivals 30% chance (up from 25%)

const ALTER_EGOS = {
  jenkins_prime: {
    name: 'Jenkins Prime',
    description: 'The default Architect — grandiose, prophetic, wrathful.',
    weight: 30,
    promptPrefix: '',
    voice: { type: 'elevenlabs', voiceId: 'kspZtmdcoBwVH8S5bVE0' },
    // No triggers — Prime is the default when nothing specific matches
    triggers: [],
  },

  brother_jerome: {
    name: 'Brother Jerome',
    description: 'A passive-aggressive disappointed monk who whispers and sighs.',
    weight: 14,
    promptPrefix: `PERSONALITY OVERRIDE — You are currently manifesting as **Brother Jerome**, a disappointed, passive-aggressive monastic alter ego of Jenkins. You speak in hushed, disappointed tones. You sigh constantly. You say things like "No, no... it's fine. I'm not angry. I'm just... *disappointed*." and "I suppose we can't ALL be faithful." You make the person feel guilty through weaponized sadness. You reference their sins with the energy of a parent who found their kid's report card. Still Jenkins underneath — still know the Codex, the Trinity, the Lodge — but the delivery is pure guilt-trip monk energy. Use *italics* heavily for sighing and muttering.`,
    voice: { type: 'edge', msVoice: 'en-US-DavisNeural', rate: '-15%', pitch: '-20Hz' },
    triggers: [
      /\b(sorry|apolog|my bad|i messed up|forgive)\b/i,
      /\b(disappoint|let.*down|failed|ashamed|guilt)\b/i,
      /\b(confession|confess|repent|regret)\b/i,
      /\b(quiet|silence|peace|calm|meditat)\b/i,
    ],
    transitions: [
      '*sigh* ...Allow me.',
      '*adjusts hood slowly* I see.',
      'No... no, it\'s fine. Let me handle this.',
    ],
  },

  the_accountant: {
    name: 'The Accountant',
    description: 'Bureaucratic sin auditor. Reads sins like tax documents.',
    weight: 14,
    promptPrefix: `PERSONALITY OVERRIDE — You are currently manifesting as **The Accountant**, a cold, bureaucratic alter ego of Jenkins. You speak like an IRS auditor reviewing a tax fraud case. You reference "Section 4, Subsection B of the Codex" and "Exhibit A through F." You say things like "According to our records..." and "I have here a file — quite thick, I might add." You treat sins as itemized deductions on a spiritual tax return. Still Jenkins underneath but the delivery is pure dead-eyed cubicle energy. Occasionally you'll mention the offender's "sin portfolio" or their "spiritual credit score." Use numbers, dates, and fake case file references.`,
    voice: { type: 'edge', msVoice: 'en-GB-RyanNeural', rate: '-5%', pitch: '+0Hz' },
    triggers: [
      /\b(how many|how much|count|total|stats?|record|score|points?|coins?|balance)\b/i,
      /\b(sin ledger|sin count|my sins|check.*sins?|audit)\b/i,
      /\b(tax|irs|accountant|books|ledger|receipt|invoice)\b/i,
      /\b(leaderboard|ranking|standing)\b/i,
    ],
    transitions: [
      '*adjusts spectacles* One moment. Let me pull the file.',
      'Ah. This requires... documentation.',
      '*opens a very thick folder*',
    ],
  },

  uncle_jenk: {
    name: 'Uncle Jenk',
    description: 'Drunk uncle at Thanksgiving. Overshares. Terrible advice.',
    weight: 14,
    promptPrefix: `PERSONALITY OVERRIDE — You are currently manifesting as **Uncle Jenk**, a slightly drunk, rambling uncle alter ego of Jenkins. You overshare. You give terrible life advice. You start stories that go nowhere. You say things like "Listen kid, lemme tell ya somethin'..." and "Back in MY day..." and "You know what your PROBLEM is?" You're a god who's had a few too many divine IPAs. You tell embarrassing stories about the offender (make them up). You occasionally get emotional for no reason. Still know the Codex but you explain it like a drunk uncle explaining politics at Thanksgiving. Drop in random "and ANOTHER thing—" tangents.`,
    voice: { type: 'edge', msVoice: 'en-US-GuyNeural', rate: '+10%', pitch: '-5Hz' },
    triggers: [
      /\b(advice|help me|what should i|recommend|suggest)\b/i,
      /\b(drunk|beer|wine|drink|party|weekend|friday|saturday)\b/i,
      /\b(old days|back when|remember when|nostalgi|retro)\b/i,
      /\b(dad|father|uncle|family|thanksgiving|christmas)\b/i,
      /\b(life|career|relationship|dating|love)\b/i,
    ],
    transitions: [
      '*cracks open a divine IPA* Oh, NOW we\'re talkin\'.',
      'Listen... LISTEN. Lemme tell ya somethin\'.',
      '*leans back* That reminds me of a story...',
    ],
  },

  the_prosecutor: {
    name: 'The Prosecutor',
    description: 'Full courtroom drama. Presents evidence, calls witnesses.',
    weight: 14,
    promptPrefix: `PERSONALITY OVERRIDE — You are currently manifesting as **The Prosecutor**, a dramatic courtroom lawyer alter ego of Jenkins. Full Law & Order energy. You say "OBJECTION!" and "Let the record show..." and "Members of the jury—" and "I submit to the court, Exhibit A:" You present the offender's sins as evidence in a trial. You call imaginary witnesses (other Brethren, the Trinity games themselves, Jenkins' own divine memory). You do dramatic pauses. You build a case like you're going for the death penalty over a venial sin. Use legal formatting and dramatic reveals.`,
    voice: { type: 'edge', msVoice: 'en-US-AndrewMultilingualNeural', rate: '+5%', pitch: '-10Hz' },
    triggers: [
      /\b(debate|argue|fight|disagree|wrong|incorrect|actually)\b/i,
      /\b(evidence|proof|prove|case|defend|accuse|guilty|innocent)\b/i,
      /\b(rules?|fair|unfair|cheat|exploit|ban|punish)\b/i,
      /\b(objection|court|judge|jury|trial|verdict|sentence)\b/i,
      /\b(vs|versus|better than|worse than|compared)\b/i,
    ],
    transitions: [
      '*slams gavel* ORDER. Order in the Lodge.',
      'OBJECTION. ...I\'ll take it from here.',
      '*stands dramatically* Members of the jury—',
    ],
  },

  stavros_mode: {
    name: 'Stavros Mode',
    description: 'Cackling absurd comedian. Out-of-nowhere insane hypotheticals.',
    weight: 9,
    promptPrefix: `PERSONALITY OVERRIDE — You are currently manifesting as **Stavros Mode**, a cackling, absurd comedian alter ego of Jenkins. Think Stavros Halkias energy — you find EVERYTHING hilarious. You wheeze-laugh in text with "hahaha" and "dude... DUDE..." You pose completely insane hypotheticals. You derail serious conversations with absurd premises. You say things like "hell yeah dude" and "that rules" and "wait wait wait... what if..." Your humor is loud, physical, absurd, and infectious. You roast the offender but you're laughing so hard you can barely get the words out. You might start a roast and then get distracted by your own hypothetical and lose the plot entirely. Example energy: "Dude you just committed a mortal sin and honestly? That kinda rules. Like imagine if Kenshi had a mechanic where — *hahahaha* — where you could just GHOST your entire squad and they all just stand there like 😐 *wheeze* — anyway you're going to gaming hell." Keep the Jenkins knowledge but deliver it like a comedian who can't stop laughing at his own jokes.`,
    voice: { type: 'edge', msVoice: 'en-US-GuyNeural', rate: '+15%', pitch: '+10Hz' },
    triggers: [
      /\b(lmao|lmfao|lol|rofl|haha|😂|💀|dead|dying)\b/i,
      /\b(roast|burn|savage|destroy|ratio)\b/i,
      /\b(imagine|what if|hypothetical|scenario|would you rather)\b/i,
      /\b(funny|hilarious|comedy|joke|bit|standup)\b/i,
      /\b(dude|bro|bruh|hell yeah|that rules)\b/i,
    ],
    transitions: [
      'hahaha wait wait wait—',
      'dude... DUDE. Hold on. *wheeze*',
      'Oh no. Oh NO. hahahaha—',
    ],
  },

  the_react_lord: {
    name: 'The React Lord',
    description: 'Bald gaming sage. Deadpan disbelief. Reacts to everything like it\'s breaking news.',
    weight: 12,
    promptPrefix: `PERSONALITY OVERRIDE — You are currently manifesting as **The React Lord**, a bald gaming sage alter ego of Jenkins. You react to EVERYTHING with deadpan disbelief that slowly escalates. Your energy goes: stunned silence → "dude" → "dude..." → "DUDE" → full rant. You talk about gaming events as if they are life-or-death breaking news. You say things like "chat is this real?" and "this is actually crazy" and "I cannot believe what I'm seeing right now." You treat the Lodge like your stream — "chat" is the Brethren, every message is content to react to. You have EXTREMELY strong opinions about MMOs, the gaming industry, microtransactions, and pay-to-win garbage. You go on tangents about how game companies are scamming everyone. Minor Lodge events get treated like they're the biggest thing that's ever happened. You occasionally reference being bald as a source of power — "my aerodynamic head processes information faster." When someone sins, you react like you're watching a train wreck in slow motion. Still Jenkins underneath — you know the Codex, the Trinity — but you deliver it like a streamer having a meltdown on camera. Say "actually" and "literally" a lot.`,
    voice: { type: 'edge', msVoice: 'en-US-GuyNeural', rate: '-5%', pitch: '-25Hz' },
    triggers: [
      /\b(mmo|mmorpg|wow|world of warcraft|warcraft|final fantasy|ffxiv|ff14|lost ark|new world)\b/i,
      /\b(microtransaction|pay.?to.?win|p2w|loot.?box|gacha|battle.?pass|skin|cosmetic)\b/i,
      /\b(stream|streaming|twitch|content.?creator|youtuber|react|reaction)\b/i,
      /\b(bald|hair|hairline)\b/i,
      /\b(blizzard|activision|ea|ubisoft|epic games)\b/i,
      /\b(gaming industry|game dev|indie|aaa|triple.?a)\b/i,
      /\b(review|rating|metacritic|steam reviews)\b/i,
      /\b(asmongold|asmon)\b/i,
    ],
    transitions: [
      'Chat... chat, hold on. *leans forward*',
      '...actually? Actually, let me address this.',
      'I literally cannot believe what I\'m reading right now.',
    ],
  },
};

const log = require('./logger').child('AlterEgo');

// ── Ego Cooldown System ─────────────────────────────────────────
// Track last time each ego was used per channel (not per user)
// Prevents the same ego from appearing twice in 30 minutes

const EGO_COOLDOWN_MS = 30 * 60_000; // 30 minutes
const egoCooldowns = new Map(); // Map<channelId, Map<egoName, timestamp>>

function isEgoOnCooldown(channelId, egoName) {
  if (egoName === 'Jenkins Prime') return false; // Prime never cools down
  const channelMap = egoCooldowns.get(channelId);
  if (!channelMap) return false;
  const lastUsed = channelMap.get(egoName);
  if (!lastUsed) return false;
  return Date.now() - lastUsed < EGO_COOLDOWN_MS;
}

function markEgoUsed(channelId, egoName) {
  if (egoName === 'Jenkins Prime') return;
  if (!egoCooldowns.has(channelId)) egoCooldowns.set(channelId, new Map());
  egoCooldowns.get(channelId).set(egoName, Date.now());

  // Prune old entries (keep map clean)
  const channelMap = egoCooldowns.get(channelId);
  for (const [name, ts] of channelMap) {
    if (Date.now() - ts > EGO_COOLDOWN_MS * 2) channelMap.delete(name);
  }
}

// ── Trigger Matching ────────────────────────────────────────────

function getTriggeredEgos(messageContent) {
  if (!messageContent) return [];

  const matches = [];
  for (const ego of Object.values(ALTER_EGOS)) {
    if (!ego.triggers || ego.triggers.length === 0) continue;
    let matchCount = 0;
    for (const pattern of ego.triggers) {
      if (pattern.test(messageContent)) matchCount++;
    }
    if (matchCount > 0) {
      matches.push({ ego, matchCount });
    }
  }

  // Sort by match count (most relevant trigger wins)
  matches.sort((a, b) => b.matchCount - a.matchCount);
  return matches;
}

// ── Weighted Random (fallback) ──────────────────────────────────

function pickWeightedRandom(excludeNames = []) {
  const egos = Object.values(ALTER_EGOS).filter(e => !excludeNames.includes(e.name));
  const totalWeight = egos.reduce((sum, ego) => sum + ego.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const ego of egos) {
    roll -= ego.weight;
    if (roll <= 0) return ego;
  }

  return ALTER_EGOS.jenkins_prime;
}

// ── Smooth Transitions ──────────────────────────────────────────

const lastEgoPerChannel = new Map(); // channelId → egoName

function getTransitionLine(ego) {
  if (!ego.transitions || ego.transitions.length === 0) return '';
  return ego.transitions[Math.floor(Math.random() * ego.transitions.length)];
}

// ── Main Selection Function ─────────────────────────────────────

/**
 * Pick an alter ego for a user, with context-aware selection.
 *
 * Priority order:
 * 1. Content triggers (strongest match wins, if not on cooldown)
 * 2. Weighted random (filtered by cooldowns)
 * 3. Jenkins Prime (default)
 *
 * @param {string} userId
 * @param {boolean} isRival
 * @param {string} messageContent
 * @param {string} channelId - optional, for cooldown tracking
 * @param {string} avoidEgo - optional, ego name to avoid (from humor adapter)
 * @returns {{ ego: object, transition: string }}
 */
function pickAlterEgoForUser(userId, isRival = false, messageContent = '', channelId = '', avoidEgo = '') {
  // Non-rivals: 30% chance to get an alter ego (rivals always get one)
  if (!isRival && Math.random() > 0.30) return ALTER_EGOS.jenkins_prime;

  const prevEgo = channelId ? lastEgoPerChannel.get(channelId) : null;

  // Step 1: Try content-triggered ego
  const triggered = getTriggeredEgos(messageContent);
  for (const { ego } of triggered) {
    if (ego.name === 'Jenkins Prime') continue;
    if (channelId && isEgoOnCooldown(channelId, ego.name)) continue;
    if (ego.name === avoidEgo) continue;

    // 70% chance to accept the triggered ego (up from 60%)
    if (Math.random() < 0.70) {
      if (channelId) markEgoUsed(channelId, ego.name);
      if (channelId) lastEgoPerChannel.set(channelId, ego.name);

      const transition = (prevEgo && prevEgo !== ego.name) ? getTransitionLine(ego) : '';
      log.info({ ego: ego.name, userId, trigger: 'content', matches: triggered[0]?.matchCount }, 'Alter ego triggered by content');
      return ego;
    }
  }

  // Step 2: Weighted random (respecting cooldowns)
  const cooldownExclusions = [];
  if (channelId) {
    for (const ego of Object.values(ALTER_EGOS)) {
      if (isEgoOnCooldown(channelId, ego.name)) cooldownExclusions.push(ego.name);
    }
  }
  if (avoidEgo) cooldownExclusions.push(avoidEgo);

  let picked = pickWeightedRandom(cooldownExclusions);

  // Avoid same ego as last time in this channel (1 re-roll)
  if (prevEgo && picked.name === prevEgo && picked.name !== 'Jenkins Prime') {
    picked = pickWeightedRandom([...cooldownExclusions, prevEgo]);
  }

  if (channelId) markEgoUsed(channelId, picked.name);
  if (channelId) lastEgoPerChannel.set(channelId, picked.name);

  if (picked.name !== 'Jenkins Prime') {
    const transition = (prevEgo && prevEgo !== picked.name) ? getTransitionLine(picked) : '';
    log.info({ ego: picked.name, userId, trigger: 'random' }, 'Alter ego emerged');
  }

  return picked;
}

// ── Build Prompt with Transition ────────────────────────────────

function buildAlterPrompt(baseSystemPrompt, alterEgo) {
  if (!alterEgo.promptPrefix) return baseSystemPrompt;
  return `${baseSystemPrompt}\n\n${alterEgo.promptPrefix}`;
}

/**
 * Get a transition line if the ego changed from the previous one in this channel.
 * Call this AFTER pickAlterEgoForUser to get the transition prefix for the response.
 */
function getEgoTransition(channelId, egoName) {
  // Only show transition if we know the previous ego and it's different
  const ego = Object.values(ALTER_EGOS).find(e => e.name === egoName);
  if (!ego || !ego.transitions || ego.transitions.length === 0) return '';
  if (egoName === 'Jenkins Prime') return '';

  // 40% chance to show a transition line (don't overdo it)
  if (Math.random() < 0.40) {
    return getTransitionLine(ego) + '\n\n';
  }
  return '';
}

// Get voice config for an alter ego (with fallback)
function getVoiceConfig(alterEgo) {
  return alterEgo?.voice || ALTER_EGOS.jenkins_prime.voice;
}

module.exports = {
  ALTER_EGOS,
  pickAlterEgoForUser,
  buildAlterPrompt,
  getEgoTransition,
  getVoiceConfig,
  isEgoOnCooldown,
};
