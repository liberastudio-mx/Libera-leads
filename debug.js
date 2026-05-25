const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const ctx  = await browser.newContext({ locale: 'es-MX' });
  const page = await ctx.newPage();

  // Primero cargamos el feed de búsqueda
  await page.goto('https://www.google.com/maps/search/psic%C3%B3logos+M%C3%A9rida+Yucat%C3%A1n', {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  await page.waitForTimeout(4000);

  // Aceptar cookies
  try {
    const btns = await page.$$('button');
    for (const btn of btns) {
      const txt = await btn.textContent();
      if (/aceptar|accept/i.test(txt)) { await btn.click(); await page.waitForTimeout(2000); break; }
    }
  } catch (_) {}

  // Esperar feed y tomar el primer link de lugar
  await page.waitForSelector('[role="feed"]', { timeout: 10000 });
  const links = await page.$$eval('a[href*="/maps/place/"]',
    els => [...new Set(els.map(e => e.href))].slice(0, 3)
  );
  console.log(`Links encontrados: ${links.length}`);
  console.log(links);

  if (!links.length) { console.log('No se encontraron links.'); await browser.close(); return; }

  // Navegar al primer lugar
  console.log('\nNavegando al primer lugar...');
  await page.goto(links[0], { waitUntil: 'domcontentloaded', timeout: 18000 });
  await page.waitForTimeout(2500);

  // Checar todos los selectores posibles para teléfono
  const phoneTests = await page.evaluate(() => {
    const results = {};

    // Opción 1: href="tel:..."
    const telLink = document.querySelector('a[href^="tel:"]');
    results['a[href^="tel:"]'] = telLink ? telLink.href : null;

    // Opción 2: data-item-id con phone
    const phoneItem = document.querySelector('[data-item-id^="phone"]');
    results['[data-item-id^="phone"]'] = phoneItem ? phoneItem.getAttribute('data-item-id') : null;

    // Opción 3: aria-label con teléfono
    const ariaPhone = document.querySelector('[aria-label*="eléfono"]');
    results['[aria-label*=eléfono]'] = ariaPhone ? ariaPhone.getAttribute('aria-label') : null;

    // Opción 4: todos los data-item-id presentes
    const allItemIds = [...document.querySelectorAll('[data-item-id]')]
      .map(el => el.getAttribute('data-item-id'))
      .filter(Boolean);
    results['all data-item-id values'] = [...new Set(allItemIds)];

    // Opción 5: sitio web
    const webEl = document.querySelector('a[data-item-id="authority"]');
    results['a[data-item-id="authority"]'] = webEl ? webEl.href : null;

    // Opción 6: address
    const addrEl = document.querySelector('[data-item-id="address"]');
    results['[data-item-id="address"]'] = addrEl ? addrEl.textContent.trim() : null;

    // Opción 7: buscar el número directamente en el texto del DOM
    const allText = document.body.innerText;
    const phoneMatch = allText.match(/(\+52[\s\d]{10,}|\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4})/);
    results['regex phone in body text'] = phoneMatch ? phoneMatch[0] : null;

    return results;
  });

  console.log('\nResultados de selectores en página de lugar:');
  Object.entries(phoneTests).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      console.log(`\n  [data-item-id] presentes (${v.length}):`);
      v.forEach(id => console.log(`    - ${id}`));
    } else {
      console.log(`  ${v ? '✅' : '❌'} ${k}: ${v || 'no encontrado'}`);
    }
  });

  await page.screenshot({ path: 'debug-place.png' });
  console.log('\nScreenshot del lugar guardado: debug-place.png');

  await browser.close();
})();
