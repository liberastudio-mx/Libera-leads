/**
 * LIBERA Leads — Generadores de mensaje (WhatsApp) y email en frío.
 * Compartido entre scraper.js (leads nuevos) y regenerate-mensajes.js (leads existentes).
 */

function tieneWeb(r) {
  return !!(r.sitio_web && !r.sitio_web.includes('facebook.com') && !r.sitio_web.includes('instagram.com'));
}

function tieneRedes(r) {
  return !!(r.sitio_web && (r.sitio_web.includes('facebook.com') || r.sitio_web.includes('instagram.com')));
}

// ── Generador de mensaje WhatsApp ─────────────────────────────────────────────

function generarMensaje(r, ciudad = 'su ciudad') {
  const nombre   = r.nombre || 'su negocio';
  const web      = tieneWeb(r);
  const redes    = tieneRedes(r);
  const resenas  = parseInt(r.resenas) || 0;
  const calif    = parseFloat(r.calificacion) || 0;

  if (!web && redes) {
    return `Hola, buenos días.

Soy Alma, de LIBERA Studio. Vi su perfil de ${nombre} en Google Maps y noté que tienen muy buenas reseñas.

También vi que no aparece una página web propia vinculada al negocio, y eso puede limitar la confianza y la información que encuentran nuevos clientes.

Ayudamos a negocios locales a mejorar su presencia digital con página web, Google Business y WhatsApp.

¿Les puedo compartir un diagnóstico rápido sin costo ni compromiso?

liberastudio.tech`;
  }

  // Construir observación natural (prosa, sin bullets)
  let obs = '';

  if (!web && resenas === 0) {
    obs = `No tienen página web propia y tampoco reseñas en Maps, así que Google los pone muy abajo cuando alguien busca en ${ciudad}.`;
  } else if (!web && resenas < 15) {
    obs = `No tienen página web propia y tienen pocas reseñas en Maps — con eso Google los muestra después de la competencia.`;
  } else if (!web) {
    obs = `No tienen página web propia. Sin eso, Google no sabe qué mostrar de ustedes y los pone después de negocios con sitio.`;
  } else if (resenas === 0) {
    obs = `No tienen reseñas en Google Maps. Eso hace que los clientes nuevos elijan primero a quien sí las tiene.`;
  } else if (resenas < 15) {
    obs = `Tienen ${resenas} reseña${resenas > 1 ? 's' : ''} en Google, que es poco para competir con otros en la zona. Google le da preferencia a quienes tienen más.`;
  } else if (calif > 0 && calif < 4.0) {
    obs = `Su calificación en Maps está en ${calif} estrellas. Hay formas de subirla sin pedir favores — y eso mueve posiciones.`;
  } else {
    obs = `Su sitio web no está configurado para búsquedas locales y su perfil de Maps no está completo, así que no aparecen entre los primeros resultados en ${ciudad}.`;
  }

  return `Hola, buenos días!

Mi nombre es Alma. Encontré su número en Google Maps y vi que ${nombre} tiene buenas reseñas.

${obs}

Soy de LIBERA Studio, ayudamos a negocios locales con eso: liberastudio.tech

¿Les comparto un diagnóstico rápido? Sin costo y sin compromiso.`;
}

// ── Generador de email en frío (formato skill email-en-frio) ──────────────────
// Trigger event derivado de los datos scrapeados: web, reseñas, calificación.

function generarEmailEnFrio(r) {
  const nombre  = r.nombre  || 'su negocio';
  const resenas = parseInt(r.resenas) || 0;
  const web     = tieneWeb(r);

  let subject, trigger;

  if (!web) {
    subject = `${nombre.split(' ')[0].toLowerCase()} no tiene sitio web`;
    trigger = `Busqué ${nombre} en Google Maps y vi que no tienen sitio web — solo el perfil de Maps.`;
  } else if (resenas > 0 && resenas < 15) {
    subject = `${resenas} reseñas y hay más`;
    trigger = `Vi que ${nombre} tiene ${resenas} reseñas en Google — hay algo puntual que puede cambiar eso esta semana.`;
  } else if (resenas === 0) {
    subject = `sin reseñas en google maps`;
    trigger = `Busqué ${nombre} en Google Maps y vi que aún no tienen reseñas registradas.`;
  } else {
    subject = `vi algo en su perfil de maps`;
    trigger = `Busqué ${r.categoria || 'negocios como el suyo'} en la zona y ${nombre} no aparece entre los primeros, aunque tienen buena calificación.`;
  }

  const linea2 = 'En LIBERA Studio ayudamos a negocios locales a aparecer primero cuando su cliente ideal los busca en Google.';
  const ask    = '¿Te late una llamada de 15 minutos esta semana?';

  return {
    subject,
    body: `${trigger}\n\n${linea2}\n\n${ask}\n\nAlma\nhola@liberastudio.tech`,
  };
}

module.exports = { generarMensaje, generarEmailEnFrio, tieneWeb, tieneRedes };
