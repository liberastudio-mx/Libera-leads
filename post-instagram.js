require('dotenv').config();
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, 'content-queue');
const IG_ID  = process.env.META_IG_BUSINESS_ACCOUNT_ID;
const TOKEN  = process.env.META_PAGE_ACCESS_TOKEN;
const API_VER = 'v21.0';
const BASE    = `https://graph.facebook.com/${API_VER}`;

function getTodayContentPath() {
  const fecha = new Date().toISOString().slice(0, 10);
  return path.join(CONTENT_DIR, `${fecha}.json`);
}

async function graphApi(endpoint, method = 'GET', body = null) {
  const url = `${BASE}${endpoint}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const json = await res.json();

  if (json.error) throw new Error(`Meta API: ${json.error.message} (code ${json.error.code})`);
  return json;
}

async function uploadImageContainer(imageUrl, caption) {
  // Paso 1: crear contenedor de media
  const data = await graphApi(`/${IG_ID}/media`, 'POST', {
    image_url: imageUrl,
    caption,
    access_token: TOKEN,
  });
  return data.id; // creation_id
}

async function publishContainer(creationId) {
  // Paso 2: publicar el contenedor
  const data = await graphApi(`/${IG_ID}/media_publish`, 'POST', {
    creation_id: creationId,
    access_token: TOKEN,
  });
  return data.id; // media_id publicado
}

async function postToInstagram() {
  if (!IG_ID || !TOKEN) {
    throw new Error('Faltan META_IG_BUSINESS_ACCOUNT_ID o META_PAGE_ACCESS_TOKEN en .env');
  }

  const contentPath = getTodayContentPath();
  if (!fs.existsSync(contentPath)) {
    throw new Error(`No hay contenido generado para hoy (${path.basename(contentPath)}). Corre generate-content.js primero.`);
  }

  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

  if (content.estado === 'publicado') {
    console.log('  ⚠ El contenido de hoy ya fue publicado. Nada que hacer.');
    return null;
  }

  // Construir caption completo: headline + caption + hashtags
  const hashtagStr = content.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ');
  const captionFull = `${content.headline}\n\n${content.caption}\n\n${hashtagStr}`;

  console.log(`  Caption (${captionFull.length} chars): "${captionFull.slice(0, 60)}..."`);

  // La imagen debe estar en una URL pública.
  // Si no hay image_url generada, usamos una imagen por defecto de marca.
  const imageUrl = content.image_url || process.env.META_DEFAULT_IMAGE_URL;
  if (!imageUrl) {
    throw new Error('No hay image_url en el contenido ni META_DEFAULT_IMAGE_URL en .env');
  }

  console.log('  Subiendo imagen...');
  const creationId = await uploadImageContainer(imageUrl, captionFull);
  console.log(`  ✓ Contenedor creado: ${creationId}`);

  console.log('  Publicando...');
  const mediaId = await publishContainer(creationId);
  console.log(`  ✓ Publicado en Instagram — media_id: ${mediaId}`);

  // Marcar como publicado
  content.estado = 'publicado';
  content.publicado_en = new Date().toISOString();
  content.instagram_media_id = mediaId;
  fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));

  return mediaId;
}

module.exports = { postToInstagram };

if (require.main === module) {
  (async () => {
    console.log('── Publicando en Instagram ──\n');
    const id = await postToInstagram();
    if (id) console.log(`\nPost publicado: https://www.instagram.com/p/${id}/`);
  })().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
}
