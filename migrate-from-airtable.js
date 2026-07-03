/**
 * migrate-from-airtable.js
 * Migración one-shot: Airtable leads → SQLite local.
 * Ejecutar UNA sola vez. Idempotente (INSERT OR IGNORE).
 *
 * Uso: node migrate-from-airtable.js
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

// Mapeo de campos Airtable → columnas SQLite
// Ajusta los nombres si tus campos tienen capitalización distinta
function mapRecord(r) {
  const f = r.fields;
  return {
    nombre:           f.Name         || f.nombre        || '',
    telefono:         f.telefono     || f.Telefono       || null,
    email:            f.email        || f.Email          || null,
    sitio_web:        f.sitio_web    || f['Sitio web']   || null,
    direccion:        f.direccion    || f.Direccion      || null,
    calificacion:     f.calificacion || f.Calificacion   || null,
    resenas:          f.resenas      || f.Reseñas        || null,
    categoria:        f.categoria    || f.Categoria      || null,
    mensaje_borrador: f.Mensaje_Borrador || f.mensaje_borrador || null,
    email_subject:    f.Email_Subject || f.email_subject  || null,
    email_body:       f.Email_Body   || f.email_body     || null,
    query_origen:     f.query_origen || null,
    // Mapear estado
    estado: mapEstado(f.Contactado || f.estado || 'Sin contactar'),
    fecha_contacto: f['Fecha y hora de contacto'] || null,
  };
}

function mapEstado(val) {
  if (!val) return 'Sin contactar';
  // Airtable puede guardar Contactado como array ['Sin contactar'] o string
  const s = Array.isArray(val) ? val[0] : val;
  const map = {
    'Sin contactar':  'Sin contactar',
    'Contactado':     'Email enviado',
    'Email enviado':  'Email enviado',
    'WA enviado':     'WA enviado',
    'Respondió':      'Respondió',
    'Respondio':      'Respondió',
    'Cerrado':        'Cerrado',
    'No interesa':    'No interesa',
    'Rebote':         'No interesa',
  };
  return map[s] || 'Sin contactar';
}

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
  console.log('Migrando leads de Airtable → SQLite\n');

  const records = await fetchAll();
  console.log(`Total en Airtable: ${records.length}\n`);

  const mapped = records.map(mapRecord);
  const inserted = db.pushLeads(mapped);

  console.log(`Insertados nuevos: ${inserted}`);
  console.log(`Duplicados ignorados: ${records.length - inserted}`);
  console.log('\nStats finales:');
  console.log(JSON.stringify(db.getStats(), null, 2));
  console.log('\nMigración completada. Puedes borrar dedup-airtable.js cuando confirmes que todo está bien.');
})();
