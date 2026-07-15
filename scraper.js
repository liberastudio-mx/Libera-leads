/**
 * LIBERA Leads — Google Maps Scraper + Email Extractor
 * Uso: node scraper.js "psicólogos Mérida" 40
 */

require('dotenv').config();

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const QUERY       = process.argv[2] || 'psicólogos Mérida Yucatán';
const MAX_RESULTS = parseInt(process.argv[3]) || 30;
const OUT_DIR     = path.join(__dirname, 'output');

const ZONA_WORDS = new Set(['norte', 'sur', 'oriente', 'poniente', 'centro', 'de', 'del', 'la', 'las', 'los', 'el', 'zona', 'hotelera', 'pueblo']);
const CIUDAD_COMPUESTA = ['Playa del Carmen', 'Tuxtla Gutiérrez', 'San Cristóbal', 'Puerto Morelos', 'Puerto Vallarta', 'San Luis Potosí'];
function extractCiudad(query) {
  for (const c of CIUDAD_COMPUESTA) {
    if (query.toLowerCase().includes(c.toLowerCase())) return c;
  }
  for (const w of query.split(/\s+/)) {
    if (/^[A-ZÁÉÍÓÚÜÑ]/.test(w) && !ZONA_WORDS.has(w.toLowerCase())) return w;
  }
  return 'su ciudad';
}
const CIUDAD = extractCiudad(QUERY);

const rnd = (min, max) => Math.floor(min + Math.random() * (max - min));

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
];

// ── Generador de mensaje WhatsApp / email en frío ─────────────────────────────
// Definidos en mensajes.js (compartido con regenerate-mensajes.js).

const { generarMensaje, generarEmailEnFrio } = require('./mensajes');

// ── CRM push (SQLite local — db/leads.db, el mismo que ve el dashboard) ───────

const localDb = require('./db');

function pushToCrm(records) {
  const enriched = records.map(r => {
    const email = generarEmailEnFrio(r);
    return {
      ...r,
      Mensaje_Borrador: generarMensaje(r, CIUDAD),
      Email_Subject:    email.subject,
      Email_Body:       email.body,
      query_origen:     QUERY,
      ciudad:           CIUDAD,
    };
  });
  const inserted = localDb.pushLeads(enriched);
  console.log(`CRM: ${inserted} leads nuevos guardados (${records.length - inserted} ya existían)`);
  return inserted;
}

// ── deduplicación entre corridas ──────────────────────────────────────────

const SEEN_PATH = path.join(OUT_DIR, '_seen.json');

function loadSeen() {
  if (!fs.existsSync(SEEN_PATH)) return new Set();
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8'))); }
  catch (_) { return new Set(); }
}

function seenKey(r) {
  const nombre = (r.nombre || '').toLowerCase().trim();
  const tel    = (r.telefono || '').replace(/\D/g, '');
  return tel ? `${nombre}|${tel}` : `${nombre}|${(r.direccion || '').toLowerCase().trim()}`;
}

function saveSeen(seen) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);
  fs.writeFileSync(SEEN_PATH, JSON.stringify([...seen]), 'utf8');
}

// ── helpers ────────────────────────────────────────────────────────────────

function toCsv(rows) {
  const headers = ['nombre', 'telefono', 'email', 'sitio_web', 'direccion', 'calificacion', 'resenas', 'categoria'];
  const escape  = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ].join('\n');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function extractEmails(text) {
  const found = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  const blacklist = /\.(png|jpg|jpeg|gif|svg|webp|woff|ttf|otf|css|js)$/i;
  const blocked   = /(sentry|example|domain|email\.com|correo@|tumail|yourmail|test@|foo@|doctoralia|practo|zocdoc|yelp|google|facebook|instagram|wix\.com|wordpress|godaddy)/i;
  return [...new Set(found.filter(e => !blacklist.test(e) && !blocked.test(e)))];
}

// ── scraper de lugar en Google Maps ───────────────────────────────────────

async function scrapePlacePage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 });
  await page.waitForTimeout(rnd(1500, 2500));

  // Esperar a que cargue el teléfono (si existe)
  await page.waitForSelector('a[href^="tel:"], [data-item-id^="phone:tel"]', { timeout: 4000 }).catch(() => {});

  return page.evaluate(() => {
    const nombre = document.querySelector('h1')?.textContent?.trim() || '';

    const categoria = document.querySelector('button[jsaction*="category"]')?.textContent?.trim() || '';

    // Calificación
    const ratingEl    = document.querySelector('[aria-label*="stars"], [aria-label*="estrellas"], [aria-label*="Calificaci"]');
    const ratingLabel = ratingEl?.getAttribute('aria-label') || '';
    const calificacion = ratingLabel.match(/[\d,.]+/)?.[0]?.replace(',', '.') || '';

    // Reseñas — intenta en este orden:
    let resenas = ratingLabel.match(/(\d[\d,.]*)[\s ]*(reseña|review)/i)?.[1]?.replace(/\D/g, '') || '';

    if (!resenas) {
      // Botón o link con aria-label que menciona reseñas
      const resenasEl = document.querySelector(
        'button[aria-label*="reseña"], a[aria-label*="reseña"], span[aria-label*="reseña"],' +
        'button[aria-label*="review"], a[aria-label*="review"]'
      );
      const resenasLabel = resenasEl?.getAttribute('aria-label') || '';
      const m = resenasLabel.match(/(\d[\d,.]*)/);
      if (m) resenas = m[1].replace(/\D/g, '');
    }

    if (!resenas) {
      // Texto visible tipo "(1,234)" cerca de la calificación
      const main = document.querySelector('[role="main"]')?.textContent || '';
      const m    = main.match(/\((\d[\d,.]+)\)/);
      if (m) resenas = m[1].replace(/\D/g, '');
    }

    // Selector principal: link tel:
    let telefono = '';
    const telEl = document.querySelector('a[href^="tel:"]');
    if (telEl) {
      telefono = telEl.href.replace('tel:', '').trim();
    } else {
      // Selector alternativo: data-item-id con el número embebido
      const phoneItem = document.querySelector('[data-item-id^="phone:tel:"]');
      if (phoneItem) {
        telefono = phoneItem.getAttribute('data-item-id').replace('phone:tel:', '').trim();
      }
    }

    const webEl     = document.querySelector('a[data-item-id="authority"]');
    const sitio_web = webEl?.href || '';

    const addrEl    = document.querySelector('[data-item-id="address"]');
    const direccion = addrEl?.textContent?.trim() || '';

    return { nombre, telefono, sitio_web, direccion, calificacion, resenas, categoria };
  });
}

// ── extractor de email desde sitio web ───────────────────────────────────

async function extractEmailFromWebsite(page, siteUrl) {
  if (!siteUrl) return '';
  try {
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 14000 });
    await page.waitForTimeout(rnd(500, 1100));

    let emails = extractEmails(await page.content());
    if (emails.length) return emails[0];

    // Intentar página de contacto
    const contactLinks = await page.$$eval('a[href]', els =>
      els.map(e => e.href)
        .filter(h => /contact|contacto|contact-us|sobre|about/i.test(h))
        .slice(0, 2)
    );

    for (const link of contactLinks) {
      try {
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(600);
        emails = extractEmails(await page.content());
        if (emails.length) return emails[0];
      } catch (_) {}
    }
  } catch (_) {}
  return '';
}

// ── checkpoint (guarda progreso para retomar si se interrumpe) ────────────

function checkpointPath(query) {
  return path.join(OUT_DIR, `_checkpoint_${slugify(query)}.json`);
}

function loadCheckpoint(query) {
  const cp = checkpointPath(query);
  if (fs.existsSync(cp)) {
    try {
      const data = JSON.parse(fs.readFileSync(cp, 'utf8'));
      console.log(`\nCheckpoint encontrado: ${data.results.length} leads ya procesados, ${data.links.length - data.doneIndex} restantes.\n`);
      return data;
    } catch (_) {}
  }
  return null;
}

function saveCheckpoint(query, links, doneIndex, results) {
  fs.writeFileSync(checkpointPath(query), JSON.stringify({ links, doneIndex, results }), 'utf8');
}

function clearCheckpoint(query) {
  const cp = checkpointPath(query);
  if (fs.existsSync(cp)) fs.unlinkSync(cp);
}

// ── main ───────────────────────────────────────────────────────────────────

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

  console.log(`\nBuscando: "${QUERY}" — máx ${MAX_RESULTS} resultados\n`);

  const browser = await chromium.launch({ headless: false, slowMo: rnd(50, 130) });
  const ctx     = await browser.newContext({
    locale:    'es-MX',
    userAgent: USER_AGENTS[rnd(0, USER_AGENTS.length)],
  });
  const page = await ctx.newPage();

  // 1. Cargar búsqueda
  await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(QUERY)}`, {
    waitUntil: 'domcontentloaded',
  });

  // Aceptar cookies
  try {
    const btns = await page.$$('button');
    for (const btn of btns) {
      const txt = await btn.textContent();
      if (/aceptar|accept/i.test(txt)) { await btn.click(); await page.waitForTimeout(1200); break; }
    }
  } catch (_) {}

  try {
    await page.waitForSelector('[role="feed"]', { timeout: 12000 });
  } catch (_) {
    console.error('No cargó el panel de resultados.');
    await browser.close(); process.exit(1);
  }

  // 2. Scroll para cargar más
  console.log('Cargando resultados...');
  let prevCount = 0;
  for (let i = 0; i < 25; i++) {
    const scrollPx = rnd(600, 1000);
    await page.locator('[role="feed"]').evaluate((el, px) => el.scrollBy(0, px), scrollPx);
    await page.waitForTimeout(rnd(800, 1600));
    const count = await page.$$eval(
      '[role="feed"] a[href*="/maps/place/"]',
      els => new Set(els.map(e => e.href)).size
    );
    if (count >= MAX_RESULTS || count === prevCount) break;
    prevCount = count;
  }

  // 3. Recolectar links (o retomar checkpoint)
  const checkpoint = loadCheckpoint(QUERY);
  let links, startIndex, results;

  if (checkpoint) {
    links      = checkpoint.links;
    startIndex = checkpoint.doneIndex;
    results    = checkpoint.results;
    console.log(`Retomando desde el resultado #${startIndex + 1}...\n`);
  } else {
    links = await page.$$eval(
      '[role="feed"] a[href*="/maps/place/"]',
      (els, max) => [...new Set(els.map(e => e.href))].slice(0, max),
      MAX_RESULTS
    );
    startIndex = 0;
    results    = [];
    console.log(`Encontrados ${links.length} lugares. Extrayendo detalles...\n`);
    saveCheckpoint(QUERY, links, 0, []);
  }

  const seen = loadSeen();
  let skipped = 0;

  for (let i = startIndex; i < links.length; i++) {
    try {
      // 4. Datos de Maps
      const data = await scrapePlacePage(page, links[i]);
      if (!data.nombre) { saveCheckpoint(QUERY, links, i + 1, results); continue; }

      // Saltar duplicados
      const key = seenKey(data);
      if (seen.has(key)) {
        console.log(`[${i+1}/${links.length}] DUPLICADO — ${data.nombre} (ya existe)`);
        skipped++;
        saveCheckpoint(QUERY, links, i + 1, results);
        continue;
      }

      // 5. Email desde sitio web
      let email = '';
      if (data.sitio_web) {
        process.stdout.write(`[${i+1}/${links.length}] ${data.nombre} — buscando email...`);
        email = await extractEmailFromWebsite(page, data.sitio_web);
        process.stdout.write(email ? ` ${email}\n` : ' no encontrado\n');
      } else {
        console.log(`[${i+1}/${links.length}] ${data.nombre} | sin sitio web`);
      }

      results.push({ ...data, email });
      seen.add(key);
      saveCheckpoint(QUERY, links, i + 1, results);

    } catch (err) {
      console.log(`[${i+1}/${links.length}] Error: ${err.message}`);
      saveCheckpoint(QUERY, links, i + 1, results);
    }
  }

  if (skipped) console.log(`\n${skipped} duplicados omitidos.`);

  await browser.close();

  if (!results.length) {
    console.log(`\n⚠ 0 leads nuevos para "${QUERY}" — ${skipped ? `los ${skipped} resultados ya estaban en el CRM (duplicados)` : 'la búsqueda no arrojó resultados'}.`);
    return;
  }

  // 6. Guardar CSV
  const filename = `${slugify(QUERY)}_${Date.now()}.csv`;
  fs.writeFileSync(path.join(OUT_DIR, filename), '﻿' + toCsv(results), 'utf8');

  clearCheckpoint(QUERY);
  saveSeen(seen);

  // 7. Guardar en el CRM
  console.log('\nGuardando en el CRM...');
  pushToCrm(results);

  // 8. Resumen
  const sinWeb   = results.filter(r => !r.sitio_web).length;
  const conTel   = results.filter(r => r.telefono).length;
  const conEmail = results.filter(r => r.email).length;

  console.log(`\n${results.length} resultados guardados en output/${filename}`);
  console.log(`Con telefono : ${conTel}/${results.length}`);
  console.log(`Con email    : ${conEmail}/${results.length}`);
  console.log(`Sin sitio web: ${sinWeb}/${results.length}  <- prospectos por WhatsApp\n`);
})();
