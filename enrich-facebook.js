/**
 * LIBERA Leads — Enriquecimiento Facebook
 * Lee leads de Airtable que tienen una URL de Facebook como sitio_web
 * y no tienen teléfono. Entra a cada página y extrae el número.
 *
 * Uso:
 *   node enrich-facebook.js           → procesa hasta 20 leads
 *   node enrich-facebook.js --limit 5 → procesa solo 5
 *   node enrich-facebook.js --dry-run → muestra qué haría sin guardar
 */

require('dotenv').config();
const { chromium } = require('playwright');

const TOKEN    = process.env.AIRTABLE_TOKEN;
const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT   = (() => {
  const i = process.argv.indexOf('--limit');
  return i !== -1 ? parseInt(process.argv[i + 1]) : 20;
})();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd   = (min, max) => Math.floor(min + Math.random() * (max - min));

// ── Airtable ─────────────────────────────────────────────────────────────────

async function fetchLeads() {
  const leads = [];
  let offset  = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('filterByFormula',
      'AND(FIND("facebook", LOWER({sitio_web})), NOT({telefono}), {estado} = "Sin contactar")'
    );
    url.searchParams.append('fields[]', 'Name');
    url.searchParams.append('fields[]', 'sitio_web');
    url.searchParams.append('fields[]', 'telefono');
    if (offset) url.searchParams.set('offset', offset);

    const res  = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || JSON.stringify(json.error));

    leads.push(...json.records);
    offset = json.offset || null;
  } while (offset);

  return leads.slice(0, LIMIT);
}

async function updateTelefono(recordId, telefono) {
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`,
    {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fields: { telefono } }),
    }
  );
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error?.message || JSON.stringify(json.error));
  }
}

// ── Extracción de teléfono desde página de Facebook ──────────────────────────

function cleanPhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return raw.trim();
}

async function extractPhoneFromFacebook(page, fbUrl) {
  try {
    await page.goto(fbUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(rnd(2000, 3500));

    // Cerrar popup de login si aparece
    const closeBtn = page.locator('[aria-label="Cerrar"], [aria-label="Close"]').first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click().catch(() => {});
      await sleep(500);
    }

    const content = await page.content();

    // 1. Buscar link de WhatsApp directo
    const waMatch = content.match(/wa\.me\/(\d{7,15})|api\.whatsapp\.com\/send\?phone=(\d{7,15})/);
    if (waMatch) {
      const num = waMatch[1] || waMatch[2];
      return `+${num}`;
    }

    // 2. Buscar link tel:
    const telMatch = content.match(/href="tel:([^"]+)"/);
    if (telMatch) {
      const cleaned = cleanPhone(telMatch[1]);
      if (cleaned) return cleaned;
    }

    // 3. Buscar patrón de número mexicano en el texto
    const mxPhone = content.match(/(\+?52[\s\-]?)?(\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4})/);
    if (mxPhone) {
      const cleaned = cleanPhone(mxPhone[0]);
      if (cleaned) return cleaned;
    }

    return null;
  } catch (_) {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!TOKEN || !BASE_ID || !TABLE_ID) {
    console.error('Faltan variables en .env (AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID)');
    process.exit(1);
  }

  console.log(`\n── Enriquecimiento Facebook ${DRY_RUN ? '(DRY RUN)' : ''} ──`);

  const leads = await fetchLeads();
  console.log(`${leads.length} leads con Facebook como sitio_web y sin teléfono\n`);

  if (leads.length === 0) {
    console.log('Nada que procesar.');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'es-MX',
  });
  const page = await context.newPage();

  let encontrados = 0;
  let sin_datos   = 0;

  for (const record of leads) {
    const nombre = record.fields.Name;
    const fbUrl  = record.fields.sitio_web;

    process.stdout.write(`  ${nombre} ... `);

    const telefono = await extractPhoneFromFacebook(page, fbUrl);

    if (telefono) {
      if (!DRY_RUN) {
        try {
          await updateTelefono(record.id, telefono);
          console.log(`✓ ${telefono}`);
          encontrados++;
        } catch (err) {
          console.log(`✗ Error al guardar: ${err.message}`);
        }
      } else {
        console.log(`✓ ${telefono} (dry-run)`);
        encontrados++;
      }
    } else {
      console.log('sin datos');
      sin_datos++;
    }

    await sleep(rnd(1500, 3000));
  }

  await browser.close();

  console.log(`\n── Resultado ──`);
  console.log(`  Teléfonos encontrados: ${encontrados}`);
  console.log(`  Sin datos:             ${sin_datos}`);
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
