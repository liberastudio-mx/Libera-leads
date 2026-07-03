require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const template = process.argv[2] || 'fitness';
const to = process.argv[3] || 'mindovera@gmail.com';

(async () => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.verify();
  console.log('✓ SMTP OK');

  const html = fs.readFileSync(path.join(__dirname, 'emails', `${template}.html`), 'utf8')
    .replace(/\{\{Nombre\}\}/g, 'TEST');

  await transporter.sendMail({
    from: `LIBERA Studio <${process.env.SMTP_USER}>`,
    to,
    subject: `[TEST] ${template} — LIBERA Studio`,
    html,
  });

  console.log(`✓ Email "${template}" enviado a ${to}`);
})();
