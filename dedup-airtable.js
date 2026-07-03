/**
 * LIBERA Leads — Elimina duplicados en Airtable
 * Uso: node dedup-airtable.js          → muestra duplicados y pregunta antes de borrar
 *      node dedup-airtable.js --delete → borra sin preguntar
 */

require('dotenv').config();

const TOKEN    = process.env.AIRTABLE_TOKEN;
const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;
const DRY_RUN  = !process.argv.includes('--delete');

if (!TOKEN || !BASE_ID || !TABLE_ID) {
  console.error('Faltan variables de entorno (AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID)');
  process.exit(1);
}

// ── helpers ────────────────────────────────────────────────────────────────

function dedupKey(fields) {
  const nombre = (fields.Name || '').toLowerCase().trim();
  const tel    = (fields.telefono || '').replace(/\D/g, '');
  return tel
    ? `${nombre}|${tel}`
    : `${nombre}|${(fields.direccion || '').toLowerCase().trim()}`;
}

async function fetchAllRecords() {
  const records = [];
  let offset    = null;

  do {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?pageSize=100&fields%5B%5D=Name&fields%5B%5D=telefono&fields%5B%5D=direccion`;
    if (offset) url += `&offset=${encodeURIComponent(offset)}`;

    const res  = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const json = await res.json();

    if (!res.ok) {
      console.error('\nError Airtable:', JSON.stringify(json.error));
      if (json.error?.type === 'INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND') {
        console.error('\nEl token no tiene permiso de lectura (data.records:read).');
        console.error('Regenera el token en: https://airtable.com/create/tokens');
      }
      process.exit(1);
    }

    records.push(...json.records);
    offset = json.offset || null;

    process.stdout.write(`\rDescargando registros... ${records.length}`);
  } while (offset);

  console.log(`\rDescargados ${records.length} registros totales.      `);
  return records;
}

async function deleteRecords(ids) {
  const batches = [];
  for (let i = 0; i < ids.length; i += 10) batches.push(ids.slice(i, i + 10));

  let deleted = 0;
  for (const batch of batches) {
    const params = batch.map(id => `records[]=${id}`).join('&');
    const res    = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    const json = await res.json();
    if (res.ok) {
      deleted += json.records?.length ?? 0;
    } else {
      console.error('Error al borrar:', JSON.stringify(json.error));
    }
    process.stdout.write(`\rBorrando... ${deleted}/${ids.length}`);
  }
  console.log(`\rBorrados ${deleted} registros duplicados.          `);
}

// ── main ───────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nAnalizando duplicados en Airtable...\n`);

  const records = await fetchAllRecords();

  // Detectar duplicados: mantener el primero, marcar el resto para borrar
  const seen    = new Map(); // key → id del primer registro
  const toDelete = [];

  for (const rec of records) {
    const key = dedupKey(rec.fields);
    if (!key || key === '|') continue; // registro sin datos útiles, saltar

    if (seen.has(key)) {
      toDelete.push({ id: rec.id, name: rec.fields.Name, tel: rec.fields.telefono });
    } else {
      seen.set(key, rec.id);
    }
  }

  if (!toDelete.length) {
    console.log('No se encontraron duplicados.');
    return;
  }

  console.log(`\nDuplicados encontrados: ${toDelete.length}`);
  console.log('─'.repeat(50));
  const preview = toDelete.slice(0, 15);
  for (const r of preview) {
    console.log(`  • ${r.name || '(sin nombre)'}  ${r.tel || ''}`);
  }
  if (toDelete.length > 15) {
    console.log(`  ... y ${toDelete.length - 15} más`);
  }

  if (DRY_RUN) {
    console.log(`\n[SIMULACIÓN] Se borrarían ${toDelete.length} registros.`);
    console.log('Para borrarlos de verdad corre:');
    console.log('  node dedup-airtable.js --delete\n');
    return;
  }

  console.log(`\nBorrando ${toDelete.length} duplicados...`);
  await deleteRecords(toDelete.map(r => r.id));
  console.log('Listo.\n');
})();
