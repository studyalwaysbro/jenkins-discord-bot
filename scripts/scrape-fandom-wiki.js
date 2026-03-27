#!/usr/bin/env node

/**
 * Generic Fandom MediaWiki Scraper
 *
 * Extracts content from any Fandom wiki via the MediaWiki API
 * and outputs clean markdown files for the Jenkins knowledge base.
 *
 * Supports two modes:
 *   --cargo <table>     Cargo query for structured data
 *   --category <name>   All pages in a wiki category
 *
 * Usage:
 *   node scripts/scrape-fandom-wiki.js --wiki <url> --cargo <table> --output <path> --category-name <name>
 *   node scripts/scrape-fandom-wiki.js --wiki <url> --category <name> --output <path> --category-name <name>
 *
 * Examples:
 *   node scripts/scrape-fandom-wiki.js --wiki https://bindingofisaacrebirth.fandom.com --cargo collectible --output knowledge/isaac-items.md --category-name isaac
 *   node scripts/scrape-fandom-wiki.js --wiki https://7daystodie.fandom.com --category Items --output knowledge/7dtd-items.md --category-name 7-days-to-die
 *   node scripts/scrape-fandom-wiki.js --wiki https://barotrauma.fandom.com --category Items --output knowledge/barotrauma-items.md --category-name barotrauma
 *
 * Options:
 *   --wiki <url>            Fandom wiki base URL (required)
 *   --cargo <table>         Cargo table name for structured query mode
 *   --category <name>       Wiki category name for page listing mode
 *   --output <path>         Output file path (required)
 *   --category-name <name>  Category tag for knowledge base header (required)
 *   --fields <f1,f2,...>    Cargo fields to query (default: _pageName,description)
 *   --limit <n>             Max pages to fetch per batch (default: 500, max 500)
 *   --delay <ms>            Delay between requests in ms (default: 1500)
 *   --max-pages <n>         Max total pages to fetch (default: unlimited)
 *   --dry-run               Show what would be fetched without writing
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    wiki: null,
    cargo: null,
    category: null,
    output: null,
    categoryName: null,
    fields: '_pageName,description',
    limit: 500,
    delay: 1500,
    maxPages: Infinity,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--wiki':        opts.wiki = args[++i]; break;
      case '--cargo':       opts.cargo = args[++i]; break;
      case '--category':    opts.category = args[++i]; break;
      case '--output':      opts.output = args[++i]; break;
      case '--category-name': opts.categoryName = args[++i]; break;
      case '--fields':      opts.fields = args[++i]; break;
      case '--limit':       opts.limit = Math.min(500, parseInt(args[++i], 10)); break;
      case '--delay':       opts.delay = parseInt(args[++i], 10); break;
      case '--max-pages':   opts.maxPages = parseInt(args[++i], 10); break;
      case '--dry-run':     opts.dryRun = true; break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  // Validation
  if (!opts.wiki) {
    console.error('Error: --wiki <url> is required');
    process.exit(1);
  }
  if (!opts.cargo && !opts.category) {
    console.error('Error: either --cargo <table> or --category <name> is required');
    process.exit(1);
  }
  if (opts.cargo && opts.category) {
    console.error('Error: use --cargo or --category, not both');
    process.exit(1);
  }
  if (!opts.output) {
    console.error('Error: --output <path> is required');
    process.exit(1);
  }
  if (!opts.categoryName) {
    console.error('Error: --category-name <name> is required');
    process.exit(1);
  }

  // Normalize wiki URL (strip trailing slash)
  opts.wiki = opts.wiki.replace(/\/+$/, '');

  return opts;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJSON(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'JenkinsBot-WikiScraper/1.0 (educational; +https://github.com)',
          'Accept': 'application/json',
        },
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
        console.warn(`  Rate limited, waiting ${retryAfter}s (attempt ${attempt}/${retries})`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        throw new Error(`Failed after ${retries} attempts: ${err.message}`);
      }
      const backoff = attempt * 2000;
      console.warn(`  Request failed (attempt ${attempt}/${retries}): ${err.message}, retrying in ${backoff}ms...`);
      await sleep(backoff);
    }
  }
}

// ---------------------------------------------------------------------------
// Wiki markup cleaning
// ---------------------------------------------------------------------------

function cleanWikiText(text) {
  if (!text) return '';

  let clean = text;

  // Remove <ref>...</ref> and <ref .../> tags
  clean = clean.replace(/<ref[^>]*\/>/gi, '');
  clean = clean.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');

  // Remove HTML comments
  clean = clean.replace(/<!--[\s\S]*?-->/g, '');

  // Remove <gallery>...</gallery>
  clean = clean.replace(/<gallery[^>]*>[\s\S]*?<\/gallery>/gi, '');

  // Remove {{#invoke:...}} parser functions
  clean = clean.replace(/\{\{#invoke:[^}]*\}\}/g, '');

  // Handle infobox and complex templates: remove multi-line templates with pipes
  // This catches {{Infobox\n|field=val\n|field=val\n}}
  clean = clean.replace(/\{\{[^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*\}\}/g, (match) => {
    // If it contains newlines and pipes, it's likely an infobox - remove it
    if (match.includes('\n') && match.includes('|')) return '';
    // Simple inline templates - try to extract useful text
    const inner = match.slice(2, -2);
    const parts = inner.split('|');
    // For templates like {{Color|red|text}}, return the last part
    if (parts.length > 1) return parts[parts.length - 1].trim();
    return '';
  });

  // Second pass for remaining nested templates
  clean = clean.replace(/\{\{[^{}]*\}\}/g, (match) => {
    const inner = match.slice(2, -2);
    const parts = inner.split('|');
    if (parts.length > 1) return parts[parts.length - 1].trim();
    return '';
  });

  // Convert [[File:...|...]] and [[Image:...]] to empty (remove images)
  clean = clean.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '');

  // Convert [[Category:...]] to empty
  clean = clean.replace(/\[\[Category:[^\]]*\]\]/gi, '');

  // Convert [[link|display text]] to display text
  clean = clean.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1');

  // Convert [url display text] external links to display text
  clean = clean.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1');
  clean = clean.replace(/\[https?:\/\/[^\]]+\]/g, '');

  // Remove remaining HTML tags but keep content
  clean = clean.replace(/<\/?[^>]+>/g, '');

  // Clean up bold/italic wiki markup
  clean = clean.replace(/'{2,5}/g, '');

  // Remove __TOC__, __NOTOC__, etc.
  clean = clean.replace(/__[A-Z]+__/g, '');

  // Convert wiki headings to markdown
  clean = clean.replace(/^======\s*(.+?)\s*======/gm, '###### $1');
  clean = clean.replace(/^=====\s*(.+?)\s*=====/gm, '##### $1');
  clean = clean.replace(/^====\s*(.+?)\s*====/gm, '#### $1');
  clean = clean.replace(/^===\s*(.+?)\s*===/gm, '### $1');
  clean = clean.replace(/^==\s*(.+?)\s*==/gm, '### $1');

  // Convert wiki bullet lists
  clean = clean.replace(/^\*\*\*/gm, '    - ');
  clean = clean.replace(/^\*\*/gm, '  - ');
  clean = clean.replace(/^\*/gm, '- ');

  // Convert wiki numbered lists
  clean = clean.replace(/^###/gm, '    1. ');
  clean = clean.replace(/^##/gm, '  1. ');
  clean = clean.replace(/^#([^#])/gm, '1. $1');

  // Clean up excess whitespace
  clean = clean.replace(/\n{3,}/g, '\n\n');
  clean = clean.replace(/[ \t]+$/gm, '');

  return clean.trim();
}

// ---------------------------------------------------------------------------
// MediaWiki API: Cargo mode
// ---------------------------------------------------------------------------

async function fetchCargoPages(opts) {
  const pages = [];
  let offset = 0;

  console.log(`[cargo] Querying table "${opts.cargo}" with fields: ${opts.fields}`);

  while (pages.length < opts.maxPages) {
    const params = new URLSearchParams({
      action: 'cargoquery',
      format: 'json',
      tables: opts.cargo,
      fields: opts.fields,
      limit: String(opts.limit),
      offset: String(offset),
    });

    const url = `${opts.wiki}/api.php?${params}`;
    console.log(`  Fetching offset=${offset} ...`);

    const data = await fetchJSON(url);

    if (!data.cargoquery || data.cargoquery.length === 0) {
      console.log('  No more results.');
      break;
    }

    for (const item of data.cargoquery) {
      const row = item.title;
      pages.push({
        title: row._pageName || row.Name || row.name || 'Unknown',
        data: row,
      });
    }

    console.log(`  Got ${data.cargoquery.length} results (total: ${pages.length})`);

    if (data.cargoquery.length < opts.limit) break;

    offset += opts.limit;
    await sleep(opts.delay);
  }

  return pages;
}

// ---------------------------------------------------------------------------
// MediaWiki API: Category mode
// ---------------------------------------------------------------------------

async function fetchCategoryPageList(opts) {
  const pageTitles = [];
  let cmcontinue = null;

  console.log(`[category] Listing pages in "Category:${opts.category}"`);

  while (pageTitles.length < opts.maxPages) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'categorymembers',
      cmtitle: `Category:${opts.category}`,
      cmtype: 'page',
      cmlimit: String(opts.limit),
    });
    if (cmcontinue) params.set('cmcontinue', cmcontinue);

    const url = `${opts.wiki}/api.php?${params}`;
    console.log(`  Fetching page list (have ${pageTitles.length} so far) ...`);

    const data = await fetchJSON(url);

    if (!data.query || !data.query.categorymembers) {
      console.log('  No results in category.');
      break;
    }

    for (const member of data.query.categorymembers) {
      pageTitles.push(member.title);
    }

    console.log(`  Got ${data.query.categorymembers.length} titles (total: ${pageTitles.length})`);

    if (data.continue && data.continue.cmcontinue) {
      cmcontinue = data.continue.cmcontinue;
    } else {
      break;
    }

    await sleep(opts.delay);
  }

  return pageTitles.slice(0, opts.maxPages);
}

async function fetchPageContent(wikiUrl, title, delay) {
  const params = new URLSearchParams({
    action: 'parse',
    format: 'json',
    page: title,
    prop: 'wikitext',
    redirects: '1',
  });

  const url = `${wikiUrl}/api.php?${params}`;
  const data = await fetchJSON(url);

  if (data.error) {
    console.warn(`  Warning: Could not fetch "${title}": ${data.error.info}`);
    return null;
  }

  const wikitext = data.parse?.wikitext?.['*'] || '';
  return {
    title: data.parse?.title || title,
    content: wikitext,
  };
}

async function fetchCategoryPages(opts) {
  const titles = await fetchCategoryPageList(opts);
  console.log(`\n[content] Fetching content for ${titles.length} pages...`);

  const pages = [];
  let fetched = 0;

  for (const title of titles) {
    fetched++;
    if (fetched % 10 === 0 || fetched === 1) {
      console.log(`  Fetching page ${fetched}/${titles.length}: ${title}`);
    }

    const page = await fetchPageContent(opts.wiki, title, opts.delay);
    if (page && page.content) {
      pages.push(page);
    }

    await sleep(opts.delay);
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function formatCargoOutput(pages, categoryName) {
  const lines = [`category: ${categoryName}`, ''];

  for (const page of pages) {
    lines.push(`## ${page.title}`);

    // Build a readable summary from cargo data fields
    const fields = page.data;
    const parts = [];

    for (const [key, value] of Object.entries(fields)) {
      if (key.startsWith('_')) continue; // skip internal fields
      if (!value || value === 'NULL' || value === '') continue;

      const cleanValue = cleanWikiText(String(value));
      if (!cleanValue) continue;

      // Format nicely
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
      parts.push(`**${label}**: ${cleanValue}`);
    }

    if (parts.length > 0) {
      lines.push(parts.join('\n'));
    } else {
      lines.push('No description available.');
    }

    lines.push('');
  }

  return lines.join('\n');
}

function formatCategoryOutput(pages, categoryName) {
  const lines = [`category: ${categoryName}`, ''];

  for (const page of pages) {
    lines.push(`## ${page.title}`);
    const cleaned = cleanWikiText(page.content);

    // Truncate extremely long pages to keep knowledge files reasonable
    const MAX_CHARS_PER_PAGE = 3000;
    if (cleaned.length > MAX_CHARS_PER_PAGE) {
      // Take the first portion, try to break at a paragraph boundary
      let truncated = cleaned.slice(0, MAX_CHARS_PER_PAGE);
      const lastParagraph = truncated.lastIndexOf('\n\n');
      if (lastParagraph > MAX_CHARS_PER_PAGE * 0.5) {
        truncated = truncated.slice(0, lastParagraph);
      }
      lines.push(truncated);
    } else {
      lines.push(cleaned);
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  console.log('=== Fandom Wiki Scraper ===');
  console.log(`Wiki:     ${opts.wiki}`);
  console.log(`Mode:     ${opts.cargo ? 'cargo (' + opts.cargo + ')' : 'category (' + opts.category + ')'}`);
  console.log(`Output:   ${opts.output}`);
  console.log(`Category: ${opts.categoryName}`);
  console.log(`Delay:    ${opts.delay}ms`);
  if (opts.maxPages < Infinity) console.log(`Max pages: ${opts.maxPages}`);
  console.log('');

  let pages;
  let output;

  if (opts.cargo) {
    pages = await fetchCargoPages(opts);
    console.log(`\nFetched ${pages.length} cargo entries.`);

    if (opts.dryRun) {
      console.log('\n[dry-run] Would write the following pages:');
      for (const p of pages.slice(0, 20)) {
        console.log(`  - ${p.title}`);
      }
      if (pages.length > 20) console.log(`  ... and ${pages.length - 20} more`);
      return;
    }

    output = formatCargoOutput(pages, opts.categoryName);
  } else {
    pages = await fetchCategoryPages(opts);
    console.log(`\nFetched content for ${pages.length} pages.`);

    if (opts.dryRun) {
      console.log('\n[dry-run] Would write the following pages:');
      for (const p of pages.slice(0, 20)) {
        console.log(`  - ${p.title}`);
      }
      if (pages.length > 20) console.log(`  ... and ${pages.length - 20} more`);
      return;
    }

    output = formatCategoryOutput(pages, opts.categoryName);
  }

  // Ensure output directory exists
  const outDir = path.dirname(opts.output);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(opts.output, output, 'utf-8');

  const stats = {
    pages: pages.length,
    bytes: Buffer.byteLength(output, 'utf-8'),
  };

  console.log(`\nDone! Wrote ${stats.pages} entries to ${opts.output} (${(stats.bytes / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
});
