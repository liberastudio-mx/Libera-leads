require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, 'content-queue');

// Airtable Post Master (LIBERA SMM)
const AT_TOKEN    = process.env.AIRTABLE_TOKEN;
const AT_BASE     = process.env.AIRTABLE_SMM_BASE_ID;
const AT_TABLE    = process.env.AIRTABLE_SMM_TABLE_ID;

// Field IDs del Post Master
const F = {
  hook:          'fldeLkI88cs4RxIu1',
  caption:       'fldJorsFyJcxnvxqI',
  hashtags:      'fldiURQF2oidw3shS',
  visualConcept: 'fld27rqs9gnDMYx1N',
  visualElems:   'fldRr1MiWcaY9O14x',
  publishDate:   'fldyW6I6XyJRHi2UP',
  platform:      'fldwkB3ZIKjBXrlAX',
  format:        'fld2teWM2t7dLNz92',
};

async function saveToAirtable(content) {
  if (!AT_TOKEN || !AT_BASE || !AT_TABLE) {
    console.log('  ⚠ AIRTABLE_TOKEN / AIRTABLE_SMM_BASE_ID / AIRTABLE_SMM_TABLE_ID no configurados — saltando Airtable');
    return null;
  }

  const res = await fetch(`https://api.airtable.com/v0/${AT_BASE}/${AT_TABLE}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [{
        fields: {
          [F.hook]:          content.headline,
          [F.caption]:       content.caption,
          [F.hashtags]:      Array.isArray(content.hashtags) ? content.hashtags.join(' ') : content.hashtags,
          [F.visualConcept]: content.image_prompt,
          [F.visualElems]:   content.subtitulo,
          [F.publishDate]:   content.fecha,
          [F.platform]:      'Meta',
          [F.format]:        'Single Image 4:5',
        }
      }]
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`Airtable error ${res.status}: ${JSON.stringify(json.error)}`);
  return json.records?.[0]?.id;
}

// Rubricas LIBERA Studio (rotación semanal)
const RUBRICAS = [
  'Tecnología que libera tiempo',
  'AI sin fuffa',
  'Problemas reales, sistemas reales',
  'Diario de laboratorio',
  'Automatizaciones útiles',
  'Apuntes de método',
  'Primero el problema, luego la herramienta',
];

// Día de la semana → rúbrica
function getRubricaHoy() {
  const dia = new Date().getDay(); // 0=dom, 1=lun...
  return RUBRICAS[dia % RUBRICAS.length];
}

async function generateContent() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Falta ANTHROPIC_API_KEY en .env — obtén tu key en console.anthropic.com');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const rubrica = getRubricaHoy();
  const fecha = new Date().toISOString().slice(0, 10);

  console.log(`  Rúbrica de hoy: "${rubrica}"`);

  const prompt = `Eres el agente SOCIAL-CONTENT-STRATEGIST de LIBERA Studio, una agencia de diseño web y automatización con IA en Mérida, Yucatán.

Voz de marca: directa, sin relleno, con autoridad técnica pero accesible. Nunca corporativa. El público son profesionales independientes y pequeñas empresas en México que quieren digitalizar su negocio.

Hoy toca la rúbrica: "${rubrica}"

Genera un post para Instagram de LIBERA Studio. El formato es POST ESTÁTICO.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "rubrica": "${rubrica}",
  "headline": "texto visual principal (máx 8 palabras, impacto inmediato)",
  "subtitulo": "subtítulo de apoyo (máx 12 palabras)",
  "caption": "caption completo para Instagram (150-220 caracteres, incluye CTA al final)",
  "hashtags": ["hashtag1", "hashtag2", ...] (exactamente 10 hashtags relevantes para México),
  "image_prompt": "prompt en inglés para generar la imagen (estilo minimalista, fondo oscuro #06070E, acento naranja #E85220, tipografía moderna, sin personas)",
  "alt_text": "texto alternativo de la imagen para accesibilidad (1 línea)"
}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text.trim();

  // Extraer JSON del response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('El modelo no devolvió JSON válido');

  const content = JSON.parse(jsonMatch[0]);
  content.fecha = fecha;
  content.generado_en = new Date().toISOString();
  content.estado = 'pendiente'; // pendiente | publicado | error

  // Guardar en queue local
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR);
  const outPath = path.join(CONTENT_DIR, `${fecha}.json`);
  fs.writeFileSync(outPath, JSON.stringify(content, null, 2));

  console.log(`  ✓ Contenido generado → ${outPath}`);
  console.log(`  Headline: "${content.headline}"`);
  console.log(`  Caption: "${content.caption.slice(0, 80)}..."`);

  // Guardar en Airtable Post Master
  try {
    const recordId = await saveToAirtable(content);
    if (recordId) console.log(`  ✓ Airtable registrado → ${recordId}`);
  } catch (err) {
    console.log(`  ✗ Airtable falló: ${err.message}`);
  }

  return content;
}

module.exports = { generateContent };

if (require.main === module) {
  (async () => {
    console.log('── Generando contenido del día ──\n');
    await generateContent();
    console.log('\nListo.');
  })().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
}
