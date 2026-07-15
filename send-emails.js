require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const TOKEN    = process.env.AIRTABLE_TOKEN;
const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Emails per batch
const BATCH_SIZE = 10;
// 30s between individual sends
const DELAY_MS = 30_000;
// 3 min pause between batches
const BATCH_PAUSE_MS = 3 * 60_000;
// Hostinger allows max 100 emails/day
const MAX_PER_RUN = 100;

// Mapa categoria Airtable → template de email
const EMAIL_MAP = {
  salud:          ['psicólogo', 'psicologia', 'dentista', 'dental', 'odontol', 'médico', 'medico', 'doctor', 'clínica', 'clinica', 'consultorio', 'nutricion', 'nutrición', 'fisioterapia', 'fisioterapeuta', 'psiquiatra', 'pediatra', 'ginecólogo', 'ginecologo', 'dermatólogo', 'dermatologo', 'oftalmólogo', 'oftalmologo', 'ortodon', 'quiropráct', 'quiropractic', 'veterinario', 'veterinaria'],
  fitness:        ['gym', 'gimnasio', 'yoga', 'pilates', 'crossfit', 'zumba', 'danza', 'baile', 'coach', 'entrenador', 'fitness'],
  educacion:      ['academia', 'escuela', 'idiomas', 'música', 'musica', 'tutor', 'guardería', 'guarderia', 'kinder', 'jardín', 'jardin'],
  estetica:       ['salón', 'salon', 'belleza', 'barbería', 'barberia', 'spa', 'masaje', 'estética', 'estetica'],
  profesionales:  ['abogado', 'abogada', 'contador', 'contadora', 'arquitecto', 'arquitecta', 'diseñador', 'fotografo', 'fotógrafo'],
  gastronomia:    ['restaurante', 'café', 'cafetería', 'cafeteria', 'catering', 'repostería', 'reposteria', 'cocina'],
};

function getEmailTemplate(categoria) {
  if (!categoria) return 'salud';
  const cat = categoria.toLowerCase();
  for (const [template, keywords] of Object.entries(EMAIL_MAP)) {
    if (keywords.some(k => cat.includes(k))) return template;
  }
  return 'salud'; // fallback
}

const templateCache = {};
function loadTemplate(name) {
  if (!templateCache[name]) {
    const filePath = path.join(__dirname, 'emails', `${name}.html`);
    if (fs.existsSync(filePath)) {
      templateCache[name] = fs.readFileSync(filePath, 'utf8');
    } else {
      console.warn(`  ⚠ Template ${name}.html no encontrado, usando salud.html`);
      templateCache[name] = fs.readFileSync(path.join(__dirname, 'emails', 'salud.html'), 'utf8');
    }
  }
  return templateCache[name];
}

const localDb = require('./db');

function getLeads() {
  // Devuelve leads sin contactar con email, en formato compatible con el resto del script
  return localDb.getLeads({ estado: 'Sin contactar' })
    .filter(r => r.email)
    .map(r => ({
      id:     r.id,
      fields: {
        Name:          r.nombre,
        email:         r.email,
        Contactado:    r.estado,
        categoria:     r.categoria,
        Email_Subject: r.email_subject,
        Email_Body:    r.email_body,
      },
    }));
}

function updateEstado(recordId, estado) {
  localDb.updateEstado(recordId, estado, new Date().toISOString());
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  // Validate config
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('Error: Faltan SMTP_HOST, SMTP_USER o SMTP_PASS en el .env');
    process.exit(1);
  }

  // Templates se cargan por categoría bajo demanda

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.verify();
  console.log('✓ Conexión SMTP OK\n');

  const allLeads = getLeads();
  const leads = allLeads.filter(r => r.fields.email).slice(0, MAX_PER_RUN);
  console.log(`Leads con email: ${leads.length} (límite ${MAX_PER_RUN}/día) — lotes de ${BATCH_SIZE} con 3 min de pausa\n`);

  if (leads.length === 0) {
    console.log('No hay leads con email y estado "Sin contactar".');
    return;
  }

  let sent = 0;
  let failed = 0;
  let batchNum = 0;

  for (let i = 0; i < leads.length; i++) {
    // Pausa entre lotes (no antes del primero)
    if (i > 0 && i % BATCH_SIZE === 0) {
      console.log(`\n── Lote ${batchNum} completo. Pausa de 3 min ──\n`);
      await sleep(BATCH_PAUSE_MS);
    }
    if (i % BATCH_SIZE === 0) {
      batchNum++;
      const end = Math.min(i + BATCH_SIZE, leads.length);
      console.log(`Lote ${batchNum} — enviando ${i + 1} a ${end}:`);
    }

    const record = leads[i];
    const nombre        = record.fields.Name || 'Estimado/a';
    const email         = record.fields.email;
    const categoria     = record.fields.categoria || '';
    const emailSubject  = record.fields.Email_Subject;
    const emailBody     = record.fields.Email_Body;

    // Usa el borrador personalizado si existe; si no, cae al template HTML por categoría.
    let subject, html, text, templateName;
    if (emailSubject && emailBody) {
      subject      = emailSubject;
      text         = emailBody;
      html         = `<p>${emailBody.replace(/\n/g, '<br>')}</p>`;
      templateName = 'email-en-frio';
    } else {
      templateName = getEmailTemplate(categoria);
      subject      = '50% durante julio, aprovecha!';
      html         = loadTemplate(templateName).replace(/\{\{Nombre\}\}/g, nombre);
      text         = `Hola, ${nombre}.\n\nEl 97% de sus pacientes busca su consultorio en internet antes de llamar. ¿Qué encuentran cuando lo buscan?\n\nEn LIBERA Studio construimos la presencia digital que su consultorio merece: sitio web que convierte, Google Business optimizado, WhatsApp automatizado y 1 mes de soporte.\n\nPromo de lanzamiento: 50% de descuento. Válido para los primeros 10 consultorios antes del 31 de julio de 2026.\n\nPrimera sesión de diagnóstico gratis:\nhttps://wa.me/524152197945?text=Hola%2C%20me%20interesa%20la%20promo%20de%20julio%20de%20LIBERA%20Studio\n\n—\nLIBERA Studio · Mérida, Yucatán\nhola@liberastudio.tech · liberastudio.tech`;
    }

    try {
      await transporter.sendMail({
        from: `LIBERA Studio <${SMTP_USER}>`,
        to: email,
        subject,
        html,
        text,
        headers: {
          'List-Unsubscribe': '<https://liberastudio.tech/eliminar-datos.html>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      updateEstado(record.id, 'Contactado por Email');
      console.log(`  ✓ [${templateName}] "${subject.slice(0, 40)}" → ${nombre} <${email}>`);
      sent++;
    } catch (err) {
      console.error(`  ✗ Error enviando a ${email}: ${err.message}`);
      failed++;
    }

    if (i < leads.length - 1 && (i + 1) % BATCH_SIZE !== 0) {
      console.log(`  ⏱ 30s...`);
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nResumen: ${sent} enviados, ${failed} fallidos`);
})();
