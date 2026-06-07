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

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LIBERA Studio — Dashboard</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#06070E;color:#EDE9E1;font-family:'Manrope',sans-serif;min-height:100vh}
  header{background:#0C0B18;border-bottom:1px solid #1E1B30;padding:20px 32px;display:flex;align-items:center;justify-content:space-between}
  .logo{font-size:24px;font-weight:800;letter-spacing:-0.5px}
  .logo span{color:#E85220}
  .badge{font-size:10px;font-weight:700;color:#65708F;letter-spacing:2px;text-transform:uppercase;margin-left:8px;vertical-align:middle}
  .last-updated{font-size:12px;color:#3D4066}
  main{padding:32px;max-width:1100px;margin:0 auto}
  h2{font-size:13px;font-weight:700;color:#65708F;letter-spacing:2px;text-transform:uppercase;margin-bottom:20px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:40px}
  .card{background:#0C0B18;border-radius:12px;padding:24px;border-top:3px solid #1E1B30}
  .card.orange{border-top-color:#E85220}
  .card.green{border-top-color:#22C55E}
  .card.red{border-top-color:#EF4444}
  .card.blue{border-top-color:#3B82F6}
  .card .num{font-size:40px;font-weight:800;line-height:1;color:#EDE9E1}
  .card.orange .num{color:#E85220}
  .card.green .num{color:#22C55E}
  .card.red .num{color:#EF4444}
  .card.blue .num{color:#3B82F6}
  .card .label{font-size:13px;font-weight:500;color:#65708F;margin-top:8px}
  .actions{margin-bottom:40px;display:flex;gap:12px;align-items:center}
  button{background:#E85220;color:#06070E;border:none;padding:12px 24px;border-radius:100px;font-family:'Manrope',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .2s}
  button:hover{opacity:.85}
  button.secondary{background:transparent;color:#E85220;border:1.5px solid #E85220}
  .run-status{font-size:13px;color:#22C55E;display:none}
  .logs{background:#0C0B18;border-radius:12px;overflow:hidden}
  .log-tabs{display:flex;border-bottom:1px solid #1E1B30;overflow-x:auto}
  .log-tab{padding:12px 20px;font-size:13px;font-weight:600;color:#65708F;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;transition:all .2s}
  .log-tab.active{color:#EDE9E1;border-bottom-color:#E85220}
  .log-content{padding:24px;font-family:monospace;font-size:12px;line-height:1.8;color:#9BA4BF;white-space:pre-wrap;max-height:400px;overflow-y:auto;display:none}
  .log-content.active{display:block}
  .log-content .ok{color:#22C55E}
  .log-content .err{color:#EF4444}
  .log-content .info{color:#E85220}
  .log-content .dim{color:#3D4066}
  .progress-bar{background:#1E1B30;border-radius:100px;height:6px;margin-top:16px;overflow:hidden}
  .progress-fill{height:100%;background:#E85220;border-radius:100px;transition:width .5s}
  .empty{color:#3D4066;font-size:13px;padding:40px;text-align:center}
  .scraper-form{background:#0C0B18;border-radius:12px;padding:24px;margin-bottom:40px}
  .scraper-row{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:0}
  .field{display:flex;flex-direction:column;gap:6px;flex:1;min-width:200px}
  .field label{font-size:11px;font-weight:700;color:#65708F;letter-spacing:1.5px;text-transform:uppercase}
  .field input{background:#06070E;border:1.5px solid #1E1B30;border-radius:8px;padding:10px 14px;color:#EDE9E1;font-family:'Manrope',sans-serif;font-size:14px;outline:none;transition:border-color .2s}
  .field input:focus{border-color:#E85220}
  .field-sm{flex:0 0 100px;min-width:80px}
  .scraper-output{margin-top:20px;display:none}
  .scraper-log{background:#06070E;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;line-height:1.8;color:#9BA4BF;white-space:pre-wrap;max-height:360px;overflow-y:auto;border:1px solid #1E1B30}
  .scraper-log .ok{color:#22C55E}
  .scraper-log .err{color:#EF4444}
  .scraper-log .info{color:#E85220}
  #scraperStatus{font-size:12px;color:#65708F;margin-top:10px}
</style>
</head>
<body>
<header>
  <div><span class="logo">LIBER<span>A</span></span><span class="badge">Studio</span></div>
  <span class="last-updated" id="lastUpdated">Cargando...</span>
</header>
<main>
  <h2>Scraper de Leads</h2>
  <div class="scraper-form">
    <div class="scraper-row">
      <div class="field">
        <label>Búsqueda</label>
        <input type="text" id="scraperQuery" placeholder="dentistas Cancún Quintana Roo" />
      </div>
      <div class="field field-sm">
        <label>Resultados</label>
        <input type="number" id="scraperMax" value="30" min="5" max="200" />
      </div>
      <button onclick="runScraper()" id="scraperBtn">▶ Correr scraper</button>
    </div>
    <div class="scraper-output" id="scraperOutput">
      <div class="scraper-log" id="scraperLog"></div>
      <div id="scraperStatus"></div>
    </div>
  </div>

  <h2>Estado de Leads</h2>
  <div class="cards">
    <div class="card"><div class="num" id="total">—</div><div class="label">Total leads</div></div>
    <div class="card"><div class="num" id="sinContactar">—</div><div class="label">Sin contactar</div>
      <div class="progress-bar"><div class="progress-fill" id="progSin" style="width:0%"></div></div>
    </div>
    <div class="card orange"><div class="num" id="contactado">—</div><div class="label">Contactados</div></div>
    <div class="card green"><div class="num" id="respondio">—</div><div class="label">Respondieron</div></div>
    <div class="card red"><div class="num" id="rebote">—</div><div class="label">Rebotes</div></div>
  </div>

  <h2>Acciones</h2>
  <div class="actions">
    <button onclick="runRoutine()">▶ Correr rutina ahora</button>
    <button class="secondary" onclick="loadStats()">↻ Actualizar stats</button>
    <span class="run-status" id="runStatus">✓ Rutina iniciada — revisa los logs en unos minutos</span>
  </div>

  <h2>Logs de rutinas</h2>
  <div class="logs" id="logsContainer"><div class="empty">Sin logs todavía</div></div>
</main>

<script>
async function loadStats() {
  const res = await fetch('/api/stats');
  const d = await res.json();
  document.getElementById('total').textContent = d.total;
  document.getElementById('sinContactar').textContent = d.sinContactar;
  document.getElementById('contactado').textContent = d.contactado;
  document.getElementById('respondio').textContent = d.respondio;
  document.getElementById('rebote').textContent = d.rebote;
  const pct = d.total ? Math.round((d.sinContactar / d.total) * 100) : 0;
  document.getElementById('progSin').style.width = pct + '%';
  document.getElementById('lastUpdated').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-MX');
}

async function loadLogs() {
  const res = await fetch('/api/logs');
  const logs = await res.json();
  const container = document.getElementById('logsContainer');
  if (!logs.length) return;

  const tabs = logs.map((l, i) =>
    \`<div class="log-tab \${i===0?'active':''}" onclick="showTab(\${i})">\${l.date}</div>\`
  ).join('');

  const contents = logs.map((l, i) => {
    const colored = l.content
      .replace(/✓[^\n]*/g, m => \`<span class="ok">\${m}</span>\`)
      .replace(/✗[^\n]*/g, m => \`<span class="err">\${m}</span>\`)
      .replace(/═══[^\n]*/g, m => \`<span class="info">\${m}</span>\`)
      .replace(/──[^\n]*/g, m => \`<span class="dim">\${m}</span>\`);
    return \`<div class="log-content \${i===0?'active':''}" id="tab\${i}">\${colored}</div>\`;
  }).join('');

  container.innerHTML = \`<div class="log-tabs">\${tabs}</div>\${contents}\`;
}

function showTab(i) {
  document.querySelectorAll('.log-tab').forEach((t,j) => t.classList.toggle('active', i===j));
  document.querySelectorAll('.log-content').forEach((c,j) => c.classList.toggle('active', i===j));
}

async function runRoutine() {
  await fetch('/api/run', { method: 'POST' });
  const s = document.getElementById('runStatus');
  s.style.display = 'inline';
  setTimeout(() => { s.style.display = 'none'; loadLogs(); }, 5000);
}

let scraperSSE = null;

function runScraper() {
  const query = document.getElementById('scraperQuery').value.trim();
  const max   = parseInt(document.getElementById('scraperMax').value, 10) || 30;
  if (!query) { alert('Escribe una búsqueda'); return; }

  if (scraperSSE) { scraperSSE.close(); scraperSSE = null; }

  const log    = document.getElementById('scraperLog');
  const status = document.getElementById('scraperStatus');
  const output = document.getElementById('scraperOutput');
  const btn    = document.getElementById('scraperBtn');

  log.innerHTML = '';
  output.style.display = 'block';
  btn.disabled = true;
  btn.textContent = '⏳ Corriendo...';
  status.textContent = 'Iniciando scraper...';

  const url = \`/api/scraper?q=\${encodeURIComponent(query)}&max=\${max}\`;
  scraperSSE = new EventSource(url);

  scraperSSE.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === 'start') {
      status.textContent = \`Buscando "\${d.query}" — máx \${d.max} resultados\`;
    } else if (d.type === 'log') {
      const line = document.createElement('div');
      const t = d.line;
      line.className = t.includes('✓') ? 'ok' : t.includes('✗') || t.includes('Error') ? 'err' : t.includes('═') || t.includes('►') ? 'info' : '';
      line.textContent = d.line;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    } else if (d.type === 'err') {
      const line = document.createElement('div');
      line.className = 'err';
      line.textContent = d.line;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    } else if (d.type === 'done') {
      status.textContent = d.code === 0 ? '✓ Scraper terminado correctamente' : \`⚠ Terminó con código \${d.code}\`;
      btn.disabled = false;
      btn.textContent = '▶ Correr scraper';
      scraperSSE.close();
      scraperSSE = null;
      loadStats();
    }
  };

  scraperSSE.onerror = () => {
    status.textContent = 'Error de conexión con el servidor';
    btn.disabled = false;
    btn.textContent = '▶ Correr scraper';
  };
}

loadStats();
loadLogs();
setInterval(loadStats, 60000);
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`\n  LIBERA Studio Dashboard → http://localhost:${PORT}\n`);
});
