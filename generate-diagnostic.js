const fs = require('fs');

const b64 = fs.readFileSync('C:/Users/hskin/AppData/Local/Temp/logo-b64.txt', 'utf8');
const logoSrc = 'data:image/png;base64,' + b64;

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Diagnóstico Digital — Nirupama Human Move</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #e0e0e0;
    font-size: 13px;
    line-height: 1.5;
    color: #1a1f36;
  }

  @page {
    size: A4;
    margin: 0;
  }

  /* Cada página es exactamente A4 */
  .page {
    width: 210mm;
    height: 297mm;
    background: #ffffff;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    page-break-after: always;
  }

  /* ── SHARED HEADER ─────────────────────────────── */
  .hdr {
    background: #0b0f35;
    padding: 18px 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .hdr img { height: 28px; display: block; }
  .hdr-meta { text-align: right; color: rgba(255,255,255,.5); font-size: 9.5px; line-height: 1.65; }
  .hdr-meta strong { color: rgba(255,255,255,.85); font-weight: 600; }

  /* ── HERO (página 1) ───────────────────────────── */
  .hero {
    background: linear-gradient(135deg, #E84318 0%, #b82f0e 100%);
    padding: 20px 36px;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }
  .hero-icon {
    width: 46px; height: 46px;
    background: rgba(255,255,255,.18);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; flex-shrink: 0;
  }
  .hero h1 { font-size: 19px; font-weight: 800; color: #fff; letter-spacing: -.3px; line-height: 1.15; }
  .hero p  { color: rgba(255,255,255,.8); font-size: 11px; margin-top: 3px; }
  .hero-badge {
    margin-left: auto; flex-shrink: 0;
    background: rgba(255,255,255,.18);
    border-radius: 8px; padding: 9px 16px;
    text-align: center; color: #fff;
  }
  .hero-badge .num { font-size: 16px; font-weight: 800; }
  .hero-badge .lbl { font-size: 9px; opacity: .8; margin-top: 1px; }

  /* ── PAGE BODY ────────────────────────────────── */
  .pbody { padding: 20px 36px; flex: 1; display: flex; flex-direction: column; gap: 14px; overflow: hidden; }

  /* ── FICHA ────────────────────────────────────── */
  .ficha {
    display: grid; grid-template-columns: repeat(3,1fr); gap: 0;
    border: 1px solid #e4e7f0; border-radius: 10px; overflow: hidden;
    flex-shrink: 0;
  }
  .fi {
    padding: 10px 14px;
    border-right: 1px solid #e4e7f0;
    background: #fff;
  }
  .fi:nth-child(3), .fi:nth-child(6) { border-right: none; }
  .fi:nth-child(4), .fi:nth-child(5), .fi:nth-child(6) {
    border-top: 1px solid #e4e7f0;
  }
  .fi label { font-size: 9px; text-transform: uppercase; letter-spacing: .55px; color: #9099b0; font-weight: 700; display: block; margin-bottom: 2px; }
  .fi span  { font-size: 11.5px; color: #1a1f36; font-weight: 500; }
  .fi span.alert { color: #dc2626; }

  /* ── GRID 2 COL ───────────────────────────────── */
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; flex-shrink: 0; }

  /* ── CARD ────────────────────────────────────── */
  .card {
    background: #fff; border: 1px solid #e4e7f0;
    border-radius: 10px; padding: 14px 16px;
  }
  .ctitle {
    font-size: 9.5px; text-transform: uppercase; letter-spacing: .65px;
    font-weight: 700; color: #9099b0; margin-bottom: 12px;
    display: flex; align-items: center; gap: 6px;
  }
  .rd { width: 5px; height: 5px; border-radius: 50%; background: #E84318; flex-shrink: 0; }

  /* ── SCORE ────────────────────────────────────── */
  .score-wrap { display: flex; align-items: center; gap: 14px; }
  .score-ring {
    width: 60px; height: 60px; border-radius: 50%;
    background: linear-gradient(135deg,#E84318,#b82f0e);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    flex-shrink: 0; color: #fff;
  }
  .score-ring .n { font-size: 18px; font-weight: 800; line-height: 1; }
  .score-ring .d { font-size: 9px; opacity: .7; }
  .score-info h3 { font-size: 12.5px; font-weight: 700; color: #1a1f36; margin-bottom: 3px; }
  .score-info p  { font-size: 10.5px; color: #606880; line-height: 1.5; }

  /* ── PRESENCIA ───────────────────────────────── */
  .prow { display: flex; align-items: center; gap: 8px; padding: 5.5px 0; border-bottom: 1px solid #f0f2f8; }
  .prow:last-child { border-bottom: none; }
  .pn { font-size: 11.5px; font-weight: 500; color: #1a1f36; flex: 1; }
  .pd { font-size: 10px; color: #9099b0; flex: 1; text-align: right; }
  .badge { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 20px; font-size: 9.5px; font-weight: 600; flex-shrink: 0; }
  .ok   { background: #e6f7ee; color: #15803d; }
  .warn { background: #fef3c7; color: #b45309; }
  .no   { background: #fee2e2; color: #dc2626; }

  /* ── HALLAZGOS ───────────────────────────────── */
  .finding { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px solid #f0f2f8; }
  .finding:last-child { border-bottom: none; }
  .fnum {
    width: 18px; height: 18px; border-radius: 5px;
    background: #0b0f35; color: #fff;
    font-size: 9px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px;
  }
  .ftitle { font-size: 11.5px; font-weight: 700; color: #1a1f36; margin-bottom: 2px; }
  .fdesc  { font-size: 10.5px; color: #606880; line-height: 1.5; }
  .fimp   { font-size: 9px; font-weight: 700; color: #E84318; text-transform: uppercase; letter-spacing: .4px; margin-top: 3px; display: block; }

  /* ── PROPUESTA ───────────────────────────────── */
  .propuesta { background: #0b0f35; border-radius: 10px; padding: 16px 20px; flex-shrink: 0; }
  .propuesta h2 { color: #fff; font-size: 11.5px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 7px; }
  .prop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pi { background: rgba(255,255,255,.07); border-radius: 7px; padding: 10px 12px; display: flex; align-items: flex-start; gap: 9px; }
  .pico { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
  .ptitle { color: #fff; font-size: 11px; font-weight: 600; margin-bottom: 2px; }
  .pdesc  { color: rgba(255,255,255,.55); font-size: 9.5px; line-height: 1.45; }

  /* ── PITCH ───────────────────────────────────── */
  .pitch { background: #f8f9fc; border: 1px solid #e4e7f0; border-radius: 10px; padding: 14px 18px; flex-shrink: 0; }
  .pitch-lbl { font-size: 9.5px; text-transform: uppercase; letter-spacing: .65px; font-weight: 700; color: #9099b0; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
  .pitch-txt { font-size: 11px; color: #3a4460; line-height: 1.7; border-left: 3px solid #E84318; padding-left: 12px; font-style: italic; }

  /* ── MINI HEADER PÁG 2 ───────────────────────── */
  .mini-hero {
    background: #f4f5f9;
    padding: 10px 36px;
    display: flex; align-items: center; gap: 10px;
    border-bottom: 2px solid #e4e7f0;
    flex-shrink: 0;
  }
  .mini-hero .tag {
    background: #E84318; color: #fff;
    font-size: 9px; font-weight: 700;
    padding: 2px 8px; border-radius: 4px;
    text-transform: uppercase; letter-spacing: .5px;
  }
  .mini-hero .name { font-size: 12px; font-weight: 700; color: #1a1f36; }
  .mini-hero .sep { color: #c0c6d8; }
  .mini-hero .sub { font-size: 10.5px; color: #9099b0; }
  .mini-hero .pg { margin-left: auto; font-size: 9.5px; color: #9099b0; }

  /* ── FOOTER ──────────────────────────────────── */
  .ftr {
    background: #0b0f35;
    padding: 12px 36px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; margin-top: auto;
  }
  .ftr-l { color: rgba(255,255,255,.5); font-size: 9px; line-height: 1.6; }
  .ftr-l strong { color: rgba(255,255,255,.85); }
  .ftr-r { color: rgba(255,255,255,.45); font-size: 9px; text-align: right; }

  /* ── DIVIDER ─────────────────────────────────── */
  .divider { height: 1px; background: #e4e7f0; flex-shrink: 0; }
</style>
</head>
<body>

<!-- ═══════════════════════════ PÁGINA 1 ═══════════════════════════ -->
<div class="page">

  <!-- Header -->
  <div class="hdr">
    <img src="${logoSrc}" alt="LIBERA Studio" />
    <div class="hdr-meta">
      <strong>Diagnóstico Digital &mdash; Confidencial</strong><br>
      Preparado por LIBERA Studio &middot; liberastudio.tech &middot; 19 junio 2026
    </div>
  </div>

  <!-- Hero naranja -->
  <div class="hero">
    <div class="hero-icon">🏋️</div>
    <div>
      <h1>Nirupama Human Move</h1>
      <p>Programa de acondicionamiento f&iacute;sico &middot; Col. M&eacute;xico Norte, M&eacute;rida, Yucat&aacute;n</p>
    </div>
    <div class="hero-badge">
      <div class="num">&#11088; 4.6</div>
      <div class="lbl">65 rese&ntilde;as Google</div>
    </div>
  </div>

  <div class="pbody">

    <!-- Ficha -->
    <div class="ficha">
      <div class="fi"><label>Tel&eacute;fono / WhatsApp</label><span>+52 999 322 5932</span></div>
      <div class="fi"><label>Direcci&oacute;n</label><span>C. 13 #123 x 24 y 26, M&eacute;xico Norte</span></div>
      <div class="fi"><label>Horario operativo</label><span>Lun 6:30&ndash;17:00 &middot; Mar&ndash;Vie 6:30&ndash;21:00</span></div>
      <div class="fi"><label>Instagram</label><span>@nirupama_humanmove</span></div>
      <div class="fi"><label>Facebook</label><span>/Nirupama.HumanMove &middot; ~5,500 likes</span></div>
      <div class="fi"><label>Sitio Web Propio</label><span class="alert">&#10007; No tiene</span></div>
    </div>

    <!-- Score + Presencia -->
    <div class="g2">

      <div class="card">
        <div class="ctitle"><div class="rd"></div>CALIFICACI&Oacute;N DE OPORTUNIDAD</div>
        <div class="score-wrap">
          <div class="score-ring"><div class="n">8</div><div class="d">/10</div></div>
          <div class="score-info">
            <h3>Lead de Alta Prioridad</h3>
            <p>Reputaci&oacute;n s&oacute;lida, comunidad activa y presupuesto impl&iacute;cito. Solo les falta la capa digital que los haga encontrables en Google.</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="ctitle"><div class="rd"></div>PRESENCIA DIGITAL ACTUAL</div>
        <div class="prow"><div class="pn">Google Maps</div><div class="pd">4.6 &#11088; &middot; 65 rese&ntilde;as</div><span class="badge ok">&#10003; Activo</span></div>
        <div class="prow"><div class="pn">Facebook</div><div class="pd">~5,500 likes</div><span class="badge ok">&#10003; Activo</span></div>
        <div class="prow"><div class="pn">Instagram</div><div class="pd">@nirupama_humanmove</div><span class="badge ok">&#10003; Activo</span></div>
        <div class="prow"><div class="pn">YouTube</div><div class="pd">Canal activo</div><span class="badge ok">&#10003; Activo</span></div>
        <div class="prow"><div class="pn">CrossHero</div><div class="pd">App gesti&oacute;n de clases</div><span class="badge warn">&#9888; No es web</span></div>
        <div class="prow"><div class="pn">Fresha</div><div class="pd">Sin control del negocio</div><span class="badge warn">&#9888; Sin reclamar</span></div>
        <div class="prow"><div class="pn">Sitio Web Propio</div><div class="pd">&mdash;</div><span class="badge no">&#10007; No existe</span></div>
      </div>

    </div>

    <!-- Hallazgos (3 en pág 1) -->
    <div class="card" style="flex:1;overflow:hidden;">
      <div class="ctitle"><div class="rd"></div>HALLAZGOS CLAVE (1 / 2)</div>

      <div class="finding">
        <div class="fnum">1</div>
        <div>
          <div class="ftitle">Sin sitio web posicionable en Google</div>
          <div class="fdesc">Su "sitio web" es CrossHero, una app de gesti&oacute;n de clases para gyms. CrossHero no se indexa en Google. Si alguien busca "acondicionamiento f&iacute;sico M&eacute;rida" o "entrenamiento funcional M&eacute;xico Norte", Nirupama no aparece.</div>
          <span class="fimp">&#8593; Impacto alto &mdash; captaci&oacute;n org&aacute;nica</span>
        </div>
      </div>

      <div class="finding">
        <div class="fnum">2</div>
        <div>
          <div class="ftitle">65 rese&ntilde;as s&oacute;lidas, cero visibilidad en b&uacute;squeda</div>
          <div class="fdesc">Tienen reputaci&oacute;n construida pero invisible en Google Search. Esos clientes llegaron por recomendaci&oacute;n directa o redes &mdash; no por b&uacute;squeda org&aacute;nica. Sin sitio propio, Google no los posiciona.</div>
          <span class="fimp">&#8593; Impacto alto &mdash; SEO local</span>
        </div>
      </div>

      <div class="finding">
        <div class="fnum">3</div>
        <div>
          <div class="ftitle">Fresha sin reclamar &mdash; leads perdidos</div>
          <div class="fdesc">Est&aacute;n listados en Fresha (plataforma de reservas) sin afiliarse. Cualquier prospecto que llegue ah&iacute; no puede reservar y se pierde sin que el negocio lo sepa.</div>
          <span class="fimp">&#8593; Impacto medio &mdash; conversi&oacute;n</span>
        </div>
      </div>

    </div>

  </div>

  <!-- Footer pág 1 -->
  <div class="ftr">
    <div class="ftr-l"><strong>LIBERA Studio</strong> &middot; Agencia de presencia digital para negocios locales &middot; liberastudio.tech</div>
    <div class="ftr-r">P&aacute;gina 1 de 2</div>
  </div>

</div>


<!-- ═══════════════════════════ PÁGINA 2 ═══════════════════════════ -->
<div class="page">

  <!-- Header -->
  <div class="hdr">
    <img src="${logoSrc}" alt="LIBERA Studio" />
    <div class="hdr-meta">
      <strong>Diagnóstico Digital &mdash; Confidencial</strong><br>
      Preparado por LIBERA Studio &middot; liberastudio.tech &middot; 19 junio 2026
    </div>
  </div>

  <!-- Mini hero -->
  <div class="mini-hero">
    <span class="tag">Diagn&oacute;stico</span>
    <span class="name">Nirupama Human Move</span>
    <span class="sep">&middot;</span>
    <span class="sub">Programa de acondicionamiento f&iacute;sico &middot; M&eacute;rida, Yucat&aacute;n</span>
    <span class="pg">P&aacute;g. 2 de 2</span>
  </div>

  <div class="pbody">

    <!-- Hallazgos 4 y 5 -->
    <div class="card" style="flex-shrink:0;">
      <div class="ctitle"><div class="rd"></div>HALLAZGOS CLAVE (2 / 2)</div>

      <div class="finding">
        <div class="fnum">4</div>
        <div>
          <div class="ftitle">Instagram activo sin destino digital</div>
          <div class="fdesc">Tienen contenido y comunidad en Instagram, pero el link-in-bio no dirige a ning&uacute;n sitio propio posicionable. Todo el tr&aacute;fico generado desde redes se pierde o termina en CrossHero.</div>
          <span class="fimp">&#8593; Impacto medio &mdash; conversi&oacute;n desde redes sociales</span>
        </div>
      </div>

      <div class="finding">
        <div class="fnum">5</div>
        <div>
          <div class="ftitle">Sin Google Business optimizado</div>
          <div class="fdesc">No tienen ficha de Google Business con horarios de clases, categor&iacute;as de servicio correctas (acondicionamiento, funcional, HIIT) ni fotos organizadas. Solo un pin b&aacute;sico en Maps, que limita su visibilidad local.</div>
          <span class="fimp">&#8593; Impacto medio &mdash; b&uacute;squeda local</span>
        </div>
      </div>
    </div>

    <!-- Propuesta -->
    <div class="propuesta">
      <h2><div class="rd"></div>Lo que LIBERA Studio puede hacer por Nirupama Human Move</h2>
      <div class="prop-grid">
        <div class="pi">
          <div class="pico">🌐</div>
          <div>
            <div class="ptitle">Sitio web propio con SEO local</div>
            <div class="pdesc">Landing enfocada en "acondicionamiento f&iacute;sico M&eacute;rida" y servicios espec&iacute;ficos. Posicionable en Google desde el d&iacute;a 1.</div>
          </div>
        </div>
        <div class="pi">
          <div class="pico">📍</div>
          <div>
            <div class="ptitle">Google Business optimizado</div>
            <div class="pdesc">Horarios, categor&iacute;as, fotos y descripci&oacute;n con keywords. Aparici&oacute;n en el mapa local con informaci&oacute;n completa y atractiva.</div>
          </div>
        </div>
        <div class="pi">
          <div class="pico">🔗</div>
          <div>
            <div class="ptitle">Link-in-bio funcional</div>
            <div class="pdesc">P&aacute;gina de aterrizaje desde Instagram con clases, horarios y bot&oacute;n de WhatsApp directo. Tráfico de redes convertido en contactos reales.</div>
          </div>
        </div>
        <div class="pi">
          <div class="pico">📊</div>
          <div>
            <div class="ptitle">Estrategia de rese&ntilde;as</div>
            <div class="pdesc">Sistema para pedir rese&ntilde;as a clientes actuales. De 65 a 150+ rese&ntilde;as mejora significativamente el ranking local en Google Maps.</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pitch -->
    <div class="pitch">
      <div class="pitch-lbl"><div class="rd"></div>MENSAJE SUGERIDO PARA ALMA</div>
      <div class="pitch-txt">
        "Hola, vi que Nirupama Human Move tiene muy buena reputaci&oacute;n en Google Maps (4.6 con 65 rese&ntilde;as) y una comunidad activa en Facebook e Instagram. Lo que not&eacute; es que no aparecen en b&uacute;squedas de Google cuando alguien busca entrenamiento o acondicionamiento en M&eacute;rida &mdash; porque CrossHero no funciona como sitio web propio para posicionarse. Eso significa que solo los encuentran quienes ya los conocen. &iquest;Les comparto c&oacute;mo resolverlo?"
      </div>
    </div>

    <!-- Resumen visual -->
    <div style="display:flex;gap:10px;flex-shrink:0;">
      <div style="flex:1;background:#f8f9fc;border:1px solid #e4e7f0;border-radius:10px;padding:12px 16px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#E84318;">5</div>
        <div style="font-size:9.5px;color:#9099b0;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Hallazgos detectados</div>
      </div>
      <div style="flex:1;background:#f8f9fc;border:1px solid #e4e7f0;border-radius:10px;padding:12px 16px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#E84318;">4</div>
        <div style="font-size:9.5px;color:#9099b0;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Soluciones propuestas</div>
      </div>
      <div style="flex:1;background:#0b0f35;border-radius:10px;padding:12px 16px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#E84318;">8/10</div>
        <div style="font-size:9.5px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Prioridad del lead</div>
      </div>
      <div style="flex:1;background:#f8f9fc;border:1px solid #e4e7f0;border-radius:10px;padding:12px 16px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#1a9e52;">&#11088; 4.6</div>
        <div style="font-size:9.5px;color:#9099b0;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Rating Google Maps</div>
      </div>
    </div>

  </div>

  <!-- Footer pág 2 -->
  <div class="ftr">
    <div class="ftr-l">
      <strong>LIBERA Studio</strong> &middot; liberastudio.tech &middot; hola@liberastudio.tech<br>
      Diagn&oacute;stico preparado el 19 de junio 2026 &middot; Uso interno &mdash; no distribuir sin autorizaci&oacute;n
    </div>
    <div class="ftr-r">P&aacute;gina 2 de 2</div>
  </div>

</div>

</body>
</html>`;

fs.writeFileSync('C:/Users/hskin/Desktop/diagnostico-nirupama.html', html, 'utf8');
console.log('HTML generado OK');
