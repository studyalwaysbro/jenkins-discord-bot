#!/usr/bin/env node
// scrape-isaac.js — Extract Binding of Isaac data from Fandom Cargo API
// ═══════════════════════════════════════════════════════════════
// Usage:
//   node scripts/scrape-isaac.js              # full extraction
//   node scripts/scrape-isaac.js --dry-run    # test API connectivity only
//
// Outputs knowledge base markdown files:
//   knowledge/isaac-items.md           — all collectibles grouped by quality
//   knowledge/isaac-trinkets.md        — all trinkets
//   knowledge/isaac-characters.md      — all characters with stats
//   knowledge/isaac-synergies.md       — synergy data for top 50 items
//   knowledge/isaac-transformations.md — transformations with required items
//
// Uses only Node.js built-in fetch. No external dependencies.

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════

const WIKI_BASE = 'https://bindingofisaacrebirth.fandom.com';
const API_URL = `${WIKI_BASE}/api.php`;
const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const PAGE_LIMIT = 500;
const RATE_LIMIT_MS = 5000;
const TOP_ITEMS_FOR_SYNERGIES = 50;
const DRY_RUN = process.argv.includes('--dry-run');

// ═══════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch a single page from the Cargo API.
 * Returns parsed JSON or throws on failure.
 */
async function cargoQuery(table, fields, opts = {}) {
  const params = new URLSearchParams({
    action: 'cargoquery',
    format: 'json',
    tables: table,
    fields: fields,
    limit: String(opts.limit || PAGE_LIMIT),
    offset: String(opts.offset || 0),
  });
  if (opts.where) params.set('where', opts.where);
  if (opts.orderBy) params.set('order_by', opts.orderBy);
  if (opts.joinOn) params.set('join_on', opts.joinOn);

  const url = `${API_URL}?${params}`;

  // Retry with exponential backoff on rate limits
  for (let attempt = 1; attempt <= 5; attempt++) {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'JenkinsBot/3.0 (IsaacKB; +https://github.com)' },
    });

    if (!resp.ok) {
      throw new Error(`Cargo API ${resp.status}: ${resp.statusText} — ${url}`);
    }
    const json = await resp.json();
    if (json.error) {
      if (json.error.code === 'ratelimited' && attempt < 5) {
        const backoff = RATE_LIMIT_MS * Math.pow(2, attempt);
        log(`    Rate limited, backing off ${(backoff/1000).toFixed(0)}s (attempt ${attempt}/5)...`);
        await sleep(backoff);
        continue;
      }
      throw new Error(`Cargo API error: ${JSON.stringify(json.error)}`);
    }
    return json;
  }
}

/**
 * Paginate through all records in a Cargo table.
 * Returns flat array of row objects.
 */
async function cargoQueryAll(table, fields, opts = {}) {
  const all = [];
  let offset = 0;
  let page = 1;

  while (true) {
    log(`  ${table} page ${page} (offset ${offset})...`);
    const json = await cargoQuery(table, fields, { ...opts, offset, limit: PAGE_LIMIT });
    const rows = (json.cargoquery || []).map(r => r.title);

    if (rows.length === 0) break;

    all.push(...rows);
    log(`  -> got ${rows.length} rows (total: ${all.length})`);

    if (rows.length < PAGE_LIMIT) break;

    offset += PAGE_LIMIT;
    page++;
    await sleep(RATE_LIMIT_MS);
  }

  return all;
}

/**
 * Fetch full wiki page content via action=parse.
 * Returns the wikitext string.
 */
async function fetchPageWikitext(pageTitle) {
  const params = new URLSearchParams({
    action: 'parse',
    format: 'json',
    page: pageTitle,
    prop: 'wikitext',
    redirects: '1',
  });

  const url = `${API_URL}?${params}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'JenkinsBot/3.0 (IsaacKB; +https://github.com)' },
  });

  if (!resp.ok) return null;

  const json = await resp.json();
  if (json.error) return null;

  return json.parse?.wikitext?.['*'] || null;
}

/**
 * Parse wikitext synergy sections into clean readable text.
 * Looks for == Synergies == or == Interactions == sections.
 */
function parseSynergies(wikitext, itemName) {
  if (!wikitext) return [];

  const synergies = [];

  // Find synergy/interaction sections
  const sectionPattern = /={2,3}\s*(Synergies|Interactions|Notable Synergies|Notes)\s*={2,3}/gi;
  let match;
  const sections = [];

  while ((match = sectionPattern.exec(wikitext)) !== null) {
    sections.push({ name: match[1], start: match.index + match[0].length });
  }

  for (let i = 0; i < sections.length; i++) {
    const start = sections[i].start;
    // End at next section header or end of text
    const nextSection = wikitext.indexOf('\n==', start + 1);
    const end = nextSection > -1 ? nextSection : wikitext.length;
    const block = wikitext.slice(start, end);

    // Parse bullet points
    const lines = block.split('\n');
    for (const line of lines) {
      const cleaned = cleanWikitext(line.trim());
      if (cleaned && cleaned.length > 10) {
        synergies.push(cleaned);
      }
    }
  }

  return synergies;
}

/**
 * Strip wikitext markup into plain text.
 */
function cleanWikitext(text) {
  return text
    // Remove file/image links
    .replace(/\[\[File:[^\]]*\]\]/gi, '')
    .replace(/\[\[Image:[^\]]*\]\]/gi, '')
    // Convert wiki links [[Page|Display]] -> Display, [[Page]] -> Page
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    // Remove templates like {{...}} (simple cases)
    .replace(/\{\{[^{}]{0,80}\}\}/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove bold/italic markup
    .replace(/'{2,5}/g, '')
    // Clean bullet markers
    .replace(/^\*+\s*/, '- ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize a field value — trim, handle empty.
 */
function val(v) {
  if (!v || v === 'nil' || v === 'null' || v === 'undefined') return '';
  return String(v).trim();
}

/**
 * Clean item/entity names that may contain wiki navigation markup.
 * e.g. "12►Lil Brimstone▼3►Lil' Brimstone" -> "Lil' Brimstone"
 * Takes the last meaningful segment after ► or ▼ markers.
 */
function cleanName(raw) {
  if (!raw) return '';
  let name = String(raw).trim();
  // If it contains ► or ▼, take the text after the last ►
  if (name.includes('►') || name.includes('▼')) {
    const parts = name.split(/[►▼]/);
    // Last part, but skip leading numbers
    name = parts[parts.length - 1].replace(/^\d+\s*/, '').trim();
  }
  return name;
}

// ═══════════════════════════════════════════════════════════════
// Data extraction functions
// ═══════════════════════════════════════════════════════════════

async function extractCollectibles() {
  log('Extracting collectibles...');
  const fields = [
    'name', 'id', 'quote', 'description', 'quality',
    'tags', 'is_activated', 'recharge', 'dlc',
  ].join(',');

  const rows = await cargoQueryAll('collectible', fields, {
    orderBy: 'CAST(quality AS INT) DESC, name ASC',
  });
  log(`Collectibles extracted: ${rows.length}`);
  return rows;
}

async function extractTrinkets() {
  log('Extracting trinkets...');
  const fields = ['name', 'id', 'quote', 'description', 'unlocked_by', 'dlc'].join(',');
  const rows = await cargoQueryAll('trinket', fields, { orderBy: 'name ASC' });
  log(`Trinkets extracted: ${rows.length}`);
  return rows;
}

async function extractPickups() {
  log('Extracting pickups (cards, runes, pills)...');
  const fields = ['name', 'id', 'type', 'quote', 'description', 'unlocked_by', 'dlc'].join(',');
  const rows = await cargoQueryAll('pickup', fields, { orderBy: 'name ASC' });
  log(`Pickups extracted: ${rows.length}`);
  return rows;
}

async function extractCharacters() {
  log('Extracting characters...');
  const fields = [
    'name', 'id', 'health', 'damage', 'tears', 'shot_speed',
    'range', 'speed', 'luck', 'description', 'collectibles', 'unlocked_by',
  ].join(',');
  const rows = await cargoQueryAll('player', fields, { orderBy: 'name ASC' });
  log(`Characters extracted: ${rows.length}`);
  return rows;
}

async function extractTransformations() {
  log('Extracting transformations...');
  const fields = ['name', 'id', 'requirement', 'target', 'description', 'items', 'dlc'].join(',');
  const rows = await cargoQueryAll('transformation', fields, { orderBy: 'name ASC' });
  log(`Transformations extracted: ${rows.length}`);
  return rows;
}

async function extractChallenges() {
  log('Extracting challenges...');
  const fields = ['name', 'number', 'character', 'health', 'items', 'trinkets', 'goal', 'unlocks'].join(',');
  const rows = await cargoQueryAll('challenge', fields, { orderBy: 'CAST(number AS INT) ASC' });
  log(`Challenges extracted: ${rows.length}`);
  return rows;
}

/**
 * For the top N items (by quality), fetch full wiki pages and parse synergies.
 */
async function extractSynergies(collectibles) {
  log(`Extracting synergies for top ${TOP_ITEMS_FOR_SYNERGIES} items...`);

  // Sort by quality descending, take top N
  const sorted = [...collectibles]
    .filter(c => val(c.quality))
    .sort((a, b) => {
      const qa = parseInt(val(a.quality)) || 0;
      const qb = parseInt(val(b.quality)) || 0;
      return qb - qa;
    })
    .slice(0, TOP_ITEMS_FOR_SYNERGIES);

  const results = [];
  let fetched = 0;

  for (const item of sorted) {
    const name = cleanName(item.name);
    if (!name) continue;

    fetched++;
    log(`  Synergy ${fetched}/${sorted.length}: ${name}`);

    await sleep(RATE_LIMIT_MS);

    const wikitext = await fetchPageWikitext(name);
    const synergies = parseSynergies(wikitext, name);

    if (synergies.length > 0) {
      results.push({
        name,
        id: val(item.id),
        quality: val(item.quality),
        synergies,
      });
      log(`    -> ${synergies.length} synergy entries`);
    } else {
      log(`    -> no synergies found`);
    }
  }

  log(`Synergies extracted for ${results.length} items`);
  return results;
}

// ═══════════════════════════════════════════════════════════════
// Markdown generation
// ═══════════════════════════════════════════════════════════════

function generateItemsMarkdown(collectibles) {
  const lines = ['category: binding-of-isaac', '', '# Binding of Isaac: Collectible Items', ''];

  // Group by quality tier
  const tiers = { '4': [], '3': [], '2': [], '1': [], '0': [], '': [] };
  const tierLabels = {
    '4': 'Quality 4 (Top Tier)',
    '3': 'Quality 3 (Great)',
    '2': 'Quality 2 (Good)',
    '1': 'Quality 1 (Below Average)',
    '0': 'Quality 0 (Terrible)',
    '': 'Quality Unknown',
  };

  for (const item of collectibles) {
    const q = val(item.quality);
    const bucket = tiers[q] !== undefined ? q : '';
    tiers[bucket].push(item);
  }

  for (const [tier, items] of Object.entries(tiers)) {
    if (items.length === 0) continue;
    lines.push(`# ${tierLabels[tier]} (${items.length} items)`, '');

    for (const item of items) {
      const name = cleanName(item.name) || 'Unknown';
      const id = val(item.id);
      const quality = val(item.quality);
      const tags = val(item.tags);
      const dlc = val(item.dlc);
      const quote = val(item.quote);
      const desc = val(item.description);
      const activated = val(item.is_activated);
      const recharge = val(item.recharge);

      lines.push(`## ${name}${id ? ` (ID: ${id})` : ''}`);

      // Metadata line
      const meta = [];
      if (quality) meta.push(`Quality: ${quality}`);
      if (tags) meta.push(`Tags: ${tags}`);
      if (dlc) meta.push(`DLC: ${dlc}`);
      if (activated === 'Yes' || activated === '1' || activated === 'true') {
        meta.push(`Active${recharge ? ` (${recharge} charges)` : ''}`);
      }
      if (meta.length) lines.push(meta.join(' | '));

      if (quote) lines.push(`"${quote}"`);
      if (desc) lines.push(cleanWikitext(desc));
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateTrindketsMarkdown(trinkets) {
  const lines = ['category: binding-of-isaac', '', '# Binding of Isaac: Trinkets', ''];

  for (const t of trinkets) {
    const name = cleanName(t.name) || 'Unknown';
    const id = val(t.id);
    const quote = val(t.quote);
    const desc = val(t.description);
    const dlc = val(t.dlc);
    const unlock = val(t.unlocked_by);

    lines.push(`## ${name}${id ? ` (ID: ${id})` : ''}`);

    const meta = [];
    if (dlc) meta.push(`DLC: ${dlc}`);
    if (unlock) meta.push(`Unlock: ${cleanWikitext(unlock)}`);
    if (meta.length) lines.push(meta.join(' | '));

    if (quote) lines.push(`"${quote}"`);
    if (desc) lines.push(cleanWikitext(desc));
    lines.push('');
  }

  return lines.join('\n');
}

function generateCharactersMarkdown(characters, challenges) {
  const lines = ['category: binding-of-isaac', '', '# Binding of Isaac: Characters', ''];

  for (const c of characters) {
    const name = cleanName(c.name) || 'Unknown';
    const id = val(c.id);
    const desc = val(c.description);
    const unlock = val(c.unlocked_by);
    const items = val(c.collectibles);

    lines.push(`## ${name}${id ? ` (ID: ${id})` : ''}`);

    // Stats block
    const stats = [];
    if (val(c.health)) stats.push(`HP: ${val(c.health)}`);
    if (val(c.damage)) stats.push(`DMG: ${val(c.damage)}`);
    if (val(c.tears)) stats.push(`Tears: ${val(c.tears)}`);
    if (val(c.shot_speed)) stats.push(`Shot Spd: ${val(c.shot_speed)}`);
    if (val(c.range)) stats.push(`Range: ${val(c.range)}`);
    if (val(c.speed)) stats.push(`Speed: ${val(c.speed)}`);
    if (val(c.luck)) stats.push(`Luck: ${val(c.luck)}`);
    if (stats.length) lines.push(`Stats: ${stats.join(' | ')}`);

    if (items) lines.push(`Starting Items: ${cleanWikitext(items)}`);
    if (unlock) lines.push(`Unlock: ${cleanWikitext(unlock)}`);
    if (desc) lines.push(cleanWikitext(desc));
    lines.push('');
  }

  // Append challenges section
  if (challenges && challenges.length > 0) {
    lines.push('---', '', '# Challenges', '');
    for (const ch of challenges) {
      const name = cleanName(ch.name) || 'Unknown';
      const num = val(ch.number);
      const char = val(ch.character);
      const hp = val(ch.health);
      const items = val(ch.items);
      const trinkets = val(ch.trinkets);
      const goal = val(ch.goal);
      const unlocks = val(ch.unlocks);

      lines.push(`## Challenge ${num ? `#${num}: ` : ''}${name}`);

      const meta = [];
      if (char) meta.push(`Character: ${char}`);
      if (hp) meta.push(`Health: ${hp}`);
      if (goal) meta.push(`Goal: ${cleanWikitext(goal)}`);
      if (meta.length) lines.push(meta.join(' | '));

      if (items) lines.push(`Items: ${cleanWikitext(items)}`);
      if (trinkets) lines.push(`Trinkets: ${cleanWikitext(trinkets)}`);
      if (unlocks) lines.push(`Unlocks: ${cleanWikitext(unlocks)}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateSynergiesMarkdown(synergies) {
  const lines = ['category: binding-of-isaac', '', '# Binding of Isaac: Item Synergies (Top 50)', ''];

  for (const item of synergies) {
    lines.push(`## ${item.name}${item.id ? ` (ID: ${item.id})` : ''}`);
    if (item.quality) lines.push(`Quality: ${item.quality}`);
    lines.push('');

    for (const syn of item.synergies) {
      lines.push(syn);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateTransformationsMarkdown(transformations) {
  const lines = ['category: binding-of-isaac', '', '# Binding of Isaac: Transformations', ''];

  for (const t of transformations) {
    const name = cleanName(t.name) || 'Unknown';
    const id = val(t.id);
    const req = val(t.requirement);
    const target = val(t.target);
    const desc = val(t.description);
    const items = val(t.items);
    const dlc = val(t.dlc);

    lines.push(`## ${name}${id ? ` (ID: ${id})` : ''}`);

    const meta = [];
    if (dlc) meta.push(`DLC: ${dlc}`);
    if (req) meta.push(`Requirement: ${cleanWikitext(req)}`);
    if (target) meta.push(`Target: ${cleanWikitext(target)}`);
    if (meta.length) lines.push(meta.join(' | '));

    if (desc) lines.push(cleanWikitext(desc));
    if (items) {
      lines.push('');
      lines.push(`Required Items: ${cleanWikitext(items)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// Dry run — test API connectivity
// ═══════════════════════════════════════════════════════════════

async function dryRun() {
  log('=== DRY RUN: Testing API connectivity ===');

  const tables = [
    { name: 'collectible', fields: 'name,id,quality' },
    { name: 'trinket', fields: 'name,id' },
    { name: 'pickup', fields: 'name,id,type' },
    { name: 'player', fields: 'name,id' },
    { name: 'transformation', fields: 'name,id' },
    { name: 'challenge', fields: 'name,number' },
  ];

  for (const t of tables) {
    try {
      const json = await cargoQuery(t.name, t.fields, { limit: 3 });
      const rows = (json.cargoquery || []).map(r => r.title);
      log(`  ${t.name}: OK (sample: ${rows.length} rows)`);
      if (rows.length > 0) {
        log(`    First: ${JSON.stringify(rows[0])}`);
      }
    } catch (err) {
      log(`  ${t.name}: FAILED — ${err.message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  // Test action=parse
  log('Testing action=parse (page: Brimstone)...');
  try {
    const wikitext = await fetchPageWikitext('Brimstone');
    if (wikitext) {
      const synergies = parseSynergies(wikitext, 'Brimstone');
      log(`  action=parse: OK (${wikitext.length} chars, ${synergies.length} synergy entries)`);
    } else {
      log('  action=parse: returned null (page may not exist)');
    }
  } catch (err) {
    log(`  action=parse: FAILED — ${err.message}`);
  }

  log('=== DRY RUN COMPLETE ===');
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  log('Binding of Isaac knowledge base extraction');
  log(`Wiki: ${WIKI_BASE}`);
  log(`Output: ${KNOWLEDGE_DIR}`);
  log(`Rate limit: ${RATE_LIMIT_MS}ms between calls`);

  if (DRY_RUN) {
    return dryRun();
  }

  // Ensure output directory exists
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }

  const start = Date.now();

  // Phase 1: Extract all table data
  log('');
  log('=== Phase 1: Cargo table extraction ===');

  const collectibles = await extractCollectibles();
  await sleep(RATE_LIMIT_MS);

  const trinkets = await extractTrinkets();
  await sleep(RATE_LIMIT_MS);

  const pickups = await extractPickups();
  await sleep(RATE_LIMIT_MS);

  const characters = await extractCharacters();
  await sleep(RATE_LIMIT_MS);

  const transformations = await extractTransformations();
  await sleep(RATE_LIMIT_MS);

  const challenges = await extractChallenges();
  await sleep(RATE_LIMIT_MS);

  // Phase 2: Synergies for top items
  log('');
  log('=== Phase 2: Synergy extraction (top items) ===');

  const synergies = await extractSynergies(collectibles);

  // Phase 3: Generate and write markdown files
  log('');
  log('=== Phase 3: Generating knowledge base files ===');

  const outputs = [
    {
      file: 'isaac-items.md',
      content: generateItemsMarkdown(collectibles),
      desc: 'collectibles',
    },
    {
      file: 'isaac-trinkets.md',
      content: generateTrindketsMarkdown(trinkets),
      desc: 'trinkets',
    },
    {
      file: 'isaac-characters.md',
      content: generateCharactersMarkdown(characters, challenges),
      desc: 'characters + challenges',
    },
    {
      file: 'isaac-synergies.md',
      content: generateSynergiesMarkdown(synergies),
      desc: 'synergies',
    },
    {
      file: 'isaac-transformations.md',
      content: generateTransformationsMarkdown(transformations),
      desc: 'transformations',
    },
  ];

  for (const out of outputs) {
    const filepath = path.join(KNOWLEDGE_DIR, out.file);
    fs.writeFileSync(filepath, out.content, 'utf8');
    const sizeKb = (Buffer.byteLength(out.content, 'utf8') / 1024).toFixed(1);
    log(`  Wrote ${out.file} (${sizeKb} KB) — ${out.desc}`);
  }

  // Summary
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log('');
  log('=== Extraction Complete ===');
  log(`  Collectibles: ${collectibles.length}`);
  log(`  Trinkets:     ${trinkets.length}`);
  log(`  Pickups:      ${pickups.length}`);
  log(`  Characters:   ${characters.length}`);
  log(`  Challenges:   ${challenges.length}`);
  log(`  Transforms:   ${transformations.length}`);
  log(`  Synergies:    ${synergies.length} items with synergy data`);
  log(`  Time:         ${elapsed}s`);
  log(`  Files:        ${outputs.length} written to ${KNOWLEDGE_DIR}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
