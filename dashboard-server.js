require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

const app = express();
const PORT = 3131;

const TOKEN    = process.env.AIRTABLE_TOKEN;
const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;
const LOG_DIR  = path.join(__dirname, 'logs');

async function getStats() {
  const counts = { total: 0, sinContactar: 0, contactado: 0, rebote: 0, respondio: 0, otro: 0 };
  let offset = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.append('fields[]', 'estado');
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${TOKEN}` } });
    const json = await res.json();

    for (const r of json.records) {
      counts.total++;
      const e = (r.fields.estado || '').toLowerCase();
      if (e === 'sin contactar')   counts.sinContactar++;
      else if (e === 'contactado') counts.contactado++;
      else if (e === 'rebote')     counts.rebote++;
      else if (e === 'respondió' || e === 'respondio') counts.respondio++;
      else counts.otro++;
    }
    offset = json.offset || null;
  } while (offset);

  return counts;
}

function getRecentLogs() {
  if (!fs.existsSync(LOG_DIR)) return [];
  const files = fs.readdirSync(LOG_DIR)
    .filter(f => f.endsWith('.log'))
    .sort().reverse().slice(0, 7);

  return files.map(f => ({
    date: f.replace('routine-', '').replace('.log', ''),
    content: fs.readFileSync(path.join(LOG_DIR, f), 'utf8').trim(),
  }));
}

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/logs', (req, res) => {
  res.json(getRecentLogs());
});

app.post('/api/run', (req, res) => {
  const node = process.execPath;
  const script = path.join(__dirname, 'daily-routine.js');
  execFile(node, [script], { cwd: __dirname }, (err) => {
    if (err) console.error('Rutina error:', err.message);
  });
  res.json({ started: true });
});

// SSE: corre el scraper y transmite stdout en tiempo real
app.get('/api/scraper', (req, res) => {
  const query = (req.query.q || '').trim();
  const max   = Math.min(parseInt(req.query.max, 10) || 30, 200);

  if (!query) { res.status(400).json({ error: 'query requerida' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ type: 'start', query, max });

  const node = process.execPath;
  const script = path.join(__dirname, 'scraper.js');
  const child = spawn(node, [script, query, String(max)], { cwd: __dirname });

  child.stdout.on('data', (chunk) => {
    chunk.toString().split('\n').filter(Boolean).forEach(line => send({ type: 'log', line }));
  });
  child.stderr.on('data', (chunk) => {
    chunk.toString().split('\n').filter(Boolean).forEach(line => send({ type: 'err', line }));
  });
  child.on('close', (code) => {
    send({ type: 'done', code });
    res.end();
  });

  req.on('close', () => child.kill());
});

// Frontend served by Vite dev server (port 5174) or built static files

app.listen(PORT, () => {
  console.log(`\n  LIBERA Studio Dashboard → http://localhost:${PORT}\n`);
});
