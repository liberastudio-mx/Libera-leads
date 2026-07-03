/**
 * LIBERA Leads — Agregar lead manual
 * Para negocios encontrados en Facebook, Instagram o cualquier otra fuente.
 * Guarda directo en el CRM (SQLite local).
 *
 * Uso: node add-lead.js
 */

const readline = require('readline');
const db = require('./db');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultValue = '') {
  return new Promise(resolve => {
    const hint = defaultValue ? ` [${defaultValue}]` : '';
    rl.question(`${question}${hint}: `, answer => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function main() {
  console.log('\n── Agregar lead manual a LIBERA Leads ──\n');

  const nombre   = await ask('Nombre del negocio');
  if (!nombre) { console.log('El nombre es obligatorio.'); rl.close(); return; }

  const telefono = await ask('WhatsApp o teléfono (Enter para omitir)');
  const email    = await ask('Email (Enter para omitir)');
  const sitio    = await ask('Sitio web (Enter para omitir)');
  const categoria = await ask('Categoría  (ej: dentista, psicólogo, abogado)');
  const fuente   = await ask('¿Dónde lo encontraste?', 'Facebook');

  console.log('\n── Confirmar ──');
  console.log(`  Negocio:   ${nombre}`);
  if (telefono)  console.log(`  Teléfono:  ${telefono}`);
  if (email)     console.log(`  Email:     ${email}`);
  if (sitio)     console.log(`  Web:       ${sitio}`);
  if (categoria) console.log(`  Categoría: ${categoria}`);
  console.log(`  Fuente:    ${fuente}`);

  const ok = await ask('\n¿Guardar en el CRM? (s/n)', 's');
  if (ok.toLowerCase() !== 's') {
    console.log('Cancelado.');
    rl.close();
    return;
  }

  // La categoría incluye la fuente para identificar el origen
  let cat = categoria || fuente;
  if (fuente && fuente !== 'Google Maps') {
    cat = [categoria, `(${fuente})`].filter(Boolean).join(' ');
  }

  try {
    const inserted = db.pushLeads([{
      nombre,
      telefono:  telefono || null,
      email:     email    || null,
      sitio_web: sitio    || null,
      categoria: cat,
      query_origen: `manual:${fuente}`,
    }]);

    if (inserted > 0) {
      console.log('\n✓ Lead guardado en el CRM');
    } else {
      console.log('\n○ Ya existía un lead con ese nombre/teléfono/dirección. No se duplicó.');
    }
  } catch (err) {
    console.error(`\n✗ Error al guardar: ${err.message}`);
  }

  rl.close();
}

main();
