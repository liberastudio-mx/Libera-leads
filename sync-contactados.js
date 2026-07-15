/**
 * sync-contactados.js
 * Trae el campo "Contactado" (WhatsApp / Instagram / Email / FaceBook) de Airtable
 * y lo guarda en canal_contacto de la base SQLite local.
 * Idempotente: se puede correr las veces que sea.
 *
 * Uso: node sync-contactados.js
 */

require('dotenv').config();
const db = require('./db');

const TOKEN    = process.env.AIRTABLE_TOKEN;
const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;

if (!TOKEN || !BASE_ID || !TABLE_ID) {
  console.error('Faltan AIRTABLE_TOKEN / AIRTABLE_BASE_ID / AIRTABLE_TABLE_ID en .env');
  process.exit(1);
}

// Si el lead sigue "Sin contactar" en SQLite pero Airtable dice que ya se contactó
// por alguno de los canales, actualizamos también el estado del pipeline.
const CANAL_A_ESTADO = {
  'Email':     'Contactado por Email',
  'WhatsApp':  'Contactado por WhatsApp',
  'Instagram': 'Contactado por Instagram',
  'FaceBook':  'Contactado por FaceBook',
};

async function fetchAll() {
  const records = [];
  let offset = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Airtable error ${res.status}: ${txt}`);
    }

    const json = await res.json();
    records.push(...json.records);
    offset = json.offset || null;

    process.stdout.write(`\r  Leyendo Airtable... ${records.length} registros`);
  } while (offset);

  console.log('');
  return records;
}

(async () => {
  console.log('Sincronizando canales de contacto: Airtable → SQLite\n');

  const records = await fetchAll();
  const sqlite  = db.getDb();

  const findByNombreTel = sqlite.prepare(
    'SELECT id, estado FROM leads WHERE nombre = ? AND COALESCE(telefono, \'\') = ?'
  );
  const findByNombre = sqlite.prepare('SELECT id, estado FROM leads WHERE nombre = ?');

  let actualizados = 0, estadosActualizados = 0, sinMatch = [];

  for (const r of records) {
    const f = r.fields;
    const contactado = f.Contactado;
    if (!contactado) continue;

    // multipleSelects llega como array; filtramos "Sin contactar"
    const canales = (Array.isArray(contactado) ? contactado : [contactado])
      .filter(c => c && c !== 'Sin contactar');
    if (!canales.length) continue;

    const nombre   = f.Name || '';
    const telefono = f.telefono || '';

    let rows = findByNombreTel.all(nombre, telefono);
    if (!rows.length) rows = findByNombre.all(nombre);
    if (!rows.length) { sinMatch.push(nombre); continue; }

    const canalStr = canales.join(', ');
    for (const row of rows) {
      db.updateCanal(row.id, canalStr);
      actualizados++;

      // Corregir estado si sigue "Sin contactar"
      if (row.estado === 'Sin contactar') {
        const nuevoEstado = canales.map(c => CANAL_A_ESTADO[c]).find(Boolean);
        if (nuevoEstado) {
          db.updateEstado(row.id, nuevoEstado, f['Fecha y hora de contacto'] || null);
          estadosActualizados++;
        }
      }
    }
  }

  console.log(`\nLeads con canal actualizado: ${actualizados}`);
  console.log(`Estados corregidos (Sin contactar → enviado): ${estadosActualizados}`);
  if (sinMatch.length) {
    console.log(`\nSin match en SQLite (${sinMatch.length}):`);
    sinMatch.slice(0, 20).forEach(n => console.log(`  - ${n}`));
    if (sinMatch.length > 20) console.log(`  ... y ${sinMatch.length - 20} más`);
  }

  console.log('\nStats finales:');
  console.log(JSON.stringify(db.getStats(), null, 2));
})();
