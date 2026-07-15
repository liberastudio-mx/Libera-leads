/**
 * backfill-ciudad.js
 * Rellena la columna ciudad para leads guardados antes de que scraper.js la
 * empezara a guardar, extrayéndola de query_origen (la búsqueda original).
 *
 * Uso: node backfill-ciudad.js
 */

const db = require('./db');

const ZONA_WORDS = new Set(['norte', 'sur', 'oriente', 'poniente', 'centro', 'de', 'del', 'la', 'las', 'los', 'el', 'zona', 'hotelera', 'pueblo']);
const CIUDAD_COMPUESTA = ['Playa del Carmen', 'Tuxtla Gutiérrez', 'San Cristóbal', 'Puerto Morelos', 'Puerto Vallarta', 'San Luis Potosí'];

function extractCiudad(query) {
  for (const c of CIUDAD_COMPUESTA) {
    if (query.toLowerCase().includes(c.toLowerCase())) return c;
  }
  for (const w of query.split(/\s+/)) {
    if (/^[A-ZÁÉÍÓÚÜÑ]/.test(w) && !ZONA_WORDS.has(w.toLowerCase())) return w;
  }
  return null;
}

function run() {
  const leads = db.getLeads({});
  const conn  = db.getDb();
  const stmt  = conn.prepare('UPDATE leads SET ciudad = ? WHERE id = ?');

  const update = conn.transaction((rows) => {
    let n = 0;
    for (const lead of rows) {
      if (lead.ciudad || !lead.query_origen) continue;
      const ciudad = extractCiudad(lead.query_origen);
      if (ciudad) { stmt.run(ciudad, lead.id); n++; }
    }
    return n;
  });

  const total = update(leads);
  console.log(`✓ ${total} leads con ciudad rellenada desde query_origen.`);
}

run();
