/**
 * LIBERA Studio — Video / Reels Publisher
 * Lee la tabla "Video Content" de Airtable LIBERA SMM, toma el .mp4 ya subido a
 * Google Drive (Link Drive) y publica como Reel en Instagram y video en Facebook.
 * Sin generación: usa los videos que ya creaste. Cadencia esperada: lunes y jueves.
 *
 * Drive sirve el .mp4 directo vía uc?export=download (probado OK con Meta).
 * IG Reels es asíncrono: hay que crear el contenedor, esperar a FINISHED y publicar.
 */
require('dotenv').config();

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const IG_ID          = process.env.META_IG_BUSINESS_ACCOUNT_ID;
const FB_PAGE_ID     = process.env.META_FB_PAGE_ID;
const META_TOKEN     = process.env.META_PAGE_ACCESS_TOKEN;
const API_VER        = 'v21.0';
const GRAPH_BASE     = `https://graph.facebook.com/${API_VER}`;

const BASE_ID  = process.env.AIRTABLE_SMM_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_VIDEO_TABLE_ID;

// Field IDs Video Content
const F = {
  videoId:    'fldswnkvgTvu5uJ9L', // Video_ID
  publicado:  'fldaoOfTFHDE1eHP2', // Publicado (checkbox)
  date:       'fldXxPZTjlhsyxrAX', // Publish_Date
  title:      'fldnCFEDzJALKS71S', // Title
  platforms:  'fldRW70uOg9uFluOm', // Platforms (multipleSelects)
  captions:   'fldfSrTbmMTSHeFWM', // Captions
  hashtags:   'fld5XRhLYBg10tlKu', // Hashtags
  linkDrive:  'fldvRRSoxRVEBGUUl', // Link Drive
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Nombres de un campo multipleSelects (REST con returnFieldsByFieldId los da como
// array de strings; el SDK como array de {name}). Devuelve siempre array de strings.
function selNames(v) {
  if (!Array.isArray(v)) return [];
  return v.map(x => (typeof x === 'string' ? x : (x && x.name) || '')).filter(Boolean);
}

function extractDriveId(url) {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([A-Za-z0-9_-]+)/) || url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// URL directa de descarga del .mp4 que Meta puede ingerir.
function driveVideoUrl(rawLink) {
  const id = extractDriveId(rawLink);
  if (!id) return null;
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

function getVideoUrl(fields) {
  const raw = fields[F.linkDrive] || '';
  if (!raw) return null;
  if (raw.includes('drive.google.com')) return driveVideoUrl(raw);
  return raw; // ya es URL directa
}

function buildCaption(fields) {
  const captions = fields[F.captions] || '';
  const hashtags = fields[F.hashtags] || '';
  return [captions, '', hashtags].filter(Boolean).join('\n').trim();
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

async function getTodayVideos() {
  const filter = encodeURIComponent(`AND(
    {Publicado}=FALSE(),
    IS_BEFORE({Publish_Date}, DATEADD(TODAY(), 1, 'days')),
    {Captions}!=""
  )`);
  const data = await airtableReq(
    `/${BASE_ID}/${TABLE_ID}?filterByFormula=${filter}&returnFieldsByFieldId=true`
  );
  const records = data.records || [];
  // Solo los que tienen destino Meta (IG o FB) y link de video.
  return records.filter(r => {
    const plats = selNames(r.fields[F.platforms]);
    const meta  = plats.some(p => /instagram|facebook/i.test(p));
    return meta && getVideoUrl(r.fields);
  });
}

async function markPublished(recordId) {
  await airtableReq(`/${BASE_ID}/${TABLE_ID}/${recordId}`, 'PATCH', {
    fields: { [F.publicado]: true },
  });
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

async function graphGet(endpoint) {
  const sep = endpoint.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH_BASE}${endpoint}${sep}access_token=${META_TOKEN}`);
  const json = await res.json();
  if (json.error) throw new Error(`Meta API: ${json.error.message} (code ${json.error.code})`);
  return json;
}

// Espera a que el contenedor de Reel termine de procesarse (async en Meta).
async function waitForContainer(creationId, { tries = 30, delayMs = 10000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const { status_code } = await graphGet(`/${creationId}?fields=status_code`);
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      throw new Error(`Contenedor en estado ${status_code}`);
    }
    process.stdout.write(`    procesando (${status_code})… `);
    await sleep(delayMs);
  }
  throw new Error('Timeout esperando procesamiento del Reel');
}

async function publishReelToInstagram(videoUrl, caption) {
  const { id: creationId } = await graphPost(`/${IG_ID}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    share_to_feed: true,
  });
  await waitForContainer(creationId);
  const { id: mediaId } = await graphPost(`/${IG_ID}/media_publish`, { creation_id: creationId });
  return mediaId;
}

async function publishVideoToFacebook(videoUrl, caption) {
  // Publica el video en la página (file_url = descarga directa de Drive).
  const { id } = await graphPost(`/${FB_PAGE_ID}/videos`, {
    file_url: videoUrl,
    description: caption,
  });
  return id;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function postVideoContent() {
  if (!AIRTABLE_TOKEN) throw new Error('Falta AIRTABLE_TOKEN en .env');
  if (!IG_ID || !META_TOKEN) throw new Error('Faltan credenciales Meta en .env');
  if (!FB_PAGE_ID) throw new Error('Falta META_FB_PAGE_ID en .env');

  const videos = await getTodayVideos();
  console.log(`  Videos Meta pendientes hoy: ${videos.length}`);
  if (videos.length === 0) {
    console.log('  ✓ Sin videos para hoy.');
    return [];
  }

  const results = [];
  for (const { id: recordId, fields } of videos) {
    const videoId = fields[F.videoId] || recordId;
    const title   = fields[F.title]   || '';
    const plats   = selNames(fields[F.platforms]);
    const videoUrl = getVideoUrl(fields);
    const caption  = buildCaption(fields);

    console.log(`  → [${videoId}] "${title}"`);
    console.log(`    Plataformas: ${plats.join(', ')}`);
    console.log(`    Video: ${videoUrl}`);

    let igMediaId, fbId, igError, fbError;

    if (plats.some(p => /instagram/i.test(p))) {
      try {
        console.log('    Subiendo Reel a Instagram…');
        igMediaId = await publishReelToInstagram(videoUrl, caption);
        console.log(`\n    ✓ Instagram Reel — media_id: ${igMediaId}`);
      } catch (err) {
        igError = err.message;
        console.error(`\n    ✗ Instagram: ${igError}`);
      }
    }

    if (plats.some(p => /facebook/i.test(p))) {
      try {
        console.log('    Subiendo video a Facebook…');
        fbId = await publishVideoToFacebook(videoUrl, caption);
        console.log(`    ✓ Facebook video — id: ${fbId}`);
      } catch (err) {
        fbError = err.message;
        console.error(`    ✗ Facebook: ${fbError}`);
      }
    }

    if (igMediaId || fbId) {
      await markPublished(recordId);
      console.log(`    ✓ Airtable actualizado — Publicado: true`);
      results.push({ videoId, igMediaId, fbId, igError, fbError });
    } else {
      console.error(`    ✗ No se publicó en ninguna plataforma — no se marca.`);
      results.push({ videoId, igMediaId: null, fbId: null, igError, fbError });
    }
  }
  return results;
}

module.exports = { postVideoContent };

if (require.main === module) {
  postVideoContent()
    .then(r => {
      const ok = r.filter(x => x.igMediaId || x.fbId).length;
      if (ok) console.log(`\n✓ ${ok} video(s) publicado(s).`);
    })
    .catch(err => { console.error('ERROR:', err.message); process.exit(1); });
}
