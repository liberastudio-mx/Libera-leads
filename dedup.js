/**
 * LIBERA Leads — dedup.js
 * Elimina duplicados en la base de datos local SQLite.
 *
 * Uso:
 *   node dedup.js          → muestra duplicados sin borrar
 *   node dedup.js --delete → borra duplicados (conserva el registro más antiguo)
 */

const db     = require('./db');
const DELETE = process.argv.includes('--delete');

const dupes = db.findDuplicates();

if (!dupes.length) {
  console.log('No se encontraron duplicados.');
  process.exit(0);
}

console.log(`\nDuplicados encontrados: ${dupes.length} grupos\n${'─'.repeat(50)}`);

let totalToDelete = 0;
const toDelete = [];

for (const d of dupes) {
  const ids  = d.ids.split(',').map(Number);
  const keep = ids[0]; // conservar el más antiguo
  const drop = ids.slice(1);
  totalToDelete += drop.length;
  toDelete.push(...drop);
  console.log(`  • "${d.nombre}" (${d.telefono || 'sin tel'}) — ${d.cnt} copias, borrando IDs: ${drop.join(', ')}`);
}

console.log(`\nTotal a borrar: ${totalToDelete} registros`);

if (!DELETE) {
  console.log('\n[SIMULACIÓN] Para borrar de verdad corre:');
  console.log('  node dedup.js --delete\n');
  process.exit(0);
}

for (const id of toDelete) {
  db.deleteLead(id);
}
console.log(`\n✓ Borrados ${toDelete.length} duplicados.\n`);
