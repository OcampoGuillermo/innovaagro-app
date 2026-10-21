'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./passwords');
const state = require('./state');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'innovaagro.db');

let db;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS producers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  place TEXT NOT NULL,
  zone TEXT NOT NULL,
  since INTEGER,
  hectares REAL,
  initials TEXT,
  accent TEXT NOT NULL DEFAULT '#9b6239',
  verified INTEGER NOT NULL DEFAULT 0,
  practices TEXT NOT NULL DEFAULT '[]',
  story TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT 'hero',
  gallery TEXT NOT NULL DEFAULT '[]',
  whatsapp TEXT NOT NULL DEFAULT '',
  alias TEXT NOT NULL DEFAULT '',
  pickup TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Productor',
  active INTEGER NOT NULL DEFAULT 1,
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Formosa Capital',
  address TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('buyer', 'producer')),
  producer_id TEXT REFERENCES producers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  producer_id TEXT NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  unit TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  photo TEXT NOT NULL DEFAULT 'hero',
  lot TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  organic INTEGER NOT NULL DEFAULT 0,
  short TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  highlights TEXT NOT NULL DEFAULT '[]',
  harvest TEXT NOT NULL DEFAULT '',
  season TEXT NOT NULL DEFAULT '',
  available TEXT NOT NULL DEFAULT 'Esta semana',
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL DEFAULT '',
  buyer_city TEXT NOT NULL DEFAULT '',
  delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('pickup', 'delivery')),
  pickup_id TEXT NOT NULL DEFAULT '',
  route_id TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  delivery_date TEXT NOT NULL,
  delivery_window TEXT NOT NULL DEFAULT '',
  payment TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pendiente',
  note TEXT NOT NULL DEFAULT '',
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  total INTEGER NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0)
);

CREATE TABLE IF NOT EXISTS order_groups (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  producer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo','preparando','en_ruta','entregado','cancelado')),
  subtotal INTEGER NOT NULL,
  PRIMARY KEY (order_id, producer_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS training (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  done_at TEXT NOT NULL,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS pitches (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hook TEXT NOT NULL DEFAULT '',
  story TEXT NOT NULL DEFAULT '',
  product TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notify_routes INTEGER NOT NULL DEFAULT 1,
  notify_offers INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_products_producer ON products(producer_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_producer ON order_items(producer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`;

function nowIso() {
  return new Date().toISOString();
}

function nextWeekday(day, weeks = 0) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  let diff = (Number(day) - base.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  base.setDate(base.getDate() + diff + weeks * 7);
  return base;
}

function isoDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw error;
  }
}

function seedCatalog() {
  const catalog = readJson('shared/catalog.json');
  const stamp = nowIso();
  const insertProducer = db.prepare(`
    INSERT OR IGNORE INTO producers
    (id, name, owner, place, zone, since, hectares, initials, accent, verified, practices, story, photo, gallery, whatsapp, alias, pickup, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  catalog.producers.forEach((p) => {
    insertProducer.run(
      p.id, p.name, p.owner, p.place, p.zone, p.since || null, p.hectares || 0,
      p.initials || '', p.accent || '#9b6239', p.verified ? 1 : 0,
      JSON.stringify(p.practices || []), p.story || '', p.photo || 'hero',
      JSON.stringify(p.gallery || []), p.whatsapp || '', p.alias || '',
      p.pickup || '', p.role || 'Productor', stamp, stamp
    );
  });

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products
    (id, producer_id, name, category, price, unit, stock, active, photo, lot, featured, organic, short, description, highlights, harvest, season, available, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  catalog.products.forEach((p) => {
    insertProduct.run(
      p.id, p.producerId, p.name, p.category, p.price, p.unit, p.stock,
      p.active === false ? 0 : 1, p.photo || 'hero', p.lot || '',
      p.featured ? 1 : 0, p.organic ? 1 : 0, p.short || '', p.description || '',
      JSON.stringify(p.highlights || []), p.harvest || '', p.season || '',
      p.available || 'Esta semana', stamp, stamp
    );
  });

  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('catalog_seed', stamp);
  console.log(`Catálogo inicial: ${catalog.producers.length} productores, ${catalog.products.length} productos.`);
  return catalog;
}

function createSeedUser({ id, email, password, name, role, producerId = null, city = 'Formosa Capital' }) {
  const stamp = nowIso();
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, password_hash, name, phone, city, address, role, producer_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, '', ?, '', ?, ?, ?, ?)
  `).run(id, email, hashPassword(password), name, city, role, producerId, stamp, stamp);
  db.prepare('INSERT OR IGNORE INTO settings (user_id, notify_routes, notify_offers) VALUES (?, 1, 0)').run(id);
  db.prepare('INSERT OR IGNORE INTO pitches (user_id, updated_at) VALUES (?, ?)').run(id, stamp);
}

function seedDemo() {
  const catalog = readJson('shared/catalog.json');
  const specs = readJson('shared/demo-orders.json');
  const routes = catalog.routes;
  const pickups = catalog.pickups;
  const products = catalog.products;

  createSeedUser({
    id: 'u-demo-buyer', email: 'demo@innovaagro.app', password: 'demo1234',
    name: 'Mariana Silva', role: 'buyer'
  });

  const producerEmails = ['finca', 'cooperativa', 'apiario', 'quesos', 'huerta', 'artesanas', 'frutas', 'ribera', 'verde'];
  catalog.producers.forEach((p, index) => {
    createSeedUser({
      id: `u-${p.id}`, email: `${producerEmails[index]}@innovaagro.app`, password: 'demo1234',
      name: p.owner, role: 'producer', producerId: p.id, city: p.place
    });
  });

  const existing = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE user_id = ?').get('u-demo-buyer');
  if (existing.n > 0) return;

  const insertOrder = db.prepare(`
    INSERT INTO orders
    (id, code, user_id, buyer_name, buyer_phone, buyer_city, delivery_mode, pickup_id, route_id, address, delivery_date, delivery_window, payment, payment_status, note, subtotal, shipping, total, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, producer_id, name, unit, price, qty)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertGroup = db.prepare(`
    INSERT INTO order_groups (order_id, producer_id, status, subtotal) VALUES (?, ?, ?, ?)
  `);

  specs.forEach((spec) => {
    const route = routes.find((r) => r.id === spec.delivery.routeId) || routes[0];
    const when = new Date();
    when.setDate(when.getDate() - (spec.daysAgo || 0));
    when.setHours(10 + (spec.daysAgo || 0), 20, 0, 0);
    const items = spec.items.map(([id, qty]) => {
      const p = products.find((x) => x.id === id) || products[0];
      return { productId: id, producerId: p.producerId, name: p.name, unit: p.unit, price: p.price, qty };
    });
    const groups = {};
    items.forEach((it) => {
      if (!groups[it.producerId]) groups[it.producerId] = { status: spec.statuses[it.producerId] || 'nuevo', subtotal: 0 };
      groups[it.producerId].subtotal += it.price * it.qty;
    });
    const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const shipping = spec.delivery.mode === 'delivery' ? (subtotal >= 35000 ? 0 : 2800) : 0;
    const pickup = pickups.find((p) => p.id === spec.delivery.pointId);
    const deliveryDate = isoDate(nextWeekday(route.day));
    const window = spec.delivery.mode === 'pickup' ? (pickup ? pickup.time : '') : '14:00 a 19:00';
    const id = 'ord-' + spec.code.replace(/\W/g, '').toLowerCase();
    insertOrder.run(
      id, spec.code, 'u-demo-buyer', spec.buyer.name, spec.buyer.phone || '', spec.buyer.city || '',
      spec.delivery.mode, spec.delivery.pointId || '', route.id, spec.delivery.address || '',
      deliveryDate, window, spec.payment, 'pendiente', spec.note || '',
      subtotal, shipping, subtotal + shipping, when.toISOString()
    );
    items.forEach((it) => insertItem.run(id, it.productId, it.producerId, it.name, it.unit, it.price, it.qty));
    Object.entries(groups).forEach(([producerId, g]) => insertGroup.run(id, producerId, g.status, g.subtotal));
  });
  console.log(`Pedidos demo: ${specs.length}.`);
}

function ensureDemoColumns() {
  ['producers', 'products', 'orders'].forEach((table) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN demo INTEGER NOT NULL DEFAULT 0`);
    } catch (_) {
      /* La columna ya existe. */
    }
  });
}

function markDemoCatalog() {
  const catalog = readJson('shared/catalog.json');
  const specs = readJson('shared/demo-orders.json');
  const producerIds = (catalog.producers || []).map((p) => p.id);
  const productIds = (catalog.products || []).map((p) => p.id);
  const orderCodes = (specs || []).map((o) => o.code);
  if (producerIds.length) {
    db.prepare(`UPDATE producers SET demo = 1 WHERE id IN (${producerIds.map(() => '?').join(',')})`).run(...producerIds);
  }
  if (productIds.length) {
    db.prepare(`UPDATE products SET demo = 1 WHERE id IN (${productIds.map(() => '?').join(',')})`).run(...productIds);
  }
  if (orderCodes.length) {
    db.prepare(`UPDATE orders SET demo = 1 WHERE code IN (${orderCodes.map(() => '?').join(',')})`).run(...orderCodes);
  }
}

function init() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA);
  ensureDemoColumns();
  state.setDb(db);
  const seedCatalogEnabled = process.env.SEED_CATALOG !== 'false';
  const seedDemoEnabled = process.env.SEED_DEMO !== 'false';
  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'catalog_seed'").get();
  if (!seeded) {
    transaction(() => {
      if (seedCatalogEnabled) seedCatalog();
      else db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('catalog_seed', 'empty:' + nowIso());
      if (seedCatalogEnabled && seedDemoEnabled) seedDemo();
    });
  } else if (seedCatalogEnabled && seedDemoEnabled) {
    transaction(() => seedDemo());
  }
  if (seedCatalogEnabled) transaction(() => markDemoCatalog());
  const expired = db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso());
  if (expired.changes) console.log(`Sesiones vencidas eliminadas: ${expired.changes}`);
  return db;
}

module.exports = {
  init,
  get db() { return db; },
  transaction,
  DB_PATH,
  DATA_DIR,
  nextWeekday,
  isoDate
};
