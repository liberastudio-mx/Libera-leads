require('dotenv').config();
const { processInbox } = require('./process-inbox');
const { generateContent } = require('./generate-content');
const { postToInstagram } = require('./post-instagram');
const { postRadarArticles } = require('./post-radar');
const { postVideoContent } = require('./post-videos');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const LOG_DIR  = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, `routine-${new Date().toISOString().slice(0,10)}.log`);

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

(async () => {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

  log('═══ Rutina diaria LIBERA Studio ═══');

  // 1. Procesar inbox (rebotes / respuestas / OOO)
  log('\n── Paso 1: Procesando inbox (ARCHIVIST) ──');
  try {
    const stats = await processInbox();
    log(`Inbox: ${stats.bounces} rebotes, ${stats.replies} respuestas, ${stats.ooo} OOO`);
  } catch (err) {
    log(`ERROR en inbox: ${err.message}`);
  }

  // 2. Enviar lote diario de leads (MARKETING)
  log('\n── Paso 2: Enviando lote diario (MARKETING) ──');
  try {
    execSync(`node "${path.join(__dirname, 'send-emails.js')}"`, {
      stdio: 'inherit',
      cwd: __dirname,
    });
    log('✓ Envío completado');
  } catch (err) {
    log(`ERROR en envío: ${err.message}`);
  }

  // 3. Generar contenido del día y registrar en Airtable (publicación manual)
  log('\n── Paso 3: Generando contenido del día (SOCIAL-CONTENT-STRATEGIST) ──');
  try {
    const content = await generateContent();
    log(`✓ Contenido generado y registrado en Airtable: "${content.headline}"`);
  } catch (err) {
    log(`ERROR generando contenido: ${err.message}`);
  }
  // Paso 4 (publicación automática) eliminado — se publica a mano desde Airtable

  // ── PASO MANUAL antes de este paso ──────────────────────────────────────────
  // Cuando publiques un artículo nuevo en liberastudio.tech/radar/:
  //   1. Crea el registro en Airtable SMM → tabla Radar Articles (tbltjVkZ8oHowq4t1)
  //      Campos mínimos: Article_Title, Source (URL completa), Publicado = TRUE
  //   2. Agrega la imagen Preview (1080x1080) al registro
  //   3. Recién entonces post-radar.js lo detecta y publica en IG + FB
  // Sin este paso, el artículo queda publicado en el sitio pero invisible para redes.
  // ────────────────────────────────────────────────────────────────────────────

  // 5. Publicar artículos del Radar en Instagram (SOCIAL-MEDIA-MANAGER)
  log('\n── Paso 5: Publicando Radar en Instagram (SOCIAL-MEDIA-MANAGER) ──');
  try {
    const radarResults = await postRadarArticles();
    if (radarResults.length > 0) {
      radarResults.forEach(r => {
        log(`Radar [${r.title}] IG: ${r.mediaId || '-'} FB: ${r.postId || '-'}`);
        if (r.igError) log(`  ✗ Instagram error: ${r.igError}`);
        if (r.fbError) log(`  ✗ Facebook error: ${r.fbError}`);
      });
    } else {
      log('✓ Sin artículos Radar pendientes de publicar hoy.');
    }
  } catch (err) {
    log(`ERROR en Radar Instagram: ${err.message}`);
  }

  // 7. Publicar videos/Reels del día (SOCIAL-MEDIA-MANAGER)
  log('\n── Paso 7: Publicando videos/Reels (SOCIAL-MEDIA-MANAGER) ──');
  try {
    const videoResults = await postVideoContent();
    if (videoResults.length > 0) {
      videoResults.forEach(r => {
        log(`Video [${r.videoId}] IG: ${r.igMediaId || '-'} FB: ${r.fbId || '-'}`);
        if (r.igError) log(`  ✗ Instagram error: ${r.igError}`);
        if (r.fbError) log(`  ✗ Facebook error: ${r.fbError}`);
      });
    } else {
      log('✓ Sin videos pendientes hoy.');
    }
  } catch (err) {
    log(`ERROR en videos: ${err.message}`);
  }

  log('\n═══ Rutina completada ═══');
})();
