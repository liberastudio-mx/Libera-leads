/**
 * LIBERA Leads — Push posts a Airtable Post Master
 * Lee un archivo JSON con array de posts y los registra en Airtable SMM.
 *
 * Uso:
 *   node push-airtable.js content-queue/posts-2026-06-27.json
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const AT_TOKEN = process.env.AIRTABLE_TOKEN;
const AT_BASE  = process.env.AIRTABLE_SMM_BASE_ID;
const AT_TABLE = process.env.AIRTABLE_SMM_TABLE_ID;

const F = {
  hook:          'fldeLkI88cs4RxIu1',
  caption:       'fldJorsFyJcxnvxqI',
  hashtags:      'fldiURQF2oidw3shS',
  visualConcept: 'fld27rqs9gnDMYx1N',
  visualElems:   'fldRr1MiWcaY9O14x',
  publishDate:   'fldyW6I6XyJRHi2UP',
  platform:      'fldwkB3ZIKjBXrlAX',
  format:        'fld2teWM2t7dLNz92',
  cta:           'fldhbJbhOAwNPpRCH',
};

async function pushPost(post) {
  const res = await fetch(`https://api.airtable.com/v0/${AT_BASE}/${AT_TABLE}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [{
        fields: {
          [F.hook]:          post.headline,
          [F.caption]:       post.caption,
          [F.hashtags]:      Array.isArray(post.hashtags) ? post.hashtags.join(' ') : post.hashtags,
          [F.visualConcept]: post.image_prompt || '',
          [F.visualElems]:   post.subtitulo    || '',
          [F.publishDate]:   post.publish_date,
          [F.platform]:      post.platform     || 'Meta',
          [F.format]:        post.format        || 'Single Image 4:5',
          [F.cta]:           post.cta           || '',
        }
      }]
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${JSON.stringify(json.error)}`);
  return json.records[0].id;
}

(async () => {
  if (!AT_TOKEN || !AT_BASE || !AT_TABLE) {
    console.error('Faltan AIRTABLE_TOKEN / AIRTABLE_SMM_BASE_ID / AIRTABLE_SMM_TABLE_ID en .env');
    process.exit(1);
  }

  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: node push-airtable.js <archivo.json>');
    process.exit(1);
  }

  const posts = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  console.log(`\nSubiendo ${posts.length} posts a Airtable...\n`);

  for (const post of posts) {
    try {
      const id = await pushPost(post);
      console.log(`✓ [${post.publish_date}] "${post.headline}" → ${id}`);
    } catch (err) {
      console.log(`✗ [${post.publish_date}] "${post.headline}" → ${err.message}`);
    }
  }

  console.log('\nListo.');
})();
