/**
 * LIBERA Leads — db.js
 * Módulo SQLite compartido. Todos los scripts lo importan en lugar de llamar Airtable.
 *
 * Uso:
 *   const db = require('./db');
 *   db.pushLeads(records);
 *   db.getLeads({ estado: 'Sin contactar' });
 *   db.updateEstado(id, 'Contactado por Email', new Date().toISOString());
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(__dirname, 'db', 'leads.db');

let _db = null;

function getDb() {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Crear tabla si no existe
  _db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre          TEXT NOT NULL,
      telefono        TEXT,
      email           TEXT,
      sitio_web       TEXT,
      direccion       TEXT,
      calificacion    TEXT,
      resenas         INTEGER,
      categoria       TEXT,
      ciudad          TEXT,
      estado          TEXT NOT NULL DEFAULT 'Sin contactar',
      mensaje_borrador TEXT,
      email_subject   TEXT,
      email_body      TEXT,
      fecha_scrapeado TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_contacto  TEXT,
      notas           TEXT,
      query_origen    TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_dedup
      ON leads (nombre, COALESCE(telefono, ''), COALESCE(direccion, ''));

    CREATE INDEX IF NOT EXISTS idx_leads_estado   ON leads (estado);
    CREATE INDEX IF NOT EXISTS idx_leads_email    ON leads (email);
    CREATE INDEX IF NOT EXISTS idx_leads_telefono ON leads (telefono);
    CREATE INDEX IF NOT EXISTS idx_leads_cat      ON leads (categoria);
  `);

  // Migración: columna canal_contacto (WhatsApp, Instagram, Email, FaceBook — separados por coma)
  const cols = _db.prepare("PRAGMA table_info(leads)").all().map(c => c.name);
  if (!cols.includes('canal_contacto')) {
    _db.exec("ALTER TABLE leads ADD COLUMN canal_contacto TEXT");
  }
  if (!cols.includes('ciudad')) {
    _db.exec("ALTER TABLE leads ADD COLUMN ciudad TEXT");
  }

  // Migración: renombrar estados viejos a la nomenclatura "Contactado por X"
  _db.exec(`
    UPDATE leads SET estado = 'Contactado por Email'    WHERE estado = 'Email enviado';
    UPDATE leads SET estado = 'Contactado por WhatsApp' WHERE estado = 'WA enviado';
  `);

  return _db;
}

// ── Escritura ─────────────────────────────────────────────────────────────────

const insertStmt = () => getDb().prepare(`
  INSERT OR IGNORE INTO leads
    (nombre, telefono, email, sitio_web, direccion, calificacion, resenas,
     categoria, ciudad, estado, mensaje_borrador, email_subject, email_body, query_origen)
  VALUES
    (@nombre, @telefono, @email, @sitio_web, @direccion, @calificacion, @resenas,
     @categoria, @ciudad, @estado, @mensaje_borrador, @email_subject, @email_body, @query_origen)
`);

function pushLeads(records) {
  const db   = getDb();
  const stmt = insertStmt();
  const insert = db.transaction((rows) => {
    let inserted = 0;
    for (const r of rows) {
      const info = stmt.run({
        nombre:           r.nombre          || '',
        telefono:         r.telefono        || null,
        email:            r.email           || null,
        sitio_web:        r.sitio_web       || null,
        direccion:        r.direccion       || null,
        calificacion:     r.calificacion    || null,
        resenas:          r.resenas ? parseInt(r.resenas) : null,
        categoria:        r.categoria       || null,
        ciudad:           r.ciudad          || null,
        estado:           'Sin contactar',
        mensaje_borrador: r.Mensaje_Borrador || r.mensaje_borrador || null,
        email_subject:    r.Email_Subject   || r.email_subject    || null,
        email_body:       r.Email_Body      || r.email_body       || null,
        query_origen:     r.query_origen    || null,
      });
      if (info.changes > 0) inserted++;
    }
    return inserted;
  });
  return insert(records);
}

// ── Lectura ───────────────────────────────────────────────────────────────────

// Clasifica sitio_web en un tipo de link filtrable
const LINK_CASE = `CASE
  WHEN sitio_web IS NULL OR sitio_web = '' THEN 'Sin link'
  WHEN sitio_web LIKE '%facebook.com%' OR sitio_web LIKE '%fb.com%' OR sitio_web LIKE '%fb.me%' THEN 'Facebook'
  WHEN sitio_web LIKE '%instagram.com%' THEN 'Instagram'
  WHEN sitio_web LIKE '%tiktok.com%' THEN 'TikTok'
  WHEN sitio_web LIKE '%wa.me%' OR sitio_web LIKE '%wa.link%' OR sitio_web LIKE '%whatsapp.com%' THEN 'WhatsApp'
  WHEN sitio_web LIKE '%linktr.ee%' OR sitio_web LIKE '%beacons.ai%' OR sitio_web LIKE '%taplink%' OR sitio_web LIKE '%linkin.bio%' THEN 'Linktree'
  ELSE 'Web propia'
END`;

function buildWhere({ estado, canal, q, tipo_link, tiene_email, categoria, ciudad } = {}) {
  const where  = [];
  const params = [];

  if (estado) { where.push('estado = ?'); params.push(estado); }
  if (canal)  { where.push('canal_contacto LIKE ?'); params.push(`%${canal}%`); }
  if (tipo_link) { where.push(`${LINK_CASE} = ?`); params.push(tipo_link); }
  if (tiene_email === 'con') where.push("email IS NOT NULL AND email != ''");
  if (tiene_email === 'sin') where.push("(email IS NULL OR email = '')");
  if (categoria) { where.push('categoria = ?'); params.push(categoria); }
  if (ciudad) { where.push('ciudad = ?'); params.push(ciudad); }
  if (q) {
    where.push('(nombre LIKE ? OR email LIKE ? OR telefono LIKE ? OR categoria LIKE ? OR direccion LIKE ? OR notas LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }

  return { clause: where.length ? ' WHERE ' + where.join(' AND ') : '', params };
}

function getLeads({ estado, canal, q, tipo_link, tiene_email, categoria, ciudad, limit, offset } = {}) {
  const db = getDb();
  const { clause, params } = buildWhere({ estado, canal, q, tipo_link, tiene_email, categoria, ciudad });
  let sql = `SELECT *, ${LINK_CASE} AS tipo_link FROM leads${clause} ORDER BY id DESC`;

  if (limit)  { sql += ' LIMIT ?';  params.push(limit); }
  if (offset) { sql += ' OFFSET ?'; params.push(offset); }

  return db.prepare(sql).all(...params);
}

function countLeadsFiltered(filters = {}) {
  const { clause, params } = buildWhere(filters);
  return getDb().prepare(`SELECT COUNT(*) as n FROM leads${clause}`).get(...params).n;
}

function getCategorias() {
  return getDb().prepare(`
    SELECT categoria, COUNT(*) as n FROM leads
    WHERE categoria IS NOT NULL AND categoria != ''
    GROUP BY categoria ORDER BY n DESC
  `).all();
}

function getCiudades() {
  return getDb().prepare(`
    SELECT ciudad, COUNT(*) as n FROM leads
    WHERE ciudad IS NOT NULL AND ciudad != ''
    GROUP BY ciudad ORDER BY n DESC
  `).all();
}

function getLead(id) {
  return getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

function countLeads(where = '') {
  return getDb().prepare(`SELECT COUNT(*) as n FROM leads ${where}`).get().n;
}

function searchLeads(q, { limit = 50, offset = 0 } = {}) {
  const like = `%${q}%`;
  return getDb().prepare(`
    SELECT * FROM leads
    WHERE nombre LIKE ? OR email LIKE ? OR telefono LIKE ? OR categoria LIKE ? OR direccion LIKE ?
    ORDER BY id DESC LIMIT ? OFFSET ?
  `).all(like, like, like, like, like, limit, offset);
}

// ── Actualización ─────────────────────────────────────────────────────────────

function updateEstado(id, estado, fechaContacto = null) {
  return getDb().prepare(`
    UPDATE leads SET estado = ?, fecha_contacto = ? WHERE id = ?
  `).run(estado, fechaContacto, id);
}

function updateNotas(id, notas) {
  return getDb().prepare('UPDATE leads SET notas = ? WHERE id = ?').run(notas, id);
}

function updateCanal(id, canal) {
  return getDb().prepare('UPDATE leads SET canal_contacto = ? WHERE id = ?').run(canal || null, id);
}

function updateLead(id, fields) {
  const allowed = ['estado', 'notas', 'email', 'telefono', 'fecha_contacto', 'email_subject', 'email_body'];
  const sets    = Object.keys(fields).filter(k => allowed.includes(k)).map(k => `${k} = ?`);
  if (!sets.length) return;
  const vals = sets.map(s => fields[s.split(' ')[0]]);
  return getDb().prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
}

// ── Dedup ─────────────────────────────────────────────────────────────────────

function findDuplicates() {
  return getDb().prepare(`
    SELECT nombre, COALESCE(telefono,'') as telefono, COUNT(*) as cnt,
           GROUP_CONCAT(id) as ids
    FROM leads
    GROUP BY nombre, COALESCE(telefono,'')
    HAVING cnt > 1
  `).all();
}

function deleteLead(id) {
  return getDb().prepare('DELETE FROM leads WHERE id = ?').run(id);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function getStats() {
  const db = getDb();
  return {
    total:          db.prepare("SELECT COUNT(*) as n FROM leads").get().n,
    sin_contactar:     db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'Sin contactar'").get().n,
    contactado_email:  db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'Contactado por Email'").get().n,
    contactado_wa:     db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'Contactado por WhatsApp'").get().n,
    contactado_ig:     db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'Contactado por Instagram'").get().n,
    contactado_fb:     db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'Contactado por FaceBook'").get().n,
    respondio:         db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'Respondió'").get().n,
    cerrado:           db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'Cerrado'").get().n,
    cerrado_vendido:   db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'Cerrado vendido'").get().n,
    no_interesa:       db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'No interesa'").get().n,
    con_email:      db.prepare("SELECT COUNT(*) as n FROM leads WHERE email IS NOT NULL AND email != ''").get().n,
    sin_web:        db.prepare("SELECT COUNT(*) as n FROM leads WHERE sitio_web IS NULL OR sitio_web = ''").get().n,
    // Canales de contacto (canal_contacto puede tener varios separados por coma)
    canal_wa:       db.prepare("SELECT COUNT(*) as n FROM leads WHERE canal_contacto LIKE '%WhatsApp%'").get().n,
    canal_ig:       db.prepare("SELECT COUNT(*) as n FROM leads WHERE canal_contacto LIKE '%Instagram%'").get().n,
    canal_email:    db.prepare("SELECT COUNT(*) as n FROM leads WHERE canal_contacto LIKE '%Email%'").get().n,
    canal_fb:       db.prepare("SELECT COUNT(*) as n FROM leads WHERE canal_contacto LIKE '%FaceBook%'").get().n,
    contactados:    db.prepare("SELECT COUNT(*) as n FROM leads WHERE canal_contacto IS NOT NULL AND canal_contacto != ''").get().n,
    sin_email:      db.prepare("SELECT COUNT(*) as n FROM leads WHERE email IS NULL OR email = ''").get().n,
    // Tipo de link (clasificación de sitio_web)
    links:          Object.fromEntries(
      db.prepare(`SELECT ${LINK_CASE} AS tipo, COUNT(*) as n FROM leads GROUP BY tipo`).all()
        .map(r => [r.tipo, r.n])
    ),
  };
}

module.exports = {
  getDb,
  pushLeads,
  getLeads,
  getLead,
  countLeads,
  countLeadsFiltered,
  getCategorias,
  getCiudades,
  searchLeads,
  updateEstado,
  updateNotas,
  updateCanal,
  updateLead,
  findDuplicates,
  deleteLead,
  getStats,
};
