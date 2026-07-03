require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, 'content-queue', 'articles');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AT_TOKEN   = process.env.AIRTABLE_TOKEN;
const AT_BASE    = process.env.AIRTABLE_BASE_ID;
const AT_TABLA   = 'tblvppRS5hB4wccD4'; // Articulos LIBERA

async function registrarEnAirtable(fields) {
  const res = await fetch(`https://api.airtable.com/v0/${AT_BASE}/${AT_TABLA}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  ⚠ Airtable: ${err}`);
    return null;
  }
  const json = await res.json();
  return json.id;
}

// Temas semanales para LIBERA Studio (rotación)
const TEMAS = [
  { titulo: 'Automatización para profesionales independientes en Mérida', keyword: 'automatización negocios Mérida' },
  { titulo: 'Sitio web vs perfil de Instagram: qué necesita tu negocio primero', keyword: 'sitio web negocio local México' },
  { titulo: 'Google Business Profile: cómo aparecer primero en tu zona', keyword: 'Google Business optimizar Mérida' },
  { titulo: 'WhatsApp Business automatizado para consultorios y despachos', keyword: 'WhatsApp automatizado profesional' },
  { titulo: 'Qué medir en tu presencia digital si eres profesional independiente', keyword: 'métricas presencia digital PYME' },
  { titulo: 'Por qué el 80% de los sitios web de profesionales no generan clientes', keyword: 'sitio web profesional que convierte' },
  { titulo: 'IA para pequeños negocios: herramientas que ya puedes usar hoy', keyword: 'inteligencia artificial pequeño negocio México' },
];

function getTemaDelaSemana() {
  const semana = Math.floor(Date.now() / 604800000) % TEMAS.length;
  return TEMAS[semana];
}

// STOP-SLOP rules embebidas del skill
const STOP_SLOP_PROMPT = `Eres un editor de textos profesional. Tu trabajo es reescribir el artículo aplicando estas 8 reglas sin excepción:

1. ELIMINA frases de relleno: "Aquí está la clave:", "La realidad es", "En el mundo actual", "Al final del día", "Cabe destacar que", "Es importante mencionar", "Sin lugar a dudas".
2. ROMPE estructuras formulaicas: nada de "No es X, es Y", listas de 3 elementos, fragmentos dramáticos.
3. VOZ ACTIVA siempre. Nombra al actor. No "se puede lograr" → "tú logras" o "el negocio logra".
4. SÉ ESPECÍFICO. Si una frase no nombra algo concreto, es relleno. Córtala.
5. PON AL LECTOR EN ESCENA. Usa "tú" para que el lector esté dentro del texto.
6. VARÍA el ritmo. No tres frases cortas seguidas. No párrafos del mismo largo.
7. CONFÍA en el lector. Sin meta-comentarios ("En este artículo veremos..."), sin permisos ("Está bien si...").
8. AFIRMA directo. No announces que vas a decir algo. Dilo.

Checklist antes de entregar:
- [ ] Sin adverbios (-mente, "realmente", "simplemente", "básicamente", "literalmente")
- [ ] Sin voz pasiva
- [ ] Sin aperturas vagas
- [ ] Sin contrastes negativos ("No X. Y.")
- [ ] Sin guiones largos (—)
- [ ] Sin meta-comentarios
- [ ] Sin sujetos falsos (el mercado "decide", los datos "muestran")
- [ ] Sin frases que empiecen con Qué, Cuándo, Dónde, Quién, Por qué, Cómo como gancho

Devuelve SOLO el artículo reescrito, sin explicaciones ni puntuación.`;

async function step1_radar(tema) {
  console.log('  [RADAR] Investigando...');
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: `Eres RADAR, agente de investigación de LIBERA Studio. Tu misión es reunir datos reales, verificables y útiles sobre temas relacionados con presencia digital, automatización y negocios locales en México (especialmente Yucatán/Mérida). Separas hechos de opiniones. Indicas qué datos son sólidos y cuáles son estimaciones. No tomas decisiones, solo provees inteligencia.`,
    messages: [{
      role: 'user',
      content: `Investiga este tema para un artículo de blog de LIBERA Studio:

Tema: "${tema.titulo}"
Keyword objetivo: "${tema.keyword}"

Entrega un research packet con:
1. 3-5 datos estadísticos reales y verificables (con fuente)
2. Dolor/problema principal del lector objetivo (profesional independiente en México)
3. 3 preguntas reales que este público busca en Google
4. 2-3 objeciones o mitos comunes sobre este tema
5. 1 ángulo diferenciador que la mayoría de artículos no cubre`
    }]
  });
  return res.content[0].text;
}

async function step2_writer(tema, research) {
  console.log('  [SEO-CONTENT-STRATEGIST] Escribiendo borrador...');
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: `Eres SEO CONTENT STRATEGIST de LIBERA Studio. Escribes artículos que responden mejor que la competencia a preguntas reales. Cada artículo tiene: intención clara, keyword principal, estructura legible (H1/H2/H3), respuesta útil y CTA coherente. Tu público son profesionales independientes y pequeñas empresas en México que quieren digitalizar su negocio. Escribes en español, tono directo y sin corporativismos.`,
    messages: [{
      role: 'user',
      content: `Escribe un artículo de blog completo usando este research:

TEMA: ${tema.titulo}
KEYWORD PRINCIPAL: ${tema.keyword}

RESEARCH DE RADAR:
${research}

Estructura requerida:
- H1 (título optimizado para SEO, máx 60 caracteres)
- Meta description (150-160 caracteres)
- Introducción (2-3 párrafos, hook fuerte)
- 3-5 secciones H2 con contenido sustancioso
- Subsecciones H3 donde aplique
- Conclusión con CTA hacia LIBERA Studio
- Longitud total: 800-1200 palabras`
    }]
  });
  return res.content[0].text;
}

async function step3_editor(borrador) {
  console.log('  [EDITOR/stop-slop] Limpiando texto...');
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3500,
    system: STOP_SLOP_PROMPT,
    messages: [{
      role: 'user',
      content: `Edita este artículo aplicando todas las reglas:\n\n${borrador}`
    }]
  });
  return res.content[0].text;
}

async function generateArticle() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY en .env');

  if (!fs.existsSync(ARTICLES_DIR)) fs.mkdirSync(ARTICLES_DIR, { recursive: true });

  const fecha = new Date().toISOString().slice(0, 10);
  const outPath = path.join(ARTICLES_DIR, `${fecha}.md`);

  if (fs.existsSync(outPath)) {
    console.log(`  ⚠ Ya existe artículo para hoy: ${outPath}`);
    return;
  }

  const tema = getTemaDelaSemana();
  console.log(`  Tema: "${tema.titulo}"`);

  const research  = await step1_radar(tema);
  const borrador  = await step2_writer(tema, research);
  const articulo  = await step3_editor(borrador);

  const output = `---
fecha: ${fecha}
tema: ${tema.titulo}
keyword: ${tema.keyword}
estado: revision-pendiente
agentes: RADAR → SEO-CONTENT-STRATEGIST → EDITOR(stop-slop)
---

${articulo}

---
## Research original (RADAR)

${research}

---
## Borrador pre-edición

${borrador}
`;

  fs.writeFileSync(outPath, output);
  console.log(`\n  ✓ Artículo guardado → ${outPath}`);

  // Registrar en Airtable
  const semana = `${new Date().getFullYear()}-W${String(Math.ceil(new Date().getDate() / 7)).padStart(2,'0')}`;
  const recordId = await registrarEnAirtable({
    'Titulo':           tema.titulo,
    'Keyword':          tema.keyword,
    'Semana':           semana,
    'Estado':           'Generado',
    'Fecha generacion': fecha,
    'Ruta archivo':     outPath,
    'Notas':            'Generado automáticamente. Pendiente revisión humana antes de publicar.',
  });
  if (recordId) console.log(`  ✓ Registrado en Airtable → ${recordId}`);

  return outPath;
}

module.exports = { generateArticle };

if (require.main === module) {
  (async () => {
    console.log('── Pipeline de artículo: RADAR → WRITER → EDITOR ──\n');
    await generateArticle();
    console.log('\nListo.');
  })().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
}
