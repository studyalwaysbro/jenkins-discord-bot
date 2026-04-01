// achievement-card.js — Canvas-rendered Achievement Unlock Cards
// ═══════════════════════════════════════════════════════════════
// Generates visual achievement pop-up images when a Brother unlocks something.
// Dark theme, gold accents, Lodge aesthetic.

const { createCanvas } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const log = require('./logger').child('AchCard');

// Color palette
const COLORS = {
  bg:       '#1a1a2e',  // Deep navy
  bgInner:  '#16213e',  // Slightly lighter
  gold:     '#ffd700',  // Sacred gold
  goldDim:  '#b8860b',  // Dark gold
  text:     '#e0e0e0',  // Light text
  textDim:  '#888888',  // Dimmed text
  accent:   '#0f3460',  // Blue accent
  border:   '#ffd700',  // Gold border
};

/**
 * Generate an achievement unlock card as a PNG buffer.
 *
 * @param {string} achievementName - The achievement title
 * @param {string} description - Achievement description
 * @param {string} username - Who unlocked it
 * @param {object} [opts] - { emoji, rarity }
 * @returns {Buffer} PNG image buffer
 */
function generateCard(achievementName, description, username, opts = {}) {
  const WIDTH = 600;
  const HEIGHT = 200;
  const PADDING = 20;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // ── Background ──
  // Outer fill
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Inner panel with rounded corners
  const innerX = PADDING;
  const innerY = PADDING;
  const innerW = WIDTH - PADDING * 2;
  const innerH = HEIGHT - PADDING * 2;
  const radius = 12;

  ctx.beginPath();
  ctx.moveTo(innerX + radius, innerY);
  ctx.lineTo(innerX + innerW - radius, innerY);
  ctx.quadraticCurveTo(innerX + innerW, innerY, innerX + innerW, innerY + radius);
  ctx.lineTo(innerX + innerW, innerY + innerH - radius);
  ctx.quadraticCurveTo(innerX + innerW, innerY + innerH, innerX + innerW - radius, innerY + innerH);
  ctx.lineTo(innerX + radius, innerY + innerH);
  ctx.quadraticCurveTo(innerX, innerY + innerH, innerX, innerY + innerH - radius);
  ctx.lineTo(innerX, innerY + radius);
  ctx.quadraticCurveTo(innerX, innerY, innerX + radius, innerY);
  ctx.closePath();

  ctx.fillStyle = COLORS.bgInner;
  ctx.fill();

  // Gold border
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── Trophy icon area ──
  const iconX = PADDING + 25;
  const iconY = HEIGHT / 2;
  const iconSize = 50;

  // Gold circle
  ctx.beginPath();
  ctx.arc(iconX + iconSize / 2, iconY, iconSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.gold;
  ctx.globalAlpha = 0.15;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Trophy text (emoji fallback)
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', iconX + iconSize / 2, iconY);

  // ── Text content ──
  const textX = iconX + iconSize + 25;
  const maxTextW = WIDTH - textX - PADDING - 15;

  // "ACHIEVEMENT UNLOCKED" header
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = COLORS.goldDim;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = '3px';
  ctx.fillText('ACHIEVEMENT UNLOCKED', textX, innerY + 18);

  // Achievement name
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(truncate(achievementName, ctx, maxTextW), textX, innerY + 42);

  // Description
  ctx.font = '14px sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(truncate(description, ctx, maxTextW), textX, innerY + 72);

  // Username
  ctx.font = '13px sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`Unlocked by ${username}`, textX, innerY + innerH - 30);

  // ── Decorative corner marks ──
  ctx.strokeStyle = COLORS.goldDim;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;

  // Top-left
  drawCornerMark(ctx, PADDING + 5, PADDING + 5, 10, 'tl');
  // Top-right
  drawCornerMark(ctx, WIDTH - PADDING - 5, PADDING + 5, 10, 'tr');
  // Bottom-left
  drawCornerMark(ctx, PADDING + 5, HEIGHT - PADDING - 5, 10, 'bl');
  // Bottom-right
  drawCornerMark(ctx, WIDTH - PADDING - 5, HEIGHT - PADDING - 5, 10, 'br');

  ctx.globalAlpha = 1;

  return canvas.toBuffer('image/png');
}

/**
 * Generate a card and wrap it as a Discord AttachmentBuilder.
 */
function generateCardAttachment(achievementName, description, username, opts = {}) {
  const buffer = generateCard(achievementName, description, username, opts);
  return new AttachmentBuilder(buffer, { name: 'achievement.png' });
}

// ── Helpers ──

function truncate(text, ctx, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '...').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '...';
}

function drawCornerMark(ctx, x, y, size, corner) {
  ctx.beginPath();
  switch (corner) {
    case 'tl':
      ctx.moveTo(x, y + size); ctx.lineTo(x, y); ctx.lineTo(x + size, y);
      break;
    case 'tr':
      ctx.moveTo(x - size, y); ctx.lineTo(x, y); ctx.lineTo(x, y + size);
      break;
    case 'bl':
      ctx.moveTo(x, y - size); ctx.lineTo(x, y); ctx.lineTo(x + size, y);
      break;
    case 'br':
      ctx.moveTo(x - size, y); ctx.lineTo(x, y); ctx.lineTo(x, y - size);
      break;
  }
  ctx.stroke();
}

module.exports = { generateCard, generateCardAttachment };
