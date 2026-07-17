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

const ESTADOS = ['Sin contactar', 'Contactado por Email', 'Contactado por WhatsApp', 'Contactado por Instagram', 'Contactado por FaceBook', 'Respondió', 'Cerrado', 'Cerrado vendido', 'No interesa'];
const CANALES = ['WhatsApp', 'Instagram', 'Email', 'FaceBook'];
const LINKS   = ['Web propia', 'Facebook', 'Instagram', 'TikTok', 'WhatsApp', 'Linktree', 'Sin link'];
const PRIORIDADES = ['Alta', 'Media', 'Baja'];

function parseFilters(query) {
  const { estado, actividad, canal, q, link, email, categoria, ciudad, prioridad, seguimiento, etiqueta, orden } = query;
  return {
    estado:      estado    || undefined,
    actividad:   actividad || undefined,
    canal:       canal     || undefined,
    q:           q         || undefined,
    tipo_link:   link      || undefined,
    tiene_email: email     || undefined,   // 'con' | 'sin'
    categoria:   categoria || undefined,
    ciudad:      ciudad    || undefined,
    prioridad:   prioridad || undefined,
    seguimiento: seguimiento || undefined,
    etiqueta:    etiqueta  || undefined,
    orden:       orden     || undefined,
  };
}

// ── API ───────────────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  res.json(db.getStats());
});

app.get('/api/categorias', (req, res) => {
  res.json(db.getCategorias());
});

app.get('/api/ciudades', (req, res) => {
  res.json(db.getCiudades());
});

app.get('/api/etiquetas', (req, res) => {
  res.json(db.getEtiquetas());
});

app.get('/api/leads', (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  const filters = parseFilters(req.query);
  const leads = db.getLeads({ ...filters, limit: +limit, offset: +offset });
  const total = db.countLeadsFiltered(filters);
  res.json({ leads, total });
});

app.get('/api/export.csv', (req, res) => {
  const filters = parseFilters(req.query);
  const leads = db.getLeads(filters);
  const cols = ['id', 'nombre', 'categoria', 'ciudad', 'telefono', 'email', 'sitio_web', 'tipo_link', 'estado', 'canal_contacto', 'prioridad', 'proxima_accion', 'fecha_seguimiento', 'etiquetas', 'calificacion', 'resenas', 'direccion', 'fecha_scrapeado', 'fecha_contacto', 'notas'];
  const csvCell = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [cols.join(',')]
    .concat(leads.map(l => cols.map(c => csvCell(l[c])).join(',')))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="libera-leads.csv"');
  res.send('﻿' + csv);
});

app.get('/api/leads/:id', (req, res) => {
  const lead = db.getLead(+req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  res.json(lead);
});

app.patch('/api/leads/:id', (req, res) => {
  const { estado, notas, fecha_contacto, canal_contacto, prioridad, proxima_accion, fecha_seguimiento, etiquetas } = req.body;
  if (estado) db.updateEstado(+req.params.id, estado, fecha_contacto || new Date().toISOString());
  if (notas !== undefined) db.updateNotas(+req.params.id, notas);
  if (canal_contacto !== undefined) db.updateCanal(+req.params.id, canal_contacto);
  db.updateLead(+req.params.id, {
    ...(prioridad !== undefined ? { prioridad: PRIORIDADES.includes(prioridad) ? prioridad : 'Media' } : {}),
    ...(proxima_accion !== undefined ? { proxima_accion: String(proxima_accion || '').trim() || null } : {}),
    ...(fecha_seguimiento !== undefined ? { fecha_seguimiento: fecha_seguimiento || null } : {}),
    ...(etiquetas !== undefined ? { etiquetas: String(etiquetas || '').split(',').map(v => v.trim()).filter(Boolean).join(', ') || null } : {}),
  });
  res.json(db.getLead(+req.params.id));
});

// ── HTML ──────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  const stats = db.getStats();
  res.send(html(stats));
});

function html(stats) {
  const links = stats.links || {};
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LIBERA CRM</title>
<meta name="description" content="Bandeja comercial de LIBERA para segmentar leads y dar seguimiento a próximas acciones.">
<style>
:root {
  --void: #f6f3ec; --surface: #ffffff;
  --border: rgba(0,48,73,0.10); --border-strong: rgba(0,48,73,0.18);
  --od: #003049; --od2: rgba(0,48,73,0.70); --od3: rgba(0,48,73,0.42);
  --fire: #f77f00; --fire-bg: rgba(247,127,0,0.09); --fire-dark: #d96f00;
  --green: #16a34a; --yellow: #b45309; --red: #d62828; --blue: #2563eb;
  --wa: #1fa855; --ig: #d62e6e; --fb: #1877f2; --tt: #1a1a1a; --lt: #3ba227;
  --radius: 8px; --radius-lg: 12px;
  --font: "Aptos", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
  --mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
  --ease: cubic-bezier(0.25, 1, 0.5, 1);
  --shadow-sm: 0 1px 2px rgba(0,48,73,0.05);
  --shadow-md: 0 2px 8px rgba(0,48,73,0.07);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { height: 100%; }
body { background: var(--void); color: var(--od); font-family: var(--font); font-size: 14px; line-height: 1.45; height: 100%; overflow: hidden; }
a { color: var(--fire-dark); text-decoration: none; }
button { font-family: var(--font); }
:focus-visible { outline: 2px solid var(--fire); outline-offset: 2px; border-radius: 4px; }

/* ── Layout: cabecera de marca + bandeja operativa ── */
.layout { display: flex; flex-direction: column; height: 100dvh; }
.sidebar { height: 68px; flex: 0 0 68px; background: rgba(255,255,255,.92); border-bottom: 1px solid var(--border); padding: 0 30px; display: flex; align-items: center; backdrop-filter: blur(14px); }
.sidebar .nav-label, .sidebar .filter-btn { display: none; }
.main { display: flex; flex-direction: column; width: min(100%, 1600px); margin: 0 auto; padding: 24px 30px 18px; overflow: hidden; min-width: 0; flex: 1; }

/* ── Sidebar ── */
.brand { display: flex; align-items: center; gap: 14px; margin: 0; }
.brand img { width: 142px; height: auto; display: block; }
.brand small { display: block; border-left: 1px solid var(--border-strong); padding-left: 14px; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--od3); font-weight: 750; }
.nav-label { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--od3); margin: 18px 4px 4px; font-weight: 600; }
.filter-btn { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 6px 10px; border-radius: var(--radius); border: none; background: transparent; color: var(--od2); cursor: pointer; font-size: 13px; transition: background .12s var(--ease), color .12s var(--ease); text-align: left; }
.filter-btn:hover { background: rgba(0,48,73,0.05); color: var(--od); }
.filter-btn.active { background: var(--fire-bg); color: var(--od); font-weight: 600; }
.filter-btn .badge { background: rgba(0,48,73,0.07); color: var(--od3); padding: 1px 7px; border-radius: 100px; font-size: 11px; font-family: var(--mono); font-variant-numeric: tabular-nums; }
.filter-btn.active .badge { background: var(--fire); color: #fff; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 7px; vertical-align: middle; flex-shrink: 0; }

/* ── Encabezado del main ── */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 18px; flex-wrap: wrap; }
.page-head h1 { font-size: clamp(24px, 2.3vw, 34px); font-weight: 720; letter-spacing: -0.045em; line-height: 1; }
.page-head .eyebrow { color: var(--fire-dark); font-size: 10px; font-weight: 750; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 8px; }
.page-head .sub { font-size: 13px; color: var(--od3); font-variant-numeric: tabular-nums; }
.head-actions { display: flex; gap: 8px; }

.view-tabs { display: flex; align-items: center; gap: 3px; margin-bottom: 16px; padding: 4px; width: fit-content; background: rgba(0,48,73,.055); border-radius: 10px; }
.view-tab { border: 0; background: transparent; color: var(--od2); padding: 7px 12px; border-radius: 7px; cursor: pointer; font: 600 12px/1 var(--font); transition: background .15s var(--ease), color .15s var(--ease), box-shadow .15s var(--ease); }
.view-tab:hover { color: var(--od); }
.view-tab.active { background: var(--surface); color: var(--od); box-shadow: 0 1px 3px rgba(0,48,73,.10); }

/* ── Stats ── */
.stats { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 8px; margin-bottom: 18px; }
.stat-card { background: transparent; border: 0; border-left: 1px solid var(--border); border-radius: 0; padding: 9px 16px; box-shadow: none; }
.stat-card:first-child { border-left: 0; padding-left: 0; }
.stat-card.actionable { cursor: pointer; text-align: left; font-family: var(--font); color: var(--od); transition: transform .15s var(--ease), border-color .15s var(--ease), box-shadow .15s var(--ease); }
.stat-card.actionable:hover { transform: translateY(-1px); background: rgba(255,255,255,.65); border-color: var(--border); box-shadow: none; }
.stat-card.actionable:active { transform: translateY(0); }
.stat-num { font-size: 26px; font-weight: 700; letter-spacing: -0.045em; font-variant-numeric: tabular-nums; line-height: 1.05; }
.stat-lbl { font-size: 10.5px; color: var(--od3); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 3px; font-weight: 600; }

/* ── Toolbar ── */
.toolbar { display: flex; gap: 8px; margin-bottom: 10px; align-items: center; }
.search-wrap { flex: 1; min-width: 220px; position: relative; }
.search-wrap .kbd { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); font-size: 10px; font-family: var(--mono); color: var(--od3); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; background: var(--void); pointer-events: none; }
.search { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 34px 8px 12px; color: var(--od); font-size: 13px; font-family: var(--font); transition: border-color .12s var(--ease); }
.search::placeholder { color: var(--od3); }
.search:focus { outline: none; border-color: var(--fire); box-shadow: 0 0 0 3px rgba(247,127,0,0.12); }
.toolbar select { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; color: var(--od2); font-size: 13px; max-width: 230px; font-family: var(--font); }
.toolbar select:focus { outline: none; border-color: var(--fire); }
.filter-toggle { white-space: nowrap; display: inline-flex; align-items: center; gap: 8px; }
.filter-count { display: none; min-width: 18px; height: 18px; place-items: center; background: var(--fire); color: #fff; border-radius: 5px; font: 700 10px/1 var(--mono); }
.filter-count.visible { display: inline-grid; }
.filter-panel { display: none; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 8px; padding: 12px; margin: 0 0 10px; background: rgba(255,255,255,.72); border: 1px solid var(--border); border-radius: var(--radius-lg); }
.filter-panel.open { display: grid; }
.filter-panel select { min-width: 0; width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; color: var(--od2); font: 12px var(--font); }
.filter-panel select:focus { outline: none; border-color: var(--fire); }
.filter-panel .segment-bar { grid-column: 1 / -1; margin: 4px 0 0; padding-top: 10px; border-top: 1px solid var(--border); }
.segment-bar { display: flex; gap: 8px; margin: -2px 0 10px; align-items: center; flex-wrap: wrap; }
.segment-bar select, .segment-bar input { background: transparent; border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 9px; color: var(--od2); font-size: 12px; font-family: var(--font); }
.segment-bar select { min-width: 190px; }
.segment-composer { display: none; align-items: center; gap: 6px; }
.segment-composer.open { display: flex; }
.segment-composer input { background: var(--surface); min-width: 190px; }
.text-btn { border: none; background: none; color: var(--fire-dark); cursor: pointer; padding: 5px 3px; font-size: 12px; font-weight: 600; }
.text-btn:hover { text-decoration: underline; }
.btn { padding: 8px 14px; border-radius: var(--radius); border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: background .12s var(--ease), border-color .12s var(--ease); }
.btn-primary { background: var(--fire); color: #fff; }
.btn-primary:hover { background: var(--fire-dark); }
.btn-ghost { background: var(--surface); border: 1px solid var(--border); color: var(--od2); }
.btn-ghost:hover { border-color: var(--border-strong); color: var(--od); }

/* ── Chips de filtros activos ── */
.chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.chips:empty { display: none; }
.chip { display: inline-flex; align-items: center; gap: 6px; background: var(--fire-bg); color: var(--od); border: 1px solid rgba(247,127,0,0.28); padding: 3px 10px; border-radius: 100px; font-size: 12px; font-weight: 600; }
.chip button { background: none; border: none; color: var(--fire-dark); cursor: pointer; font-size: 13px; line-height: 1; padding: 0 0 0 2px; }
.chip.clear { background: transparent; border-color: var(--border); }
.chip.clear button { color: var(--od3); font-size: 12px; }

/* ── Tabla: header pegajoso, scroll propio ── */
.table-wrap { flex: 1; min-height: 0; overflow: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 12px 30px rgba(0,48,73,.055); transition: opacity .15s var(--ease); }
.table-wrap.loading { opacity: 0.55; pointer-events: none; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th { position: sticky; top: 0; z-index: 2; background: #fbfaf7; color: var(--od3); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 11px 15px; text-align: left; font-weight: 650; box-shadow: inset 0 -1px 0 var(--border-strong); white-space: nowrap; }
td { padding: 11px 15px; border-bottom: 1px solid var(--border); color: var(--od2); vertical-align: middle; }
tbody tr { cursor: pointer; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: rgba(247,127,0,0.06); }
td.nombre { color: var(--od); font-weight: 500; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lead-cell strong { display: block; color: var(--od); font-weight: 650; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lead-cell small, .context-cell small, .contact-cell small { display: block; color: var(--od3); font-size: 10.5px; margin-top: 3px; }
.contact-cell span { display: block; font-family: var(--mono); font-size: 11px; white-space: nowrap; }
td.cat { max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
td.tel, td.email { font-family: var(--mono); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.email { max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
td.idcol { color: var(--od3); font-family: var(--mono); font-size: 11px; font-variant-numeric: tabular-nums; }
td.fecha { color: var(--od3); font-size: 11px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.empty-state { text-align: center; padding: 56px 20px; color: var(--od3); }
.empty-state strong { display: block; color: var(--od2); font-size: 15px; margin-bottom: 6px; }

/* ── Tags ── */
.link-tag { display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 700; white-space: nowrap; background: rgba(0,48,73,0.05); }
a.link-tag:hover { background: rgba(0,48,73,0.1); }
.canal-tag { display: inline-block; padding: 2px 7px; border-radius: 100px; font-size: 10px; font-weight: 600; margin-right: 3px; white-space: nowrap; background: rgba(0,48,73,0.05); }
.priority { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 650; white-space: nowrap; }
.priority::before { content: ''; width: 7px; height: 7px; border-radius: 2px; background: var(--od3); }
.priority-alta::before { background: var(--red); }
.priority-media::before { background: var(--fire); }
.priority-baja::before { background: var(--green); }
.followup { min-width: 150px; }
.followup strong { display: block; color: var(--od); font-size: 12px; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.followup time { display: block; color: var(--od3); font-size: 10.5px; margin-top: 2px; font-variant-numeric: tabular-nums; }
.followup.overdue time { color: var(--red); font-weight: 700; }
.followup.today time { color: var(--yellow); font-weight: 700; }
.estado { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 100px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.estado::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.estado-sin   { background: rgba(0,48,73,0.06); color: var(--od3); }
.estado-email { background: rgba(37,99,235,0.10); color: var(--blue); }
.estado-wa    { background: rgba(22,163,74,0.10); color: var(--green); }
.estado-ig    { background: rgba(214,46,110,0.10); color: var(--ig); }
.estado-fb    { background: rgba(24,119,242,0.10); color: var(--fb); }
.estado-resp  { background: rgba(180,83,9,0.12); color: var(--yellow); }
.estado-cerr  { background: rgba(22,163,74,0.16); color: #12813b; }
.estado-cerrv { background: rgba(22,163,74,0.24); color: #0d5c2a; }
.estado-no    { background: rgba(214,40,40,0.08); color: var(--red); }

/* ── Pager ── */
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 10px; color: var(--od3); font-size: 12px; font-variant-numeric: tabular-nums; }
.pager .btns { display: flex; gap: 6px; }
.pager button { background: var(--surface); border: 1px solid var(--border); color: var(--od2); padding: 5px 13px; border-radius: var(--radius); cursor: pointer; font-size: 12px; transition: border-color .12s var(--ease); }
.pager button:hover:not(:disabled) { border-color: var(--border-strong); color: var(--od); }
.pager button:disabled { opacity: .35; cursor: default; }

/* ── Drawer ── */
.drawer-overlay { position: fixed; inset: 0; background: rgba(0,48,73,.32); z-index: 100; opacity: 0; pointer-events: none; transition: opacity .2s var(--ease); }
.drawer-overlay.open { opacity: 1; pointer-events: auto; }
.drawer { position: fixed; right: 0; top: 0; bottom: 0; width: 440px; max-width: 92vw; background: var(--surface); border-left: 1px solid var(--border); z-index: 101; transform: translateX(100%); transition: transform .24s var(--ease); display: flex; flex-direction: column; }
.drawer.open { transform: translateX(0); box-shadow: -8px 0 32px rgba(0,48,73,0.10); }
.drawer-head { padding: 22px 26px 14px; border-bottom: 1px solid var(--border); }
.drawer-head h2 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; padding-right: 32px; line-height: 1.3; }
.drawer-head .meta { font-size: 12px; color: var(--od3); margin-top: 4px; }
.drawer-body { padding: 18px 26px 26px; overflow-y: auto; flex: 1; }
.drawer-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--od3); cursor: pointer; font-size: 18px; padding: 4px 8px; border-radius: var(--radius); }
.drawer-close:hover { background: rgba(0,48,73,0.06); color: var(--od); }
.quick-actions { display: flex; gap: 8px; margin: 12px 0 4px; flex-wrap: wrap; }
.qa-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: var(--radius); font-size: 12px; font-weight: 700; color: #fff; border: none; cursor: pointer; }
.qa-wa { background: var(--wa); }
.qa-mail { background: var(--blue); }
.qa-web { background: var(--od); }
.qa-btn:hover { opacity: .88; }
.field { margin-bottom: 15px; }
.field label { display: block; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--od3); margin-bottom: 5px; font-weight: 600; }
.field .val { font-size: 14px; color: var(--od); word-break: break-word; }
.field select, .field textarea { width: 100%; background: var(--void); border: 1px solid var(--border); border-radius: var(--radius); color: var(--od); padding: 8px 10px; font-size: 13px; font-family: var(--font); }
.field select:focus, .field textarea:focus { outline: none; border-color: var(--fire); box-shadow: 0 0 0 3px rgba(247,127,0,0.12); }
.field textarea { resize: vertical; min-height: 76px; }
.followup-panel { background: #fff8ed; border: 1px solid rgba(247,127,0,.22); border-radius: var(--radius-lg); padding: 14px; margin-bottom: 17px; }
.followup-panel .panel-title { font-size: 12px; font-weight: 750; margin-bottom: 12px; color: var(--od); }
.followup-grid { display: grid; grid-template-columns: 1fr 1.35fr; gap: 10px; }
.followup-panel .field { margin-bottom: 10px; }
.followup-panel .field:last-of-type { margin-bottom: 0; }
.followup-panel input, .followup-panel select { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); color: var(--od); padding: 8px 10px; font: inherit; }
.followup-panel input:focus, .followup-panel select:focus { outline: none; border-color: var(--fire); box-shadow: 0 0 0 3px rgba(247,127,0,.12); }
.tag-list { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
.tag { background: rgba(0,48,73,.06); color: var(--od2); padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 650; }
.toast { position: fixed; left: 50%; bottom: 22px; transform: translate(-50%, 12px); background: var(--od); color: #fff; padding: 9px 14px; border-radius: var(--radius); font-size: 12px; z-index: 200; opacity: 0; pointer-events: none; transition: opacity .18s var(--ease), transform .18s var(--ease); box-shadow: var(--shadow-md); }
.toast.show { opacity: 1; transform: translate(-50%, 0); }
.canal-check { display: flex; gap: 4px 14px; flex-wrap: wrap; margin-top: 2px; }
.canal-check label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--od2); cursor: pointer; padding: 3px 0; text-transform: none; letter-spacing: 0; font-weight: 500; margin-bottom: 0; }
.canal-check input { accent-color: var(--fire); width: 15px; height: 15px; }
.msg-box { background: var(--void); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; font-size: 12px; color: var(--od2); white-space: pre-wrap; margin-top: 4px; max-height: 150px; overflow-y: auto; line-height: 1.5; }
.drawer-meta { font-size: 11px; color: var(--od3); border-top: 1px solid var(--border); padding-top: 12px; margin-top: 6px; line-height: 1.8; }
.copy-hint { font-size: 11px; color: var(--od3); cursor: pointer; margin-left: 8px; text-transform: none; letter-spacing: 0; font-weight: 500; }
.copy-hint:hover { color: var(--fire-dark); }

@media (prefers-reduced-motion: reduce) {
  .drawer, .drawer-overlay, .filter-btn, .table-wrap, .btn, .search { transition: none; }
}
@media (max-width: 900px) {
  body { overflow: auto; }
  .layout { height: auto; min-height: 100dvh; }
  .sidebar { height: 60px; flex-basis: 60px; padding: 0 16px; }
  .brand img { width: 120px; }
  .main { min-height: 100dvh; padding: 16px; }
  .stats { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
  .stat-card, .stat-card:first-child { border-left: 1px solid var(--border); padding-left: 12px; }
  .view-tabs { width: 100%; overflow-x: auto; }
  .view-tab { flex: 0 0 auto; }
  .filter-panel { grid-template-columns: 1fr 1fr; }
  .table-wrap { min-height: 55dvh; }
}
@media (max-width: 560px) {
  .page-head { align-items: flex-start; }
  .page-head h1 { font-size: 27px; }
  .head-actions { width: 100%; }
  .head-actions .btn { flex: 1; }
  .stats { display: flex; overflow-x: auto; padding-bottom: 6px; }
  .stat-card { min-width: 132px; }
  .filter-panel { grid-template-columns: 1fr; }
  .filter-panel .segment-bar { grid-column: 1; }
  .search-wrap .kbd { display: none; }
}
</style>
</head>
<body>
<div class="layout">

<!-- SIDEBAR -->
<aside class="sidebar">
  <div class="brand">
    <img src="/assets/logo-libera.png" alt="LIBERA Studio">
    <small>CRM</small>
  </div>

  <div class="nav-label">Pipeline</div>
  <button class="filter-btn active" data-group="estado" data-val="" onclick="setFiltro(this)">
    Todos <span class="badge" id="b-total">${stats.total}</span>
  </button>
  <button class="filter-btn" data-group="estado" data-val="Sin contactar" onclick="setFiltro(this)">
    Sin contactar <span class="badge" id="b-sin">${stats.sin_contactar}</span>
  </button>
  <button class="filter-btn" data-group="estado" data-val="Contactado por Email" onclick="setFiltro(this)">
    Contactado por Email <span class="badge" id="b-email">${stats.contactado_email}</span>
  </button>
  <button class="filter-btn" data-group="estado" data-val="Contactado por WhatsApp" onclick="setFiltro(this)">
    Contactado por WhatsApp <span class="badge" id="b-wa">${stats.contactado_wa}</span>
  </button>
  <button class="filter-btn" data-group="estado" data-val="Contactado por Instagram" onclick="setFiltro(this)">
    Contactado por Instagram <span class="badge" id="b-ig">${stats.contactado_ig}</span>
  </button>
  <button class="filter-btn" data-group="estado" data-val="Contactado por FaceBook" onclick="setFiltro(this)">
    Contactado por FaceBook <span class="badge" id="b-fb">${stats.contactado_fb}</span>
  </button>
  <button class="filter-btn" data-group="estado" data-val="Respondió" onclick="setFiltro(this)">
    Respondió <span class="badge" id="b-resp">${stats.respondio}</span>
  </button>
  <button class="filter-btn" data-group="estado" data-val="Cerrado" onclick="setFiltro(this)">
    Cerrado <span class="badge" id="b-cerr">${stats.cerrado}</span>
  </button>
  <button class="filter-btn" data-group="estado" data-val="Cerrado vendido" onclick="setFiltro(this)">
    Cerrado vendido <span class="badge" id="b-cerrv">${stats.cerrado_vendido}</span>
  </button>
  <button class="filter-btn" data-group="estado" data-val="No interesa" onclick="setFiltro(this)">
    No interesa <span class="badge" id="b-no">${stats.no_interesa}</span>
  </button>

  <div class="nav-label">Seguimiento</div>
  <button class="filter-btn" data-group="seguimiento" data-val="vencido" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--red)"></span>Vencidos</span> <span class="badge" id="b-venc">${stats.seguimiento_vencido}</span>
  </button>
  <button class="filter-btn" data-group="seguimiento" data-val="hoy" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--yellow)"></span>Para hoy</span> <span class="badge" id="b-hoy">${stats.seguimiento_hoy}</span>
  </button>
  <button class="filter-btn" data-group="seguimiento" data-val="proximos7" onclick="setFiltro(this)">
    Próximos 7 días <span class="badge" id="b-prox">${stats.seguimiento_proximos7}</span>
  </button>
  <button class="filter-btn" data-group="seguimiento" data-val="sin_fecha" onclick="setFiltro(this)">
    Sin seguimiento <span class="badge" id="b-sf">${stats.sin_seguimiento}</span>
  </button>

  <div class="nav-label">Prioridad</div>
  <button class="filter-btn" data-group="prioridad" data-val="Alta" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--red)"></span>Alta</span> <span class="badge" id="b-pa">${stats.prioridad_alta}</span>
  </button>
  <button class="filter-btn" data-group="prioridad" data-val="Media" onclick="setFiltro(this)">Media</button>
  <button class="filter-btn" data-group="prioridad" data-val="Baja" onclick="setFiltro(this)">Baja</button>

  <div class="nav-label">Canal de contacto</div>
  <button class="filter-btn" data-group="canal" data-val="WhatsApp" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--wa)"></span>WhatsApp</span> <span class="badge" id="b-cwa">${stats.canal_wa}</span>
  </button>
  <button class="filter-btn" data-group="canal" data-val="Instagram" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--ig)"></span>Instagram</span> <span class="badge" id="b-cig">${stats.canal_ig}</span>
  </button>
  <button class="filter-btn" data-group="canal" data-val="Email" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--blue)"></span>Email</span> <span class="badge" id="b-cem">${stats.canal_email}</span>
  </button>
  <button class="filter-btn" data-group="canal" data-val="FaceBook" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--fb)"></span>Facebook</span> <span class="badge" id="b-cfb">${stats.canal_fb}</span>
  </button>

  <div class="nav-label">Tipo de link</div>
  <button class="filter-btn" data-group="link" data-val="Web propia" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--od)"></span>Web propia</span> <span class="badge" id="b-lweb">${links['Web propia'] || 0}</span>
  </button>
  <button class="filter-btn" data-group="link" data-val="Facebook" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--fb)"></span>Facebook</span> <span class="badge" id="b-lfb">${links['Facebook'] || 0}</span>
  </button>
  <button class="filter-btn" data-group="link" data-val="Instagram" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--ig)"></span>Instagram</span> <span class="badge" id="b-lig">${links['Instagram'] || 0}</span>
  </button>
  <button class="filter-btn" data-group="link" data-val="TikTok" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--tt)"></span>TikTok</span> <span class="badge" id="b-ltt">${links['TikTok'] || 0}</span>
  </button>
  <button class="filter-btn" data-group="link" data-val="WhatsApp" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--wa)"></span>WhatsApp</span> <span class="badge" id="b-lwa">${links['WhatsApp'] || 0}</span>
  </button>
  <button class="filter-btn" data-group="link" data-val="Linktree" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--lt)"></span>Linktree</span> <span class="badge" id="b-ltr">${links['Linktree'] || 0}</span>
  </button>
  <button class="filter-btn" data-group="link" data-val="Sin link" onclick="setFiltro(this)">
    <span><span class="dot" style="background:var(--od3)"></span>Sin link</span> <span class="badge" id="b-lno">${links['Sin link'] || 0}</span>
  </button>

  <div class="nav-label">Email</div>
  <button class="filter-btn" data-group="email" data-val="con" onclick="setFiltro(this)">
    Con email <span class="badge" id="b-econ">${stats.con_email}</span>
  </button>
  <button class="filter-btn" data-group="email" data-val="sin" onclick="setFiltro(this)">
    Sin email <span class="badge" id="b-esin">${stats.sin_email}</span>
  </button>
</aside>

<!-- MAIN -->
<main class="main">
  <div class="page-head">
    <div>
      <p class="eyebrow">Bandeja comercial</p>
      <h1>Seguimiento de leads</h1>
      <span class="sub" id="headSub"></span>
    </div>
    <div class="head-actions">
      <button class="btn btn-ghost" onclick="exportCsv()">Exportar CSV</button>
      <button class="btn btn-ghost" onclick="refreshAll()">Actualizar</button>
    </div>
  </div>

  <nav class="view-tabs" aria-label="Vistas rápidas">
    <button class="view-tab active" data-view="todos" onclick="setView('todos')">Todos</button>
    <button class="view-tab" data-view="sin_contactar" onclick="setView('sin_contactar')">Sin contactar</button>
    <button class="view-tab" data-view="trabajados" onclick="setView('trabajados')">Trabajados</button>
    <button class="view-tab" data-view="respondieron" onclick="setView('respondieron')">Respondieron</button>
    <button class="view-tab" data-view="cerrados" onclick="setView('cerrados')">Cerrados</button>
  </nav>

  <div class="stats">
    <button class="stat-card actionable" onclick="setView('trabajados')"><div class="stat-num" id="s-trab">${stats.trabajados}</div><div class="stat-lbl">Trabajados</div></button>
    <button class="stat-card actionable" onclick="quickFilter('seguimiento','vencido')"><div class="stat-num" style="color:var(--red)" id="s-venc">${stats.seguimiento_vencido}</div><div class="stat-lbl">Seguimientos vencidos</div></button>
    <button class="stat-card actionable" onclick="quickFilter('seguimiento','hoy')"><div class="stat-num" style="color:var(--yellow)" id="s-hoy">${stats.seguimiento_hoy}</div><div class="stat-lbl">Para hoy</div></button>
    <button class="stat-card actionable" onclick="quickFilter('seguimiento','proximos7')"><div class="stat-num" style="color:var(--blue)" id="s-prox">${stats.seguimiento_proximos7}</div><div class="stat-lbl">Próximos 7 días</div></button>
    <button class="stat-card actionable" onclick="quickFilter('prioridad','Alta')"><div class="stat-num" style="color:var(--fire-dark)" id="s-pa">${stats.prioridad_alta}</div><div class="stat-lbl">Prioridad alta</div></button>
  </div>

  <div class="toolbar">
    <div class="search-wrap">
      <input class="search" type="text" placeholder="Buscar nombre, contacto, notas, etiquetas o próxima acción..." id="searchInput" oninput="onSearch(this.value)">
      <span class="kbd">/</span>
    </div>
    <button class="btn btn-ghost filter-toggle" onclick="toggleFilters()">Filtros <span class="filter-count" id="filterCount">0</span></button>
  </div>

  <div class="filter-panel" id="filterPanel">
    <select id="estadoSelect" onchange="setSimpleFilter('estado', this.value)">
      <option value="">Cualquier estado</option>
      ${ESTADOS.map(e => '<option value="' + e + '">' + e + '</option>').join('')}
    </select>
    <select id="catSelect" onchange="setCategoria(this.value)">
      <option value="">Todas las categorías</option>
    </select>
    <select id="ciudadSelect" onchange="setCiudad(this.value)">
      <option value="">Todas las ciudades</option>
    </select>
    <select id="tagSelect" onchange="setSimpleFilter('etiqueta', this.value)">
      <option value="">Todas las etiquetas</option>
    </select>
    <select id="ordenSelect" onchange="setSimpleFilter('orden', this.value)">
      <option value="">Más recientes</option>
      <option value="seguimiento">Próximo seguimiento</option>
      <option value="prioridad">Mayor prioridad</option>
    </select>

    <select id="canalSelect" onchange="setSimpleFilter('canal', this.value)">
      <option value="">Cualquier canal</option>
      ${CANALES.map(c => '<option value="' + c + '">' + c + '</option>').join('')}
    </select>
    <select id="linkSelect" onchange="setSimpleFilter('link', this.value)">
      <option value="">Cualquier tipo de link</option>
      ${LINKS.map(l => '<option value="' + l + '">' + l + '</option>').join('')}
    </select>
    <select id="emailSelect" onchange="setSimpleFilter('email', this.value)">
      <option value="">Con o sin email</option>
      <option value="con">Con email</option>
      <option value="sin">Sin email</option>
    </select>
    <select id="prioridadSelect" onchange="setSimpleFilter('prioridad', this.value)">
      <option value="">Cualquier prioridad</option>
      ${PRIORIDADES.map(p => '<option value="' + p + '">' + p + '</option>').join('')}
    </select>

    <div class="segment-bar">
      <select id="savedSegments" onchange="applySavedSegment(this.value)">
        <option value="">Segmentos guardados</option>
      </select>
      <button class="text-btn" onclick="toggleSegmentComposer()">Guardar filtros como segmento</button>
      <div class="segment-composer" id="segmentComposer">
        <input id="segmentName" maxlength="40" placeholder="Nombre del segmento">
        <button class="btn btn-primary" onclick="saveSegment()">Guardar</button>
        <button class="text-btn" onclick="toggleSegmentComposer(false)">Cancelar</button>
      </div>
      <button class="text-btn" id="deleteSegmentBtn" style="display:none;color:var(--red)" onclick="deleteSelectedSegment()">Eliminar segmento</button>
    </div>
  </div>

  <div class="chips" id="chips"></div>

  <div class="table-wrap" id="tableWrap">
    <table id="leadsTable">
      <thead>
        <tr>
          <th>Lead</th>
          <th>Contexto</th>
          <th>Contacto</th>
          <th>Estado</th>
          <th>Prioridad</th>
          <th>Próxima acción</th>
          <th>Etiquetas</th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>

  <div class="pager">
    <span id="pagerInfo"></span>
    <div class="btns">
      <button id="btnPrev" onclick="prevPage()">← Anterior</button>
      <button id="btnNext" onclick="nextPage()">Siguiente →</button>
    </div>
  </div>
</main>

</div>

<!-- DRAWER -->
<div class="drawer-overlay" id="overlay" onclick="closeDrawer()"></div>
<div class="drawer" id="drawer" role="dialog" aria-modal="true">
  <button class="drawer-close" onclick="closeDrawer()" aria-label="Cerrar">✕</button>
  <div id="drawerContent" style="display:contents"></div>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script>
const ESTADOS = ${JSON.stringify(ESTADOS)};
const CANALES = ${JSON.stringify(CANALES)};
const PRIORIDADES = ${JSON.stringify(PRIORIDADES)};
const CANAL_COLOR = { WhatsApp: 'var(--wa)', Instagram: 'var(--ig)', Email: 'var(--blue)', FaceBook: 'var(--fb)' };
const ESTADO_CLASS = {
  'Sin contactar':            'estado-sin',
  'Contactado por Email':     'estado-email',
  'Contactado por WhatsApp':  'estado-wa',
  'Contactado por Instagram': 'estado-ig',
  'Contactado por FaceBook':  'estado-fb',
  'Respondió':                'estado-resp',
  'Cerrado':                  'estado-cerr',
  'Cerrado vendido':          'estado-cerrv',
  'No interesa':              'estado-no',
};
// Al marcar un canal de contacto, se sugiere automáticamente el estado correspondiente
// (solo si el lead sigue "Sin contactar", para no pisar un avance ya registrado).
const CANAL_A_ESTADO = {
  WhatsApp:  'Contactado por WhatsApp',
  Instagram: 'Contactado por Instagram',
  Email:     'Contactado por Email',
  FaceBook:  'Contactado por FaceBook',
};
const GROUP_LABEL = { estado: 'Estado', actividad: 'Vista', canal: 'Canal', link: 'Link', email: 'Email', categoria: 'Categoría', ciudad: 'Ciudad', prioridad: 'Prioridad', seguimiento: 'Seguimiento', etiqueta: 'Etiqueta', orden: 'Orden', q: 'Búsqueda' };
const FILTER_LABEL = { vencido: 'Vencidos', hoy: 'Para hoy', proximos7: 'Próximos 7 días', sin_fecha: 'Sin fecha', seguimiento: 'Próximo seguimiento', prioridad: 'Mayor prioridad' };

// Filtros combinables: todos aplican a la vez
const filtros = { estado: '', actividad: '', canal: '', link: '', email: '', categoria: '', ciudad: '', prioridad: '', seguimiento: '', etiqueta: '', orden: '', q: '' };
let page = 0;
let total = 0;
const PAGE_SIZE = 100;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function badge(estado) {
  const cls = ESTADO_CLASS[estado] || 'estado-sin';
  return \`<span class="estado \${cls}">\${esc(estado)}</span>\`;
}

function buildParams(paging = true) {
  const params = new URLSearchParams();
  if (paging) { params.set('limit', PAGE_SIZE); params.set('offset', page * PAGE_SIZE); }
  if (filtros.estado)    params.set('estado', filtros.estado);
  if (filtros.actividad) params.set('actividad', filtros.actividad);
  if (filtros.canal)     params.set('canal', filtros.canal);
  if (filtros.link)      params.set('link', filtros.link);
  if (filtros.email)     params.set('email', filtros.email);
  if (filtros.categoria) params.set('categoria', filtros.categoria);
  if (filtros.ciudad)    params.set('ciudad', filtros.ciudad);
  if (filtros.prioridad) params.set('prioridad', filtros.prioridad);
  if (filtros.seguimiento) params.set('seguimiento', filtros.seguimiento);
  if (filtros.etiqueta) params.set('etiqueta', filtros.etiqueta);
  if (filtros.orden) params.set('orden', filtros.orden);
  if (filtros.q)         params.set('q', filtros.q);
  return params;
}

function hayFiltros() {
  return Object.values(filtros).some(v => v);
}

async function loadLeads() {
  const wrap = document.getElementById('tableWrap');
  wrap.classList.add('loading');
  const { leads, total: t } = await fetch('/api/leads?' + buildParams()).then(r => r.json());
  wrap.classList.remove('loading');
  total = t;
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';

  if (!leads.length) {
    tbody.innerHTML = \`<tr><td colspan="7"><div class="empty-state">
      <strong>Sin resultados</strong>
      \${hayFiltros() ? 'Ningún lead coincide con los filtros activos.<br><br><button class="btn btn-ghost" onclick="clearAll()">Limpiar filtros</button>' : 'Aún no hay leads en el CRM.'}
    </div></td></tr>\`;
  }

  leads.forEach(l => {
    const priorityClass = 'priority-' + (l.prioridad || 'Media').toLowerCase();
    const tags = (l.etiquetas || '').split(',').map(v => v.trim()).filter(Boolean);
    const tagsHtml = tags.slice(0, 2).map(tag => \`<span class="tag">\${esc(tag)}</span>\`).join('') + (tags.length > 2 ? \`<span class="tag">+\${tags.length - 2}</span>\` : '');
    const due = l.fecha_seguimiento ? new Date(l.fecha_seguimiento) : null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = due ? new Date(due.getFullYear(), due.getMonth(), due.getDate()) : null;
    const dueClass = due && due < now ? 'overdue' : dueDay && dueDay.getTime() === today.getTime() ? 'today' : '';
    const dueLabel = due ? due.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha';
    const lastContact = l.fecha_contacto ? new Date(l.fecha_contacto).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const followupHtml = l.proxima_accion || due
      ? \`<div class="followup \${dueClass}"><strong title="\${esc(l.proxima_accion || '')}">\${esc(l.proxima_accion || 'Seguimiento')}</strong><time>\${esc(dueLabel)}</time></div>\`
      : lastContact
        ? \`<div class="followup"><strong>Sin próxima acción</strong><time>Último contacto: \${esc(lastContact)}</time></div>\`
        : '<span style="color:var(--od3)">Sin actividad</span>';
    tbody.insertAdjacentHTML('beforeend', \`
      <tr onclick="openDrawer(\${l.id})">
        <td class="lead-cell"><strong title="\${esc(l.nombre)}">\${esc(l.nombre)}</strong><small>#\${l.id}\${l.tipo_link ? \` · \${esc(l.tipo_link)}\` : ''}</small></td>
        <td class="context-cell"><span>\${esc(l.categoria || 'Sin categoría')}</span><small>\${esc(l.ciudad || 'Sin ciudad')}</small></td>
        <td class="contact-cell"><span>\${esc(l.telefono || 'Sin teléfono')}</span><small title="\${esc(l.email || '')}">\${esc(l.email || 'Sin email')}</small></td>
        <td>\${badge(l.estado)}</td>
        <td><span class="priority \${priorityClass}">\${esc(l.prioridad || 'Media')}</span></td>
        <td>\${followupHtml}</td>
        <td><div class="tag-list">\${tagsHtml || '<span style="color:var(--od3)">—</span>'}</div></td>
      </tr>
    \`);
  });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const desde = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const hasta = Math.min((page + 1) * PAGE_SIZE, total);
  document.getElementById('pagerInfo').textContent =
    \`\${desde}–\${hasta} de \${total} · página \${page + 1}/\${pages}\`;
  document.getElementById('headSub').textContent =
    hayFiltros() ? \`\${total} leads con los filtros activos\` : \`\${total} leads en total\`;
  document.getElementById('btnPrev').disabled = page === 0;
  document.getElementById('btnNext').disabled = (page + 1) * PAGE_SIZE >= total;

  renderChips();
  syncViewTabs();
  updateFilterCount();
}

function renderChips() {
  const chips = document.getElementById('chips');
  const activos = Object.entries(filtros).filter(([k, v]) =>
    v && k !== 'actividad' && !(k === 'estado' && (v === 'Sin contactar' || v === 'Respondió'))
  );
  chips.innerHTML = activos.map(([k, v]) =>
    \`<span class="chip">\${GROUP_LABEL[k]}: \${esc(k === 'email' ? (v === 'con' ? 'Con email' : 'Sin email') : (FILTER_LABEL[v] || v))}
      <button onclick="clearFiltro('\${k}')" title="Quitar filtro">✕</button></span>\`
  ).join('');
  if (activos.length > 1) {
    chips.insertAdjacentHTML('beforeend',
      '<span class="chip clear"><button onclick="clearAll()">Limpiar todo ✕</button></span>');
  }
}

function syncSidebar() {
  document.querySelectorAll('.filter-btn').forEach(b => {
    const g = b.dataset.group;
    const activo = g === 'estado' && !filtros.estado ? b.dataset.val === '' : filtros[g] === b.dataset.val && b.dataset.val !== '';
    b.classList.toggle('active', activo);
  });
}

function currentView() {
  if (filtros.estado === 'Sin contactar' && !filtros.actividad) return 'sin_contactar';
  if (filtros.estado === 'Respondió' && !filtros.actividad) return 'respondieron';
  if (filtros.actividad === 'trabajados') return 'trabajados';
  if (filtros.actividad === 'cerrados') return 'cerrados';
  return 'todos';
}

function syncViewTabs() {
  const active = currentView();
  document.querySelectorAll('.view-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === active));
}

function setView(view) {
  filtros.estado = '';
  filtros.actividad = '';
  if (view === 'sin_contactar') filtros.estado = 'Sin contactar';
  if (view === 'trabajados') filtros.actividad = 'trabajados';
  if (view === 'respondieron') filtros.estado = 'Respondió';
  if (view === 'cerrados') filtros.actividad = 'cerrados';
  document.getElementById('estadoSelect').value = filtros.estado;
  page = 0;
  syncViewTabs();
  loadLeads();
}

function toggleFilters(force) {
  const panel = document.getElementById('filterPanel');
  const open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
  panel.classList.toggle('open', open);
}

function updateFilterCount() {
  const advanced = ['estado', 'canal', 'link', 'email', 'categoria', 'ciudad', 'prioridad', 'seguimiento', 'etiqueta'];
  const quickState = filtros.estado === 'Sin contactar' || filtros.estado === 'Respondió';
  const count = advanced.filter(k => filtros[k] && !(k === 'estado' && quickState)).length;
  const badge = document.getElementById('filterCount');
  badge.textContent = count;
  badge.classList.toggle('visible', count > 0);
  if (count > 0) toggleFilters(true);
}

function setFiltro(btn) {
  const g = btn.dataset.group;
  const v = btn.dataset.val;
  // Clic en el filtro ya activo lo desactiva (excepto "Todos")
  filtros[g] = (filtros[g] === v && v !== '') ? '' : v;
  if (g === 'seguimiento') {
    filtros.orden = filtros[g] ? 'seguimiento' : '';
    document.getElementById('ordenSelect').value = filtros.orden;
  }
  page = 0;
  syncSidebar();
  loadLeads();
}

function clearFiltro(k) {
  filtros[k] = '';
  if (k === 'q') document.getElementById('searchInput').value = '';
  if (k === 'categoria') document.getElementById('catSelect').value = '';
  if (k === 'ciudad') document.getElementById('ciudadSelect').value = '';
  if (k === 'etiqueta') document.getElementById('tagSelect').value = '';
  if (k === 'orden') document.getElementById('ordenSelect').value = '';
  if (k === 'estado') document.getElementById('estadoSelect').value = '';
  if (k === 'canal') document.getElementById('canalSelect').value = '';
  if (k === 'link') document.getElementById('linkSelect').value = '';
  if (k === 'email') document.getElementById('emailSelect').value = '';
  if (k === 'prioridad') document.getElementById('prioridadSelect').value = '';
  page = 0;
  syncSidebar();
  loadLeads();
}

function clearAll() {
  Object.keys(filtros).forEach(k => filtros[k] = '');
  document.getElementById('searchInput').value = '';
  document.getElementById('catSelect').value = '';
  document.getElementById('ciudadSelect').value = '';
  document.getElementById('tagSelect').value = '';
  document.getElementById('ordenSelect').value = '';
  document.getElementById('estadoSelect').value = '';
  document.getElementById('canalSelect').value = '';
  document.getElementById('linkSelect').value = '';
  document.getElementById('emailSelect').value = '';
  document.getElementById('prioridadSelect').value = '';
  document.getElementById('savedSegments').value = '';
  document.getElementById('deleteSegmentBtn').style.display = 'none';
  page = 0;
  syncSidebar();
  loadLeads();
}

function setCategoria(val) {
  filtros.categoria = val;
  page = 0;
  loadLeads();
}

function setCiudad(val) {
  filtros.ciudad = val;
  page = 0;
  loadLeads();
}

function setSimpleFilter(key, val) {
  filtros[key] = val;
  if (key === 'estado') filtros.actividad = '';
  page = 0;
  loadLeads();
}

function quickFilter(key, val) {
  filtros[key] = filtros[key] === val ? '' : val;
  if (key === 'seguimiento') filtros.orden = filtros[key] ? 'seguimiento' : '';
  document.getElementById('ordenSelect').value = filtros.orden;
  page = 0;
  syncSidebar();
  loadLeads();
}

let searchTimer;
function onSearch(val) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { filtros.q = val.trim(); page = 0; loadLeads(); }, 300);
}

function exportCsv() {
  window.open('/api/export.csv?' + buildParams(false), '_blank');
}

function refreshAll() {
  refreshStats();
  loadLeads();
}

function prevPage() { if (page > 0) { page--; loadLeads(); } }
function nextPage() { page++; loadLeads(); }

async function loadCategorias() {
  const cats = await fetch('/api/categorias').then(r => r.json());
  const sel = document.getElementById('catSelect');
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.categoria;
    opt.textContent = \`\${c.categoria} (\${c.n})\`;
    sel.appendChild(opt);
  });
}

async function loadCiudades() {
  const ciudades = await fetch('/api/ciudades').then(r => r.json());
  const sel = document.getElementById('ciudadSelect');
  ciudades.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.ciudad;
    opt.textContent = \`\${c.ciudad} (\${c.n})\`;
    sel.appendChild(opt);
  });
}

async function loadEtiquetas() {
  const tags = await fetch('/api/etiquetas').then(r => r.json());
  const sel = document.getElementById('tagSelect');
  tags.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.etiqueta;
    opt.textContent = \`\${t.etiqueta} (\${t.n})\`;
    sel.appendChild(opt);
  });
}

const SEGMENTS_KEY = 'libera-crm-segments';
function getSegments() {
  try { return JSON.parse(localStorage.getItem(SEGMENTS_KEY) || '[]'); } catch (_) { return []; }
}

function renderSavedSegments(selected = '') {
  const sel = document.getElementById('savedSegments');
  sel.innerHTML = '<option value="">Segmentos guardados</option>' + getSegments().map(s =>
    \`<option value="\${esc(s.id)}" \${String(s.id) === String(selected) ? 'selected' : ''}>\${esc(s.name)}</option>\`
  ).join('');
  document.getElementById('deleteSegmentBtn').style.display = selected ? '' : 'none';
}

function toggleSegmentComposer(force) {
  const composer = document.getElementById('segmentComposer');
  const open = typeof force === 'boolean' ? force : !composer.classList.contains('open');
  composer.classList.toggle('open', open);
  if (open) setTimeout(() => document.getElementById('segmentName').focus(), 0);
}

function saveSegment() {
  const input = document.getElementById('segmentName');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  const segments = getSegments();
  const segment = { id: Date.now(), name, filters: { ...filtros } };
  segments.push(segment);
  localStorage.setItem(SEGMENTS_KEY, JSON.stringify(segments));
  input.value = '';
  toggleSegmentComposer(false);
  renderSavedSegments(segment.id);
  showToast('Segmento guardado');
}

function syncFilterControls() {
  document.getElementById('searchInput').value = filtros.q;
  document.getElementById('catSelect').value = filtros.categoria;
  document.getElementById('ciudadSelect').value = filtros.ciudad;
  document.getElementById('tagSelect').value = filtros.etiqueta;
  document.getElementById('ordenSelect').value = filtros.orden;
  document.getElementById('estadoSelect').value = filtros.estado;
  document.getElementById('canalSelect').value = filtros.canal;
  document.getElementById('linkSelect').value = filtros.link;
  document.getElementById('emailSelect').value = filtros.email;
  document.getElementById('prioridadSelect').value = filtros.prioridad;
  syncSidebar();
  syncViewTabs();
  updateFilterCount();
}

function applySavedSegment(id) {
  if (!id) {
    document.getElementById('deleteSegmentBtn').style.display = 'none';
    return;
  }
  const segment = getSegments().find(s => String(s.id) === String(id));
  if (!segment) return;
  Object.keys(filtros).forEach(k => filtros[k] = segment.filters[k] || '');
  page = 0;
  syncFilterControls();
  document.getElementById('deleteSegmentBtn').style.display = '';
  loadLeads();
}

function deleteSelectedSegment() {
  const sel = document.getElementById('savedSegments');
  if (!sel.value) return;
  const segments = getSegments().filter(s => String(s.id) !== String(sel.value));
  localStorage.setItem(SEGMENTS_KEY, JSON.stringify(segments));
  renderSavedSegments();
  showToast('Segmento eliminado');
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

async function copyText(txt, el) {
  try {
    await navigator.clipboard.writeText(txt);
    const prev = el.textContent;
    el.textContent = '✓ copiado';
    setTimeout(() => el.textContent = prev, 1200);
  } catch (_) {}
}

async function openDrawer(id) {
  const l = await fetch('/api/leads/' + id).then(r => r.json());
  const wa = l.telefono ? \`https://wa.me/52\${l.telefono.replace(/\\D/g,'')}?text=\${encodeURIComponent(l.mensaje_borrador || '')}\` : null;

  const acciones = [
    wa ? \`<a class="qa-btn qa-wa" href="\${wa}" target="_blank">WhatsApp →</a>\` : '',
    l.email ? \`<a class="qa-btn qa-mail" href="mailto:\${esc(l.email)}">Email →</a>\` : '',
    l.sitio_web ? \`<a class="qa-btn qa-web" href="\${esc(l.sitio_web)}" target="_blank">Abrir link ↗</a>\` : '',
  ].filter(Boolean).join('');

  document.getElementById('drawerContent').innerHTML = \`
    <div class="drawer-head">
      <h2>\${esc(l.nombre)}</h2>
      <div class="meta">\${esc(l.categoria || 'Sin categoría')}\${l.ciudad ? \` · \${esc(l.ciudad)}\` : ''} · #\${l.id}\${l.calificacion ? \` · \${esc(l.calificacion)} ★ (\${l.resenas || 0} reseñas)\` : ''}</div>
      \${acciones ? \`<div class="quick-actions">\${acciones}</div>\` : ''}
    </div>
    <div class="drawer-body">

    <section class="followup-panel">
      <div class="panel-title">Siguiente paso</div>
      <div class="followup-grid">
        <div class="field">
          <label>Prioridad</label>
          <select id="drawerPrioridad">
            \${PRIORIDADES.map(p => \`<option \${p===(l.prioridad || 'Media')?'selected':''} value="\${p}">\${p}</option>\`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Fecha y hora</label>
          <input id="drawerFechaSeguimiento" type="datetime-local" value="\${esc((l.fecha_seguimiento || '').slice(0,16))}">
        </div>
      </div>
      <div class="field">
        <label>Próxima acción</label>
        <input id="drawerProximaAccion" value="\${esc(l.proxima_accion || '')}" placeholder="Ej. enviar propuesta o llamar">
      </div>
      <div class="field">
        <label>Etiquetas</label>
        <input id="drawerEtiquetas" value="\${esc(l.etiquetas || '')}" placeholder="Ej. restaurante, oportunidad, referido">
      </div>
      <div style="display:flex;gap:7px;margin-top:10px">
        <button class="btn btn-primary" style="flex:1" onclick="saveFollowup(\${l.id}, this)">Guardar seguimiento</button>
        \${l.fecha_seguimiento || l.proxima_accion ? \`<button class="btn btn-ghost" onclick="completeFollowup(\${l.id})">Marcar hecho</button>\` : ''}
      </div>
    </section>

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
          return \`<label><input type="checkbox" value="\${c}" \${checked} onchange="saveCanal(\${l.id}, this)"><span style="color:\${CANAL_COLOR[c]}">\${c}</span></label>\`;
        }).join('')}
      </div>
    </div>

    \${l.telefono ? \`
    <div class="field">
      <label>Teléfono</label>
      <div class="val">\${esc(l.telefono)}<span class="copy-hint" onclick="copyText('\${esc(l.telefono)}', this)">copiar</span></div>
    </div>\` : ''}

    \${l.email ? \`
    <div class="field">
      <label>Email</label>
      <div class="val">\${esc(l.email)}<span class="copy-hint" onclick="copyText('\${esc(l.email)}', this)">copiar</span></div>
    </div>\` : ''}

    \${l.sitio_web ? \`
    <div class="field">
      <label>Link</label>
      <div class="val"><a href="\${esc(l.sitio_web)}" target="_blank">\${esc(l.sitio_web)}</a></div>
    </div>\` : ''}

    \${l.direccion ? \`
    <div class="field">
      <label>Dirección</label>
      <div class="val" style="font-size:13px">\${esc(l.direccion)}</div>
    </div>\` : ''}

    \${l.mensaje_borrador ? \`
    <div class="field">
      <label>Mensaje WA borrador <span class="copy-hint" onclick="copyText(document.getElementById('waMsg').textContent, this)">copiar</span></label>
      <div class="msg-box" id="waMsg">\${esc(l.mensaje_borrador)}</div>
    </div>\` : ''}

    \${l.email_subject ? \`
    <div class="field">
      <label>Email borrador</label>
      <div class="msg-box"><strong>\${esc(l.email_subject)}</strong>\n\n\${esc(l.email_body || '')}</div>
    </div>\` : ''}

    <div class="field">
      <label>Notas</label>
      <textarea id="drawerNotas" placeholder="Notas internas...">\${esc(l.notas || '')}</textarea>
      <button class="btn btn-primary" style="margin-top:8px;width:100%" onclick="saveNotas(\${l.id}, this)">Guardar notas</button>
    </div>

    <div class="drawer-meta">
      Scrapeado: \${l.fecha_scrapeado?.slice(0,10) || '-'}<br>
      Contactado: \${l.fecha_contacto?.slice(0,10) || 'nunca'}<br>
      Query: \${esc(l.query_origen || '-')}
    </div>
    </div>
  \`;

  document.getElementById('overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
}

// Atajos: "/" enfoca búsqueda, Esc cierra el drawer
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
});

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
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('b-total', s.total);
    set('b-sin',   s.sin_contactar);
    set('b-email', s.contactado_email);
    set('b-wa',    s.contactado_wa);
    set('b-ig',    s.contactado_ig);
    set('b-fb',    s.contactado_fb);
    set('b-resp',  s.respondio);
    set('b-cerr',  s.cerrado);
    set('b-cerrv', s.cerrado_vendido);
    set('b-no',    s.no_interesa);
    set('b-cwa',   s.canal_wa);
    set('b-cig',   s.canal_ig);
    set('b-cem',   s.canal_email);
    set('b-cfb',   s.canal_fb);
    set('b-econ',  s.con_email);
    set('b-esin',  s.sin_email);
    set('b-venc',  s.seguimiento_vencido);
    set('b-hoy',   s.seguimiento_hoy);
    set('b-prox',  s.seguimiento_proximos7);
    set('b-sf',    s.sin_seguimiento);
    set('b-pa',    s.prioridad_alta);
    const links = s.links || {};
    set('b-lweb', links['Web propia'] || 0);
    set('b-lfb',  links['Facebook'] || 0);
    set('b-lig',  links['Instagram'] || 0);
    set('b-ltt',  links['TikTok'] || 0);
    set('b-lwa',  links['WhatsApp'] || 0);
    set('b-ltr',  links['Linktree'] || 0);
    set('b-lno',  links['Sin link'] || 0);
    set('s-trab',  s.trabajados);
    set('s-venc',  s.seguimiento_vencido);
    set('s-hoy',   s.seguimiento_hoy);
    set('s-prox',  s.seguimiento_proximos7);
    set('s-pa',    s.prioridad_alta);
  });
}

async function saveCanal(id, checkbox) {
  const canales = [...document.querySelectorAll('.canal-check input:checked')].map(c => c.value);
  const body = { canal_contacto: canales.join(', ') };

  // Al marcar (no desmarcar) un canal, sugerir el estado "Contactado por X"
  // — solo si el lead sigue "Sin contactar", para no pisar un avance ya registrado.
  const estadoSelect = document.getElementById('drawerEstado');
  if (checkbox && checkbox.checked && estadoSelect && estadoSelect.value === 'Sin contactar') {
    const estadoSugerido = CANAL_A_ESTADO[checkbox.value];
    if (estadoSugerido) {
      estadoSelect.value = estadoSugerido;
      body.estado = estadoSugerido;
      body.fecha_contacto = new Date().toISOString();
    }
  }

  await fetch('/api/leads/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  loadLeads();
  refreshStats();
}

async function saveFollowup(id, button) {
  const body = {
    prioridad: document.getElementById('drawerPrioridad').value,
    proxima_accion: document.getElementById('drawerProximaAccion').value,
    fecha_seguimiento: document.getElementById('drawerFechaSeguimiento').value,
    etiquetas: document.getElementById('drawerEtiquetas').value,
  };
  button.disabled = true;
  await fetch('/api/leads/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  button.disabled = false;
  showToast('Seguimiento actualizado');
  loadLeads();
  refreshStats();
  refreshTags();
}

async function completeFollowup(id) {
  await fetch('/api/leads/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proxima_accion: '', fecha_seguimiento: '' }),
  });
  showToast('Seguimiento completado');
  loadLeads();
  refreshStats();
  openDrawer(id);
}

async function saveNotas(id, btn) {
  const notas = document.getElementById('drawerNotas').value;
  await fetch('/api/leads/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notas }),
  });
  btn.textContent = '✓ Guardado';
  setTimeout(() => btn.textContent = 'Guardar notas', 1500);
}

async function refreshTags() {
  const selected = filtros.etiqueta;
  const sel = document.getElementById('tagSelect');
  sel.innerHTML = '<option value="">Todas las etiquetas</option>';
  await loadEtiquetas();
  sel.value = selected;
}

loadCategorias();
loadCiudades();
loadEtiquetas();
renderSavedSegments();
loadLeads();
</script>
</body>
</html>`;
}

app.listen(PORT, () => {
  console.log(`\nLIBERA CRM → http://localhost:${PORT}\n`);
});
