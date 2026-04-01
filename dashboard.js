// dashboard.js — Jenkins Admin Dashboard
// ═══════════════════════════════════════════════════════════════
// Lightweight Express server for viewing bot stats.
// Reads from SQLite. No auth (local use only).
// Run: node dashboard.js

require('dotenv').config();

const express = require('express');
const { db, dbRead } = require('./db');
const { getStats: kbStats } = require('./knowledge');
const log = require('./logger').child('Dashboard');

const PORT = process.env.DASHBOARD_PORT || 3333;
const app = express();

// ═══════════════════════════════════════════════════════════════
// API Routes
// ═══════════════════════════════════════════════════════════════

app.get('/api/overview', (req, res) => {
  const economy = dbRead('economy', {});
  const sins = dbRead('sins', {});
  const mood = dbRead('mood', { axes: {} });
  const sermons = dbRead('sermons', { sermons: [] });
  const dreams = dbRead('dreams', { dreams: [] });
  const predictions = dbRead('predictions', { markets: [] });
  const kb = kbStats();

  const userCount = Object.keys(economy).length;
  const totalCoins = Object.values(economy).reduce((sum, u) => sum + (u.balance || 0), 0);
  const sinnerCount = Object.keys(sins).length;
  const totalSins = Object.values(sins).reduce((sum, u) => sum + (u.totalVenial || 0) + (u.totalMortal || 0) + (u.totalUnforgivable || 0), 0);

  res.json({
    economy: { users: userCount, totalCoins },
    sins: { sinners: sinnerCount, totalSins },
    mood: { current: deriveMood(mood.axes), axes: mood.axes },
    sermons: { total: sermons.sermons?.length || 0 },
    dreams: { total: dreams.dreams?.length || 0, lastDate: dreams.lastDreamDate },
    predictions: { active: (predictions.markets || []).filter(m => m.status === 'open').length },
    knowledge: kb,
  });
});

app.get('/api/economy', (req, res) => {
  const economy = dbRead('economy', {});
  const users = Object.entries(economy)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.balance - a.balance);
  res.json({ users });
});

app.get('/api/economy/:userId', (req, res) => {
  const economy = dbRead('economy', {});
  const user = economy[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ userId: req.params.userId, ...user });
});

app.get('/api/sins', (req, res) => {
  const sins = dbRead('sins', {});
  const sinners = Object.entries(sins)
    .map(([id, data]) => ({
      id,
      username: data.username,
      venial: data.totalVenial || 0,
      mortal: data.totalMortal || 0,
      unforgivable: data.totalUnforgivable || 0,
      total: (data.totalVenial || 0) + (data.totalMortal || 0) + (data.totalUnforgivable || 0),
      recentSins: (data.sins || []).slice(-5),
    }))
    .sort((a, b) => b.total - a.total);
  res.json({ sinners });
});

app.get('/api/mood', (req, res) => {
  const mood = dbRead('mood', { axes: {}, transitions: [] });
  res.json({
    current: deriveMood(mood.axes),
    axes: mood.axes,
    recentTransitions: (mood.transitions || []).slice(-10),
  });
});

app.get('/api/sermons', (req, res) => {
  const data = dbRead('sermons', { sermons: [] });
  const sermons = (data.sermons || []).slice(-20).reverse();
  res.json({ sermons, total: data.sermons?.length || 0 });
});

app.get('/api/dreams', (req, res) => {
  const data = dbRead('dreams', { dreams: [] });
  const dreams = (data.dreams || []).slice(-10).reverse().map(d => ({
    id: d.id,
    date: d.date,
    mood: d.mood,
    preview: (d.content || d.narrative || '').substring(0, 200),
  }));
  res.json({ dreams, total: data.dreams?.length || 0 });
});

app.get('/api/knowledge', (req, res) => {
  const stats = kbStats();
  const chunks = db.prepare('SELECT id, source, category, title, length(content) as size FROM knowledge_chunks ORDER BY source, id').all();
  res.json({ ...stats, chunks });
});

// ═══════════════════════════════════════════════════════════════
// Dashboard HTML
// ═══════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.send(DASHBOARD_HTML);
});

// Simple mood derivation (duplicated from mood.js to avoid full module init)
function deriveMood(axes) {
  if (!axes) return 'unknown';
  if ((axes.wrath || 0) > 70) return 'wrathful';
  if ((axes.joy || 0) > 70 && (axes.energy || 0) > 50) return 'ecstatic';
  if ((axes.energy || 0) > 80 && (axes.chaos || 0) > 50) return 'manic';
  if ((axes.chaos || 0) > 65 && (axes.wrath || 0) > 40) return 'suspicious';
  if ((axes.joy || 0) > 60 && (axes.wrath || 0) < 30) return 'benevolent';
  if ((axes.energy || 0) < 30) return 'melancholic';
  return 'contemplative';
}

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jenkins Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0d1117; color: #e0e0e0; font-family: 'Segoe UI', system-ui, sans-serif; padding: 20px; }
    h1 { color: #ffd700; margin-bottom: 20px; font-size: 24px; }
    h2 { color: #ffd700; margin: 20px 0 10px; font-size: 18px; border-bottom: 1px solid #333; padding-bottom: 5px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
    .card-title { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .card-value { color: #ffd700; font-size: 28px; font-weight: bold; margin: 8px 0; }
    .card-sub { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { text-align: left; color: #888; font-size: 12px; text-transform: uppercase; padding: 8px; border-bottom: 1px solid #333; }
    td { padding: 8px; border-bottom: 1px solid #1a1a2e; font-size: 14px; }
    tr:hover td { background: #1a1f2e; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .badge-gold { background: rgba(255,215,0,0.15); color: #ffd700; }
    .badge-red { background: rgba(255,68,68,0.15); color: #ff4444; }
    .badge-green { background: rgba(0,255,65,0.15); color: #00ff41; }
    .badge-blue { background: rgba(52,152,219,0.15); color: #3498db; }
    .mood-bar { height: 8px; border-radius: 4px; background: #1a1a2e; overflow: hidden; margin: 4px 0; }
    .mood-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
    #status { color: #666; font-size: 12px; margin-top: 10px; }
    .refresh-btn { background: #ffd700; color: #000; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-left: 10px; }
    .refresh-btn:hover { background: #e6c200; }
    .header { display: flex; align-items: center; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Jenkins Admin Dashboard</h1>
    <button class="refresh-btn" onclick="loadAll()">Refresh</button>
  </div>

  <div class="grid" id="overview"></div>

  <h2>Mood State</h2>
  <div id="mood"></div>

  <h2>Economy — Top Users</h2>
  <div id="economy"></div>

  <h2>Sin Ledger — Worst Offenders</h2>
  <div id="sins"></div>

  <h2>Recent Sermons</h2>
  <div id="sermons"></div>

  <h2>Recent Dreams</h2>
  <div id="dreams"></div>

  <div id="status"></div>

  <script>
    async function fetchJSON(url) {
      const res = await fetch(url);
      return res.json();
    }

    function moodColor(axis) {
      const colors = { wrath: '#ff4444', joy: '#00ff41', energy: '#e91e63', chaos: '#e67e22' };
      return colors[axis] || '#3498db';
    }

    async function loadOverview() {
      const d = await fetchJSON('/api/overview');
      document.getElementById('overview').innerHTML = [
        card('Users', d.economy.users, 'Registered in economy'),
        card('Total Coins', d.economy.totalCoins.toLocaleString(), 'In circulation'),
        card('Sinners', d.sins.sinners, d.sins.totalSins + ' total sins'),
        card('Mood', d.mood.current.toUpperCase(), 'Current state'),
        card('Sermons', d.sermons.total, 'Delivered'),
        card('Dreams', d.dreams.total, d.dreams.lastDate ? 'Last: ' + d.dreams.lastDate : 'None yet'),
        card('Knowledge', d.knowledge.total, 'Chunks indexed'),
        card('Predictions', d.predictions.active, 'Active markets'),
      ].join('');
    }

    async function loadMood() {
      const d = await fetchJSON('/api/mood');
      const axes = d.axes || {};
      let html = '<div class="card">';
      html += '<div class="card-title">Current: <span class="badge badge-gold">' + d.current + '</span></div>';
      for (const [axis, val] of Object.entries(axes)) {
        html += '<div style="margin:8px 0"><span style="display:inline-block;width:60px;color:#888">' + axis + '</span>';
        html += '<span style="color:#ffd700;width:30px;display:inline-block">' + val + '</span>';
        html += '<div class="mood-bar" style="display:inline-block;width:200px;vertical-align:middle">';
        html += '<div class="mood-fill" style="width:' + val + '%;background:' + moodColor(axis) + '"></div></div></div>';
      }
      if (d.recentTransitions.length > 0) {
        html += '<div style="margin-top:10px;color:#666;font-size:12px">Recent: ';
        html += d.recentTransitions.slice(-3).map(t => t.fromMood + ' → ' + t.toMood).join(', ');
        html += '</div>';
      }
      html += '</div>';
      document.getElementById('mood').innerHTML = html;
    }

    async function loadEconomy() {
      const d = await fetchJSON('/api/economy');
      const top = d.users.slice(0, 15);
      if (top.length === 0) { document.getElementById('economy').innerHTML = '<p style="color:#666">No users yet</p>'; return; }
      let html = '<table><tr><th>#</th><th>User</th><th>Balance</th><th>Streak</th><th>Gambles</th></tr>';
      top.forEach((u, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1);
        html += '<tr><td>' + medal + '</td><td>' + (u.id.slice(-6)) + '</td>';
        html += '<td style="color:#ffd700">' + u.balance.toLocaleString() + '</td>';
        html += '<td>' + (u.dailyStreak||0) + 'd</td>';
        html += '<td>' + (u.gamblesWon||0) + 'W/' + (u.gamblesLost||0) + 'L</td></tr>';
      });
      html += '</table>';
      document.getElementById('economy').innerHTML = html;
    }

    async function loadSins() {
      const d = await fetchJSON('/api/sins');
      if (d.sinners.length === 0) { document.getElementById('sins').innerHTML = '<p style="color:#666">No sinners yet</p>'; return; }
      let html = '<table><tr><th>User</th><th>Venial</th><th>Mortal</th><th>Unforgivable</th><th>Total</th></tr>';
      d.sinners.slice(0, 10).forEach(s => {
        html += '<tr><td>' + (s.username||s.id.slice(-6)) + '</td>';
        html += '<td>' + s.venial + '</td>';
        html += '<td style="color:#ff4444">' + s.mortal + '</td>';
        html += '<td style="color:#ff0000;font-weight:bold">' + s.unforgivable + '</td>';
        html += '<td style="color:#ffd700">' + s.total + '</td></tr>';
      });
      html += '</table>';
      document.getElementById('sins').innerHTML = html;
    }

    async function loadSermons() {
      const d = await fetchJSON('/api/sermons');
      if (d.sermons.length === 0) { document.getElementById('sermons').innerHTML = '<p style="color:#666">No sermons yet</p>'; return; }
      let html = '<table><tr><th>ID</th><th>Topic</th><th>Tier</th><th>By</th></tr>';
      d.sermons.slice(0, 8).forEach(s => {
        html += '<tr><td>' + s.id + '</td><td>' + (s.topic||'').substring(0,40) + '</td>';
        html += '<td><span class="badge badge-blue">' + (s.tier||'?') + '</span></td>';
        html += '<td>' + (s.username||'?') + '</td></tr>';
      });
      html += '</table>';
      document.getElementById('sermons').innerHTML = html;
    }

    async function loadDreams() {
      const d = await fetchJSON('/api/dreams');
      if (d.dreams.length === 0) { document.getElementById('dreams').innerHTML = '<p style="color:#666">No dreams yet</p>'; return; }
      let html = '';
      d.dreams.slice(0, 5).forEach(dr => {
        html += '<div class="card" style="margin-bottom:8px"><div class="card-title">' + dr.date + ' — <span class="badge badge-gold">' + dr.mood + '</span></div>';
        html += '<p style="margin-top:6px;color:#aaa;font-size:13px">' + dr.preview + '...</p></div>';
      });
      document.getElementById('dreams').innerHTML = html;
    }

    function card(title, value, sub) {
      return '<div class="card"><div class="card-title">' + title + '</div><div class="card-value">' + value + '</div><div class="card-sub">' + sub + '</div></div>';
    }

    async function loadAll() {
      document.getElementById('status').textContent = 'Loading...';
      try {
        await Promise.all([loadOverview(), loadMood(), loadEconomy(), loadSins(), loadSermons(), loadDreams()]);
        document.getElementById('status').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
      } catch (e) {
        document.getElementById('status').textContent = 'Error: ' + e.message;
      }
    }

    loadAll();
    setInterval(loadAll, 30000); // Auto-refresh every 30s
  </script>
</body>
</html>`;

// ═══════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  log.info({ port: PORT, url: `http://localhost:${PORT}` }, 'Dashboard running');
});
