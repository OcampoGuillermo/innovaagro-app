'use strict';

const { getDb } = require('./state');

function audit(req, action, entity = '', entityId = '', detail = null) {
  try {
    const user = req && req.user;
    getDb().prepare(`
      INSERT INTO audit_log (user_id, action, entity, entity_id, detail, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      user ? user.id : null,
      String(action).slice(0, 80),
      String(entity).slice(0, 60),
      String(entityId || '').slice(0, 120),
      detail == null ? null : JSON.stringify(detail).slice(0, 4000),
      String((req && (req.ip || req.socket && req.socket.remoteAddress)) || '').slice(0, 80),
      new Date().toISOString()
    );
  } catch (error) {
    console.error('No se pudo registrar la auditoría:', error.message);
  }
}

function recentAudit(limit = 30) {
  return getDb().prepare(`
    SELECT a.*, u.email, u.name FROM audit_log a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT ?
  `).all(Math.min(200, Math.max(1, Number(limit) || 30))).map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    detail: row.detail,
    ip: row.ip,
    createdAt: row.created_at,
    userName: row.name || '',
    userEmail: row.email || ''
  }));
}

module.exports = { audit, recentAudit };
