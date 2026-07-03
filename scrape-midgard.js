const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  const brokenLinks = [];

  page.on('response', res => {
    if (res.status() >= 400) errors.push({ url: res.url(), status: res.status() });
  });

  await page.goto('https://midgard.fitcolatam.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('URL final:', page.url());
  console.log('Title:', await page.title());

  const heads = await page.evaluate(() =>
    Array.from(document.querySelectorAll('h1,h2,h3,h4'))
      .map(e => e.tagName + ': ' + e.textContent.trim())
      .filter(t => t.length > 3)
  );
  console.log('\n=== HEADINGS ===');
  heads.forEach(h => console.log(h));

  const allLinks = await page.evaluate(() =>
    [...new Set(Array.from(document.querySelectorAll('a[href]')).map(e => ({
      text: e.textContent.trim().slice(0, 60),
      href: e.href
    })).filter(l => l.href && !l.href.startsWith('javascript'))
    .map(l => l.text + ' → ' + l.href))]
  );
  console.log('\n=== LINKS ===');
  allLinks.slice(0, 40).forEach(l => console.log(l));

  const phones = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href^="tel:"]')).map(e => e.href)
  );
  const emails = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href^="mailto:"]')).map(e => e.href)
  );
  const socials = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map(e => e.href)
      .filter(h => /facebook|instagram|twitter|tiktok|youtube|whatsapp|wa\.me/.test(h))
  );

  console.log('\n=== CONTACTO ===');
  console.log('Tel:', phones);
  console.log('Email:', emails);
  console.log('Social:', [...new Set(socials)]);

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\n=== TEXTO VISIBLE ===');
  console.log(bodyText.slice(0, 3000));

  // Probar links importantes (términos, privacidad, etc.)
  const importantLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .filter(e => /termino|condicion|privacidad|legal|politica|about|contacto|precio|plan/i.test(e.textContent + e.href))
      .map(e => ({ text: e.textContent.trim(), href: e.href }))
  );
  console.log('\n=== LINKS LEGALES / IMPORTANTES ===');
  importantLinks.forEach(l => console.log(l.text, '→', l.href));

  console.log('\n=== ERRORES HTTP ===');
  errors.forEach(e => console.log(e.status, e.url));

  // Ahora probar cada link importante
  if (importantLinks.length > 0) {
    console.log('\n=== VERIFICANDO LINKS ===');
    for (const link of importantLinks.slice(0, 10)) {
      try {
        const res = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
        console.log(res.status(), link.text, '→', link.href);
        await page.goBack();
      } catch (e) {
        console.log('ERROR', link.text, '→', link.href, ':', e.message.slice(0, 80));
      }
    }
  }

  await browser.close();
})().catch(e => console.error('ERROR GLOBAL:', e.message));
