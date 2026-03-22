// ═══════════════════════════════════════════════════════════════
//  GAME NIGHT ENGINE — Scheduled gaming events for the server
//  "Court is in recess. Game night is in session."
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const log = require('./logger').child('GameNight');

const DATA_FILE = path.join(__dirname, 'data', 'game-nights.json');

// Nick's game library (co-op and competitive)
const GAME_LIBRARY = [
  { name: 'Helldivers 2', players: '2-4', genre: 'Co-op Shooter', emoji: '🪖' },
  { name: 'Risk of Rain 2', players: '1-4', genre: 'Roguelike', emoji: '🌧️' },
  { name: 'Pummel Party', players: '2-8', genre: 'Party', emoji: '🎉' },
  { name: 'Hunt Showdown', players: '2-3', genre: 'Extraction', emoji: '🤠' },
  { name: 'It Takes Two', players: '2', genre: 'Co-op', emoji: '👫' },
  { name: 'Gunfire Reborn', players: '1-4', genre: 'Roguelike FPS', emoji: '🔫' },
  { name: 'The Outlast Trials', players: '1-4', genre: 'Horror', emoji: '😱' },
  { name: 'Chained Together', players: '2-4', genre: 'Co-op', emoji: '⛓️' },
  { name: 'Squad', players: '50v50', genre: 'Tactical FPS', emoji: '🎖️' },
  { name: 'Brawlhalla', players: '2-8', genre: 'Fighting', emoji: '⚔️' },
  { name: 'CS2', players: '5v5', genre: 'Competitive FPS', emoji: '💣' },
  { name: 'PUBG', players: '1-4', genre: 'Battle Royale', emoji: '🍳' },
  { name: 'BattleBit', players: 'Massive', genre: 'FPS', emoji: '🔫' },
  { name: 'Delta Force', players: 'Multi', genre: 'Tactical FPS', emoji: '🪂' },
  { name: 'Marvel Rivals', players: '6v6', genre: 'Hero Shooter', emoji: '🦸' },
  { name: 'Rust', players: 'Massive', genre: 'Survival', emoji: '🏚️' },
  { name: 'DayZ', players: 'Massive', genre: 'Survival', emoji: '🧟' },
  { name: 'Total War Warhammer III', players: '2-8', genre: 'Strategy', emoji: '🏰' },
  { name: 'EU4', players: '2-8', genre: 'Grand Strategy', emoji: '🗺️' },
  { name: 'Hearts of Iron IV', players: '2-32', genre: 'Grand Strategy', emoji: '⚙️' },
  { name: 'Terraria', players: '1-8', genre: 'Sandbox', emoji: '⛏️' },
  { name: 'Stardew Valley', players: '1-4', genre: 'Farming', emoji: '🌾' },
  { name: 'Elden Ring', players: '1-4', genre: 'Action RPG', emoji: '💍' },
  { name: 'Monster Hunter Wilds', players: '1-4', genre: 'Action RPG', emoji: '🐲' },
  { name: 'Path of Exile 2', players: '1-6', genre: 'ARPG', emoji: '⚡' },
  { name: 'HELLCARD', players: '1-3', genre: 'Roguelike Card', emoji: '🃏' },
  { name: 'Northgard', players: '2-6', genre: 'RTS', emoji: '🛡️' },
  { name: 'Dragon Ball Sparking Zero', players: '1v1', genre: 'Fighting', emoji: '🐉' },
  { name: 'Noita', players: '1', genre: 'Roguelike', emoji: '🧙' },
  { name: 'Slay the Spire 2', players: '1', genre: 'Roguelike Deckbuilder', emoji: '🃏' },
  { name: 'Barotrauma', players: '2-16', genre: 'Co-op Survival', emoji: '🚢' },
  { name: 'Kenshi', players: '1', genre: 'Open World RPG', emoji: '🏜️' },
  { name: 'Caves of Qud', players: '1', genre: 'Roguelike', emoji: '🧬' },
  { name: 'Battle Brothers', players: '1', genre: 'Tactical RPG', emoji: '⚔️' },
  { name: 'Among Us', players: '4-15', genre: 'Social Deduction', emoji: '📮' },
  { name: 'Lethal Company', players: '1-4', genre: 'Horror Co-op', emoji: '👻' },
  { name: 'Palworld', players: '1-32', genre: 'Survival', emoji: '🐾' },
  { name: 'Valheim', players: '1-10', genre: 'Survival', emoji: '🪓' },
  { name: 'Deep Rock Galactic', players: '1-4', genre: 'Co-op Shooter', emoji: '⛏️' },
  { name: 'Jackbox', players: '3-8', genre: 'Party', emoji: '🎭' },
  { name: 'Gartic Phone', players: '4-30', genre: 'Party', emoji: '📞' },
];

// Fuzzy game matching — handles partial names, typos, abbreviations
function findGame(query) {
  const q = query.toLowerCase().trim();
  // Exact match first
  let match = GAME_LIBRARY.find(g => g.name.toLowerCase() === q);
  if (match) return match;
  // Starts with
  match = GAME_LIBRARY.find(g => g.name.toLowerCase().startsWith(q));
  if (match) return match;
  // Contains
  match = GAME_LIBRARY.find(g => g.name.toLowerCase().includes(q));
  if (match) return match;
  // Reverse contains (query contains game name — e.g. "slay the spire 2 stuff" contains "slay the spire 2")
  match = GAME_LIBRARY.find(g => q.includes(g.name.toLowerCase()));
  if (match) return match;
  return null;
}

// Time keywords that signal the start of a time expression
const TIME_KEYWORDS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'tomorrow', 'tonight', 'today'];

// Split "Slay the Spire 2 friday 8pm" into { gameName: "Slay the Spire 2", timeStr: "friday 8pm" }
function splitGameAndTime(fullArgs) {
  const lower = fullArgs.toLowerCase();

  // Strategy: find where the time expression starts
  // Time expressions start with: a day name, "tomorrow", "tonight", "today",
  // or a bare time like "8pm" / "10:30pm" — but NOT a number that's part of a game name

  // Check for day keyword
  for (const keyword of TIME_KEYWORDS) {
    const idx = lower.indexOf(keyword);
    if (idx > 0) {
      return {
        gameName: fullArgs.substring(0, idx).trim(),
        timeStr: fullArgs.substring(idx).trim(),
      };
    }
  }

  // Check for date pattern like "3/25 7pm"
  const datePattern = /\s(\d{1,2}\/\d{1,2}\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))/i;
  const dateMatch = fullArgs.match(datePattern);
  if (dateMatch) {
    return {
      gameName: fullArgs.substring(0, dateMatch.index).trim(),
      timeStr: dateMatch[1].trim(),
    };
  }

  // Check for bare time at the END: "8pm", "10:30pm" — only if it's the last token
  const bareTimeEnd = fullArgs.match(/\s(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*$/i);
  if (bareTimeEnd) {
    const gamePart = fullArgs.substring(0, bareTimeEnd.index).trim();
    // Make sure we're not eating a number that's part of the game name
    // e.g. "Helldivers 2" — "2" alone doesn't have am/pm so it won't match
    if (gamePart.length > 0) {
      return {
        gameName: gamePart,
        timeStr: bareTimeEnd[1].trim(),
      };
    }
  }

  // No time found
  return { gameName: fullArgs, timeStr: null };
}

// Parse time strings like "friday 8pm", "tomorrow 9pm", "3/25 7:30pm", "8pm"
function parseTime(timeStr) {
  const now = new Date();
  const str = timeStr.toLowerCase().trim();

  const timeMatch = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2] || '0');
  const ampm = timeMatch[3].toLowerCase();

  if (ampm === 'pm' && hours !== 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;

  const date = new Date(now);

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayMatch = str.match(new RegExp(`(${days.join('|')})`, 'i'));
  const tomorrowMatch = str.match(/tomorrow/i);
  const dateMatch = str.match(/(\d{1,2})\/(\d{1,2})/);

  if (dayMatch) {
    const targetDay = days.indexOf(dayMatch[1].toLowerCase());
    let diff = targetDay - now.getDay();
    if (diff <= 0) diff += 7;
    date.setDate(date.getDate() + diff);
  } else if (tomorrowMatch) {
    date.setDate(date.getDate() + 1);
  } else if (dateMatch) {
    date.setMonth(parseInt(dateMatch[1]) - 1);
    date.setDate(parseInt(dateMatch[2]));
    if (date < now) date.setFullYear(date.getFullYear() + 1);
  } else {
    const testDate = new Date(date);
    testDate.setHours(hours, minutes, 0, 0);
    if (testDate < now) date.setDate(date.getDate() + 1);
  }

  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatTime(date) {
  const d = new Date(date);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const mStr = m > 0 ? `:${String(m).padStart(2, '0')}` : '';
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}, ${h12}${mStr} ${ampm} ET`;
}

function timeUntil(date) {
  const diff = new Date(date) - Date.now();
  if (diff <= 0) return 'NOW';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Build a visual bar for voting
function voteBar(votes, totalVoters, width = 16) {
  if (totalVoters === 0) return '░'.repeat(width) + ' 0%';
  const pct = votes / totalVoters;
  const filled = Math.round(pct * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return `${bar} ${Math.round(pct * 100)}% (${votes})`;
}

// ── Schedule Poll Helpers ──

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Parse "8pm" or "8:30pm" into 24h hour number
function parseHour(str) {
  const m = str.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const ampm = m[3].toLowerCase();
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h;
}

// Format 24h hour to display string
function formatHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}${ampm}`;
}

// Parse day range: "fri-sun" or "friday-sunday" or "fri,sat,sun"
function parseDays(str) {
  const s = str.toLowerCase().trim();

  // Range: "fri-sun"
  const rangeMatch = s.match(/^(\w+)\s*-\s*(\w+)$/);
  if (rangeMatch) {
    const startIdx = DAY_NAMES.findIndex(d => d.startsWith(rangeMatch[1]));
    const endIdx = DAY_NAMES.findIndex(d => d.startsWith(rangeMatch[2]));
    if (startIdx === -1 || endIdx === -1) return null;
    const days = [];
    let i = startIdx;
    while (true) {
      days.push(i);
      if (i === endIdx) break;
      i = (i + 1) % 7;
      if (days.length > 7) break; // safety
    }
    return days;
  }

  // Comma-separated: "fri, sat, sun" or "friday, saturday"
  const parts = s.split(/[,\s]+/).filter(p => p);
  const days = parts.map(p => DAY_NAMES.findIndex(d => d.startsWith(p))).filter(d => d !== -1);
  return days.length > 0 ? days : null;
}

// Generate time slots from day indices + hour range
function generateSlots(dayIndices, startHour, endHour) {
  const now = new Date();
  const slots = [];

  for (const dayIdx of dayIndices) {
    for (let h = startHour; h <= endHour; h++) {
      // Calculate the actual date for this day
      const date = new Date(now);
      let diff = dayIdx - now.getDay();
      if (diff < 0) diff += 7;
      if (diff === 0 && h <= now.getHours()) diff += 7; // same day but past = next week
      date.setDate(date.getDate() + diff);
      date.setHours(h, 0, 0, 0);

      slots.push({
        label: `${DAY_SHORT[dayIdx]} ${formatHour(h)}`,
        day: dayIdx,
        hour: h,
        date: date.toISOString(),
      });
    }
  }
  return slots;
}

class GameNight {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) {}
    return { upcoming: [], history: [], idCounter: 0 };
  }

  save() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
    } catch (e) { log.error({ err: e }, 'Save error'); }
  }

  // Single-game event
  create(game, hostId, timeStr) {
    this.data.idCounter++;
    const id = `GN-${String(this.data.idCounter).padStart(3, '0')}`;
    const gameInfo = findGame(game);

    let scheduledAt = null;
    if (timeStr) {
      scheduledAt = parseTime(timeStr);
      if (!scheduledAt) {
        return {
          error: true,
          message: 'Couldn\'t parse that time. Try: `friday 8pm`, `tomorrow 9pm`, `8pm`, or `3/25 7:30pm`',
        };
      }
    }

    const event = {
      id,
      game: gameInfo ? gameInfo.name : game,
      emoji: gameInfo ? gameInfo.emoji : '🎮',
      players: gameInfo ? gameInfo.players : 'Any',
      genre: gameInfo ? gameInfo.genre : 'Custom',
      host: hostId,
      signups: [hostId],
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
      createdAt: new Date().toISOString(),
      status: 'open',
      // Multi-game voting (null for single-game events)
      options: null,
      votes: null,
    };

    this.data.upcoming.push(event);
    this.save();
    return event;
  }

  // Multi-game event: !gn vote "game1 | game2 | game3" friday 8pm
  createVote(gameNames, hostId, timeStr) {
    this.data.idCounter++;
    const id = `GN-${String(this.data.idCounter).padStart(3, '0')}`;

    let scheduledAt = null;
    if (timeStr) {
      scheduledAt = parseTime(timeStr);
      if (!scheduledAt) {
        return {
          error: true,
          message: 'Couldn\'t parse that time. Try: `friday 8pm`, `tomorrow 9pm`, `8pm`, or `3/25 7:30pm`',
        };
      }
    }

    const options = gameNames.map(name => {
      const info = findGame(name.trim());
      return {
        name: info ? info.name : name.trim(),
        emoji: info ? info.emoji : '🎮',
        players: info ? info.players : 'Any',
        genre: info ? info.genre : 'Custom',
      };
    });

    const event = {
      id,
      game: 'VOTE IN PROGRESS',
      emoji: '🗳️',
      players: 'TBD',
      genre: 'Vote',
      host: hostId,
      signups: [hostId],
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
      createdAt: new Date().toISOString(),
      status: 'open',
      options,
      votes: {}, // userId -> optionIndex
    };

    this.data.upcoming.push(event);
    this.save();
    return event;
  }

  // Schedule poll: !gn when "Rust" fri-sun 8pm-11pm
  createSchedulePoll(game, hostId, dayStr, timeRange) {
    const dayIndices = parseDays(dayStr);
    if (!dayIndices || dayIndices.length === 0) {
      return { error: true, message: 'Couldn\'t parse days. Try: `fri-sun`, `fri,sat,sun`, `thursday-saturday`' };
    }

    const timeParts = timeRange.split('-').map(t => t.trim());
    if (timeParts.length !== 2) {
      return { error: true, message: 'Time range needs start-end. Try: `8pm-11pm`, `7pm-12am`' };
    }
    const startHour = parseHour(timeParts[0]);
    const endHour = parseHour(timeParts[1]);
    if (startHour === null || endHour === null) {
      return { error: true, message: 'Couldn\'t parse time range. Try: `8pm-11pm`, `7pm-12am`' };
    }

    const slots = generateSlots(dayIndices, startHour, endHour);
    if (slots.length === 0) {
      return { error: true, message: 'No slots generated. Check your range.' };
    }
    if (slots.length > 28) {
      return { error: true, message: `That's ${slots.length} slots — max 28. Narrow the range.` };
    }

    this.data.idCounter++;
    const id = `GN-${String(this.data.idCounter).padStart(3, '0')}`;
    const gameInfo = findGame(game);

    const event = {
      id,
      game: gameInfo ? gameInfo.name : game,
      emoji: gameInfo ? gameInfo.emoji : '🎮',
      players: gameInfo ? gameInfo.players : 'Any',
      genre: gameInfo ? gameInfo.genre : 'Custom',
      host: hostId,
      signups: [hostId],
      scheduledAt: null,
      createdAt: new Date().toISOString(),
      status: 'open',
      options: null,
      votes: null,
      // Schedule poll data
      schedule: {
        slots,
        votes: {}, // userId -> [slotIndex, slotIndex, ...]
      },
    };

    this.data.upcoming.push(event);
    this.save();
    return event;
  }

  // Vote on schedule slots (multi-select)
  scheduleVote(eventId, slotIndices, userId) {
    const event = this.data.upcoming.find(e => e.id === eventId);
    if (!event) return { success: false, message: 'Event not found.' };
    if (!event.schedule) return { success: false, message: 'This isn\'t a schedule poll.' };

    const maxSlot = event.schedule.slots.length;
    const valid = slotIndices.filter(i => i >= 1 && i <= maxSlot).map(i => i - 1);
    if (valid.length === 0) {
      return { success: false, message: `Pick slots 1-${maxSlot}. You can pick multiple: \`!when ${eventId} 1 3 5 7\`` };
    }

    event.schedule.votes[userId] = valid;
    if (!event.signups.includes(userId)) event.signups.push(userId);
    this.save();

    const slotNames = valid.map(i => event.schedule.slots[i].label).join(', ');
    return { success: true, event, slotNames };
  }

  // Lock schedule poll — pick the slot with most votes
  lockSchedule(eventId, userId) {
    const event = this.data.upcoming.find(e => e.id === eventId);
    if (!event) return { success: false, message: 'Event not found.' };
    if (!event.schedule) return { success: false, message: 'Not a schedule poll.' };
    if (event.host !== userId) return { success: false, message: 'Only the host can lock the schedule.' };

    const slotCounts = new Array(event.schedule.slots.length).fill(0);
    for (const indices of Object.values(event.schedule.votes)) {
      for (const idx of indices) {
        slotCounts[idx]++;
      }
    }

    const winnerIdx = slotCounts.indexOf(Math.max(...slotCounts));
    const winnerSlot = event.schedule.slots[winnerIdx];

    event.scheduledAt = winnerSlot.date;
    event.schedule.locked = true;
    this.save();

    return { success: true, event, winner: winnerSlot.label, votes: slotCounts[winnerIdx] };
  }

  // Build schedule poll embed
  schedulePollEmbed(event, guild) {
    const host = guild.members.cache.get(event.host);
    const signupNames = event.signups.map(id => {
      const m = guild.members.cache.get(id);
      return m ? m.displayName : 'Unknown';
    });

    const embed = new EmbedBuilder()
      .setColor(0x00D4FF)
      .setTitle(`📅 WHEN CAN YOU PLAY: ${event.game}`)
      .setDescription(`*Vote for ALL times that work for you!*\n\`!when ${event.id} 1 3 5 7\` (pick multiple)`);

    // Group slots by day
    const totalVoters = Object.keys(event.schedule.votes).length;
    const slotCounts = new Array(event.schedule.slots.length).fill(0);
    for (const indices of Object.values(event.schedule.votes)) {
      for (const idx of indices) {
        slotCounts[idx]++;
      }
    }

    // Find the best slot for highlighting
    const maxVotes = Math.max(...slotCounts, 0);

    let currentDay = -1;
    let dayLines = [];
    let fieldName = '';

    const flushDay = () => {
      if (dayLines.length > 0 && fieldName) {
        embed.addFields({ name: fieldName, value: dayLines.join('\n'), inline: false });
        dayLines = [];
      }
    };

    event.schedule.slots.forEach((slot, i) => {
      if (slot.day !== currentDay) {
        flushDay();
        currentDay = slot.day;
        fieldName = `📆 ${DAY_NAMES[slot.day].charAt(0).toUpperCase() + DAY_NAMES[slot.day].slice(1)}`;
      }
      const count = slotCounts[i];
      const highlight = count > 0 && count === maxVotes ? ' ⭐' : '';
      dayLines.push(`\`${String(i + 1).padStart(2)}\` ${formatHour(slot.hour)} ${voteBar(count, totalVoters, 10)}${highlight}`);
    });
    flushDay();

    embed.addFields(
      { name: 'Host', value: host?.displayName || 'Unknown', inline: true },
      { name: 'Voters', value: `${totalVoters}`, inline: true },
      { name: 'Event ID', value: `\`${event.id}\``, inline: true },
      { name: `Signed Up (${event.signups.length})`, value: signupNames.join(', ') || 'No one yet', inline: false },
    );

    embed.setFooter({ text: `!when ${event.id} 1 3 5 ... | !gn lock ${event.id} to pick winner` });
    return embed;
  }

  // Cast a vote on a multi-game event
  vote(eventId, optionIndex, userId) {
    const event = this.data.upcoming.find(e => e.id === eventId);
    if (!event) return { success: false, message: 'Event not found.' };
    if (!event.options) return { success: false, message: 'This isn\'t a vote event. Use `!signup` instead.' };
    if (optionIndex < 1 || optionIndex > event.options.length) {
      return { success: false, message: `Pick 1-${event.options.length}.` };
    }

    event.votes[userId] = optionIndex - 1;
    // Auto-signup if not already
    if (!event.signups.includes(userId)) {
      event.signups.push(userId);
    }
    this.save();

    return { success: true, event, voted: event.options[optionIndex - 1].name };
  }

  // Lock in the winner of a vote (game vote OR schedule poll)
  lockVote(eventId, userId) {
    const event = this.data.upcoming.find(e => e.id === eventId);
    if (!event) return { success: false, message: 'Event not found.' };
    if (event.host !== userId) return { success: false, message: 'Only the host can lock.' };

    // Delegate to schedule lock if it's a schedule poll
    if (event.schedule && !event.schedule.locked) {
      return this.lockSchedule(eventId, userId);
    }

    if (!event.options) return { success: false, message: 'Not a vote event.' };

    // Count votes
    const counts = new Array(event.options.length).fill(0);
    for (const optIdx of Object.values(event.votes)) {
      counts[optIdx]++;
    }

    const winnerIdx = counts.indexOf(Math.max(...counts));
    const winner = event.options[winnerIdx];

    // Convert to a normal single-game event
    event.game = winner.name;
    event.emoji = winner.emoji;
    event.players = winner.players;
    event.genre = winner.genre;
    // Keep options/votes for history but mark as locked
    event.voteLocked = true;

    this.save();
    return { success: true, event, winner: winner.name, counts };
  }

  signup(eventId, userId) {
    const event = this.data.upcoming.find(e => e.id === eventId);
    if (!event) return { success: false, message: 'Game night not found.' };
    if (event.signups.includes(userId)) return { success: false, message: 'You\'re already signed up!' };
    event.signups.push(userId);
    this.save();
    return { success: true, event };
  }

  leave(eventId, userId) {
    const event = this.data.upcoming.find(e => e.id === eventId);
    if (!event) return { success: false, message: 'Game night not found.' };
    event.signups = event.signups.filter(id => id !== userId);
    if (event.votes) delete event.votes[userId];
    this.save();
    return { success: true, event };
  }

  cancel(eventId, userId) {
    const idx = this.data.upcoming.findIndex(e => e.id === eventId);
    if (idx === -1) return { success: false, message: 'Not found.' };
    const event = this.data.upcoming[idx];
    if (event.host !== userId) return { success: false, message: 'Only the host can cancel.' };
    this.data.upcoming.splice(idx, 1);
    this.save();
    return { success: true };
  }

  listUpcoming() {
    return this.data.upcoming
      .filter(e => e.status === 'open')
      .sort((a, b) => {
        if (a.scheduledAt && b.scheduledAt) return new Date(a.scheduledAt) - new Date(b.scheduledAt);
        if (a.scheduledAt) return -1;
        if (b.scheduledAt) return 1;
        return 0;
      });
  }

  getUpcomingSoon(timeframeMs = 3600000) {
    const now = Date.now();
    return this.data.upcoming.filter(e => {
      if (!e.scheduledAt || e.status !== 'open') return false;
      const diff = new Date(e.scheduledAt) - now;
      return diff > 0 && diff <= timeframeMs;
    });
  }

  getStarted() {
    const now = Date.now();
    return this.data.upcoming.filter(e => {
      if (!e.scheduledAt || e.status !== 'open') return false;
      return new Date(e.scheduledAt) <= now;
    });
  }

  complete(eventId) {
    const idx = this.data.upcoming.findIndex(e => e.id === eventId);
    if (idx === -1) return;
    const event = this.data.upcoming[idx];
    event.status = 'completed';
    this.data.history.push(event);
    this.data.upcoming.splice(idx, 1);
    this.save();
  }

  eventEmbed(event, guild) {
    // Schedule poll gets its own embed
    if (event.schedule && !event.schedule.locked) {
      return this.schedulePollEmbed(event, guild);
    }

    const host = guild.members.cache.get(event.host);
    const signupNames = event.signups.map(id => {
      const m = guild.members.cache.get(id);
      return m ? m.displayName : 'Unknown';
    });

    const embed = new EmbedBuilder()
      .setColor(event.options && !event.voteLocked ? 0x9B59B6 : 0xFF6B35)
      .setTitle(`${event.emoji} GAME NIGHT: ${event.game}`)
      .setDescription(event.options && !event.voteLocked
        ? `*"The Lodge cannot decide. Cast your vote, Brethren."*`
        : `*"Court is in recess. Game night is in session."*`);

    // Vote mode: show options with bar graphs
    if (event.options && !event.voteLocked) {
      const counts = new Array(event.options.length).fill(0);
      for (const optIdx of Object.values(event.votes || {})) {
        counts[optIdx]++;
      }
      const totalVotes = Object.keys(event.votes || {}).length;

      const optionLines = event.options.map((opt, i) => {
        return `**${i + 1}.** ${opt.emoji} ${opt.name} (${opt.genre})\n${voteBar(counts[i], totalVotes)}`;
      });

      embed.addFields({
        name: `🗳️ Vote — ${totalVotes} vote${totalVotes !== 1 ? 's' : ''} cast`,
        value: optionLines.join('\n\n'),
        inline: false,
      });
    } else {
      embed.addFields(
        { name: 'Game', value: event.game, inline: true },
        { name: 'Genre', value: event.genre, inline: true },
        { name: 'Players', value: event.players, inline: true },
      );
    }

    embed.addFields(
      { name: 'Host', value: host ? host.displayName : 'Unknown', inline: true },
      { name: 'Event ID', value: `\`${event.id}\``, inline: true },
    );

    if (event.scheduledAt) {
      embed.addFields(
        { name: 'When', value: `**${formatTime(event.scheduledAt)}**\n(${timeUntil(event.scheduledAt)})`, inline: true },
      );
    } else {
      embed.addFields({ name: 'When', value: '*Not scheduled — `!gn time <ID> <time>`*', inline: true });
    }

    embed.addFields(
      { name: `Signed Up (${event.signups.length})`, value: signupNames.join(', ') || 'No one yet', inline: false },
    );

    if (event.options && !event.voteLocked) {
      embed.setFooter({ text: `!vote ${event.id} <#> to vote | !gn lock ${event.id} to pick winner` });
    } else {
      embed.setFooter({ text: `!signup ${event.id} to join | !gn time ${event.id} friday 8pm` });
    }

    return embed;
  }

  reminderEmbed(event, guild) {
    const signupMentions = event.signups.map(id => `<@${id}>`).join(' ');
    return new EmbedBuilder()
      .setColor(0xFF4500)
      .setTitle(`${event.emoji} GAME NIGHT STARTING SOON: ${event.game}`)
      .setDescription(`**${formatTime(event.scheduledAt)}** — that's **${timeUntil(event.scheduledAt)}** from now!\n\n${signupMentions}\n\nGet in voice! The Lodge demands your presence.`)
      .setFooter({ text: 'The Architect does not tolerate no-shows.' });
  }

  setTime(eventId, userId, timeStr) {
    const event = this.data.upcoming.find(e => e.id === eventId);
    if (!event) return { success: false, message: 'Event not found.' };
    if (event.host !== userId) return { success: false, message: 'Only the host can set the time.' };

    const scheduledAt = parseTime(timeStr);
    if (!scheduledAt) {
      return { success: false, message: 'Couldn\'t parse that time. Try: `friday 8pm`, `tomorrow 9pm`, `8pm`, `3/25 7:30pm`' };
    }

    event.scheduledAt = scheduledAt.toISOString();
    this.save();
    return { success: true, event, formattedTime: formatTime(scheduledAt) };
  }

  gamesEmbed() {
    const genres = {};
    for (const game of GAME_LIBRARY) {
      if (!genres[game.genre]) genres[game.genre] = [];
      genres[game.genre].push(`${game.emoji} ${game.name} (${game.players})`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🎮 Game Library — Pass The Torch')
      .setDescription([
        'Use `!gn <game> [time]` to host a single game:',
        '`!gn Helldivers 2 friday 8pm`',
        '',
        'Use `!gn vote "game1 | game2 | game3" [time]` to let people vote:',
        '`!gn vote "Rust | CS2 | Helldivers 2" saturday 9pm`',
      ].join('\n'));

    for (const [genre, games] of Object.entries(genres)) {
      embed.addFields({ name: genre, value: games.join('\n'), inline: true });
    }

    return embed;
  }
}

module.exports = { GameNight, splitGameAndTime, GAME_LIBRARY };
