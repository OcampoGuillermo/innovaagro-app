'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const { init, transaction, nextWeekday, isoDate } = require('./db');
const { getDb } = require('./state');
const { hashPassword, verifyPassword } = require('./passwords');
const {
  createSession, setSessionCookie, currentUser, requireUser, requireProducer,
  destroySession, publicUser
} = require('./auth');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const UPLOADS = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(PUBLIC, 'uploads');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'catalog.json'), 'utf8'));
const courses = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'courses.json'), 'utf8'));
const LESSON_IDS = new Set(courses.flatMap((c) => c.lessonsData.map((l) => l.id)));
const CATEGORIES = new Set(catalog.categories);
const ROUTE_IDS = new Set(catalog.routes.map((r) => r.id));
const PICKUP_IDS = new Set(catalog.pickups.map((p) => p.id));
const PAYMENTS = new Set(['efectivo', 'transferencia', 'mercadopago']);
const STATUS_FLOW = {
  nuevo: ['preparando', 'cancelado'],
  preparando: ['en_ruta', 'cancelado'],
  en_ruta: ['entregado'],
  entregado: [],
  cancelado: []
};

fs.mkdirSync(UPLOADS, { recursive: true });
init();

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields || null;
  }
}

/* ---------- helpers ---------- */
function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed == null ? fallback : parsed;
  } catch (_) { return fallback; }
}

function producerOut(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    owner: row.owner,
    place: row.place,
    zone: row.zone,
    since: row.since,
    hectares: row.hectares,
    initials: row.initials,
    accent: row.accent,
    verified: !!row.verified,
    practices: parseJson(row.practices, []),
    story: row.story,
    photo: row.photo,
    gallery: parseJson(row.gallery, []),
    whatsapp: row.whatsapp,
    alias: row.alias,
    pickup: row.pickup,
    role: row.role,
    demo: !!row.demo
  };
}

function productOut(row) {
  if (!row) return null;
  return {
    id: row.id,
    producerId: row.producer_id,
    name: row.name,
    category: row.category,
    price: row.price,
    unit: row.unit,
    stock: row.stock,
    active: !!row.active,
    photo: row.photo,
    lot: row.lot,
    featured: !!row.featured,
    organic: !!row.organic,
    short: row.short,
    description: row.description,
    highlights: parseJson(row.highlights, []),
    harvest: row.harvest,
    season: row.season,
    available: row.available,
    demo: !!row.demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function orderOut(row, items, groups) {
  return {
    id: row.id,
    code: row.code,
    createdAt: row.created_at,
    buyer: { name: row.buyer_name, phone: row.buyer_phone, city: row.buyer_city },
    delivery: {
      mode: row.delivery_mode,
      pointId: row.pickup_id,
      routeId: row.route_id,
      address: row.address,
      date: row.delivery_date,
      window: row.delivery_window
    },
    payment: row.payment,
    paymentStatus: row.payment_status,
    note: row.note,
    items: items.map((it) => ({
      productId: it.product_id,
      producerId: it.producer_id,
      name: it.name,
      unit: it.unit,
      price: it.price,
      qty: it.qty
    })),
    groups,
    subtotal: row.subtotal,
    shipping: row.shipping,
    total: row.total,
    demo: !!row.demo
  };
}

function loadOrder(id, onlyProducerId = null) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!row) return null;
  const items = onlyProducerId
    ? db.prepare('SELECT * FROM order_items WHERE order_id = ? AND producer_id = ?').all(id, onlyProducerId)
    : db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  const groupRows = onlyProducerId
    ? db.prepare('SELECT * FROM order_groups WHERE order_id = ? AND producer_id = ?').all(id, onlyProducerId)
    : db.prepare('SELECT * FROM order_groups WHERE order_id = ?').all(id);
  const groups = {};
  groupRows.forEach((g) => { groups[g.producer_id] = { status: g.status, subtotal: g.subtotal }; });
  return orderOut(row, items, groups);
}

function ordersFor(user) {
  const db = getDb();
  if (user.role === 'producer' && user.producer_id) {
    const rows = db.prepare(`
      SELECT DISTINCT o.* FROM orders o
      JOIN order_groups g ON g.order_id = o.id
      WHERE g.producer_id = ?
      ORDER BY o.created_at DESC LIMIT 200
    `).all(user.producer_id);
    return rows.map((r) => loadOrder(r.id, user.producer_id));
  }
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 200').all(user.id);
  return rows.map((r) => loadOrder(r.id));
}

function validationError(fields) {
  return new HttpError(422, 'Revisá los datos marcados.', fields);
}

function cleanText(value, max = 200) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function slugify(value) {
  const base = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42);
  return base || 'producto';
}

function uniqueProductId(name) {
  const db = getDb();
  const base = slugify(name);
  let id = base;
  let n = 2;
  while (db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

function makeOrderCode() {
  const db = getDb();
  const d = new Date();
  const y = String(d.getFullYear()).slice(2);
  const stamp = `${y}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  for (let i = 0; i < 20; i++) {
    const code = `IA-${stamp}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(Math.floor(Math.random() * 90) + 10)}`;
    if (!db.prepare('SELECT 1 FROM orders WHERE code = ?').get(code)) return code;
  }
  return `IA-${stamp}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function nextRouteDate(route) {
  return isoDate(nextWeekday(route.day));
}

/* ---------- middlewares ---------- */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const expected = `${proto}://${req.get('host')}`;
  if (origin !== expected) return res.status(403).json({ error: 'Origen no permitido.' });
  return next();
});

app.use(express.json({ limit: '512kb' }));

/* ---------- rate limit for auth ---------- */
const attempts = new Map();
function authLimiter(req, res, next) {
  const key = req.ip || 'local';
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 15 * 60 * 1000; }
  if (entry.count >= 20) {
    return res.status(429).json({ error: 'Demasiados intentos. Esperá 15 minutos antes de volver a probar.' });
  }
  entry.count += 1;
  attempts.set(key, entry);
  next();
}

/* ---------- public API ---------- */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'innovaagro-app', time: new Date().toISOString() });
});

app.get('/api/bootstrap', (req, res) => {
  const db = getDb();
  const user = currentUser(req, res);
  const base = {
    user: publicUser(user),
    config: {
      categories: catalog.categories,
      cities: catalog.cities,
      routes: catalog.routes,
      pickups: catalog.pickups
    },
    serverTime: new Date().toISOString()
  };
  if (!user) return res.json({ ...base, producers: [], products: [], orders: [], favorites: [], training: { done: [], pitch: {} }, settings: {} });

  const producers = db.prepare('SELECT * FROM producers WHERE active = 1 ORDER BY name COLLATE NOCASE').all().map(producerOut);
  const products = user.role === 'producer' && user.producer_id
    ? db.prepare('SELECT * FROM products WHERE active = 1 OR producer_id = ? ORDER BY name COLLATE NOCASE').all(user.producer_id).map(productOut)
    : db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name COLLATE NOCASE').all().map(productOut);
  const favorites = db.prepare('SELECT product_id FROM favorites WHERE user_id = ?').all(user.id).map((r) => r.product_id);
  const done = db.prepare('SELECT lesson_id FROM training WHERE user_id = ?').all(user.id).map((r) => r.lesson_id);
  const pitch = db.prepare('SELECT hook, story, product, cta FROM pitches WHERE user_id = ?').get(user.id) || { hook: '', story: '', product: '', cta: '' };
  const settings = db.prepare('SELECT notify_routes, notify_offers FROM settings WHERE user_id = ?').get(user.id) || { notify_routes: 1, notify_offers: 0 };
  res.json({
    ...base,
    producers,
    products,
    orders: ordersFor(user),
    favorites,
    training: { done, pitch },
    settings: { notifyRoutes: !!settings.notify_routes, notifyOffers: !!settings.notify_offers }
  });
});

/* ---------- auth ---------- */
app.post('/api/auth/register', authLimiter, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const fields = {};
  const name = cleanText(body.name, 80);
  const email = cleanText(body.email, 160).toLowerCase();
  const password = String(body.password || '');
  const role = body.role === 'producer' ? 'producer' : 'buyer';
  const city = catalog.cities.includes(body.city) ? body.city : 'Formosa Capital';

  if (name.length < 2) fields.name = 'Ingresá tu nombre.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fields.email = 'Ingresá un correo válido.';
  if (password.length < 8) fields.password = 'La contraseña debe tener al menos 8 caracteres.';
  if (password.length > 200) fields.password = 'La contraseña es demasiado larga.';

  let farmName = '';
  let place = '';
  let zone = '';
  if (role === 'producer') {
    farmName = cleanText(body.farmName, 80);
    place = cleanText(body.place, 80);
    zone = cleanText(body.zone, 80);
    if (farmName.length < 2) fields.farmName = 'Ingresá el nombre de la finca o emprendimiento.';
    if (place.length < 2) fields.place = 'Ingresá la localidad.';
    if (!zone) fields.zone = 'Elegí una zona de reparto.';
  }
  if (Object.keys(fields).length) throw validationError(fields);
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw validationError({ email: 'Ya existe una cuenta con ese correo.' });
  }

  const stamp = new Date().toISOString();
  const userId = 'u-' + crypto.randomUUID();
  let producerId = null;

  transaction(() => {
    if (role === 'producer') {
      producerId = 'p-' + crypto.randomBytes(6).toString('hex');
      const initials = farmName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
      db.prepare(`
        INSERT INTO producers
        (id, name, owner, place, zone, since, hectares, initials, accent, verified, practices, story, photo, gallery, whatsapp, alias, pickup, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, '#3e6b51', 0, '[]', '', 'farmer_field', ?, '', '', '', ?, ?, ?)
      `).run(
        producerId, farmName, name, place, zone, new Date().getFullYear(), initials,
        JSON.stringify(['farmer_field', 'hero', 'hojas']), 'Productor', stamp, stamp
      );
    }
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, phone, city, address, role, producer_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', ?, '', ?, ?, ?, ?)
    `).run(userId, email, hashPassword(password), name, city, role, producerId, stamp, stamp);
    db.prepare('INSERT INTO settings (user_id, notify_routes, notify_offers) VALUES (?, 1, 0)').run(userId);
    db.prepare('INSERT INTO pitches (user_id, updated_at) VALUES (?, ?)').run(userId, stamp);
  });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const session = createSession(userId);
  setSessionCookie(res, session);
  res.status(201).json({ user: publicUser(user) });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const db = getDb();
  const email = cleanText((req.body || {}).email, 160).toLowerCase();
  const password = String((req.body || {}).password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  const session = createSession(user.id);
  setSessionCookie(res, session);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

/* ---------- account ---------- */
app.patch('/api/me', requireUser, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const fields = {};
  const name = cleanText(body.name, 80);
  const phone = cleanText(body.phone, 20);
  const city = catalog.cities.includes(body.city) ? body.city : cleanText(body.city, 80);
  const address = cleanText(body.address, 200);
  if (name.length < 2) fields.name = 'Ingresá tu nombre.';
  if (phone && !/^[0-9+()\s-]{6,20}$/.test(phone)) fields.phone = 'Revisá el teléfono.';
  if (Object.keys(fields).length) throw validationError(fields);
  db.prepare('UPDATE users SET name = ?, phone = ?, city = ?, address = ?, updated_at = ? WHERE id = ?')
    .run(name, phone, city || 'Formosa Capital', address, new Date().toISOString(), req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

app.post('/api/me/password', requireUser, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');
  const fields = {};
  if (!verifyPassword(currentPassword, req.user.password_hash)) fields.currentPassword = 'La contraseña actual no es correcta.';
  if (newPassword.length < 8) fields.newPassword = 'La contraseña nueva debe tener al menos 8 caracteres.';
  if (newPassword.length > 200) fields.newPassword = 'La contraseña es demasiado larga.';
  if (!fields.newPassword && newPassword === currentPassword) fields.newPassword = 'Elegí una contraseña distinta a la actual.';
  if (Object.keys(fields).length) throw validationError(fields);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(hashPassword(newPassword), new Date().toISOString(), req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
  const session = createSession(req.user.id);
  setSessionCookie(res, session);
  res.json({ ok: true });
});

app.get('/api/me/export', requireUser, (req, res) => {
  const db = getDb();
  res.setHeader('Content-Disposition', 'attachment; filename="innovaagro-datos.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    user: publicUser(req.user),
    orders: ordersFor(req.user),
    favorites: db.prepare('SELECT product_id FROM favorites WHERE user_id = ?').all(req.user.id),
    training: db.prepare('SELECT lesson_id FROM training WHERE user_id = ?').all(req.user.id),
    pitch: db.prepare('SELECT hook, story, product, cta FROM pitches WHERE user_id = ?').get(req.user.id) || {}
  });
});

/* ---------- producer profile ---------- */
app.patch('/api/producer/me', requireProducer, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const fields = {};
  const name = cleanText(body.name, 80);
  const owner = cleanText(body.owner, 80);
  const place = cleanText(body.place, 80);
  const zone = cleanText(body.zone, 80);
  const since = Number(body.since);
  const hectares = Number(body.hectares);
  const story = cleanText(body.story, 5000);
  const role = cleanText(body.role, 60);
  const whatsapp = cleanText(body.whatsapp, 20).replace(/[^\d+]/g, '');
  const alias = cleanText(body.alias, 60);
  const pickup = cleanText(body.pickup, 100);
  const accent = /^#[0-9a-f]{6}$/i.test(body.accent || '') ? body.accent : '#9b6239';
  const practices = Array.isArray(body.practices)
    ? body.practices.map((p) => cleanText(p, 48)).filter(Boolean).slice(0, 8)
    : String(body.practices || '').split(',').map((p) => cleanText(p, 48)).filter(Boolean).slice(0, 8);
  const currentPhoto = db.prepare('SELECT photo FROM producers WHERE id = ?').get(req.user.producer_id);
  const photo = cleanText(body.photo, 300) || (currentPhoto ? currentPhoto.photo : 'farmer_field');

  if (name.length < 2) fields.name = 'Ingresá el nombre público.';
  if (owner.length < 2) fields.owner = 'Ingresá el nombre del responsable.';
  if (place.length < 2) fields.place = 'Ingresá la localidad.';
  if (!catalog.routes.some((r) => r.zone === zone || r.name === zone) && zone.length < 2) fields.zone = 'Ingresá la zona.';
  if (!Number.isFinite(since) || since < 1900 || since > new Date().getFullYear() + 1) fields.since = 'Revisá el año de inicio.';
  if (!Number.isFinite(hectares) || hectares < 0 || hectares > 100000) fields.hectares = 'Revisá la superficie.';
  if (story.length > 5000) fields.story = 'La historia es demasiado larga.';
  if (whatsapp && !/^\d{8,15}$/.test(whatsapp)) fields.whatsapp = 'Usá solo números, con código de país. Ej.: 5493704000000.';
  if (!/^(\/uploads\/[a-z0-9._-]+|\/assets\/photos\/[a-z0-9_-]+\.webp|[a-z0-9_]+)$/i.test(photo)) fields.photo = 'La imagen no es válida.';
  if (Object.keys(fields).length) throw validationError(fields);

  db.prepare(`
    UPDATE producers SET name = ?, owner = ?, place = ?, zone = ?, since = ?, hectares = ?,
      story = ?, role = ?, whatsapp = ?, alias = ?, pickup = ?, accent = ?, practices = ?, photo = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name, owner, place, zone, Math.round(since), hectares, story, role || 'Productor',
    whatsapp.replace(/^\+/, ''), alias, pickup, accent, JSON.stringify(practices), photo,
    new Date().toISOString(), req.user.producer_id
  );
  res.json({ producer: producerOut(db.prepare('SELECT * FROM producers WHERE id = ?').get(req.user.producer_id)) });
});

/* ---------- products ---------- */
function productPayload(body, current = null) {
  const fields = {};
  const name = cleanText(body.name, 90);
  const category = cleanText(body.category, 40);
  const price = Number(body.price);
  const unit = cleanText(body.unit, 30);
  const stock = Number(body.stock);
  const photo = cleanText(body.photo, 300) || (current ? current.photo : 'hero');
  const lot = cleanText(body.lot, 30);
  const short = cleanText(body.short, 240);
  const description = cleanText(body.description, 2500);
  const harvest = cleanText(body.harvest, 60);
  const season = cleanText(body.season, 40);
  const available = cleanText(body.available, 60) || 'Esta semana';
  const highlights = Array.isArray(body.highlights)
    ? body.highlights.map((h) => cleanText(h, 70)).filter(Boolean).slice(0, 8)
    : String(body.highlights || '').split(',').map((h) => cleanText(h, 70)).filter(Boolean).slice(0, 8);

  if (name.length < 2) fields.name = 'Ingresá el nombre del producto.';
  if (!CATEGORIES.has(category)) fields.category = 'Elegí una categoría válida.';
  if (!Number.isFinite(price) || price < 1 || price > 10000000) fields.price = 'Ingresá un precio en pesos.';
  if (!unit) fields.unit = 'Indicá la unidad de venta.';
  if (!Number.isFinite(stock) || stock < 0 || stock > 1000000) fields.stock = 'El stock debe ser un número mayor o igual a cero.';
  if (!/^(\/uploads\/[a-z0-9._-]+|\/assets\/photos\/[a-z0-9_-]+\.webp|[a-z0-9_]+)$/i.test(photo)) fields.photo = 'La imagen no es válida.';
  if (!lot) fields.lot = 'Asigná un código de lote.';
  if (!short) fields.short = 'Escribí una descripción breve.';
  if (!description) fields.description = 'Agregá una descripción completa.';
  if (Object.keys(fields).length) throw validationError(fields);
  return {
    name, category, price: Math.round(price), unit, stock: Math.round(stock), photo, lot,
    short, description, highlights, harvest, season, available,
    organic: !!body.organic,
    active: body.active === false ? 0 : 1
  };
}

app.post('/api/products', requireProducer, (req, res) => {
  const db = getDb();
  const data = productPayload(req.body || {});
  const id = uniqueProductId(data.name);
  const stamp = new Date().toISOString();
  db.prepare(`
    INSERT INTO products
    (id, producer_id, name, category, price, unit, stock, active, photo, lot, featured, organic, short, description, highlights, harvest, season, available, demo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    id, req.user.producer_id, data.name, data.category, data.price, data.unit, data.stock,
    data.active, data.photo, data.lot, data.organic ? 1 : 0, data.short, data.description,
    JSON.stringify(data.highlights), data.harvest, data.season, data.available, stamp, stamp
  );
  res.status(201).json({ product: productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) });
});

app.patch('/api/products/:id', requireProducer, (req, res) => {
  const db = getDb();
  const current = db.prepare('SELECT * FROM products WHERE id = ? AND producer_id = ?').get(req.params.id, req.user.producer_id);
  if (!current) return res.status(404).json({ error: 'Producto no encontrado.' });
  const data = productPayload(req.body || {}, current);
  db.prepare(`
    UPDATE products SET name = ?, category = ?, price = ?, unit = ?, stock = ?, active = ?, photo = ?,
      lot = ?, organic = ?, short = ?, description = ?, highlights = ?, harvest = ?, season = ?, available = ?, updated_at = ?
    WHERE id = ? AND producer_id = ?
  `).run(
    data.name, data.category, data.price, data.unit, data.stock, data.active, data.photo,
    data.lot, data.organic ? 1 : 0, data.short, data.description, JSON.stringify(data.highlights),
    data.harvest, data.season, data.available, new Date().toISOString(), req.params.id, req.user.producer_id
  );
  res.json({ product: productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)) });
});

app.patch('/api/products/:id/stock', requireProducer, (req, res) => {
  const db = getDb();
  const stock = Number((req.body || {}).stock);
  if (!Number.isFinite(stock) || stock < 0 || stock > 1000000) throw validationError({ stock: 'Stock inválido.' });
  const result = db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ? AND producer_id = ?')
    .run(Math.round(stock), new Date().toISOString(), req.params.id, req.user.producer_id);
  if (!result.changes) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json({ product: productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)) });
});

app.delete('/api/products/:id', requireProducer, (req, res) => {
  const db = getDb();
  const result = db.prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ? AND producer_id = ?')
    .run(new Date().toISOString(), req.params.id, req.user.producer_id);
  if (!result.changes) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json({ ok: true });
});

/* ---------- favorites / training / pitch / settings ---------- */
app.post('/api/favorites/:productId', requireUser, (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
  const exists = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ?').get(req.user.id, product.id);
  if (exists) db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(req.user.id, product.id);
  else db.prepare('INSERT INTO favorites (user_id, product_id, created_at) VALUES (?, ?, ?)').run(req.user.id, product.id, new Date().toISOString());
  res.json({ favorite: !exists, favorites: db.prepare('SELECT product_id FROM favorites WHERE user_id = ?').all(req.user.id).map((r) => r.product_id) });
});

app.post('/api/training/:lessonId', requireUser, (req, res) => {
  const db = getDb();
  if (!LESSON_IDS.has(req.params.lessonId)) return res.status(404).json({ error: 'Clase no encontrada.' });
  const exists = db.prepare('SELECT 1 FROM training WHERE user_id = ? AND lesson_id = ?').get(req.user.id, req.params.lessonId);
  if (exists) db.prepare('DELETE FROM training WHERE user_id = ? AND lesson_id = ?').run(req.user.id, req.params.lessonId);
  else db.prepare('INSERT INTO training (user_id, lesson_id, done_at) VALUES (?, ?, ?)').run(req.user.id, req.params.lessonId, new Date().toISOString());
  res.json({
    done: !exists,
    training: db.prepare('SELECT lesson_id FROM training WHERE user_id = ?').all(req.user.id).map((r) => r.lesson_id)
  });
});

app.put('/api/pitch', requireUser, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const pitch = {
    hook: cleanText(body.hook, 500),
    story: cleanText(body.story, 1000),
    product: cleanText(body.product, 500),
    cta: cleanText(body.cta, 300)
  };
  db.prepare(`
    INSERT INTO pitches (user_id, hook, story, product, cta, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET hook = excluded.hook, story = excluded.story,
      product = excluded.product, cta = excluded.cta, updated_at = excluded.updated_at
  `).run(req.user.id, pitch.hook, pitch.story, pitch.product, pitch.cta, new Date().toISOString());
  res.json({ pitch });
});

app.patch('/api/settings', requireUser, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const current = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id) || { notify_routes: 1, notify_offers: 0 };
  const routes = typeof body.notifyRoutes === 'boolean' ? body.notifyRoutes : !!current.notify_routes;
  const offers = typeof body.notifyOffers === 'boolean' ? body.notifyOffers : !!current.notify_offers;
  db.prepare(`
    INSERT INTO settings (user_id, notify_routes, notify_offers) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET notify_routes = excluded.notify_routes, notify_offers = excluded.notify_offers
  `).run(req.user.id, routes ? 1 : 0, offers ? 1 : 0);
  res.json({ settings: { notifyRoutes: routes, notifyOffers: offers } });
});

/* ---------- orders ---------- */
app.post('/api/orders', requireUser, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const fields = {};
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const wanted = new Map();
  rawItems.forEach((it) => {
    const id = cleanText(it && it.productId, 80);
    const qty = Number(it && it.qty);
    if (!id || !Number.isFinite(qty) || qty < 1 || qty > 50) return;
    wanted.set(id, (wanted.get(id) || 0) + Math.round(qty));
  });
  if (!wanted.size) fields.items = 'La canasta está vacía.';

  const name = cleanText(body.name || req.user.name, 80);
  const phone = cleanText(body.phone || req.user.phone, 20);
  const city = cleanText(body.city || req.user.city, 80);
  const note = cleanText(body.note, 500);
  const mode = body.mode === 'delivery' ? 'delivery' : 'pickup';
  const payment = PAYMENTS.has(body.payment) ? body.payment : 'efectivo';
  const pickup = catalog.pickups.find((p) => p.id === body.pointId);
  const route = catalog.routes.find((r) => r.id === body.routeId) || (pickup ? catalog.routes.find((r) => r.id === pickup.routeId) : null);
  const address = cleanText(body.address, 200);

  if (name.length < 2) fields.name = 'Ingresá el nombre de quien recibe.';
  if (!/^[0-9+()\s-]{6,20}$/.test(phone)) fields.phone = 'Ingresá un WhatsApp válido.';
  if (mode === 'pickup' && !pickup) fields.pointId = 'Elegí un punto de retiro.';
  if (mode === 'delivery' && !route) fields.routeId = 'Elegí una ruta de entrega.';
  if (mode === 'delivery' && address.length < 5) fields.address = 'Ingresá la dirección de entrega.';
  if (Object.keys(fields).length) throw validationError(fields);

  const items = [];
  let subtotal = 0;
  wanted.forEach((qty, productId) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
    if (!product) {
      fields.items = 'Uno de los productos ya no está disponible.';
      return;
    }
    if (product.stock < qty) {
      fields.items = `No hay stock suficiente de ${product.name}. Quedan ${product.stock}.`;
      return;
    }
    items.push({
      productId: product.id, producerId: product.producer_id, name: product.name,
      unit: product.unit, price: product.price, qty
    });
    subtotal += product.price * qty;
  });
  if (Object.keys(fields).length) throw validationError(fields);

  const shipping = mode === 'pickup' ? 0 : (subtotal >= 35000 ? 0 : 2800);
  const total = subtotal + shipping;
  const date = nextRouteDate(route);
  const window = mode === 'pickup' ? pickup.time : '14:00 a 19:00';
  const id = 'ord-' + crypto.randomUUID();
  const code = makeOrderCode();
  const createdAt = new Date().toISOString();

  transaction(() => {
    db.prepare(`
      INSERT INTO orders
      (id, code, user_id, buyer_name, buyer_phone, buyer_city, delivery_mode, pickup_id, route_id, address, delivery_date, delivery_window, payment, payment_status, note, subtotal, shipping, total, demo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, 0, ?)
    `).run(
      id, code, req.user.id, name, phone, city, mode, pickup ? pickup.id : '', route.id,
      address, date, window, payment, note, subtotal, shipping, total, createdAt
    );
    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, producer_id, name, unit, price, qty) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const groups = new Map();
    items.forEach((it) => {
      insertItem.run(id, it.productId, it.producerId, it.name, it.unit, it.price, it.qty);
      const g = groups.get(it.producerId) || { subtotal: 0 };
      g.subtotal += it.price * it.qty;
      groups.set(it.producerId, g);
      const dec = db.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?')
        .run(it.qty, createdAt, it.productId, it.qty);
      if (!dec.changes) throw new HttpError(409, `El stock de ${it.name} cambió mientras confirmabas. Volvé a intentar.`);
    });
    const insertGroup = db.prepare('INSERT INTO order_groups (order_id, producer_id, status, subtotal) VALUES (?, ?, ?, ?)');
    groups.forEach((g, producerId) => insertGroup.run(id, producerId, 'nuevo', g.subtotal));
    db.prepare('UPDATE users SET name = ?, phone = ?, city = ?, address = ?, updated_at = ? WHERE id = ?')
      .run(name, phone, city || 'Formosa Capital', mode === 'delivery' ? address : req.user.address, createdAt, req.user.id);
  });

  res.status(201).json({ order: loadOrder(id), code });
});

app.get('/api/orders/:id', requireUser, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Pedido no encontrado.' });
  if (row.user_id !== req.user.id) {
    if (req.user.role !== 'producer' || !req.user.producer_id) return res.status(403).json({ error: 'No tenés acceso a este pedido.' });
    const belongs = db.prepare('SELECT 1 FROM order_groups WHERE order_id = ? AND producer_id = ?').get(row.id, req.user.producer_id);
    if (!belongs) return res.status(403).json({ error: 'No tenés acceso a este pedido.' });
    return res.json({ order: loadOrder(row.id, req.user.producer_id) });
  }
  res.json({ order: loadOrder(row.id) });
});

app.patch('/api/orders/:id/groups/:producerId', requireProducer, (req, res) => {
  const db = getDb();
  if (req.params.producerId !== req.user.producer_id) return res.status(403).json({ error: 'No podés cambiar el estado de otro productor.' });
  const next = cleanText((req.body || {}).status, 20);
  const group = db.prepare('SELECT * FROM order_groups WHERE order_id = ? AND producer_id = ?').get(req.params.id, req.user.producer_id);
  if (!group) return res.status(404).json({ error: 'Pedido no encontrado.' });
  if (!STATUS_FLOW[group.status] || !STATUS_FLOW[group.status].includes(next)) {
    return res.status(409).json({ error: `No se puede pasar de «${group.status}» a «${next}».` });
  }
  transaction(() => {
    db.prepare('UPDATE order_groups SET status = ? WHERE order_id = ? AND producer_id = ?')
      .run(next, req.params.id, req.user.producer_id);
    // Si se cancela un pedido real, el stock vuelve al catálogo. Los pedidos
    // iniciales de demostración no descontaron stock, por eso se excluyen.
    if (next === 'cancelado') {
      const order = db.prepare('SELECT demo FROM orders WHERE id = ?').get(req.params.id);
      if (order && !order.demo) {
        const stamp = new Date().toISOString();
        const restore = db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?');
        const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ? AND producer_id = ?')
          .all(req.params.id, req.user.producer_id);
        items.forEach((item) => restore.run(item.qty, stamp, item.product_id));
      }
    }
  });
  res.json({ order: loadOrder(req.params.id, req.user.producer_id) });
});

/* ---------- uploads ---------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) return cb(new HttpError(415, 'Subí una imagen JPG, PNG o WebP.'));
    return cb(null, true);
  }
});

function imageExtension(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buffer.length > 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return '.webp';
  return null;
}

app.post('/api/uploads', requireProducer, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
  const ext = imageExtension(req.file.buffer);
  if (!ext) return res.status(415).json({ error: 'El archivo no es una imagen válida.' });
  const filename = crypto.randomUUID() + ext;
  fs.writeFileSync(path.join(UPLOADS, filename), req.file.buffer);
  res.status(201).json({ url: `/uploads/${filename}` });
});

/* ---------- static ---------- */
app.use('/uploads', express.static(UPLOADS, {
  fallthrough: false,
  maxAge: '365d',
  immutable: true,
  setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); }
}));
app.use(express.static(PUBLIC, {
  index: false,
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
  res.setHeader('Cache-Control', 'no-cache');
  return res.sendFile(path.join(PUBLIC, 'index.html'));
});

/* ---------- errors ---------- */
app.use((req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, ...(error.fields ? { fields: error.fields } : {}) });
  }
  if (error && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'La imagen supera los 6 MB.' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
  }
  console.error(error);
  return res.status(500).json({ error: 'Ocurrió un error inesperado. Intentá de nuevo.' });
});

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
  console.log(`InnovaAgro-App escuchando en http://localhost:${PORT}`);
  if (process.env.SEED_DEMO !== 'false' && process.env.SEED_CATALOG !== 'false') {
    console.log('Cuentas demo: demo@innovaagro.app / demo1234');
    console.log('Productor demo: finca@innovaagro.app / demo1234');
  }
});

function shutdown(signal) {
  console.log(`\n${signal}: cerrando servidor…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
