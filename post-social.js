/**
 * LIBERA Studio — Social Media Publisher
 * Lee posts del Post Master en Airtable LIBERA SMM,
 * toma el asset ya diseñado desde Google Drive (Link Drive / Image_or_Asset_Link)
 * y publica en Instagram + Facebook. Sin generación de imagen (sin DALL-E).
 * Solo procesa posts de la plataforma "Meta" con Publish_Date <= hoy.
 *
 * Fase 1: Single Image 4:5 + Text + Image 4:5
 * Fase 2 pendiente: Carousels, Reels
 */
require('dotenv').config();

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const IG_ID          = process.env.META_IG_BUSINESS_ACCOUNT_ID;
const FB_PAGE_ID     = process.env.META_FB_PAGE_ID;
const META_TOKEN     = process.env.META_PAGE_ACCESS_TOKEN;
const API_VER        = 'v21.0';
const GRAPH_BASE     = `https://graph.facebook.com/${API_VER}`;

const BASE_ID  = process.env.AIRTABLE_SMM_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_SMM_TABLE_ID;

// Field IDs Post Master
const F = {
  postId:         'fldxhieTPzP6aeu3Q',  // Post_ID
  publicado:      'fld2wbr9PrOZ7B7jh',  // Publicado (checkbox)
  date:           'fldyW6I6XyJRHi2UP',  // Publish_Date
  platform:       'fldwkB3ZIKjBXrlAX',  // Platform
  format:         'fld2teWM2t7dLNz92',  // Format
  hook:           'fldeLkI88cs4RxIu1',  // Hook
  visualConcept:  'fld27rqs9gnDMYx1N',  // Visual_Concept
  visualElements: 'fldRr1MiWcaY9O14x',  // Visual_Elements
  caption:        'fldJorsFyJcxnvxqI',  // Caption
  cta:            'fldhbJbhOAwNPpRCH',  // CTA
  hashtags:       'fldiURQF2oidw3shS',  // Hashtags
  postedUrl:      'fldXGDWxwemtd69zC',  // Posted_URL
  imageLink:      'fldS5Yh5cFvUELlDp',  // Image_or_Asset_Link
  linkDrive:      'fldTbAGIRCYilKcHB',  // Link Drive
};

// Formatos soportados. Carousel 4:5 se publica como imagen simple mientras el
// asset en Drive sea una sola imagen (un solo Link Drive por registro).
const SUPPORTED_FORMATS = ['Single Image 4:5', 'Text + Image 4:5', 'Carousel 4:5'];

// Normaliza un valor de singleSelect: REST con returnFieldsByFieldId lo da como
// string; el SDK/MCP lo da como {name}. Devuelve siempre el string.
function selName(v) {
  if (!v) return '';
  return typeof v === 'string' ? v : (v.name || '');
}

// ── Airtable ──────────────────────────────────────────────────────────────────

async function airtableReq(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`https://api.airtable.com/v0${path}`, opts);
  const json = await res.json();
  if (json.error) throw new Error(`Airtable: ${JSON.stringify(json.error)}`);
  return json;
}

async function getTodayPosts() {
  const today = new Date().toISOString().slice(0, 10);
  // Posts Meta, no publicados, fecha <= hoy, con contenido
  const filter = encodeURIComponent(`AND(
    {Platform}="Meta",
    {Publicado}=FALSE(),
    IS_BEFORE({Publish_Date}, DATEADD(TODAY(), 1, 'days')),
    {Caption}!="",
    {Hook}!=""
  )`);
  const data = await airtableReq(
    `/${BASE_ID}/${TABLE_ID}?filterByFormula=${filter}&returnFieldsByFieldId=true`
  );
  const records = data.records || [];
  // Solo formatos soportados. Con returnFieldsByFieldId=true los singleSelect
  // llegan como string plano, no como {name}.
  return records.filter(r => SUPPORTED_FORMATS.includes(selName(r.fields[F.format])));
}

async function markPublished(recordId, postedUrl) {
  await airtableReq(`/${BASE_ID}/${TABLE_ID}/${recordId}`, 'PATCH', {
    fields: { [F.publicado]: true, [F.postedUrl]: postedUrl || '' },
  });
}

// ── Validación de imagen ──────────────────────────────────────────────────────

// Verifica que la URL devuelva un content-type de imagen sin requerir auth.
async function isImageAccessible(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'error' });
    const ct  = res.headers.get('content-type') || '';
    return res.ok && ct.startsWith('image/');
  } catch {
    return false;
  }
}

// ── Asset desde Google Drive ──────────────────────────────────────────────────

// Extrae el file ID de un link de Google Drive en cualquiera de sus formatos:
//   https://drive.google.com/file/d/<ID>/view?usp=sharing
//   https://drive.google.com/open?id=<ID>
//   https://drive.google.com/uc?export=download&id=<ID>
function extractDriveId(url) {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([A-Za-z0-9_-]+)/) || url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Convierte un link de Drive en una URL de imagen directa que Meta puede descargar.
// drive.usercontent.google.com es el endpoint oficial para archivos públicos sin redirect.
function driveImageUrl(rawLink) {
  const id = extractDriveId(rawLink);
  if (!id) return null;
  return `https://drive.usercontent.google.com/download?id=${id}&export=view`;
}

// Devuelve la URL de imagen lista para Meta a partir del registro de Airtable.
// Prioriza Image_or_Asset_Link; si no, usa Link Drive. Si ya es una URL directa
// (no Drive), la deja tal cual.
function getImageUrl(fields) {
  const raw = fields[F.imageLink] || fields[F.linkDrive] || '';
  if (!raw) return null;
  if (raw.includes('drive.google.com')) return driveImageUrl(raw);
  return raw;
}

// ── Caption builder ───────────────────────────────────────────────────────────

function buildCaption(fields) {
  const hook     = fields[F.hook]     || '';
  const caption  = fields[F.caption]  || '';
  const cta      = fields[F.cta]      || '';
  const hashtags = fields[F.hashtags] || '';

  return [hook, '', caption, '', cta, '.', '.', '.', hashtags]
    .filter(l => l !== undefined)
    .join('\n');
}

// ── Meta Graph API ────────────────────────────────────────────────────────────

async function graphPost(endpoint, body) {
  const res  = await fetch(`${GRAPH_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: META_TOKEN }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Meta API: ${json.error.message} (code ${json.error.code})`);
  return json;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Calienta la caché del thumbnail antes de crear el contenedor,
// igual que en post-radar.js — reduce errores 9007 de Instagram.
async function warmPreview(imageUrl) {
  try { await fetch(imageUrl); } catch (_) {}
}

async function publishToInstagram(imageUrl, caption) {
  await warmPreview(imageUrl);
  const { id: creationId } = await graphPost(`/${IG_ID}/media`, { image_url: imageUrl, caption });

  // Instagram procesa la imagen de forma asíncrona; reintentar ante código 9007.
  const MAX_RETRIES = 4;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { id: mediaId } = await graphPost(`/${IG_ID}/media_publish`, { creation_id: creationId });
      return mediaId;
    } catch (err) {
      if (err.code === 9007 && attempt < MAX_RETRIES) {
        await sleep(attempt * 5000); // 5s, 10s, 15s
        continue;
      }
      throw err;
    }
  }
}

async function publishToFacebook(imageUrl, caption) {
  const { id: postId } = await graphPost(`/${FB_PAGE_ID}/photos`, { url: imageUrl, caption });
  return postId;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function postSocialContent() {
  if (!AIRTABLE_TOKEN) throw new Error('Falta AIRTABLE_TOKEN en .env');
  if (!IG_ID || !META_TOKEN) throw new Error('Faltan credenciales Meta en .env');
  if (!FB_PAGE_ID)     throw new Error('Falta META_FB_PAGE_ID en .env');

  const posts = await getTodayPosts();
  console.log(`  Posts Meta pendientes hoy: ${posts.length}`);

  if (posts.length === 0) {
    console.log('  ✓ Sin posts para hoy.');
    return [];
  }

  const results = [];
  for (const { id: recordId, fields } of posts) {
    const postId  = fields[F.postId]  || recordId;
    const format  = selName(fields[F.format]);
    const hook    = fields[F.hook]    || '';

    console.log(`  → [${postId}] "${hook.slice(0, 50)}..."`);
    console.log(`    Formato: ${format}`);

    try {
      // 1. Tomar el asset ya diseñado desde Drive (Airtable)
      const imageUrl = getImageUrl(fields);
      if (!imageUrl) {
        const msg = 'Sin asset: falta Image_or_Asset_Link / Link Drive.';
        console.error(`    ✗ ${msg} Saltando.`);
        results.push({ postId, igMediaId: null, fbPostId: null, igError: msg, fbError: msg });
        continue;
      }
      console.log(`    ✓ Asset: ${imageUrl}`);

      // Validar que Meta pueda acceder a la imagen antes de publicar
      const accessible = await isImageAccessible(imageUrl);
      if (!accessible) {
        const msg = 'Imagen no accesible públicamente. Comparte el archivo en Drive como "Cualquiera con el enlace".';
        console.error(`    ✗ ${msg} Saltando.`);
        results.push({ postId, igMediaId: null, fbPostId: null, igError: msg, fbError: msg });
        continue;
      }

      // 2. Construir caption
      const caption = buildCaption(fields);

      // 3. Publicar en Instagram
      let igMediaId, fbPostId, igError, fbError;
      try {
        igMediaId = await publishToInstagram(imageUrl, caption);
        console.log(`    ✓ Instagram — media_id: ${igMediaId}`);
      } catch (err) {
        igError = err.message;
        console.error(`    ✗ Instagram: ${igError}`);
      }

      // 4. Publicar en Facebook
      try {
        fbPostId = await publishToFacebook(imageUrl, caption);
        console.log(`    ✓ Facebook — post_id: ${fbPostId}`);
      } catch (err) {
        fbError = err.message;
        console.error(`    ✗ Facebook: ${fbError}`);
      }

      // 5. Marcar publicado solo si al menos una plataforma tuvo éxito
      if (!igMediaId && !fbPostId) {
        console.error(`    ✗ Ambas plataformas fallaron — Publicado NO actualizado.`);
        results.push({ postId, igMediaId: null, fbPostId: null, igError, fbError });
        continue;
      }
      const postedUrl = igMediaId
        ? `https://www.instagram.com/p/${igMediaId}`
        : fbPostId || '';
      await markPublished(recordId, postedUrl);
      console.log(`    ✓ Airtable actualizado — Publicado: true`);

      results.push({ postId, igMediaId, fbPostId, igError, fbError });
    } catch (err) {
      console.error(`    ERROR en [${postId}]: ${err.message}`);
      results.push({ postId, igMediaId: null, fbPostId: null, igError: err.message });
    }
  }
  return results;
}

module.exports = { postSocialContent };

if (require.main === module) {
  postSocialContent()
    .then(r => {
      const ok = r.filter(x => x.igMediaId || x.fbPostId).length;
      if (ok) console.log(`\n✓ ${ok} post(s) publicado(s).`);
    })
    .catch(err => { console.error('ERROR:', err.message); process.exit(1); });
}
