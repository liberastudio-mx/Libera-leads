/**
 * LIBERA Leads — Pipeline automático por bloque
 * Scraper → Dedup → Envío de emails en una sola ejecución.
 *
 * Uso:
 *   node run-bloque.js educacion
 *   node run-bloque.js estetica
 *   node run-bloque.js profesionales
 *   node run-bloque.js gastronomia
 *   node run-bloque.js --no-send educacion   → solo scraper + dedup, sin enviar
 */

const { spawnSync } = require('child_process');

const noSend = process.argv.includes('--no-send');
const bloque = process.argv.find(a => !a.startsWith('--') && !a.includes('run-bloque') && !a.includes('node'));

if (!bloque) {
  console.error('Uso: node run-bloque.js <categoria>');
  console.error('Categorías: educacion, estetica, profesionales, gastronomia, fitness, salud');
  process.exit(1);
}

const queriesFile = `queries-${bloque}.txt`;
const fs = require('fs');
if (!fs.existsSync(queriesFile)) {
  console.error(`No existe ${queriesFile}`);
  process.exit(1);
}

function run(cmd, args) {
  console.log(`\n▶ ${cmd} ${args.join(' ')}`);
  console.log('─'.repeat(60));
  const result = spawnSync('node', [cmd, ...args], {
    stdio: 'inherit',
    cwd: __dirname,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.log(`\n⚠ ${cmd} terminó con errores (código ${result.status})`);
  }
  return result.status === 0;
}

(async () => {
  const start = Date.now();
  console.log('\n' + '═'.repeat(60));
  console.log(`PIPELINE: ${bloque.toUpperCase()}`);
  console.log('═'.repeat(60));

  // 1. Scraper
  console.log('\n[1/3] Scraper');
  run('batch.js', [queriesFile]);

  // 2. Dedup
  console.log('\n[2/3] Dedup');
  run('dedup.js', ['--delete']);

  // 3. Emails
  if (noSend) {
    console.log('\n[3/3] Envío omitido (--no-send)');
  } else {
    console.log('\n[3/3] Enviando emails...');
    run('send-emails.js', []);
  }

  const mins = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log('\n' + '═'.repeat(60));
  console.log(`✓ Pipeline ${bloque} completado en ${mins} min`);
  console.log('═'.repeat(60) + '\n');
})();
