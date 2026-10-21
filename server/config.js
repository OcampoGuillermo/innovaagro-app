'use strict';

const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');

function envBool(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|si|sí)$/i.test(String(value));
}

const store = {
  name: process.env.STORE_NAME || 'InnovaAgro-App',
  legalName: process.env.STORE_LEGAL_NAME || 'InnovaAgro-App',
  taxId: process.env.STORE_TAX_ID || '',
  address: process.env.STORE_ADDRESS || 'Formosa, Argentina',
  email: process.env.STORE_EMAIL || 'hola@innovaagro.app',
  phone: process.env.STORE_PHONE || '',
  invoicePrefix: process.env.INVOICE_PREFIX || 'IA'
};

const mail = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: envBool('SMTP_SECURE', Number(process.env.SMTP_PORT) === 465),
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.MAIL_FROM || `${store.name} <no-reply@innovaagro.app>`,
  replyTo: process.env.MAIL_REPLY_TO || store.email,
  outbox: path.join(DATA_DIR, 'mail-outbox.jsonl'),
  publicUrl: PUBLIC_URL
};

const payments = {
  provider: 'mercadopago',
  accessToken: process.env.MP_ACCESS_TOKEN || '',
  webhookSecret: process.env.MP_WEBHOOK_SECRET || '',
  publicUrl: PUBLIC_URL,
  sandbox: envBool('MP_SANDBOX', false)
};

const push = {
  subject: process.env.VAPID_SUBJECT || `mailto:${store.email}`,
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
  keyFile: path.join(DATA_DIR, 'vapid.json')
};

const invoices = {
  fiscal: false,
  note: 'Comprobante interno de venta. No válido como factura fiscal.'
};

function paymentsEnabled() {
  return Boolean(
    payments.accessToken &&
    payments.webhookSecret &&
    /^https:\/\//i.test(payments.publicUrl)
  );
}

module.exports = {
  ROOT,
  DATA_DIR,
  PORT,
  PUBLIC_URL,
  ENV: process.env.NODE_ENV || 'development',
  store,
  mail,
  payments,
  push,
  invoices,
  paymentsEnabled,
  envBool
};
