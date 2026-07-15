/**
 * LIBERA Leads — Master runner
 * Corre todas las tandas en secuencia con 1 hora de pausa entre cada una.
 * Después de cada tanda limpia duplicados automáticamente.
 *
 * Uso:
 *   node run-tandas.js            → corre desde tanda 3 (1 y 2 ya completadas)
 *   node run-tandas.js --from 4   → empieza desde tanda específica
 */

const { spawnSync } = require('child_process');
const path = require('path');

const PAUSE_HOURS = 1;
const PAUSE_MS    = PAUSE_HOURS * 60 * 60 * 1000;

const TANDAS = [
  { num: 3, file: 'queries-batch3.txt', label: 'Nutricionista + Fisioterapista' },
  { num: 4, file: 'queries-batch4.txt', label: 'Pediatra + Ginecólogo' },
  { num: 5, file: 'queries-batch5.txt', label: 'Dermatólogo + Ortodoncista + Oftalmólogo' },
  { num: 6, file: 'queries-batch6.txt', label: 'Psiquiatra + Quiropráctico + Veterinario' },
];

const fromArg = process.argv.indexOf('--from');
const fromNum = fromArg !== -1 ? parseInt(process.argv[fromArg + 1]) : 3;
const tandas  = TANDAS.filter(t => t.num >= fromNum);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function countdown(ms, label) {
  return new Promise(resolve => {
    let remaining = Math.ceil(ms / 1000 / 60);
    const interval = setInterval(() => {
      process.stdout.write(`\r⏱ Pausa antes de ${label}: ${remaining} min restantes...`);
      remaining--;
      if (remaining < 0) {
        clearInterval(interval);
        process.stdout.write('\r' + ' '.repeat(60) + '\r');
        resolve();
      }
    }, 60_000);
  });
}

function runBatch(file) {
  console.log(`\nCorriendo: ${file}`);
  const result = spawnSync('node', ['batch.js', file], {
    stdio: 'inherit',
    cwd: __dirname,
    encoding: 'utf8',
  });
  return result.status === 0;
}

function runDedup() {
  console.log('\nLimpiando duplicados...');
  const result = spawnSync('node', ['dedup.js', '--delete'], {
    stdio: 'inherit',
    cwd: __dirname,
    encoding: 'utf8',
  });
  return result.status === 0;
}

(async () => {
  console.log(`\nMaster runner iniciado — ${tandas.length} tandas pendientes`);
  console.log(`Pausa entre tandas: ${PAUSE_HOURS} hora(s)\n`);
  console.log('═'.repeat(60));

  for (let i = 0; i < tandas.length; i++) {
    const tanda = tandas[i];
    const isLast = i === tandas.length - 1;

    console.log(`\n▶ TANDA ${tanda.num}: ${tanda.label}`);
    console.log('─'.repeat(60));

    const ok = runBatch(tanda.file);
    if (!ok) {
      console.log(`\n⚠ Tanda ${tanda.num} terminó con errores — continuando...`);
    }

    runDedup();

    if (!isLast) {
      const next = tandas[i + 1];
      console.log(`\n✓ Tanda ${tanda.num} completa.`);
      await countdown(PAUSE_MS, `Tanda ${next.num}: ${next.label}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✓ Todas las tandas completadas.');
  console.log('Revisa el dashboard local para ver todos los leads.\n');
})();
