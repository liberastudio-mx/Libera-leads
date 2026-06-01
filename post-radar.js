/**
 * LIBERA Studio — Post Radar Articles to Instagram
 * Busca artículos del Radar en Airtable con Publicado=true, Preview!='' e Instagram_Posted=false
 * y los publica en Instagram via Meta Graph API.
 */
require('dotenv').config();

const AIRTABLE_TOKEN  = process.env.AIRTABLE_TOKEN;
const RADAR_BASE_ID   = 'appCLF2sMEV9YVJ2A';
const RADAR_TABLE_ID  = 'tbltjVkZ8oHowq4t1';
const IG_ID           = process.env.META_IG_BUSINESS_ACCOUNT_ID;
const META_TOKEN      = process.env.META_PAGE_ACCESS_TOKEN;
const API_VER         = 'v21.0';
const IG_BASE         = `https://graph.facebook.com/${API_VER}`;

// Field IDs de la tabla Radar Articles
const F = {
  title:     'fldWzoK0eaFV3RIgK',  // Article_Title
  source:    'fldNbdHOckrDnmSkS',  // Source (URL del artículo)
  publicado: 'fld5Zje0kUJu7U954',  // Publicado (checkbox)
  notes:     'fldOhzhO9942ijaOB',  // Notes (contiene excerpt + categoría + fuentes)
  preview:   'fldztq8zCmoxu9eLp',  // Preview (URL imagen social 1080x1080)
  igPosted:  'fld4SxzCRmNOgy6hl',  // Instagram_Posted (checkbox)
};

const HASHTAGS = '#liberastudio #ai #automatizacion #tecnologia #negocios #ia #mexico #merida #agenciaia #herramientas';

// ── Airtable helpers ──────────────────────────────────────────────────────────

async function airtableReq(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.airtable.com/v0${path}`, opts);
  const json = await res.json();
  if (json.error) throw new Error(`Airtable: ${JSON.stringify(json.error)}`);
  return json;
}

async function getPendingArticles() {
  const filter = encodeURIComponent(
    `AND({Publicado}=TRUE(), {Instagram_Posted}=FALSE(), {Preview}!='')`
  );
  const data = await airtableReq(`/${RADAR_BASE_ID}/${RADAR_TABLE_ID}?filterByFormula=${filter}`);
  return data.records || [];
}

async function markPosted(recordId) {
  await airtableReq(`/${RADAR_BASE_ID}/${RADAR_TABLE_ID}/${recordId}`, 'PATCH', {
    fields: { [F.igPosted]: true },
  });
}

// ── Caption builder ───────────────────────────────────────────────────────────

function buildCaption(fields) {
  const title  = fields[F.title] || '';
  const notes  = fields[F.notes] || '';
  const source = fields[F.source] || '';

  const excerptMatch = notes.match(/Excerpt:\s*(.+?)(?:\n|Fuentes:)/s);
  const excerpt = excerptMatch ? excerptMatch[1].trim() : '';

  const domain = source.replace('https://', '').replace(/\/$/, '');

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
  ].filter(l => l !== undefined).join('\n');
}

// ── Instagram helpers ─────────────────────────────────────────────────────────

async function graphApi(endpoint, body) {
  const opts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: META_TOKEN }),
  };
  const res  = await fetch(`${IG_BASE}${endpoint}`, opts);
  const json = await res.json();
  if (json.error) throw new Error(`Meta API: ${json.error.message} (code ${json.error.code})`);
  return json;
}

async function publishToIG(imageUrl, caption) {
  const { id: creationId } = await graphApi(`/${IG_ID}/media`, { image_url: imageUrl, caption });
  const { id: mediaId }    = await graphApi(`/${IG_ID}/media_publish`, { creation_id: creationId });
  return mediaId;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function postRadarArticles() {
  if (!AIRTABLE_TOKEN)     throw new Error('Falta AIRTABLE_TOKEN en .env');
  if (!IG_ID || !META_TOKEN) throw new Error('Faltan META_IG_BUSINESS_ACCOUNT_ID o META_PAGE_ACCESS_TOKEN en .env');

  const articles = await getPendingArticles();
  console.log(`  Artículos Radar pendientes: ${articles.length}`);

  if (articles.length === 0) {
    console.log('  ✓ No hay artículos nuevos que publicar en Instagram.');
    return [];
  }

  const results = [];
  for (const { id: recordId, fields } of articles) {
    const title = fields[F.title] || 'Nuevo artículo en Radar';
    try {
      console.log(`  → Publicando: "${title}"`);
      const caption = buildCaption(fields);
      const mediaId = await publishToIG(fields[F.preview], caption);
      await markPosted(recordId);
      console.log(`  ✓ Publicado — media_id: ${mediaId}`);
      results.push({ title, mediaId });
    } catch (err) {
      console.error(`  ERROR en "${title}": ${err.message}`);
    }
  }
  return results;
}

module.exports = { postRadarArticles };

if (require.main === module) {
  postRadarArticles()
    .then(r => { if (r.length) console.log(`\n✓ ${r.length} artículo(s) publicado(s).`); })
    .catch(err => { console.error('ERROR:', err.message); process.exit(1); });
}
