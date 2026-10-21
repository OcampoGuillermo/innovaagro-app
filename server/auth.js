'use strict';

const crypto = require('node:crypto');
const { getDb } = require('./state');

const COOKIE = 'ia_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const key = part.slice(0, i).trim();
    if (!key) return;
    try { out[key] = decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { out[key] = part.slice(i + 1).trim(); }
  });
  return out;
}

function secureCookie() {
  return process.env.COOKIE_SECURE === 'true';
}

function createSession(userId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + MAX_AGE_SECONDS * 1000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(tokenHash(token), userId, now.toISOString(), expires.toISOString());
  return { token, expires };
}

function setSessionCookie(res, session) {
  const parts = [
    `${COOKIE}=${session.token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_SECONDS}`
  ];
  if (secureCookie()) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secureCookie()) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    city: user.city,
    address: user.address,
    role: user.role,
    producerId: user.producer_id || null,
    createdAt: user.created_at
  };
}

function currentUser(req, res) {
  if (req.user !== undefined) return req.user;
  const db = getDb();
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) { req.user = null; return null; }
  const row = db.prepare(`
    SELECT u.*, s.expires_at FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(tokenHash(token));
  if (!row) { req.user = null; return null; }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
    clearSessionCookie(res);
    req.user = null;
    return null;
  }
  req.user = row;
  return row;
}

function requireUser(req, res, next) {
  const user = currentUser(req, res);
  if (!user) return res.status(401).json({ error: 'Necesitás iniciar sesión.' });
  return next();
}

function requireProducer(req, res, next) {
  const user = currentUser(req, res);
  if (!user) return res.status(401).json({ error: 'Necesitás iniciar sesión.' });
  if (user.role !== 'producer' || !user.producer_id) {
    return res.status(403).json({ error: 'Esta acción requiere una cuenta de productor.' });
  }
  return next();
}

function destroySession(req, res) {
  const db = getDb();
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
  clearSessionCookie(res);
}

module.exports = {
  createSession, setSessionCookie, clearSessionCookie, currentUser,
  requireUser, requireProducer, destroySession, publicUser, parseCookies
};
