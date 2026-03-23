// charts.js — Data Visualization for the Lodge
// ═══════════════════════════════════════════════════════════════
// Generates chart images for economy stats, leaderboards, sin trends.
// Uses Chart.js with canvas rendering.

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { AttachmentBuilder } = require('discord.js');
const log = require('./logger').child('Charts');

const WIDTH = 600;
const HEIGHT = 400;

const chartJS = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: '#1a1a2e',
});

// Color palette
const GOLD = '#ffd700';
const GOLD_DIM = 'rgba(255, 215, 0, 0.3)';
const RED = '#ff4444';
const RED_DIM = 'rgba(255, 68, 68, 0.3)';
const GREEN = '#00ff41';
const GREEN_DIM = 'rgba(0, 255, 65, 0.3)';
const BLUE = '#3498db';
const BLUE_DIM = 'rgba(52, 152, 219, 0.3)';
const TEXT = '#e0e0e0';
const GRID = 'rgba(255, 255, 255, 0.1)';

/**
 * Generate a leaderboard bar chart.
 * @param {Array<{name: string, balance: number}>} leaders - Top users
 * @returns {Promise<Buffer>} PNG buffer
 */
async function leaderboardChart(leaders) {
  const config = {
    type: 'bar',
    data: {
      labels: leaders.map((l, i) => `${i + 1}. ${l.name}`),
      datasets: [{
        label: 'Torch Coins',
        data: leaders.map(l => l.balance),
        backgroundColor: leaders.map((_, i) =>
          i === 0 ? GOLD : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : BLUE_DIM
        ),
        borderColor: leaders.map((_, i) =>
          i === 0 ? GOLD : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : BLUE
        ),
        borderWidth: 1,
      }],
    },
    options: {
      indexAxis: 'y',
      plugins: {
        title: { display: true, text: '🏆 Torch Coin Leaderboard', color: GOLD, font: { size: 18 } },
        legend: { display: false },
      },
      scales: {
        x: { ticks: { color: TEXT }, grid: { color: GRID } },
        y: { ticks: { color: TEXT }, grid: { color: GRID } },
      },
    },
  };

  return chartJS.renderToBuffer(config);
}

/**
 * Generate a user's economy stat radar chart.
 * @param {string} username
 * @param {object} user - Economy user data
 * @returns {Promise<Buffer>} PNG buffer
 */
async function userStatsRadar(username, user) {
  // Normalize stats to 0-100 scale
  const maxBalance = 100000;
  const maxStreak = 30;
  const maxGambles = 100;
  const maxDungeons = 50;
  const maxMessages = 5000;

  const config = {
    type: 'radar',
    data: {
      labels: ['Wealth', 'Streak', 'Gambling', 'Dungeons', 'Activity'],
      datasets: [{
        label: username,
        data: [
          Math.min(100, (user.balance / maxBalance) * 100),
          Math.min(100, ((user.dailyStreak || 0) / maxStreak) * 100),
          Math.min(100, (((user.gamblesWon || 0) + (user.gamblesLost || 0)) / maxGambles) * 100),
          Math.min(100, ((user.dungeonRuns || 0) / maxDungeons) * 100),
          Math.min(100, ((user.messagesCount || 0) / maxMessages) * 100),
        ],
        backgroundColor: GOLD_DIM,
        borderColor: GOLD,
        borderWidth: 2,
        pointBackgroundColor: GOLD,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: `📊 ${username}'s Lodge Profile`, color: GOLD, font: { size: 16 } },
        legend: { display: false },
      },
      scales: {
        r: {
          ticks: { color: TEXT, backdropColor: 'transparent' },
          grid: { color: GRID },
          pointLabels: { color: TEXT, font: { size: 12 } },
          suggestedMin: 0,
          suggestedMax: 100,
        },
      },
    },
  };

  return chartJS.renderToBuffer(config);
}

/**
 * Generate a mood axes chart.
 * @param {object} axes - { wrath, joy, energy, chaos }
 * @returns {Promise<Buffer>} PNG buffer
 */
async function moodChart(axes) {
  const labels = ['Wrath', 'Joy', 'Energy', 'Chaos'];
  const values = [axes.wrath || 50, axes.joy || 50, axes.energy || 50, axes.chaos || 50];
  const colors = [RED, GREEN, '#e91e63', '#e67e22'];
  const bgColors = [RED_DIM, GREEN_DIM, 'rgba(233, 30, 99, 0.3)', 'rgba(230, 126, 34, 0.3)'];

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Intensity',
        data: values,
        backgroundColor: bgColors,
        borderColor: colors,
        borderWidth: 2,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: "🧠 The Architect's Mind", color: GOLD, font: { size: 16 } },
        legend: { display: false },
      },
      scales: {
        y: { min: 0, max: 100, ticks: { color: TEXT }, grid: { color: GRID } },
        x: { ticks: { color: TEXT }, grid: { color: GRID } },
      },
    },
  };

  return chartJS.renderToBuffer(config);
}

/**
 * Generate a win/loss pie chart.
 * @param {string} username
 * @param {number} wins
 * @param {number} losses
 * @param {string} [label='Gambles']
 * @returns {Promise<Buffer>} PNG buffer
 */
async function winLossChart(username, wins, losses, label = 'Gambles') {
  const config = {
    type: 'doughnut',
    data: {
      labels: ['Wins', 'Losses'],
      datasets: [{
        data: [wins || 0, losses || 0],
        backgroundColor: [GREEN_DIM, RED_DIM],
        borderColor: [GREEN, RED],
        borderWidth: 2,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: `${username}'s ${label}: ${wins}W / ${losses}L`, color: GOLD, font: { size: 16 } },
        legend: { labels: { color: TEXT } },
      },
    },
  };

  return chartJS.renderToBuffer(config);
}

// Wrap buffer as Discord attachment
function toAttachment(buffer, name = 'chart.png') {
  return new AttachmentBuilder(buffer, { name });
}

module.exports = { leaderboardChart, userStatsRadar, moodChart, winLossChart, toAttachment };
