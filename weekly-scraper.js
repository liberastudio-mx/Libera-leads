require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const LOG_DIR  = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, `scraper-${new Date().toISOString().slice(0,10)}.log`);

const LEADS_POR_TANDA  = 20;
const TANDAS_POR_DIA   = 3;
const PAUSA_ENTRE_MS   = 20 * 60 * 1000; // 20 minutos

// Ciudades disponibles — una por día en rotación, mismo peso para todas
const BLOQUES = [
  'queries-merida.txt',
  'queries-cancun.txt',
  'queries-playadelcarmen.txt',
  'queries-tulum.txt',
  'queries-tuxtla.txt',
];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// Pausa sincrónica sin busy-wait
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function getBloqueDelDia() {
  const dia = Math.floor(Date.now() / 86400000);
  return BLOQUES[dia % BLOQUES.length];
}

function leerQueries(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('|')[0].trim()); // solo la query, sin el límite
}

(async () => {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

  log('═══ Scraper Diario LIBERA Studio ═══');
  log(`Meta: ${TANDAS_POR_DIA} tandas × ${LEADS_POR_TANDA} leads = ${TANDAS_POR_DIA * LEADS_POR_TANDA} leads/día`);

  const bloque      = getBloqueDelDia();
  const queriesPath = path.join(__dirname, bloque);

  if (!fs.existsSync(queriesPath)) {
    log(`⚠ Archivo no encontrado: ${bloque} — usando queries-merida.txt`);
  }

  const todasLasQueries = leerQueries(fs.existsSync(queriesPath) ? queriesPath : path.join(__dirname, 'queries-merida.txt'));

  if (todasLasQueries.length === 0) {
    log('✗ No hay queries disponibles. Revisa el archivo de queries.');
    process.exit(1);
  }

  // Rotar las queries según el día para no repetir siempre las mismas
  const dia      = Math.floor(Date.now() / 86400000);
  const startIdx = (dia * TANDAS_POR_DIA) % todasLasQueries.length;

  const queriesDeHoy = [];
  for (let i = 0; i < TANDAS_POR_DIA; i++) {
    queriesDeHoy.push(todasLasQueries[(startIdx + i) % todasLasQueries.length]);
  }

  log(`Ciudad de hoy: ${bloque}`);
  log(`Queries de hoy: ${queriesDeHoy.join(' | ')}`);

  let totalNuevos = 0;

  for (let t = 0; t < queriesDeHoy.length; t++) {
    const query = queriesDeHoy[t];
    log(`\n── Tanda ${t + 1}/${TANDAS_POR_DIA}: "${query}" (máx ${LEADS_POR_TANDA}) ──`);

    try {
      const out = execSync(
        `node "${path.join(__dirname, 'scraper.js')}" "${query}" ${LEADS_POR_TANDA}`,
        { cwd: __dirname, encoding: 'utf8' }
      );
      process.stdout.write(out);
      // El scraper reporta "CRM: N leads nuevos guardados"
      const nuevos = parseInt(out.match(/CRM: (\d+) leads nuevos/)?.[1] || '0');
      totalNuevos += nuevos;
      log(nuevos > 0
        ? `✓ Tanda ${t + 1}: ${nuevos} leads nuevos al CRM`
        : `⚠ Tanda ${t + 1}: 0 leads nuevos (duplicados o sin resultados)`);
    } catch (err) {
      log(`✗ Error en tanda ${t + 1}: ${err.message}`);
    }

    if (t < queriesDeHoy.length - 1) {
      log(`Esperando 20 minutos antes de la siguiente tanda...`);
      sleepSync(PAUSA_ENTRE_MS);
    }
  }

  // Dedup al final del día
  log('\n── Eliminando duplicados ──');
  try {
    execSync(`node "${path.join(__dirname, 'dedup.js')}" --delete`, {
      stdio: 'inherit',
      cwd: __dirname,
    });
    log('✓ Dedup completado');
  } catch (err) {
    log(`✗ Error en dedup: ${err.message}`);
  }

  log(`\n═══ Scraper finalizado — ${totalNuevos} leads nuevos en el CRM ═══`);
})();
