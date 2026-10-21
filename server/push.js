'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const webpush = require('web-push');
const config = require('./config');
const { getDb } = require('./state');

let enabled = false;
let publicKey = '';
let privateKey = '';

function persistGeneratedKeys(keys) {
  fs.mkdirSync(path.dirname(config.push.keyFile), { recursive: true });
  fs.writeFileSync(config.push.keyFile, JSON.stringify({ ...keys, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  try { fs.chmodSync(config.push.keyFile, 0o600); } catch (_) {}
}

function init() {
  try {
    if (config.push.publicKey && config.push.privateKey) {
      publicKey = config.push.publicKey;
      privateKey = config.push.privateKey;
    } else if (fs.existsSync(config.push.keyFile)) {
      const saved = JSON.parse(fs.readFileSync(config.push.keyFile, 'utf8'));
      publicKey = saved.publicKey || '';
      privateKey = saved.privateKey || '';
    } else {
      const keys = webpush.generateVAPIDKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
      persistGeneratedKeys(keys);
      console.log(`Push: claves VAPID generadas en ${config.push.keyFile}`);
    }
    if (!publicKey || !privateKey) throw new Error('Faltan las claves VAPID.');
    webpush.setVapidDetails(config.push.subject, publicKey, privateKey);
    enabled = true;
    return { enabled, publicKey };
  } catch (error) {
    enabled = false;
    console.error('Push deshabilitado:', error.message);
    return { enabled, publicKey: '' };
  }
}

function status() {
  return { enabled, publicKey };
}

function validateSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') return 'Suscripción inválida.';
  const endpoint = String(subscription.endpoint || '');
  if (!/^https:\/\//i.test(endpoint) || endpoint.length > 1200) return 'El endpoint de notificaciones no es válido.';
  const keys = subscription.keys || {};
  const p256dh = String(keys.p256dh || '');
  const auth = String(keys.auth || '');
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,100}$/.test(auth)) {
    return 'Las claves de la suscripción no son válidas.';
  }
  return null;
}

function subscribe(userId, subscription, userAgent = '') {
  const error = validateSubscription(subscription);
  if (error) return { error };
  const db = getDb();
  const endpoint = String(subscription.endpoint);
  const p256dh = String(subscription.keys.p256dh);
  const auth = String(subscription.keys.auth);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh,
      auth = excluded.auth, user_agent = excluded.user_agent, last_seen_at = excluded.last_seen_at
  `).run('ps-' + crypto.randomUUID(), userId, endpoint, p256dh, auth, String(userAgent).slice(0, 300), now, now);
  return { ok: true, subscribed: true };
}

function unsubscribe(userId, endpoint) {
  if (!endpoint) return { ok: false };
  const result = getDb().prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
    .run(userId, String(endpoint));
  return { ok: true, removed: result.changes > 0 };
}

function isSubscribed(userId) {
  return Boolean(getDb().prepare('SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1').get(userId));
}

function subscriptionsFor(userId) {
  return getDb().prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
}

function allSubscriptions() {
  return getDb().prepare('SELECT * FROM push_subscriptions').all();
}

function notificationPayload(input = {}) {
  let url = String(input.url || '/#/home').trim().slice(0, 500);
  if (!url.startsWith('/') || url.startsWith('//')) url = '/#/home';
  return {
    title: String(input.title || 'InnovaAgro-App').slice(0, 120),
    body: String(input.body || '').slice(0, 280),
    url,
    tag: String(input.tag || 'innovaagro').slice(0, 80),
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-64.png',
    timestamp: Date.now()
  };
}

async function sendToSubscription(row, payload) {
  if (!enabled) return { sent: false, disabled: true };
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify(notificationPayload(payload)),
      { TTL: 60 * 60 * 24, urgency: 'normal' }
    );
    getDb().prepare('UPDATE push_subscriptions SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
    return { sent: true };
  } catch (error) {
    const statusCode = Number(error && error.statusCode);
    if (statusCode === 404 || statusCode === 410) {
      getDb().prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id);
    } else {
      console.error('No se pudo enviar una notificación push:', error && error.message);
    }
    return { sent: false, statusCode };
  }
}

async function sendToUser(userId, payload) {
  const rows = subscriptionsFor(userId);
  let sent = 0;
  for (const row of rows) {
    const result = await sendToSubscription(row, payload);
    if (result.sent) sent += 1;
  }
  return { sent, total: rows.length };
}

async function broadcast(payload) {
  const rows = allSubscriptions();
  let sent = 0;
  for (const row of rows) {
    const result = await sendToSubscription(row, payload);
    if (result.sent) sent += 1;
  }
  return { sent, total: rows.length };
}

module.exports = {
  init,
  status,
  subscribe,
  unsubscribe,
  isSubscribed,
  sendToUser,
  broadcast,
  notificationPayload
};
