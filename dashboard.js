/**
 * LIBERA CRM — dashboard.js
 * Servidor web local para gestionar leads.
 *
 * Uso:
 *   node dashboard.js
 *   Abrir: http://localhost:3000
 */

require('dotenv').config();
const express = require('express');
const path    = require('path');
const db      = require('./db');

const PORT = process.env.CRM_PORT || 3000;
const app  = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const ESTADOS = ['Sin contactar', 'Email enviado', 'WA enviado', 'Respondió', 'Cerrado', 'No interesa'];
const CANALES = ['WhatsApp', 'Instagram', 'Email', 'FaceBook'];

// ── API ───────────────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  res.json(db.getStats());
});

app.get('/api/leads', (req, res) => {
  const { estado, canal, q, limit = 100, offset = 0 } = req.query;
  let leads;
  if (q) {
    leads = db.searchLeads(q, { limit: +limit, offset: +offset });
  } else {
    leads = db.getLeads({ estado: estado || undefined, canal: canal || undefined, limit: +limit, offset: +offset });
  }
  res.json(leads);
});

app.get('/api/leads/:id', (req, res) => {
  const lead = db.getLead(+req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  res.json(lead);
});

app.patch('/api/leads/:id', (req, res) => {
  const { estado, notas, fecha_contacto, canal_contacto } = req.body;
  if (estado) db.updateEstado(+req.params.id, estado, fecha_contacto || new Date().toISOString());
  if (notas !== undefined) db.updateNotas(+req.params.id, notas);
  if (canal_contacto !== undefined) db.updateCanal(+req.params.id, canal_contacto);
  res.json(db.getLead(+req.params.id));
});

// ── HTML ──────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  const stats = db.getStats();
  res.send(html(stats));
});

function html(stats) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LIBERA CRM</title>
<style>
:root {
  --void: #f6f3ec; --surface: #ffffff; --border: rgba(0,48,73,0.12);
  --od: #003049; --od2: rgba(0,48,73,0.72); --od3: rgba(0,48,73,0.45);
  --fire: #f77f00; --fire-bg: rgba(247,127,0,0.10);
  --green: #16a34a; --yellow: #b45309; --red: #d62828; --blue: #2563eb;
  --radius: 8px; --font: 'Inter', system-ui, sans-serif; --mono: 'JetBrains Mono', monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--void); color: var(--od); font-family: var(--font); font-size: 14px; }
a { color: var(--fire); text-decoration: none; }

/* Layout */
.layout { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
.sidebar { background: var(--surface); border-right: 1px solid var(--border); padding: 24px 16px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.main { padding: 28px 32px; overflow-x: auto; }

/* Sidebar */
.brand { margin-bottom: 28px; padding: 4px 2px; }
.brand img { width: 140px; height: auto; display: block; }
.brand small { display: block; margin-top: 6px; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--od3); font-weight: 700; }
.nav-label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--od3); margin: 20px 0 8px; }
.filter-btn { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 8px 10px; border-radius: var(--radius); border: none; background: transparent; color: var(--od2); cursor: pointer; font-size: 13px; transition: background .15s; }
.filter-btn:hover, .filter-btn.active { background: var(--fire-bg); color: var(--od); }
.filter-btn .badge { background: var(--border); padding: 2px 7px; border-radius: 100px; font-size: 11px; font-family: var(--mono); }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 7px; vertical-align: middle; }
.canal-tag { display: inline-block; padding: 2px 7px; border-radius: 100px; font-size: 10px; font-weight: 600; margin-right: 3px; white-space: nowrap; background: rgba(0,48,73,0.06); color: var(--od2); }
.canal-check { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.canal-check label { display: flex; align-items: center; gap: 5px; font-size: 13px; color: var(--od2); cursor: pointer; text-transform: none; letter-spacing: 0; }
.filter-btn.active .badge { background: var(--fire); color: #fff; }

/* Stats */
.stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,48,73,0.06); }
.stat-num { font-size: 28px; font-weight: 700; letter-spacing: -0.04em; }
.stat-lbl { font-size: 11px; color: var(--od3); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px; }

/* Toolbar */
.toolbar { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; }
.search { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 12px; color: var(--od); font-size: 13px; }
.search:focus { outline: none; border-color: var(--fire); }
.btn { padding: 8px 16px; border-radius: var(--radius); border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: opacity .15s; }
.btn:hover { opacity: .85; }
.btn-primary { background: var(--fire); color: #fff; }
.btn-ghost { background: var(--surface); border: 1px solid var(--border); color: var(--od2); }

/* Table */
.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { background: var(--surface); color: var(--od3); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); font-weight: 500; }
td { padding: 11px 14px; border-bottom: 1px solid var(--border); color: var(--od2); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--fire-bg); }
td.nombre { color: var(--od); font-weight: 500; }
td.tel, td.email { font-family: var(--mono); font-size: 12px; }

/* Estado badge */
.estado { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 100px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.estado-sin  { background: rgba(0,48,73,0.07); color: var(--od3); }
.estado-email { background: rgba(59,130,246,0.15); color: var(--blue); }
.estado-wa   { background: rgba(34,197,94,0.15); color: var(--green); }
.estado-resp { background: rgba(234,179,8,0.15); color: var(--yellow); }
.estado-cerr { background: rgba(34,197,94,0.2); color: var(--green); }
.estado-no   { background: rgba(239,68,68,0.1); color: var(--red); }

/* Drawer */
.drawer-overlay { display: none; position: fixed; inset: 0; background: rgba(0,48,73,.35); z-index: 100; }
.drawer-overlay.open { display: block; }
.drawer { position: fixed; right: 0; top: 0; bottom: 0; width: 420px; background: var(--surface); border-left: 1px solid var(--border); padding: 28px; overflow-y: auto; z-index: 101; transform: translateX(100%); transition: transform .25s ease; }
.drawer.open { transform: translateX(0); }
.drawer-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--od3); cursor: pointer; font-size: 20px; }
.drawer h2 { font-size: 18px; font-weight: 700; margin-bottom: 20px; }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--od3); margin-bottom: 6px; }
.field .val { font-size: 14px; color: var(--od); }
.field select, .field textarea { width: 100%; background: var(--void); border: 1px solid var(--border); border-radius: var(--radius); color: var(--od); padding: 8px 10px; font-size: 13px; font-family: var(--font); }
.field select:focus, .field textarea:focus { outline: none; border-color: var(--fire); }
.field textarea { resize: vertical; min-height: 80px; }
.wa-link { display: inline-block; margin-top: 6px; background: #25d366; color: #fff; padding: 6px 14px; border-radius: var(--radius); font-size: 12px; font-weight: 700; }
.msg-box { background: var(--void); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; font-size: 12px; color: var(--od2); white-space: pre-wrap; margin-top: 6px; max-height: 140px; overflow-y: auto; }

/* Pager */
.pager { display: flex; align-items: center; gap: 12px; margin-top: 16px; color: var(--od3); font-size: 12px; }
.pager button { background: var(--surface); border: 1px solid var(--border); color: var(--od2); padding: 6px 14px; border-radius: var(--radius); cursor: pointer; }
.pager button:disabled { opacity: .3; cursor: default; }
</style>
</head>
<body>
<div class="layout">

<!-- SIDEBAR -->
<aside class="sidebar">
  <div class="brand">
    <img src="/assets/logo-libera.png" alt="LIBERA">
    <small>CRM</small>
  </div>

  <div class="nav-label">Pipeline</div>
  <button class="filter-btn active" data-estado="" onclick="setFiltro(this)">
    Todos <span class="badge" id="b-total">${stats.total}</span>
  </button>
  <button class="filter-btn" data-estado="Sin contactar" onclick="setFiltro(this)">
    Sin contactar <span class="badge" id="b-sin">${stats.sin_contactar}</span>
  </button>
  <button class="filter-btn" data-estado="Email enviado" onclick="setFiltro(this)">
    Email enviado <span class="badge" id="b-email">${stats.email_enviado}</span>
  </button>
  <button class="filter-btn" data-estado="WA enviado" onclick="setFiltro(this)">
    WA enviado <span class="badge" id="b-wa">${stats.wa_enviado}</span>
  </button>
  <button class="filter-btn" data-estado="Respondió" onclick="setFiltro(this)">
    Respondió <span class="badge" id="b-resp">${stats.respondio}</span>
  </button>
  <button class="filter-btn" data-estado="Cerrado" onclick="setFiltro(this)">
    Cerrado <span class="badge" id="b-cerr">${stats.cerrado}</span>
  </button>
  <button class="filter-btn" data-estado="No interesa" onclick="setFiltro(this)">
    No interesa <span class="badge" id="b-no">${stats.no_interesa}</span>
  </button>

  <div class="nav-label" style="margin-top:28px">Canal de contacto</div>
  <button class="filter-btn" data-canal="WhatsApp" onclick="setCanal(this)">
    <span><span class="dot" style="background:var(--green)"></span>WhatsApp</span> <span class="badge" id="b-cwa">${stats.canal_wa}</span>
  </button>
  <button class="filter-btn" data-canal="Instagram" onclick="setCanal(this)">
    <span><span class="dot" style="background:#e1306c"></span>Instagram</span> <span class="badge" id="b-cig">${stats.canal_ig}</span>
  </button>
  <button class="filter-btn" data-canal="Email" onclick="setCanal(this)">
    <span><span class="dot" style="background:var(--blue)"></span>Email</span> <span class="badge" id="b-cem">${stats.canal_email}</span>
  </button>
  <button class="filter-btn" data-canal="FaceBook" onclick="setCanal(this)">
    <span><span class="dot" style="background:#1877f2"></span>Facebook</span> <span class="badge" id="b-cfb">${stats.canal_fb}</span>
  </button>

  <div class="nav-label" style="margin-top:28px">Datos</div>
  <div style="font-size:12px;color:var(--od3);padding:4px 10px">
    Con email: <strong style="color:var(--od)">${stats.con_email}</strong><br>
    Sin sitio web: <strong style="color:var(--fire)">${stats.sin_web}</strong>
  </div>
</aside>

<!-- MAIN -->
<main class="main">
  <div class="stats">
    <div class="stat-card"><div class="stat-num">${stats.total}</div><div class="stat-lbl">Leads totales</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--fire)">${stats.sin_contactar}</div><div class="stat-lbl">Sin contactar</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--yellow)">${stats.respondio}</div><div class="stat-lbl">Respondieron</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--green)">${stats.cerrado}</div><div class="stat-lbl">Cerrados</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--blue)">${stats.contactados}</div><div class="stat-lbl">Contactados</div></div>
  </div>

  <div class="toolbar">
    <input class="search" type="text" placeholder="Buscar nombre, email, teléfono, categoría..." id="searchInput" oninput="onSearch(this.value)">
    <button class="btn btn-ghost" onclick="location.reload()">Actualizar</button>
  </div>

  <div class="table-wrap">
    <table id="leadsTable">
      <thead>
        <tr>
          <th>#</th>
          <th>Nombre</th>
          <th>Categoría</th>
          <th>Teléfono</th>
          <th>Email</th>
          <th>Web</th>
          <th>Estado</th>
          <th>Canal</th>
          <th>Scrapeado</th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>

  <div class="pager">
    <button id="btnPrev" onclick="prevPage()">← Anterior</button>
    <span id="pagerInfo"></span>
    <button id="btnNext" onclick="nextPage()">Siguiente →</button>
  </div>
</main>

</div>

<!-- DRAWER -->
<div class="drawer-overlay" id="overlay" onclick="closeDrawer()"></div>
<div class="drawer" id="drawer">
  <button class="drawer-close" onclick="closeDrawer()">✕</button>
  <div id="drawerContent"></div>
</div>

<script>
const ESTADOS = ${JSON.stringify(ESTADOS)};
const CANALES = ${JSON.stringify(CANALES)};
const CANAL_COLOR = { WhatsApp: 'var(--green)', Instagram: '#e1306c', Email: 'var(--blue)', FaceBook: '#1877f2' };
const ESTADO_CLASS = {
  'Sin contactar': 'estado-sin',
  'Email enviado': 'estado-email',
  'WA enviado':    'estado-wa',
  'Respondió':     'estado-resp',
  'Cerrado':       'estado-cerr',
  'No interesa':   'estado-no',
};

let currentEstado = '';
let currentCanal  = '';
let currentQ      = '';
let page          = 0;
const PAGE_SIZE   = 100;

function badge(estado) {
  const cls = ESTADO_CLASS[estado] || 'estado-sin';
  return \`<span class="estado \${cls}">\${estado}</span>\`;
}

async function loadLeads() {
  const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  if (currentEstado) params.set('estado', currentEstado);
  if (currentCanal)  params.set('canal', currentCanal);
  if (currentQ)      params.set('q', currentQ);

  const leads = await fetch('/api/leads?' + params).then(r => r.json());
  const tbody  = document.getElementById('tbody');
  tbody.innerHTML = '';

  leads.forEach(l => {
    const fecha = l.fecha_scrapeado ? l.fecha_scrapeado.slice(0, 10) : '';
    const web   = l.sitio_web ? '✓' : '<span style="color:var(--fire)">✗</span>';
    const canales = (l.canal_contacto || '').split(',').map(c => c.trim()).filter(Boolean);
    const canalHtml = canales.map(c =>
      \`<span class="canal-tag" style="color:\${CANAL_COLOR[c] || 'var(--od2)'}">\${c}</span>\`
    ).join('') || '<span style="color:var(--od3)">—</span>';
    tbody.insertAdjacentHTML('beforeend', \`
      <tr style="cursor:pointer" onclick="openDrawer(\${l.id})">
        <td style="color:var(--od3);font-family:var(--mono);font-size:11px">\${l.id}</td>
        <td class="nombre">\${l.nombre}</td>
        <td>\${l.categoria || ''}</td>
        <td class="tel">\${l.telefono || ''}</td>
        <td class="email">\${l.email || ''}</td>
        <td style="text-align:center">\${web}</td>
        <td>\${badge(l.estado)}</td>
        <td>\${canalHtml}</td>
        <td style="color:var(--od3);font-size:11px">\${fecha}</td>
      </tr>
    \`);
  });

  document.getElementById('pagerInfo').textContent =
    \`Página \${page + 1} · \${leads.length} resultados\`;
  document.getElementById('btnPrev').disabled = page === 0;
  document.getElementById('btnNext').disabled = leads.length < PAGE_SIZE;
}

function setFiltro(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentEstado = btn.dataset.estado;
  currentCanal  = '';
  page = 0;
  loadLeads();
}

function setCanal(btn) {
  const yaActivo = btn.classList.contains('active');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (yaActivo) {
    // Segundo clic: quitar filtro, volver a Todos
    currentCanal = '';
    document.querySelector('.filter-btn[data-estado=""]').classList.add('active');
  } else {
    btn.classList.add('active');
    currentCanal = btn.dataset.canal;
  }
  currentEstado = '';
  page = 0;
  loadLeads();
}

let searchTimer;
function onSearch(val) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { currentQ = val; page = 0; loadLeads(); }, 300);
}

function prevPage() { if (page > 0) { page--; loadLeads(); } }
function nextPage() { page++; loadLeads(); }

async function openDrawer(id) {
  const l = await fetch('/api/leads/' + id).then(r => r.json());
  const wa = l.telefono ? \`https://wa.me/52\${l.telefono.replace(/\\D/g,'')}?text=\${encodeURIComponent(l.mensaje_borrador || '')}\` : null;

  document.getElementById('drawerContent').innerHTML = \`
    <h2>\${l.nombre}</h2>

    <div class="field">
      <label>Estado</label>
      <select id="drawerEstado" onchange="saveEstado(\${l.id})">
        \${ESTADOS.map(e => \`<option \${e===l.estado?'selected':''} value="\${e}">\${e}</option>\`).join('')}
      </select>
    </div>

    <div class="field">
      <label>Contactado por</label>
      <div class="canal-check">
        \${CANALES.map(c => {
          const checked = (l.canal_contacto || '').includes(c) ? 'checked' : '';
          return \`<label><input type="checkbox" value="\${c}" \${checked} onchange="saveCanal(\${l.id})"><span style="color:\${CANAL_COLOR[c]}">\${c}</span></label>\`;
        }).join('')}
      </div>
    </div>

    \${l.telefono ? \`
    <div class="field">
      <label>Teléfono</label>
      <div class="val">\${l.telefono}</div>
      \${wa ? \`<a class="wa-link" href="\${wa}" target="_blank">Abrir WhatsApp →</a>\` : ''}
    </div>\` : ''}

    \${l.email ? \`
    <div class="field">
      <label>Email</label>
      <div class="val">\${l.email}</div>
    </div>\` : ''}

    \${l.sitio_web ? \`
    <div class="field">
      <label>Sitio web</label>
      <div class="val"><a href="\${l.sitio_web}" target="_blank">\${l.sitio_web}</a></div>
    </div>\` : ''}

    \${l.categoria ? \`
    <div class="field">
      <label>Categoría</label>
      <div class="val">\${l.categoria}</div>
    </div>\` : ''}

    \${l.calificacion || l.resenas ? \`
    <div class="field">
      <label>Google Maps</label>
      <div class="val">\${l.calificacion || '-'} ★ · \${l.resenas || 0} reseñas</div>
    </div>\` : ''}

    \${l.mensaje_borrador ? \`
    <div class="field">
      <label>Mensaje WA borrador</label>
      <div class="msg-box">\${l.mensaje_borrador}</div>
    </div>\` : ''}

    <div class="field">
      <label>Notas</label>
      <textarea id="drawerNotas" placeholder="Notas internas...">\${l.notas || ''}</textarea>
      <button class="btn btn-primary" style="margin-top:8px;width:100%" onclick="saveNotas(\${l.id})">Guardar notas</button>
    </div>

    <div style="font-size:11px;color:var(--od3);margin-top:12px">
      Scrapeado: \${l.fecha_scrapeado?.slice(0,10) || '-'}<br>
      Contactado: \${l.fecha_contacto?.slice(0,10) || 'nunca'}<br>
      Query: \${l.query_origen || '-'}
    </div>
  \`;

  document.getElementById('overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
}

async function saveEstado(id) {
  const estado = document.getElementById('drawerEstado').value;
  await fetch('/api/leads/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado, fecha_contacto: new Date().toISOString() }),
  });
  loadLeads();
  refreshStats();
}

function refreshStats() {
  fetch('/api/stats').then(r => r.json()).then(s => {
    document.getElementById('b-total').textContent = s.total;
    document.getElementById('b-sin').textContent   = s.sin_contactar;
    document.getElementById('b-email').textContent = s.email_enviado;
    document.getElementById('b-wa').textContent    = s.wa_enviado;
    document.getElementById('b-resp').textContent  = s.respondio;
    document.getElementById('b-cerr').textContent  = s.cerrado;
    document.getElementById('b-no').textContent    = s.no_interesa;
    document.getElementById('b-cwa').textContent   = s.canal_wa;
    document.getElementById('b-cig').textContent   = s.canal_ig;
    document.getElementById('b-cem').textContent   = s.canal_email;
    document.getElementById('b-cfb').textContent   = s.canal_fb;
  });
}

async function saveCanal(id) {
  const canales = [...document.querySelectorAll('.canal-check input:checked')].map(c => c.value);
  await fetch('/api/leads/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canal_contacto: canales.join(', ') }),
  });
  loadLeads();
  refreshStats();
}

async function saveNotas(id) {
  const notas = document.getElementById('drawerNotas').value;
  await fetch('/api/leads/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notas }),
  });
  const btn = event.target;
  btn.textContent = '✓ Guardado';
  setTimeout(() => btn.textContent = 'Guardar notas', 1500);
}

loadLeads();
</script>
</body>
</html>`;
}

app.listen(PORT, () => {
  console.log(`\nLIBERA CRM → http://localhost:${PORT}\n`);
});
