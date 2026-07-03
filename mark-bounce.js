/**
 * Marca manualmente emails como Rebote en la base SQLite.
 * Uso: node mark-bounce.js email1@dominio.com email2@dominio.com
 */

require('dotenv').config();
const db = require('./db');

const emails = process.argv.slice(2).map(e => e.toLowerCase().trim());

if (emails.length === 0) {
  console.error('Uso: node mark-bounce.js email1@dominio.com email2@dominio.com ...');
  process.exit(1);
}

console.log(`Buscando ${emails.length} email(s)...\n`);

let marked = 0;
const notFound = [];

for (const email of emails) {
  const results = db.searchLeads(email, { limit: 5 });
  const matches = results.filter(r => r.email?.toLowerCase() === email);
  if (matches.length === 0) {
    notFound.push(email);
    continue;
  }
  for (const r of matches) {
    db.updateEstado(r.id, 'Rebote', new Date().toISOString());
    console.log(`  ✓ Rebote marcado — ${r.nombre} <${email}>`);
    marked++;
  }
}

if (notFound.length > 0) console.log(`\n  ⚠ No encontrados: ${notFound.join(', ')}`);
console.log(`\nListo: ${marked} marcado(s) como Rebote.`);
