/**
 * LIBERA Studio — Post Radar Articles to Instagram + Facebook
 * Publica artículos del Radar en IG y FB via Meta Graph API.
 * Usa flags independientes: Instagram_Posted y FB_Posted.
 */
require('dotenv').config();

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const RADAR_BASE_ID  = 'appCLF2sMEV9YVJ2A';
const RADAR_TABLE_ID = 'tbltjVkZ8oHowq4t1';
const IG_ID          = process.env.META_IG_BUSINESS_ACCOUNT_ID;
const FB_PAGE_ID     = process.env.META_FB_PAGE_ID;
const META_TOKEN     = process.env.META_PAGE_ACCESS_TOKEN;
const API_VER        = 'v21.0';
const GRAPH_BASE     = `https://graph.facebook.com/${API_VER}`;

// Field IDs de la tabla Radar Articles
const F = {
  title:     'fldWzoK0eaFV3RIgK',  // Article_Title
  source:    'fldNbdHOckrDnmSkS',  // Source (URL del artículo)
  publicado: 'fld5Zje0kUJu7U954',  // Publicado
  notes:     'fldOhzhO9942ijaOB',  // Notes (excerpt + categoría + fuentes)
  preview:   'fldztq8zCmoxu9eLp',  // Preview URL (1080x1080)
  igPosted:  'fld4SxzCRmNOgy6hl',  // Instagram_Posted
  fbPosted:  'fldAGIHpaSF7S8xWZ',  // FB_Posted
};

const HASHTAGS = '#liberastudio #ai #automatizacion #tecnologia #negocios #ia #mexico #merida #agenciaia #herramientas';

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

async function getPendingArticles() {
  // Artículos publicados con Preview que aún no están en IG o FB
  const filter = encodeURIComponent(
    `AND({Publicado}=TRUE(), {Preview}!='', OR({Instagram_Posted}=FALSE(), {FB_Posted}=FALSE()))`
  );
  const data = await airtableReq(
    `/${RADAR_BASE_ID}/${RADAR_TABLE_ID}?filterByFormula=${filter}&returnFieldsByFieldId=true`
  );
  return data.records || [];
}

async function markPosted(recordId, fields) {
  await airtableReq(`/${RADAR_BASE_ID}/${RADAR_TABLE_ID}/${recordId}`, 'PATCH', { fields });
}

// ── Caption ───────────────────────────────────────────────────────────────────

function buildCaption(fields) {
  const title  = fields[F.title]  || '';
  const notes  = fields[F.notes]  || '';
  const source = fields[F.source] || '';

  const excerptMatch = notes.match(/Excerpt:\s*(.+?)(?:\n|Fuentes:)/s);
  const excerpt = excerptMatch ? excerptMatch[1].trim() : '';
  const domain  = source.replace('https://', '').replace(/\/$/, '');

  return [
    title,
    '',
    excerpt,
    '',
    `Lee el artículo completo en ${domain}`,
    '.',
    '.',
    '.',
    HASHTAGS,
  ].join('\n');
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

async function publishToInstagram(imageUrl, caption) {
  const { id: creationId } = await graphPost(`/${IG_ID}/media`, { image_url: imageUrl, caption });
  const { id: mediaId }    = await graphPost(`/${IG_ID}/media_publish`, { creation_id: creationId });
  return mediaId;
}

async function publishToFacebook(imageUrl, caption) {
  const { id: postId } = await graphPost(`/${FB_PAGE_ID}/photos`, {
    url: imageUrl,
    caption,
  });
  return postId;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function postRadarArticles() {
  if (!AIRTABLE_TOKEN)       throw new Error('Falta AIRTABLE_TOKEN en .env');
  if (!IG_ID || !META_TOKEN) throw new Error('Faltan META_IG_BUSINESS_ACCOUNT_ID o META_PAGE_ACCESS_TOKEN en .env');
  if (!FB_PAGE_ID)           throw new Error('Falta META_FB_PAGE_ID en .env');

  const articles = await getPendingArticles();
  console.log(`  Artículos Radar pendientes: ${articles.length}`);
  if (articles.length === 0) {
    console.log('  ✓ Todo publicado. Nada que hacer.');
    return [];
  }

  const results = [];
  for (const { id: recordId, fields } of articles) {
    const title    = fields[F.title]   || 'Nuevo artículo en Radar';
    const preview  = fields[F.preview];
    const igPosted = !!fields[F.igPosted];
    const fbPosted = !!fields[F.fbPosted];
    const caption  = buildCaption(fields);
    const updates  = {};

    console.log(`  → "${title}"`);

    if (!igPosted) {
      try {
        const mediaId = await publishToInstagram(preview, caption);
        updates[F.igPosted] = true;
        console.log(`    ✓ Instagram — media_id: ${mediaId}`);
      } catch (err) {
        console.error(`    ✗ Instagram: ${err.message}`);
      }
    } else {
      console.log(`    · Instagram ya publicado`);
    }

    if (!fbPosted) {
      try {
        const postId = await publishToFacebook(preview, caption);
        updates[F.fbPosted] = true;
        console.log(`    ✓ Facebook — post_id: ${postId}`);
      } catch (err) {
        console.error(`    ✗ Facebook: ${err.message}`);
      }
    } else {
      console.log(`    · Facebook ya publicado`);
    }

    if (Object.keys(updates).length > 0) await markPosted(recordId, updates);
    results.push({ title });
  }
  return results;
}

module.exports = { postRadarArticles };

if (require.main === module) {
  postRadarArticles()
    .then(r => { if (r.length) console.log(`\n✓ ${r.length} artículo(s) procesado(s).`); })
    .catch(err => { console.error('ERROR:', err.message); process.exit(1); });
}
