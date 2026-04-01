// knowledge.js — RAG Knowledge Base for Jenkins
// ═══════════════════════════════════════════════════════════════
// SQLite FTS5 full-text search over game guides, lore, server rules.
// Chunks are loaded from markdown files in knowledge/ directory.
// Retrieved chunks are injected into the system prompt for context.

const fs = require('fs');
const path = require('path');
const { db } = require('./db');
const log = require('./logger').child('Knowledge');

const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');
const MAX_CONTEXT_CHARS = 1500; // Max chars to inject into prompt
const MAX_RESULTS = 5;

// ═══════════════════════════════════════════════════════════════
// Schema — FTS5 virtual table for full-text search
// ═══════════════════════════════════════════════════════════════

db.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    loaded_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// FTS5 index (separate from main table, linked by rowid)
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
    title, content, category,
    content='knowledge_chunks',
    content_rowid='id',
    tokenize='porter unicode61'
  );
`);

// Triggers to keep FTS in sync with main table
db.exec(`
  CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge_chunks BEGIN
    INSERT INTO knowledge_fts(rowid, title, content, category)
    VALUES (new.id, new.title, new.content, new.category);
  END;
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge_chunks BEGIN
    INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, category)
    VALUES ('delete', old.id, old.title, old.content, old.category);
  END;
`);

// ═══════════════════════════════════════════════════════════════
// Prepared Statements
// ═══════════════════════════════════════════════════════════════

const stmtSearch = db.prepare(`
  SELECT kc.id, kc.source, kc.category, kc.title, kc.content,
         rank
  FROM knowledge_fts kf
  JOIN knowledge_chunks kc ON kc.id = kf.rowid
  WHERE knowledge_fts MATCH ?
  ORDER BY rank
  LIMIT ?
`);

const stmtInsert = db.prepare(`
  INSERT INTO knowledge_chunks (source, category, title, content)
  VALUES (?, ?, ?, ?)
`);

const stmtClearSource = db.prepare(`
  DELETE FROM knowledge_chunks WHERE source = ?
`);

const stmtCount = db.prepare(`
  SELECT COUNT(*) as count FROM knowledge_chunks
`);

const stmtCountBySource = db.prepare(`
  SELECT source, COUNT(*) as count FROM knowledge_chunks GROUP BY source
`);

// ═══════════════════════════════════════════════════════════════
// Markdown Loader — parse knowledge/*.md into chunks
// ═══════════════════════════════════════════════════════════════

/**
 * Parse a markdown file into chunks.
 * Splits on ## headers. Each section becomes a chunk.
 * Frontmatter-style metadata: first line starting with `category:` sets the category.
 *
 * Format:
 * ```
 * category: games
 *
 * ## Section Title
 * Content here...
 *
 * ## Another Section
 * More content...
 * ```
 */
function parseMarkdown(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const chunks = [];

  let category = 'general';
  let currentTitle = '';
  let currentContent = [];
  let started = false;

  for (const line of lines) {
    // Parse category from top of file
    if (!started && line.startsWith('category:')) {
      category = line.replace('category:', '').trim();
      continue;
    }

    // New section on ## header
    if (line.startsWith('## ')) {
      // Flush previous section
      if (currentTitle && currentContent.length > 0) {
        chunks.push({
          title: currentTitle,
          content: currentContent.join('\n').trim(),
          category,
        });
      }
      currentTitle = line.replace(/^##\s*/, '').trim();
      currentContent = [];
      started = true;
      continue;
    }

    if (started) {
      currentContent.push(line);
    }
  }

  // Flush last section
  if (currentTitle && currentContent.length > 0) {
    chunks.push({
      title: currentTitle,
      content: currentContent.join('\n').trim(),
      category,
    });
  }

  return chunks;
}

/**
 * Load all markdown files from knowledge/ directory into the database.
 * Clears and reloads each file's chunks on every startup for freshness.
 */
function loadAllKnowledge() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    log.warn('No knowledge/ directory found');
    return 0;
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md'));
  let totalChunks = 0;

  const insertMany = db.transaction((source, chunks) => {
    stmtClearSource.run(source);
    for (const chunk of chunks) {
      stmtInsert.run(source, chunk.category, chunk.title, chunk.content);
    }
  });

  for (const file of files) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    try {
      const chunks = parseMarkdown(filePath);
      if (chunks.length > 0) {
        insertMany(file, chunks);
        totalChunks += chunks.length;
        log.debug({ file, chunks: chunks.length }, 'Knowledge loaded');
      }
    } catch (err) {
      log.warn({ file, err }, 'Failed to load knowledge file');
    }
  }

  const total = stmtCount.get().count;
  log.info({ files: files.length, chunks: totalChunks, total }, 'Knowledge base loaded');
  return totalChunks;
}

// ═══════════════════════════════════════════════════════════════
// Search & Retrieval
// ═══════════════════════════════════════════════════════════════

/**
 * Search the knowledge base.
 * @param {string} query - Search query (natural language)
 * @param {number} [limit=5] - Max results
 * @returns {Array<{title: string, content: string, category: string, source: string}>}
 */
function search(query, limit = MAX_RESULTS) {
  if (!query || query.trim().length < 2) return [];

  // Clean query for FTS5: remove special chars, wrap words for prefix matching
  const cleaned = query
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1)
    .map(w => `"${w}"*`)
    .join(' OR ');

  if (!cleaned) return [];

  try {
    return stmtSearch.all(cleaned, limit);
  } catch (err) {
    // FTS5 can throw on malformed queries — fall back to simple LIKE
    log.debug({ query, err: err.message }, 'FTS5 search failed, trying LIKE fallback');
    try {
      const likeQuery = `%${query.trim()}%`;
      return db.prepare(`
        SELECT id, source, category, title, content
        FROM knowledge_chunks
        WHERE content LIKE ? OR title LIKE ?
        LIMIT ?
      `).all(likeQuery, likeQuery, limit);
    } catch {
      return [];
    }
  }
}

/**
 * Build a context injection string from search results.
 * Suitable for prepending to a user message or appending to system prompt.
 * @param {string} query - The user's question
 * @returns {string} Context string or empty string
 */
function getContext(query) {
  const results = search(query, 3);
  if (results.length === 0) return '';

  let context = '\n\n[KNOWLEDGE BASE — relevant context for this conversation]\n';
  let chars = context.length;

  for (const r of results) {
    const entry = `\n**${r.title}** (${r.category}):\n${r.content}\n`;
    if (chars + entry.length > MAX_CONTEXT_CHARS) break;
    context += entry;
    chars += entry.length;
  }

  return context;
}

/**
 * Get stats about the knowledge base.
 */
function getStats() {
  const total = stmtCount.get().count;
  const bySource = stmtCountBySource.all();
  return { total, bySource };
}

// ═══════════════════════════════════════════════════════════════
// Initialize on import
// ═══════════════════════════════════════════════════════════════

loadAllKnowledge();

module.exports = { search, getContext, getStats, loadAllKnowledge };
