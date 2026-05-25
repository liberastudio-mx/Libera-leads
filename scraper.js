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

const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

// ── Airtable push (lotes de 10) ────────────────────────────────────────────

async function pushToAirtable(records) {
  if (!AIRTABLE_TOKEN) { console.log('Sin token de Airtable — solo CSV.'); return; }

  const batches = [];
  for (let i = 0; i < records.length; i += 10) batches.push(records.slice(i, i + 10));

  let pushed = 0;
  for (const batch of batches) {
    const body = {
      records: batch.map(r => ({
        fields: {
          Name:         r.nombre,
          telefono:     r.telefono,
          email:        r.email,
          sitio_web:    r.sitio_web,
          direccion:    r.direccion,
          calificacion: r.calificacion,
          resenas:      r.resenas,
          categoria:    r.categoria,
          estado:       'Sin contactar',
        },
      })),
    };

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      }
    );

    const json = await res.json();
    if (res.ok) {
      pushed += batch.length;
    } else {
      console.log(`Error Airtable: ${JSON.stringify(json.error)}`);
    }
  }

  console.log(`Airtable: ${pushed}/${records.length} registros enviados`);
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
  await page.waitForTimeout(900);

  return page.evaluate(() => {
    const nombre = document.querySelector('h1')?.textContent?.trim() || '';

    const categoria = document.querySelector('button[jsaction*="category"]')?.textContent?.trim() || '';

    const ratingLabel = document.querySelector('[aria-label*="stars"], [aria-label*="estrellas"]')
      ?.getAttribute('aria-label') || '';
    const calificacion = ratingLabel.match(/[\d,.]+/)?.[0]?.replace(',', '.') || '';
    const resenas      = ratingLabel.match(/(\d[\d,.]*)[\s ]*(reseña|review)/i)?.[1]?.replace(/\D/g, '') || '';

    const telEl    = document.querySelector('a[href^="tel:"]');
    const telefono = telEl ? telEl.href.replace('tel:', '').trim() : '';

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
    await page.waitForTimeout(700);

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

// ── main ───────────────────────────────────────────────────────────────────

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

  console.log(`\nBuscando: "${QUERY}" — máx ${MAX_RESULTS} resultados\n`);

  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const ctx     = await browser.newContext({
    locale:    'es-MX',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
    await page.locator('[role="feed"]').evaluate(el => el.scrollBy(0, 800));
    await page.waitForTimeout(900);
    const count = await page.$$eval(
      '[role="feed"] a[href*="/maps/place/"]',
      els => new Set(els.map(e => e.href)).size
    );
    if (count >= MAX_RESULTS || count === prevCount) break;
    prevCount = count;
  }

  // 3. Recolectar links
  const links = await page.$$eval(
    '[role="feed"] a[href*="/maps/place/"]',
    (els, max) => [...new Set(els.map(e => e.href))].slice(0, max),
    MAX_RESULTS
  );
  console.log(`Encontrados ${links.length} lugares. Extrayendo detalles...\n`);

  const results = [];

  for (let i = 0; i < links.length; i++) {
    try {
      // 4. Datos de Maps
      const data = await scrapePlacePage(page, links[i]);
      if (!data.nombre) continue;

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

    } catch (err) {
      console.log(`[${i+1}/${links.length}] Error: ${err.message}`);
    }
  }

  await browser.close();

  if (!results.length) { console.log('\nNo se obtuvieron resultados.'); return; }

  // 6. Guardar CSV
  const filename = `${slugify(QUERY)}_${Date.now()}.csv`;
  fs.writeFileSync(path.join(OUT_DIR, filename), '﻿' + toCsv(results), 'utf8');

  // 7. Enviar a Airtable
  process.stdout.write('\nEnviando a Airtable...');
  await pushToAirtable(results);

  // 8. Resumen
  const sinWeb   = results.filter(r => !r.sitio_web).length;
  const conTel   = results.filter(r => r.telefono).length;
  const conEmail = results.filter(r => r.email).length;

  console.log(`\n${results.length} resultados guardados en output/${filename}`);
  console.log(`Con telefono : ${conTel}/${results.length}`);
  console.log(`Con email    : ${conEmail}/${results.length}`);
  console.log(`Sin sitio web: ${sinWeb}/${results.length}  <- prospectos por WhatsApp\n`);
})();
