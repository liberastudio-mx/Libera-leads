/**
 * regenerate-mensajes.js
 * Regenera mensaje_borrador (WhatsApp) y email_subject/email_body para todos los
 * leads ya guardados en el CRM, usando la plantilla actual de mensajes.js.
 * Útil después de cambiar el copy de contacto para que los leads viejos no se
 * queden con el mensaje anterior.
 *
 * Uso: node regenerate-mensajes.js
 */

const db = require('./db');
const { generarMensaje, generarEmailEnFrio } = require('./mensajes');

function run() {
  const leads = db.getLeads({});
  const conn  = db.getDb();
  const stmt  = conn.prepare(`
    UPDATE leads SET mensaje_borrador = ?, email_subject = ?, email_body = ? WHERE id = ?
  `);

  const update = conn.transaction((rows) => {
    let n = 0;
    for (const lead of rows) {
      const mensaje = generarMensaje(lead, lead.ciudad || 'su ciudad');
      const email   = generarEmailEnFrio(lead);
      stmt.run(mensaje, email.subject, email.body, lead.id);
      n++;
    }
    return n;
  });

  const total = update(leads);
  console.log(`✓ ${total} leads actualizados con el nuevo mensaje.`);
}

run();
