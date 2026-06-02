require('dotenv').config();
const { processInbox } = require('./process-inbox');
const { generateContent } = require('./generate-content');
const { postToInstagram } = require('./post-instagram');
const { postRadarArticles } = require('./post-radar');
const { postSocialContent } = require('./post-social');
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

  // 3. Generar contenido del día (SOCIAL-CONTENT-STRATEGIST)
  log('\n── Paso 3: Generando contenido (SOCIAL-CONTENT-STRATEGIST) ──');
  try {
    const content = await generateContent();
    log(`✓ Contenido generado: "${content.headline}"`);
  } catch (err) {
    log(`ERROR generando contenido: ${err.message}`);
  }

  // 4. Publicar en Instagram (SOCIAL-MEDIA-MANAGER)
  log('\n── Paso 4: Publicando en Instagram (SOCIAL-MEDIA-MANAGER) ──');
  try {
    const mediaId = await postToInstagram();
    if (mediaId) log(`✓ Publicado — media_id: ${mediaId}`);
  } catch (err) {
    log(`ERROR publicando: ${err.message}`);
  }

  // 5. Publicar artículos del Radar en Instagram (SOCIAL-MEDIA-MANAGER)
  log('\n── Paso 5: Publicando Radar en Instagram (SOCIAL-MEDIA-MANAGER) ──');
  try {
    const radarResults = await postRadarArticles();
    if (radarResults.length > 0) {
      radarResults.forEach(r => log(`✓ Radar publicado: "${r.title}" — media_id: ${r.mediaId}`));
    } else {
      log('✓ Sin artículos Radar pendientes de publicar hoy.');
    }
  } catch (err) {
    log(`ERROR en Radar Instagram: ${err.message}`);
  }

  // 6. Publicar contenido social del día (SOCIAL-MEDIA-MANAGER)
  log('\n── Paso 6: Publicando posts sociales (SOCIAL-MEDIA-MANAGER) ──');
  try {
    const socialResults = await postSocialContent();
    if (socialResults.length > 0) {
      socialResults.forEach(r => log(`✓ Post publicado: [${r.postId}] IG: ${r.igMediaId || '-'} FB: ${r.fbPostId || '-'}`));
    } else {
      log('✓ Sin posts sociales pendientes hoy.');
    }
  } catch (err) {
    log(`ERROR en posts sociales: ${err.message}`);
  }

  log('\n═══ Rutina completada ═══');
})();
