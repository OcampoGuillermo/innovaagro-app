'use strict';

const crypto = require('node:crypto');
const { getDb } = require('./state');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function createToken(userId, kind, ttlMs = 24 * 60 * 60 * 1000) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + ttlMs);
  db.prepare('DELETE FROM email_tokens WHERE user_id = ? AND kind = ? AND used_at IS NULL').run(userId, kind);
  db.prepare('INSERT INTO email_tokens (token_hash, user_id, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(hashToken(token), userId, kind, now.toISOString(), expires.toISOString());
  return { token, expires };
}

function consumeToken(token, kind) {
  const db = getDb();
  if (!token || String(token).length > 200) return null;
  const row = db.prepare(`
    SELECT * FROM email_tokens
    WHERE token_hash = ? AND kind = ? AND used_at IS NULL
  `).get(hashToken(token), kind);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM email_tokens WHERE token_hash = ?').run(row.token_hash);
    return null;
  }
  const usedAt = new Date().toISOString();
  const result = db.prepare('UPDATE email_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL')
    .run(usedAt, row.token_hash);
  if (!result.changes) return null;
  return row;
}

function invalidateTokens(userId, kind) {
  getDb().prepare('DELETE FROM email_tokens WHERE user_id = ? AND kind = ?')
    .run(userId, kind);
}

function cleanupExpiredTokens() {
  const result = getDb().prepare('DELETE FROM email_tokens WHERE expires_at < ?').run(new Date().toISOString());
  return result.changes || 0;
}

module.exports = { createToken, consumeToken, invalidateTokens, cleanupExpiredTokens };
