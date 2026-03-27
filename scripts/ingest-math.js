#!/usr/bin/env node
// ingest-math.js — Ingest markdown math content into the RAG database
// ═══════════════════════════════════════════════════════════════
// Usage:
//   node scripts/ingest-math.js                          # ingest all knowledge/math-*.md files
//   node scripts/ingest-math.js --file path/to/file.md   # ingest specific file
//   node scripts/ingest-math.js --subject linear-algebra  # ingest only matching subject
//   node scripts/ingest-math.js --stats                  # show current stats
//   node scripts/ingest-math.js --clear source-name      # clear chunks from a source
//
// Markdown format (same as knowledge/ files):
//   category: mathematics
//
//   ## Section Title
//   Content here...
//
// For future PDF ingestion, pipe through a PDF-to-markdown tool first,
// then feed the output through this script.

const fs = require('fs');
const path = require('path');
const { insertChunk, clearSource, getStats } = require('../math-rag');

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const MAX_CHUNK_CHARS = 2000; // ~500 tokens

// ═══════════════════════════════════════════════════════════════
// Parse markdown into chunks (same format as knowledge.js)
// ═══════════════════════════════════════════════════════════════

function parseMarkdown(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const sourceName = path.basename(filePath, '.md');

  // Extract category/subject from frontmatter
  let subject = 'general';
  let startLine = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const match = lines[i].match(/^(?:category|subject):\s*(.+)/i);
    if (match) {
      subject = match[1].trim().toLowerCase();
      startLine = i + 1;
      break;
    }
  }

  // Split on ## headers
  const chunks = [];
  let currentTitle = '';
  let currentContent = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      if (currentTitle && currentContent.length > 0) {
        const content = currentContent.join('\n').trim();
        if (content.length > 0) {
          // Split oversized chunks
          if (content.length > MAX_CHUNK_CHARS) {
            const subChunks = splitChunk(content, MAX_CHUNK_CHARS);
            subChunks.forEach((sc, idx) => {
              chunks.push({
                source: sourceName,
                subject,
                section: `${currentTitle} (${idx + 1}/${subChunks.length})`,
                content: sc,
              });
            });
          } else {
            chunks.push({ source: sourceName, subject, section: currentTitle, content });
          }
        }
      }
      currentTitle = line.replace('## ', '').trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Last section
  if (currentTitle && currentContent.length > 0) {
    const content = currentContent.join('\n').trim();
    if (content.length > 0) {
      if (content.length > MAX_CHUNK_CHARS) {
        const subChunks = splitChunk(content, MAX_CHUNK_CHARS);
        subChunks.forEach((sc, idx) => {
          chunks.push({
            source: sourceName,
            subject,
            section: `${currentTitle} (${idx + 1}/${subChunks.length})`,
            content: sc,
          });
        });
      } else {
        chunks.push({ source: sourceName, subject, section: currentTitle, content });
      }
    }
  }

  return chunks;
}

function splitChunk(text, maxLen) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if (current.length + s.length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += s + ' ';
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2);

if (args.includes('--stats')) {
  const stats = getStats();
  console.log(`Total chunks: ${stats.total}`);
  for (const s of stats.bySubject) {
    console.log(`  ${s.subject}: ${s.count}`);
  }
  process.exit(0);
}

if (args.includes('--clear')) {
  const idx = args.indexOf('--clear');
  const source = args[idx + 1];
  if (!source) { console.error('Usage: --clear <source-name>'); process.exit(1); }
  clearSource(source);
  console.log(`Cleared chunks from source: ${source}`);
  process.exit(0);
}

// Determine files to ingest
let files = [];
if (args.includes('--file')) {
  const idx = args.indexOf('--file');
  const filePath = args[idx + 1];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  files = [filePath];
} else if (args.includes('--all')) {
  // All .md files in knowledge/ (excluding game-library, holy-trinity, lodge-lore which are in the FTS5 knowledge.js system)
  const LEGACY_FILES = new Set(['game-library.md', 'holy-trinity.md', 'lodge-lore.md']);
  files = fs.readdirSync(KNOWLEDGE_DIR)
    .filter(f => f.endsWith('.md') && !LEGACY_FILES.has(f))
    .map(f => path.join(KNOWLEDGE_DIR, f));
} else {
  // Default: all math-*.md files in knowledge/
  files = fs.readdirSync(KNOWLEDGE_DIR)
    .filter(f => f.startsWith('math-') && f.endsWith('.md'))
    .map(f => path.join(KNOWLEDGE_DIR, f));
}

if (args.includes('--subject')) {
  const idx = args.indexOf('--subject');
  const subjectFilter = args[idx + 1];
  files = files.filter(f => f.includes(subjectFilter));
}

// Ingest
let totalChunks = 0;
for (const file of files) {
  const sourceName = path.basename(file, '.md');
  console.log(`Ingesting ${sourceName}...`);

  // Clear old chunks from this source before re-ingesting
  clearSource(sourceName);

  const chunks = parseMarkdown(file);
  for (const chunk of chunks) {
    const tokenEstimate = Math.ceil(chunk.content.length / 4);
    insertChunk(chunk.source, chunk.subject, chunk.section, chunk.content, null, tokenEstimate);
  }

  console.log(`  → ${chunks.length} chunks`);
  totalChunks += chunks.length;
}

console.log(`\nDone! Ingested ${totalChunks} chunks from ${files.length} files.`);
const stats = getStats();
console.log(`Total in database: ${stats.total} chunks`);
for (const s of stats.bySubject) {
  console.log(`  ${s.subject}: ${s.count}`);
}
