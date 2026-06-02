/**
 * LIBERA Studio — Social Media Publisher
 * Lee posts del Post Master en Airtable LIBERA SMM,
 * genera imagen con DALL-E 3 y publica en Instagram + Facebook.
 * Solo procesa posts de la plataforma "Meta" con Publish_Date <= hoy.
 *
 * Fase 1: Single Image 4:5 + Text + Image 4:5
 * Fase 2 pendiente: Carousels, Reels
 */
require('dotenv').config();

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const OPENAI_KEY     = process.env.OPENAI_API_KEY;
const IG_ID          = process.env.META_IG_BUSINESS_ACCOUNT_ID;
const FB_PAGE_ID     = process.env.META_FB_PAGE_ID;
const META_TOKEN     = process.env.META_PAGE_ACCESS_TOKEN;
const API_VER        = 'v21.0';
const GRAPH_BASE     = `https://graph.facebook.com/${API_VER}`;

const BASE_ID  = 'appCLF2sMEV9YVJ2A';
const TABLE_ID = 'tblc7xwv2voe1RuRC';

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
};

// Formatos soportados en Fase 1
const SUPPORTED_FORMATS = ['Single Image 4:5', 'Text + Image 4:5'];

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
  // Solo formatos soportados en Fase 1
  return records.filter(r => {
    const fmt = r.fields[F.format]?.name || '';
    return SUPPORTED_FORMATS.includes(fmt);
  });
}

async function markPublished(recordId, postedUrl) {
  await airtableReq(`/${BASE_ID}/${TABLE_ID}/${recordId}`, 'PATCH', {
    fields: { [F.publicado]: true, [F.postedUrl]: postedUrl || '' },
  });
}

// ── DALL-E 3 Image Generation ─────────────────────────────────────────────────

async function generateImage(visualConcept, visualElements, hook) {
  const prompt = [
    `Social media post for LIBERA Studio (tech agency, Mérida Mexico).`,
    `Visual concept: ${visualConcept}.`,
    `Visual elements: ${visualElements}.`,
    `Main message: "${hook}".`,
    `Style: clean, modern, professional. Orange accent (#E8612A) on dark background.`,
    `No text overlays unless specified. 4:5 aspect ratio composition.`,
  ].join(' ');

  console.log(`    Generando imagen DALL-E 3...`);
  const res = await fetch('https://api.openai.com/v1/images/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', quality: 'standard' }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`DALL-E: ${json.error.message}`);
  return json.data[0].url;
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

async function publishToInstagram(imageUrl, caption) {
  const { id: creationId } = await graphPost(`/${IG_ID}/media`, { image_url: imageUrl, caption });
  const { id: mediaId }    = await graphPost(`/${IG_ID}/media_publish`, { creation_id: creationId });
  return mediaId;
}

async function publishToFacebook(imageUrl, caption) {
  const { id: postId } = await graphPost(`/${FB_PAGE_ID}/photos`, { url: imageUrl, caption });
  return postId;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function postSocialContent() {
  if (!AIRTABLE_TOKEN) throw new Error('Falta AIRTABLE_TOKEN en .env');
  if (!OPENAI_KEY)     throw new Error('Falta OPENAI_API_KEY en .env');
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
    const format  = fields[F.format]?.name || '';
    const hook    = fields[F.hook]    || '';

    console.log(`  → [${postId}] "${hook.slice(0, 50)}..."`);
    console.log(`    Formato: ${format}`);

    try {
      // 1. Generar imagen
      const imageUrl = await generateImage(
        fields[F.visualConcept]  || '',
        fields[F.visualElements] || '',
        hook
      );
      console.log(`    ✓ Imagen generada`);

      // 2. Construir caption
      const caption = buildCaption(fields);

      // 3. Publicar en Instagram
      let igMediaId, fbPostId;
      try {
        igMediaId = await publishToInstagram(imageUrl, caption);
        console.log(`    ✓ Instagram — media_id: ${igMediaId}`);
      } catch (err) {
        console.error(`    ✗ Instagram: ${err.message}`);
      }

      // 4. Publicar en Facebook
      try {
        fbPostId = await publishToFacebook(imageUrl, caption);
        console.log(`    ✓ Facebook — post_id: ${fbPostId}`);
      } catch (err) {
        console.error(`    ✗ Facebook: ${err.message}`);
      }

      // 5. Marcar publicado
      const postedUrl = igMediaId
        ? `https://www.instagram.com/p/${igMediaId}`
        : fbPostId || '';
      await markPublished(recordId, postedUrl);
      console.log(`    ✓ Airtable actualizado — Publicado: true`);

      results.push({ postId, igMediaId, fbPostId });
    } catch (err) {
      console.error(`    ERROR en [${postId}]: ${err.message}`);
    }
  }
  return results;
}

module.exports = { postSocialContent };

if (require.main === module) {
  postSocialContent()
    .then(r => { if (r.length) console.log(`\n✓ ${r.length} post(s) publicado(s).`); })
    .catch(err => { console.error('ERROR:', err.message); process.exit(1); });
}
