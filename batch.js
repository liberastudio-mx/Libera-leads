/**
 * LIBERA Leads — Batch Runner
 * Lee queries.txt y corre el scraper para cada una en secuencia.
 *
 * Uso:
 *   node batch.js               → usa queries.txt, pausa 3-8 min entre queries
 *   node batch.js mis-queries.txt
 *
 * Formato de queries.txt:
 *   psicólogos norte Mérida | 80
 *   dentistas Cancún | 60
 *   # esto es un comentario — se ignora
 */

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const PAUSE_MIN_MS = 20 * 1000;  // 20 seg entre queries
const PAUSE_MAX_MS = 25 * 1000;  // 25 seg entre queries

function randomPause() {
  const ms = PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
  const min = (ms / 1000 / 60).toFixed(1);
  return { ms, min };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function countdown(ms) {
  return new Promise(resolve => {
    let remaining = Math.ceil(ms / 1000);
    const interval = setInterval(() => {
      process.stdout.write(`\rEsperando ${remaining}s antes de la siguiente query...`);
      remaining--;
      if (remaining < 0) {
        clearInterval(interval);
        process.stdout.write('\r' + ' '.repeat(55) + '\r');
        resolve();
      }
    }, 1000);
  });
}

const QUERIES_FILE = process.argv[2] || 'queries.txt';
const QUERIES_PATH = path.resolve(__dirname, QUERIES_FILE);

if (!fs.existsSync(QUERIES_PATH)) {
  console.error(`No se encontró el archivo: ${QUERIES_PATH}`);
  console.error('Crea un archivo queries.txt con una búsqueda por línea.');
  process.exit(1);
}

const lines = fs.readFileSync(QUERIES_PATH, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'));

if (!lines.length) {
  console.error('El archivo de queries está vacío.');
  process.exit(1);
}

console.log(`\nBatch: ${lines.length} queries — iniciando\n${'═'.repeat(60)}`);

const summary = [];

(async () => {
for (let i = 0; i < lines.length; i++) {
  const parts  = lines[i].split('|').map(s => s.trim());
  const query  = parts[0];
  const max    = parts[1] || '80';

  console.log(`\n[${i + 1}/${lines.length}] "${query}" — máx ${max} resultados`);
  console.log('─'.repeat(60));

  const start  = Date.now();
  const result = spawnSync('node', ['scraper.js', query, max], {
    stdio:   'inherit',
    cwd:     __dirname,
    encoding: 'utf8',
  });
  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);

  const ok = result.status === 0;
  summary.push({ query, max, ok, elapsed });

  if (!ok) {
    console.log(`\nError en "${query}" (código ${result.status}) — continuando...\n`);
  }

  // Pausa entre queries (no después de la última)
  if (i < lines.length - 1) {
    const { ms, min } = randomPause();
    console.log(`\nPausa de ~${min} min antes de la siguiente query...`);
    await countdown(ms);
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log('RESUMEN BATCH');
console.log('─'.repeat(60));
for (const s of summary) {
  const icon = s.ok ? '✓' : '✗';
  console.log(`${icon} "${s.query}" (${s.max} máx) — ${s.elapsed} min`);
}
console.log(`\nBatch completado. Resultados en carpeta output/\n`);
})();
