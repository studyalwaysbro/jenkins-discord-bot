// math-rag.js — Vector-based RAG for Mathematics Textbooks
// ═══════════════════════════════════════════════════════════════
// Semantic search over embedded textbook chunks using SQLite.
// Embeddings computed externally (via ingest script), stored as
// JSON-encoded float arrays. Cosine similarity computed in JS.
//
// Lightweight: no vector DB server, no local embedding model.
// Just SQLite on disk + a small JS search module.
//
// Usage:
//   const { search } = require('./math-rag');
//   const results = await search('eigenvalue decomposition', 5);
//
// Ingest new content:
//   node scripts/ingest-math.js --source textbook.pdf --subject "linear-algebra"

const path = require('path');
const { db } = require('./db');
const log = require('./logger').child('MathRAG');

// ═══════════════════════════════════════════════════════════════
// Schema — chunks + embeddings in SQLite
// ═══════════════════════════════════════════════════════════════

db.exec(`
  CREATE TABLE IF NOT EXISTS math_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    subject TEXT NOT NULL,
    section TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT,
    token_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_math_chunks_subject ON math_chunks(subject);
`);

// Also create FTS5 for hybrid search (keyword + semantic)
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS math_fts USING fts5(
    section, content, subject,
    content='math_chunks',
    content_rowid='id',
    tokenize='porter unicode61'
  );
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS math_ai AFTER INSERT ON math_chunks BEGIN
    INSERT INTO math_fts(rowid, section, content, subject)
    VALUES (new.id, new.section, new.content, new.subject);
  END;
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS math_ad AFTER DELETE ON math_chunks BEGIN
    INSERT INTO math_fts(math_fts, rowid, section, content, subject)
    VALUES ('delete', old.id, old.section, old.content, old.subject);
  END;
`);

// ═══════════════════════════════════════════════════════════════
// Prepared Statements
// ═══════════════════════════════════════════════════════════════

const stmtInsert = db.prepare(`
  INSERT INTO math_chunks (source, subject, section, content, embedding, token_count)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const stmtGetAll = db.prepare(`
  SELECT id, subject, section, content, embedding FROM math_chunks WHERE embedding IS NOT NULL
`);

const stmtFtsSearch = db.prepare(`
  SELECT mc.id, mc.source, mc.subject, mc.section, mc.content, rank
  FROM math_fts mf
  JOIN math_chunks mc ON mc.id = mf.rowid
  WHERE math_fts MATCH ?
  ORDER BY rank
  LIMIT ?
`);

const stmtCount = db.prepare(`SELECT COUNT(*) as count FROM math_chunks`);
const stmtCountBySubject = db.prepare(`SELECT subject, COUNT(*) as count FROM math_chunks GROUP BY subject`);
const stmtClearSource = db.prepare(`DELETE FROM math_chunks WHERE source = ?`);

// ═══════════════════════════════════════════════════════════════
// Cosine Similarity
// ═══════════════════════════════════════════════════════════════

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ═══════════════════════════════════════════════════════════════
// Search — Hybrid: FTS5 keyword + cosine similarity
// ═══════════════════════════════════════════════════════════════

/**
 * Search math knowledge base. Uses FTS5 keyword search.
 * When embeddings are available, also does semantic search and merges results.
 *
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 5)
 * @param {number[]} [queryEmbedding] - Optional pre-computed query embedding for semantic search
 * @returns {Array<{subject, section, content, score}>}
 */
function search(query, limit = 5, queryEmbedding = null) {
  const results = new Map(); // id -> {subject, section, content, score}

  // 1. FTS5 keyword search
  try {
    const cleaned = query.replace(/[^\w\s]/g, ' ').trim();
    if (cleaned.length >= 2) {
      const ftsResults = stmtFtsSearch.all(cleaned, limit * 2);
      for (const r of ftsResults) {
        results.set(r.id, {
          subject: r.subject,
          section: r.section,
          content: r.content,
          score: Math.abs(r.rank) * 0.5, // normalize FTS rank
        });
      }
    }
  } catch (e) {
    log.warn({ err: e.message }, 'FTS search failed, falling back to semantic only');
  }

  // 2. Semantic search (if query embedding provided)
  if (queryEmbedding) {
    try {
      const allChunks = stmtGetAll.all();
      const scored = allChunks.map(chunk => {
        const emb = JSON.parse(chunk.embedding);
        return {
          id: chunk.id,
          subject: chunk.subject,
          section: chunk.section,
          content: chunk.content,
          score: cosineSimilarity(queryEmbedding, emb),
        };
      }).sort((a, b) => b.score - a.score).slice(0, limit * 2);

      for (const r of scored) {
        if (results.has(r.id)) {
          // Boost items found by both methods
          results.get(r.id).score += r.score;
        } else {
          results.set(r.id, r);
        }
      }
    } catch (e) {
      log.warn({ err: e.message }, 'Semantic search failed');
    }
  }

  // Sort by combined score, return top results
  return [...results.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════
// Ingest — Add chunks to the database
// ═══════════════════════════════════════════════════════════════

function insertChunk(source, subject, section, content, embedding = null, tokenCount = 0) {
  stmtInsert.run(source, subject, section, content, embedding ? JSON.stringify(embedding) : null, tokenCount);
}

function clearSource(source) {
  stmtClearSource.run(source);
}

function getStats() {
  const total = stmtCount.get();
  const bySubject = stmtCountBySubject.all();
  return { total: total.count, bySubject };
}

// ═══════════════════════════════════════════════════════════════

module.exports = { search, insertChunk, clearSource, getStats };
