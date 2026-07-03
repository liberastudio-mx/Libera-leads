require('dotenv').config();
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const localDb   = require('./db');
const IMAP_HOST = process.env.IMAP_HOST || 'imap.hostinger.com';
const IMAP_USER = process.env.SMTP_USER;
const IMAP_PASS = process.env.SMTP_PASS;

// Palabras clave para clasificar emails entrantes
const BOUNCE_SUBJECTS = ['delivery', 'undeliverable', 'mail delivery', 'returned mail', 'failure notice', 'undelivered'];
const BOUNCE_FROM     = ['mailer-daemon', 'postmaster', 'mail delivery subsystem'];
const OOO_SUBJECTS    = ['out of office', 'fuera de oficina', 'ausente', 'vacaciones', 'autom', 'auto-reply', 'autorespuesta'];

// Regex para extraer email del cuerpo del NDR
const BOUNCE_EMAIL_RE = /[<(]([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})[>)]/g;

function classifyEmail(from, subject) {
  const f = (from || '').toLowerCase();
  const s = (subject || '').toLowerCase();
  if (BOUNCE_FROM.some(k => f.includes(k)) || BOUNCE_SUBJECTS.some(k => s.includes(k))) return 'bounce';
  if (OOO_SUBJECTS.some(k => s.includes(k))) return 'ooo';
  return 'reply';
}

function extractBouncedEmails(text, html) {
  const content = `${text || ''} ${html || ''}`;
  const emails = new Set();
  let m;
  while ((m = BOUNCE_EMAIL_RE.exec(content)) !== null) {
    const e = m[1].toLowerCase();
    if (!e.includes('liberastudio') && !e.includes('mailer-daemon') && !e.includes('postmaster')) {
      emails.add(e);
    }
  }
  return [...emails];
}

function findAirtableRecord(email) {
  const results = localDb.searchLeads(email, { limit: 1 });
  return results.find(r => r.email?.toLowerCase() === email.toLowerCase()) || null;
}

function updateEstado(recordId, estado) {
  localDb.updateEstado(recordId, estado, new Date().toISOString());
}

async function processInbox() {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });

  await client.connect();

  const stats = { bounces: 0, replies: 0, ooo: 0, skipped: 0 };

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Solo emails no leídos
      const messages = await client.search({ seen: false });
      if (messages.length === 0) {
        console.log('  Sin emails nuevos.');
        return stats;
      }

      console.log(`  ${messages.length} email(s) sin leer\n`);

      for await (const msg of client.fetch(messages, { source: true, envelope: true })) {
        const parsed = await simpleParser(msg.source);
        const from    = parsed.from?.text || '';
        const subject = parsed.subject || '';
        const type    = classifyEmail(from, subject);

        if (type === 'bounce') {
          const bouncedEmails = extractBouncedEmails(parsed.text, parsed.textAsHtml);
          if (bouncedEmails.length === 0) {
            console.log(`  ⚠ Bounce sin email extraíble: "${subject}"`);
            stats.skipped++;
            continue;
          }

          for (const email of bouncedEmails) {
            const record = findAirtableRecord(email);
            if (record) {
              updateEstado(record.id, 'Rebote');
              console.log(`  ↩ Rebote → ${record.fields.Name} <${email}>`);
              stats.bounces++;
            } else {
              console.log(`  ↩ Rebote (no en Airtable): ${email}`);
              stats.skipped++;
            }
          }
        } else if (type === 'ooo') {
          console.log(`  💤 OOO ignorado: ${from}`);
          stats.ooo++;
        } else {
          // Respuesta real — marcar como Respondió
          const replyTo = parsed.replyTo?.value?.[0]?.address || parsed.from?.value?.[0]?.address || '';
          if (replyTo) {
            const record = findAirtableRecord(replyTo);
            if (record && record.fields.estado !== 'Respondió') {
              updateEstado(record.id, 'Respondió');
              console.log(`  ✉ Respondió → ${record.fields.Name} <${replyTo}>`);
            } else {
              console.log(`  ✉ Respuesta (no en Airtable o ya marcado): ${replyTo}`);
            }
          }
          stats.replies++;
        }

        // Marcar como leído
        await client.messageFlagsAdd(msg.seq, ['\\Seen']);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return stats;
}

module.exports = { processInbox };

if (require.main === module) {
  (async () => {
    console.log('── Procesando inbox ──\n');
    const stats = await processInbox();
    console.log(`\nResumen: ${stats.bounces} rebotes, ${stats.replies} respuestas, ${stats.ooo} OOO, ${stats.skipped} sin clasificar`);
  })();
}
