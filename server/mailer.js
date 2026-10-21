'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');
const config = require('./config');

let transporter = null;
if (config.mail.host) {
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    pool: true,
    maxConnections: 3,
    connectionTimeout: 15000
  });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function layout({ title, intro, body, action, actionUrl, footnote }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f5f4ea;color:#182521;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f4ea;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fbfaf4;border:1px solid #d8d7cc;border-radius:14px;overflow:hidden">
        <tr><td style="background:#132c2a;padding:22px 28px;color:#fbfaf4">
          <div style="font-size:20px;font-weight:700;letter-spacing:-.02em">InnovaAgro<span style="color:#f1b84b">-App</span></div>
          <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#c9d6ca;margin-top:5px">Tecnología &amp; Naturaleza · Formosa</div>
        </td></tr>
        <tr><td style="padding:30px 28px">
          <h1 style="font-size:24px;line-height:1.15;margin:0 0 12px;color:#182521">${escapeHtml(title)}</h1>
          <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#50635a">${escapeHtml(intro)}</p>
          ${body}
          ${action && actionUrl ? `<p style="margin:26px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#132c2a;color:#fbfaf4;text-decoration:none;font-weight:700;font-size:14px;padding:13px 20px;border-radius:9px">${escapeHtml(action)}</a></p>
          <p style="font-size:12px;line-height:1.5;color:#75877d;margin:0 0 8px">Si el botón no abre, copiá este enlace en el navegador:</p>
          <p style="font-size:12px;line-height:1.5;color:#50635a;word-break:break-all;margin:0 0 22px">${escapeHtml(actionUrl)}</p>` : ''}
          <div style="border-top:1px solid #d8d7cc;padding-top:16px;font-size:12px;line-height:1.6;color:#75877d">${footnote || 'Si no solicitaste este mensaje, podés ignorarlo.'}</div>
        </td></tr>
        <tr><td style="background:#f5f4ea;padding:14px 28px;font-size:11px;line-height:1.5;color:#75877d">
          ${escapeHtml(config.store.name)} · ${escapeHtml(config.store.address)} · ${escapeHtml(config.store.email)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendMail({ to, subject, text, html, kind = 'transactional' }) {
  const message = {
    from: config.mail.from,
    replyTo: config.mail.replyTo,
    to,
    subject,
    text,
    html
  };
  if (transporter) {
    const info = await transporter.sendMail(message);
    return { delivered: true, id: info.messageId, mode: 'smtp' };
  }
  const id = crypto.randomUUID();
  const entry = {
    id,
    kind,
    createdAt: new Date().toISOString(),
    to,
    subject,
    text,
    html
  };
  fs.mkdirSync(path.dirname(config.mail.outbox), { recursive: true });
  fs.appendFileSync(config.mail.outbox, JSON.stringify(entry) + '\n', 'utf8');
  console.log(`[mail:desarrollo] ${subject} → ${to} · guardado en ${config.mail.outbox}`);
  return { delivered: false, id, mode: 'outbox' };
}

function verificationEmail(user, token) {
  const url = `${config.mail.publicUrl}/#/verify/${encodeURIComponent(token)}`;
  const html = layout({
    title: 'Verificá tu correo',
    intro: `Hola ${user.name || ''}. Tu cuenta de InnovaAgro-App está casi lista. Confirmá que este correo es tuyo para poder comprar u operar en el marketplace.`,
    body: '<p style="font-size:14px;line-height:1.6;color:#50635a;margin:0">El enlace vence en 24 horas y se puede usar una sola vez.</p>',
    action: 'Verificar mi correo',
    actionUrl: url,
    footnote: 'Si no creaste esta cuenta, ignorá el mensaje. No se activará nada sin tu confirmación.'
  });
  const text = `Hola ${user.name || ''}:\n\nVerificá tu correo de InnovaAgro-App desde este enlace (vence en 24 horas):\n${url}\n\nSi no creaste la cuenta, ignorá este mensaje.`;
  return sendMail({ to: user.email, subject: 'Verificá tu correo · InnovaAgro-App', text, html, kind: 'verify' });
}

function resetEmail(user, token) {
  const url = `${config.mail.publicUrl}/#/reset/${encodeURIComponent(token)}`;
  const html = layout({
    title: 'Restablecer contraseña',
    intro: `Hola ${user.name || ''}. Recibimos una solicitud para cambiar la contraseña de tu cuenta.`,
    body: '<p style="font-size:14px;line-height:1.6;color:#50635a;margin:0">El enlace vence en 30 minutos y se puede usar una sola vez. Después de cambiar la contraseña, se cerrarán las demás sesiones.</p>',
    action: 'Elegir una contraseña nueva',
    actionUrl: url,
    footnote: 'Si no pediste el cambio, ignorá el mensaje. Tu contraseña actual sigue siendo válida.'
  });
  const text = `Hola ${user.name || ''}:\n\nPara restablecer tu contraseña de InnovaAgro-App, abrí este enlace (vence en 30 minutos):\n${url}\n\nSi no pediste el cambio, ignorá este mensaje.`;
  return sendMail({ to: user.email, subject: 'Restablecer contraseña · InnovaAgro-App', text, html, kind: 'reset' });
}

module.exports = {
  sendMail,
  sendVerificationEmail: verificationEmail,
  sendPasswordResetEmail: resetEmail,
  usingSmtp: Boolean(transporter)
};
