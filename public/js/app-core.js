/* ===================== InnovaAgro-App · núcleo del cliente ===================== */
const STATE_VERSION = 4;
const SHIPPING = 2800;
const FREE_SHIPPING = 35000;

let db = null;
let sealSeq = 0;
let detailQty = 1;
let lastRouteKey = '';
let checkoutDraft = null;
let checkoutErrors = {};
let ordersTab = 'all';
let panelOrdersTab = 'all';
let panelProductQuery = '';
let timerState = { seconds: 60, left: 60, running: false, id: null };
let deferredInstall = null;
let speechUtterance = null;
let storageWarned = false;
let marketFocusPending = false;
let authMode = 'login';
let authRole = 'buyer';
let authError = '';
let authFields = {};
let authNotice = '';
let forgotEmail = '';
let forgotSent = false;
let forgotError = '';
let resetError = {};
let resetDone = false;
let verifyState = { status: 'loading', message: '', email: '' };
let verifyTokenInFlight = '';
let adminData = null;
let adminLoading = false;
let adminError = '';
let adminTab = 'users';
let adminQuery = '';
let adminRoleFilter = '';
let paymentReturnHandled = '';
let bootError = '';
let lastUserId = '';
try { lastUserId = localStorage.getItem('innovaagro.lastUser') || ''; } catch (_) {}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clone = (value) => JSON.parse(JSON.stringify(value));
const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const money = (n) => '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const digits = (s) => String(s || '').replace(/\D/g, '');
const photoSrc = (value) => {
  if (!value) return PHOTOS.hero;
  if (/^(https?:|data:|\/)/i.test(String(value))) return String(value);
  return PHOTOS[value] || PHOTOS.hero;
};

/* ---------- API ---------- */
class ApiError extends Error {
  constructor(message, status = 0, fields = null, code = '') {
    super(message);
    this.status = status;
    this.fields = fields;
    this.code = code;
  }
}

async function api(path, options = {}) {
  const opts = { credentials: 'same-origin', ...options };
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body && !isForm && typeof opts.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  opts.headers = headers;
  let response;
  try {
    response = await fetch('/api' + path, opts);
  } catch (error) {
    throw new ApiError('No hay conexión con el servidor. Revisá tu red e intentá de nuevo.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || 'No se pudo completar la operación.', response.status, data.fields || null, data.code || '');
  return data;
}

async function uploadImage(file) {
  const body = new FormData();
  body.append('image', file);
  const result = await api('/uploads', { method: 'POST', body });
  return result.url;
}

/* ---------- dates ---------- */
function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function isoDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
function fmtShort(date) {
  const d = parseDate(date);
  if (!d) return '';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
function fmtLong(date) {
  const d = parseDate(date);
  if (!d) return '';
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtDateTime(date) {
  const d = parseDate(date);
  if (!d) return '';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function nextWeekday(day, weeks = 0) {
  const base = today();
  let diff = (Number(day) - base.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(base, diff + weeks * 7);
}
function routeById(id) {
  return ROUTES.find((r) => r.id === id) || ROUTES[0] || { id: '', name: 'Ruta a coordinar', day: 4, dayLabel: 'Jueves', zone: 'Formosa', stops: [], cutoff: '24 h antes', note: '' };
}
function pickupById(id) {
  return PICKUPS.find((p) => p.id === id) || PICKUPS[0] || { id: '', name: 'Punto a coordinar', address: 'Formosa', time: 'A coordinar', note: '', routeId: '' };
}
function routeNextDate(routeId, weeks = 0) {
  return nextWeekday(routeById(routeId).day, weeks);
}
function upcomingDates(count = 3) {
  const list = [];
  for (let w = 0; w < count; w++) {
    ROUTES.forEach((r) => list.push({ route: r, date: routeNextDate(r.id, w) }));
  }
  return list.sort((a, b) => a.date - b.date);
}
function dayName(date) {
  const d = parseDate(date);
  return d ? d.toLocaleDateString('es-AR', { weekday: 'long' }) : '';
}

/* ---------- state ---------- */
function blankState() {
  return {
    version: STATE_VERSION,
    user: null,
    role: 'buyer',
    producerId: null,
    buyer: { name: '', phone: '', city: 'Formosa Capital', address: '', favorites: [] },
    cart: [],
    orders: [],
    products: [],
    producers: [],
    training: { done: [], pitch: { hook: '', story: '', product: '', cta: '' } },
    settings: { notifyRoutes: true, notifyOffers: false },
    market: { q: '', cat: 'Todos', sort: 'relevance', onlyAvailable: false, onlyOrganic: false, onlyFav: false, maxPrice: 0, producerId: '' },
    offline: false,
    createdAt: Date.now()
  };
}

function hydrate(data) {
  const base = blankState();
  const user = data.user;
  base.user = user;
  base.role = user.role;
  base.producerId = user.producerId || null;
  base.buyer = {
    name: user.name || '',
    phone: user.phone || '',
    city: user.city || 'Formosa Capital',
    address: user.address || '',
    favorites: Array.isArray(data.favorites) ? data.favorites.slice() : []
  };
  base.orders = Array.isArray(data.orders) ? data.orders : [];
  base.products = Array.isArray(data.products) ? data.products : [];
  base.producers = Array.isArray(data.producers) ? data.producers : [];
  base.training = {
    done: (data.training && Array.isArray(data.training.done)) ? data.training.done.slice() : [],
    pitch: Object.assign({ hook: '', story: '', product: '', cta: '' }, (data.training && data.training.pitch) || {})
  };
  base.settings = Object.assign({ notifyRoutes: true, notifyOffers: false }, data.settings || {});
  const savedMarket = readJson('innovaagro.market', null);
  if (savedMarket && typeof savedMarket === 'object') base.market = Object.assign(base.market, savedMarket);
  db = base;
  db.cart = loadCart(user.id);
  lastUserId = user.id;
  try { localStorage.setItem('innovaagro.lastUser', user.id); } catch (_) {}
  save();
}

function setGuest() {
  db = blankState();
  save();
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) { return fallback; }
}

function loadCart(userId) {
  if (!userId) return [];
  const cart = readJson('innovaagro.cart.' + userId, []);
  if (!Array.isArray(cart)) return [];
  return cart
    .filter((line) => line && typeof line.productId === 'string' && Number(line.qty) > 0)
    .map((line) => ({ productId: line.productId, qty: Math.max(1, Math.min(50, Math.round(Number(line.qty)))) }));
}

function saveCart() {
  if (!db || !db.user) return;
  try { localStorage.setItem('innovaagro.cart.' + db.user.id, JSON.stringify(db.cart)); } catch (_) {}
}

function snapshotPayload() {
  return {
    version: STATE_VERSION,
    savedAt: new Date().toISOString(),
    config: { categories: CATEGORIES, cities: CITIES, routes: ROUTES, pickups: PICKUPS, features: FEATURES },
    db
  };
}

function save() {
  if (!db) return;
  try {
    if (!storageWarned) {
      localStorage.setItem('innovaagro.snapshot.v1', JSON.stringify(snapshotPayload()));
      if (db.user) {
        localStorage.setItem('innovaagro.lastUser', db.user.id);
        localStorage.setItem('innovaagro.market', JSON.stringify(db.market));
      }
    }
  } catch (err) {
    if (!storageWarned) {
      storageWarned = true;
      toast('El teléfono no tiene espacio para guardar la copia local. La app sigue funcionando con conexión.', true);
    }
  }
}

function loadSnapshot() {
  const saved = readJson('innovaagro.snapshot.v1', null);
  if (!saved || saved.version !== STATE_VERSION || !saved.db || !saved.db.user) return null;
  if (lastUserId && saved.db.user.id !== lastUserId) return null;
  applyConfig(saved.config || {});
  db = Object.assign(blankState(), saved.db);
  db.offline = true;
  db.cart = loadCart(db.user.id);
  return db;
}

function clearLocalData() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('innovaagro.')) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (_) {}
}

function logoutLocal() {
  db = blankState();
  lastUserId = '';
  try { localStorage.removeItem('innovaagro.snapshot.v1'); localStorage.removeItem('innovaagro.lastUser'); } catch (_) {}
  authMode = 'login';
  authError = '';
  authFields = {};
  go('#/welcome');
}

/* ---------- derived ---------- */
function productById(id) { return db && db.products ? db.products.find((p) => p.id === id) : null; }
function producerById(id) { return db && db.producers ? db.producers.find((p) => p.id === id) : null; }
function activeProducts() { return db && db.products ? db.products.filter((p) => p.active) : []; }
function producerProducts(producerId, includeInactive = false) {
  if (!db) return [];
  return db.products.filter((p) => p.producerId === producerId && (includeInactive || p.active));
}
function cartDetails() {
  if (!db) return [];
  return db.cart.map((line) => {
    const p = productById(line.productId);
    if (!p || !p.active) return null;
    const qty = Math.max(0, Math.min(Number(line.qty) || 0, p.stock));
    if (!qty) return null;
    return { ...line, qty, product: p, producer: producerById(p.producerId), line: p.price * qty };
  }).filter(Boolean);
}
function cartCount() { return cartDetails().reduce((sum, it) => sum + it.qty, 0); }
function cartSubtotal() { return cartDetails().reduce((sum, it) => sum + it.line, 0); }
function shippingFor(subtotal, mode) {
  if (mode === 'pickup') return 0;
  return subtotal >= FREE_SHIPPING ? 0 : SHIPPING;
}
function producerName(id) { const p = producerById(id); return p ? p.name : 'Productor'; }
function initials(name) {
  return String(name || 'IA').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function paymentLabel(method) {
  return {
    mercadopago: 'Mercado Pago', transferencia: 'Transferencia', efectivo: 'Efectivo al recibir',
    'Mercado Pago': 'Mercado Pago', 'Transferencia': 'Transferencia', 'Efectivo': 'Efectivo al recibir'
  }[method] || method || 'A coordinar';
}
function paymentStatusLabel(status) {
  return {
    pendiente: 'Pendiente', pagado: 'Pagado', rechazado: 'Rechazado',
    reembolsado: 'Reembolsado', contracargo: 'Contracargo'
  }[status] || status || 'Pendiente';
}
function paymentStatusClass(status) {
  if (status === 'pagado') return 'status-entregado';
  if (status === 'rechazado' || status === 'contracargo') return 'status-cancelado';
  if (status === 'reembolsado') return 'status-preparando';
  return 'status-nuevo';
}
function isAdmin() {
  return Boolean(db && db.user && db.user.isAdmin);
}
function orderInvoice(order, producerId) {
  return ((order && order.invoices) || []).find((inv) => inv.producerId === producerId) || null;
}
function canPayOnline(order) {
  return Boolean(order && order.payment === 'mercadopago' && FEATURES.payments.enabled &&
    order.paymentStatus !== 'pagado' && order.paymentStatus !== 'reembolsado' && order.paymentStatus !== 'contracargo');
}
function landingHash(user) {
  if (!user) return '#/welcome';
  if (user.isAdmin) return '#/admin';
  return user.role === 'producer' ? '#/panel' : '#/home';
}
function statusLabel(status) {
  return { nuevo: 'Nuevo', preparando: 'Preparando', en_ruta: 'En ruta', entregado: 'Entregado', cancelado: 'Cancelado' }[status] || status;
}
function statusOrder(order) {
  const states = Object.values(order.groups || {}).map((g) => g.status);
  if (!states.length) return 'nuevo';
  if (states.every((s) => s === 'entregado' || s === 'cancelado')) return states.some((s) => s === 'entregado') ? 'entregado' : 'cancelado';
  if (states.some((s) => s === 'en_ruta')) return 'en_ruta';
  if (states.some((s) => s === 'preparando')) return 'preparando';
  return 'nuevo';
}
function orderById(id) {
  if (db && db.orders) {
    const own = db.orders.find((o) => o.id === id);
    if (own) return own;
  }
  if (adminData && Array.isArray(adminData.orders)) return adminData.orders.find((o) => o.id === id) || null;
  return null;
}
function producerOrders(producerId) {
  if (!db) return [];
  return db.orders.filter((o) => (o.items || []).some((it) => it.producerId === producerId));
}
function orderGroupSubtotal(order, producerId) {
  return (order.items || []).filter((it) => it.producerId === producerId).reduce((sum, it) => sum + it.price * it.qty, 0);
}
function orderDeliveryText(order) {
  const d = order.delivery || {};
  if (d.mode === 'pickup') {
    const p = pickupById(d.pointId);
    return `${p.name} · ${p.address} · ${fmtLong(d.date)} · ${d.window || p.time}`;
  }
  return `Envío a domicilio · ${d.address || 'Dirección a coordinar'} · ${fmtLong(d.date)} · ${d.window || '14:00 a 19:00'}`;
}
function categoryCounts() {
  const counts = { Todos: activeProducts().length };
  CATEGORIES.forEach((cat) => { counts[cat] = activeProducts().filter((p) => p.category === cat).length; });
  return counts;
}
function courseById(id) { return COURSES.find((c) => c.id === id); }
function courseDone(course) {
  return (course.lessonsData || []).filter((l) => (db.training.done || []).includes(l.id)).length;
}
function totalCourseDone() {
  return COURSES.reduce((sum, c) => sum + courseDone(c), 0);
}
function totalLessons() {
  return COURSES.reduce((sum, c) => sum + c.lessonsData.length, 0);
}
function nextStatus(status) {
  const flow = ['nuevo', 'preparando', 'en_ruta', 'entregado'];
  const i = flow.indexOf(status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : status;
}
function cartProducerIds() {
  return [...new Set(cartDetails().map((it) => it.product.producerId))];
}
function ownProducer() {
  return db && db.role === 'producer' ? producerById(db.producerId) : null;
}
function isDemoCatalog() {
  return !!(db && db.producers && db.producers.some((p) => p.demo));
}

/* ---------- toast, forms, clipboard, speech ---------- */
function toast(message, isError = false) {
  const root = $('#toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' is-error' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon(isError ? 'info' : 'check', 'icon-sm')}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'opacity .2s, transform .2s';
    setTimeout(() => el.remove(), 220);
  }, 3600);
}

function showFieldErrors(form, fields = {}) {
  if (!form) return;
  form.querySelectorAll('[data-err]').forEach((el) => {
    const key = el.getAttribute('data-err');
    const message = fields[key];
    el.textContent = message || '';
    el.hidden = !message;
  });
  form.querySelectorAll('[name]').forEach((el) => {
    if (fields[el.name]) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  });
  const first = form.querySelector('[aria-invalid="true"]');
  if (first && first.focus) first.focus();
}

function clearFieldErrors(form) {
  showFieldErrors(form, {});
}

function setBusy(button, busy, label = 'Guardando…') {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `${icon('clock', 'icon-sm')} ${esc(label)}`;
  } else {
    button.disabled = false;
    if (button.dataset.label) {
      button.innerHTML = button.dataset.label;
      delete button.dataset.label;
    }
  }
}

async function copyText(text, message = 'Copiado') {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
    return true;
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast(message); } catch (e) { toast('No se pudo copiar. Seleccioná el texto manualmente.', true); }
    ta.remove();
    return false;
  }
}
function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    speechUtterance = null;
  }
}
function speak(text) {
  if (!('speechSynthesis' in window)) { toast('Este navegador no tiene voz disponible.', true); return; }
  stopSpeech();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-AR';
  u.rate = 0.95;
  const voice = window.speechSynthesis.getVoices().find((v) => /es[-_]/i.test(v.lang));
  if (voice) u.voice = voice;
  u.onend = () => { speechUtterance = null; };
  speechUtterance = u;
  window.speechSynthesis.speak(u);
  toast('Cápsula en audio. Podés detenerla desde el mismo botón.');
}

/* ---------- whatsapp / share / calendar ---------- */
function whatsappHref(phone, text) {
  const clean = digits(phone);
  const base = clean.length >= 8 ? `https://wa.me/${clean}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}
function openWhatsApp(phone, text) {
  const url = whatsappHref(phone, text);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) location.href = url;
}
function producerContactMessage(producer, product) {
  return `Hola ${producer.owner}, te escribo desde InnovaAgro-App. Vi ${product ? `«${product.name}»` : `el perfil de ${producer.name}`} y quiero consultar por disponibilidad, precio y entrega. ¿Me contás?`;
}
function orderMessage(order, producerId) {
  const producer = producerById(producerId) || { owner: 'productor', name: 'productor' };
  const items = (order.items || []).filter((it) => it.producerId === producerId);
  const lines = items.map((it) => `• ${it.qty} ${it.unit} de ${it.name} — ${money(it.price * it.qty)}`).join('\n');
  const delivery = order.delivery.mode === 'pickup'
    ? `Retiro en ${pickupById(order.delivery.pointId).name} (${fmtLong(order.delivery.date)}, ${order.delivery.window})`
    : `Envío a ${order.delivery.address} (${fmtLong(order.delivery.date)}, ${order.delivery.window})`;
  return `Hola ${producer.owner}, soy ${order.buyer.name || 'un cliente'}. Hice el pedido ${order.code} en InnovaAgro-App:\n\n${lines}\n\nSubtotal: ${money(orderGroupSubtotal(order, producerId))}\nEntrega: ${delivery}\nPago: ${paymentLabel(order.payment)}\n\n¿Me confirmás disponibilidad y forma de pago? Gracias.`;
}
function buyerOrderMessage(order) {
  return `Hola, soy ${order.buyer.name || 'un cliente'}. Consulto por el pedido ${order.code} de InnovaAgro-App. Entrega: ${orderDeliveryText(order)}. Total: ${money(order.total)}.`;
}
async function shareOrder(order) {
  const text = `Mi pedido en InnovaAgro-App: ${order.code} · ${money(order.total)} · ${orderDeliveryText(order)}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Pedido InnovaAgro-App', text }); return; } catch (err) {}
  }
  copyText(text, 'Pedido copiado para compartir');
}
function downloadICS(order) {
  const date = parseDate(order.delivery.date) || new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const start = `${y}${m}${d}T090000`;
  const end = `${y}${m}${d}T100000`;
  const point = pickupById(order.delivery.pointId);
  const location = order.delivery.mode === 'pickup' ? `${point.name}, ${point.address}` : order.delivery.address;
  const desc = `Pedido ${order.code} en InnovaAgro-App. ${order.items.map((it) => `${it.qty} ${it.unit} ${it.name}`).join(', ')}.`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//InnovaAgro-App//Formosa//ES', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${order.id}@innovaagro.app`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:Entrega InnovaAgro ${order.code}`, `LOCATION:${location.replace(/\n/g, ' ')}`,
    `DESCRIPTION:${desc.replace(/\n/g, ' ')}`, 'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `innovaagro-${order.code}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Calendario descargado');
}

/* ---------- UI atoms ---------- */
function seal(producer, size = 54, extra = '') {
  if (!producer) return '';
  const id = 'sealpath' + (++sealSeq);
  const place = (producer.place || 'Formosa').toUpperCase();
  return `<span class="seal ${extra}" style="width:${size}px;height:${size}px;color:${producer.accent || 'var(--copper)'}" title="Sello de origen: ${esc(producer.name)} · ${esc(producer.place)}">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs><path id="${id}" d="M 15 54 A 35 35 0 0 1 85 54"></path></defs>
      <circle cx="50" cy="50" r="47" fill="var(--paper)" stroke="currentColor" stroke-width="1.7"></circle>
      <circle cx="50" cy="50" r="40.2" fill="none" stroke="currentColor" stroke-width=".7" stroke-dasharray="1.2 2.4"></circle>
      <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" stroke-width=".45" opacity=".55"></circle>
      <text class="seal-ring-text"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(place)} · FORMOSA</textPath></text>
    </svg>
    <span class="seal-initials" style="font-size:${Math.max(9, Math.round(size * 0.26))}px">${esc(producer.initials || initials(producer.name))}</span>
  </span>`;
}
function tag(text, cls = '') { return `<span class="tag ${cls}">${esc(text)}</span>`; }
function statusBadge(status) {
  return `<span class="status status-${esc(status)}"><span class="status-dot"></span>${esc(statusLabel(status))}</span>`;
}
function price(value) { return `<span class="price">${money(value)}</span>`; }
function emptyState(iconName, title, text, action = '') {
  return `<div class="empty-state">${icon(iconName, 'icon-lg')}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}
function stockNote(product) {
  if (product.stock <= 0) return `<span class="stock-out">Agotado por ahora</span>`;
  if (product.stock <= 4) return `<span class="stock-note">Últimas ${product.stock} unidades</span>`;
  return '';
}
function productCard(product) {
  const p = producerById(product.producerId) || { name: 'Formosa', demo: false };
  const isFav = (db.buyer.favorites || []).includes(product.id);
  const soldOut = product.stock <= 0;
  return `<article class="product-card">
    <div class="product-media">
      <a href="#/product/${product.id}" aria-label="Ver ${esc(product.name)}">
        <img src="${photoSrc(product.photo)}" alt="${esc(product.name)} de ${esc(p.name)}" loading="lazy">
      </a>
      ${soldOut ? tag('Agotado', 'tag-danger') : tag(product.available === 'Esta semana' ? 'De la semana' : product.season, 'tag-sun')}
      <button class="fav-btn ${isFav ? 'is-on' : ''}" data-action="toggle-fav" data-id="${product.id}" aria-label="${isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}" aria-pressed="${isFav}">
        ${icon('heart')}
      </button>
      <span class="lot">${esc(product.lot)}</span>
    </div>
    <div class="product-body">
      <div class="producer-line">${icon('pin', 'icon-sm')}<span>${esc(p.name)}</span>${p.demo ? '<span class="demo-pill">Ejemplo</span>' : ''}</div>
      <h3 class="product-name"><a href="#/product/${product.id}">${esc(product.name)}</a></h3>
      <div class="product-meta">${esc(product.unit)} · ${esc(product.season)}</div>
      ${stockNote(product)}
      <div class="price-row">
        <div class="price">${money(product.price)} <small>/ ${esc(product.unit)}</small></div>
        <button class="add-btn" data-action="add-cart" data-id="${product.id}" aria-label="Agregar ${esc(product.name)} al carrito" ${soldOut ? 'disabled' : ''}>${icon('plus')}</button>
      </div>
    </div>
  </article>`;
}
function courseGridCard(course) {
  const done = courseDone(course);
  const pct = Math.round((done / course.lessonsData.length) * 100);
  return `<a class="course-card" href="#/learn/${course.id}">
    <div class="course-media"><img src="${photoSrc(course.photo)}" alt="" loading="lazy">${tag(course.category, 'tag-copper')}</div>
    <div class="course-body">
      <h3>${esc(course.title)}</h3>
      <p>${esc(course.summary)}</p>
      <div class="progress-bar" aria-label="Progreso ${pct}%"><i style="width:${pct}%"></i></div>
      <div class="course-foot"><span>${course.lessons} clases · ${esc(course.duration)}</span><span>${done ? pct + '%' : 'Empezar'}</span></div>
    </div>
  </a>`;
}
function courseRowCard(course) {
  const done = courseDone(course);
  const pct = Math.round((done / course.lessonsData.length) * 100);
  return `<a class="course-row" href="#/learn/${course.id}">
    <div class="course-row-media"><img src="${photoSrc(course.photo)}" alt="" loading="lazy"></div>
    <div class="course-row-body">
      <div class="flex between center gap-8">${tag(course.category, 'tag-copper')}<span class="tiny muted">${esc(course.level)}</span></div>
      <h3>${esc(course.title)}</h3>
      <p>${esc(course.summary)}</p>
      <div class="progress-bar" aria-label="Progreso ${pct}%"><i style="width:${pct}%"></i></div>
      <div class="course-row-foot"><span>${course.lessons} clases · ${esc(course.duration)}</span><span>${done ? pct + '% completado' : 'Empezar'}</span></div>
    </div>
  </a>`;
}
function routeCard(route, highlight = false) {
  const next = routeNextDate(route.id);
  return `<article class="route-card ${highlight ? 'is-highlight' : ''}" id="route-${route.id}" data-route-card="${route.id}">
    <div class="route-day"><span class="mono-label">Sale</span><strong>${esc(route.dayLabel)}</strong><span>${fmtShort(next)}</span></div>
    <div>
      <h3>${esc(route.name)}</h3>
      <p>${esc(route.zone)}</p>
      <div class="route-stops">${(route.stops || []).map((s) => `<span>${esc(s)}</span>`).join('')}</div>
      <p>${esc(route.note)}</p>
    </div>
    <div class="route-card-side">
      <div class="cutoff">Cierre de pedidos<strong>${esc(route.cutoff)}</strong></div>
      <a class="btn btn-sm btn-white" href="#/routes">Ver paradas</a>
    </div>
  </article>`;
}

/* ---------- chrome ---------- */
function buyerNav() {
  return [
    ['home', 'Inicio', 'home'],
    ['market', 'Mercado', 'market'],
    ['routes', 'Entregas', 'route'],
    ['learn', 'Aprender', 'book'],
    ['profile', 'Perfil', 'user']
  ];
}
function producerNav() {
  return [
    ['panel', 'Panel', 'home'],
    ['panel/products', 'Productos', 'market'],
    ['panel/orders', 'Pedidos', 'bag'],
    ['learn', 'Aprender', 'book'],
    ['profile', 'Perfil', 'user']
  ];
}
function adminNav() {
  return [
    ['admin', 'Admin', 'shield'],
    ['admin/users', 'Cuentas', 'user'],
    ['admin/orders', 'Pedidos', 'bag'],
    ['market', 'Mercado', 'market'],
    ['profile', 'Perfil', 'user']
  ];
}
function activeKey(parts) {
  const page = parts[0] || 'home';
  if (isAdmin()) {
    if (page === 'admin' && parts[1] === 'users') return 'admin/users';
    if (page === 'admin' && parts[1] === 'orders') return 'admin/orders';
    if (page === 'admin') return 'admin';
    if (page === 'market' || page === 'product' || page === 'producer' || page === 'cart' || page === 'checkout') return 'market';
    if (page === 'profile' || page === 'orders' || page === 'order' || page === 'publish' || page === 'about') return 'profile';
    return page;
  }
  if (db.role === 'producer') {
    if (page === 'panel' && parts[1] === 'products') return 'panel/products';
    if (page === 'panel' && parts[1] === 'orders') return 'panel/orders';
    if (page === 'panel') return 'panel';
    if (page === 'learn' || page === 'pitch') return 'learn';
    if (page === 'profile' || page === 'orders' || page === 'order') return 'profile';
    if (page === 'market' || page === 'product' || page === 'producer') return 'market';
    if (page === 'routes') return 'routes';
    return page;
  }
  if (page === 'market' || page === 'product' || page === 'producer' || page === 'cart' || page === 'checkout') return 'market';
  if (page === 'routes') return 'routes';
  if (page === 'learn' || page === 'pitch') return 'learn';
  if (page === 'profile' || page === 'orders' || page === 'order' || page === 'publish' || page === 'about') return 'profile';
  return 'home';
}
function updateChrome(parts = []) {
  if (!db) return;
  const nav = isAdmin() ? adminNav() : (db.role === 'producer' ? producerNav() : buyerNav());
  const active = activeKey(parts);
  const desk = $('#desk-nav');
  if (desk) {
    desk.innerHTML = nav.slice(0, 4).map(([href, label]) => `<a href="#/${href}" class="${active === href ? 'is-active' : ''}" ${active === href ? 'aria-current="page"' : ''}>${label}</a>`).join('') +
      (db.role === 'producer' && !isAdmin() ? `<a href="#/producer/${db.producerId}" class="${active === 'producer' ? 'is-active' : ''}">Mi tienda</a>` : '');
  }
  const tabs = $('#tabbar-inner');
  if (tabs) {
    tabs.innerHTML = nav.map(([href, label, ic]) => `<a class="tab ${active === href ? 'is-active' : ''}" href="#/${href}" ${active === href ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('');
  }
  const cartEl = $('#cart-count');
  if (cartEl) {
    const n = cartCount();
    cartEl.textContent = n > 99 ? '99+' : String(n);
    cartEl.hidden = n === 0;
    const cartLink = cartEl.closest('a');
    if (cartLink) {
      cartLink.setAttribute('aria-label', n > 0
        ? `Mi canasta, ${n} ${n === 1 ? 'producto' : 'productos'}`
        : 'Mi canasta, vacía');
    }
  }
  const avatar = $('#avatar-btn');
  if (avatar) {
    const label = isAdmin()
      ? initials(db.user.name || 'Administración')
      : (db.role === 'producer'
        ? ((producerById(db.producerId) || {}).initials || 'PD')
        : initials(db.buyer.name || 'Innova Agro'));
    avatar.textContent = label;
    avatar.setAttribute('aria-label', `${isAdmin() ? 'Panel de administración' : db.role === 'producer' ? 'Panel del productor' : 'Mi perfil'}, ${label}`);
    avatar.setAttribute('href', isAdmin() ? '#/admin' : '#/profile');
  }
  const offline = $('#offline-strip');
  if (offline) offline.hidden = navigator.onLine && !db.offline;
  const year = $('#footer-year');
  if (year) year.textContent = String(new Date().getFullYear());
  const loc = $('#loc-label');
  if (loc) {
    loc.textContent = db.buyer.city || 'Formosa Capital';
    const locLink = loc.closest('a');
    if (locLink) locLink.setAttribute('aria-label', `${loc.textContent}: ver rutas y puntos de retiro`);
  }
  document.body.dataset.role = db.role;
}

/* ---------- navigation ---------- */
function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}
function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const path = raw.split('?')[0];
  const parts = path.split('/').filter(Boolean);
  return { parts, page: parts[0] || '', param: parts[1] || '', query: raw.split('?')[1] || '' };
}
function render() {
  if (!db) return;
  const route = parseRoute();
  let page = route.page;
  let param = route.param;
  if (!page) page = db.user ? (isAdmin() ? 'admin' : db.role === 'producer' ? 'panel' : 'home') : 'welcome';

  const guestPages = ['welcome', 'verify', 'reset', 'forgot'];
  if (db.user && page === 'welcome') { go(landingHash(db.user)); return; }
  if (!db.user && !guestPages.includes(page)) { go('#/welcome'); return; }
  if (!db.user && page === 'welcome') {
    stopSpeech();
    $('#view').innerHTML = viewWelcome();
    document.body.classList.add('welcome-mode');
    document.body.classList.remove('has-detail-bar');
    document.body.dataset.role = 'guest';
    document.body.dataset.admin = 'false';
    document.title = 'InnovaAgro-App · Tecnología & Naturaleza';
    updateChrome([]);
    afterRender('welcome');
    return;
  }
  if (page === 'verify' || page === 'reset' || page === 'forgot') {
    stopSpeech();
    $('#view').innerHTML = page === 'verify' ? viewVerify(param) : page === 'reset' ? viewReset(param) : viewForgot();
    document.body.classList.add('welcome-mode');
    document.body.classList.remove('has-detail-bar');
    document.body.dataset.role = db.user ? db.role : 'guest';
    document.body.dataset.admin = isAdmin() ? 'true' : 'false';
    document.title = pageTitle(page, param);
    updateChrome([]);
    afterRender(page, param);
    return;
  }
  if (page.startsWith('admin') && !isAdmin()) { go(db.user ? '#/home' : '#/welcome'); return; }

  if (page === 'panel') {
    const sub = route.parts[1];
    if (sub === 'products') page = 'panel/products';
    else if (sub === 'orders') page = 'panel/orders';
    else if (sub === 'profile') page = 'panel/profile';
    else if (sub === 'product') { page = 'panel/product'; param = route.parts[2] || 'new'; }
  }
  if (page === 'admin') {
    const sub = route.parts[1];
    if (sub === 'users') page = 'admin/users';
    else if (sub === 'orders') page = 'admin/orders';
  }
  if (page === 'learn' && route.parts[1]) { page = 'course'; param = route.parts[1]; }
  if (db.role === 'producer' && !isAdmin() && page === 'home') { go('#/panel'); return; }

  stopSpeech();
  const detailPages = ['product'];
  document.body.classList.toggle('welcome-mode', false);
  document.body.classList.toggle('has-detail-bar', detailPages.includes(page));
  document.body.dataset.admin = isAdmin() ? 'true' : 'false';
  if (page === 'product') {
    const key = location.hash;
    if (key !== lastRouteKey) detailQty = 1;
  }
  lastRouteKey = location.hash;

  let html = '';
  switch (page) {
    case 'welcome': html = viewWelcome(); break;
    case 'home': html = viewHome(); break;
    case 'market': html = viewMarket(); break;
    case 'product': html = viewProduct(param); break;
    case 'producer': html = viewProducer(param); break;
    case 'cart': html = viewCart(); break;
    case 'checkout': html = viewCheckout(); break;
    case 'order': html = viewOrder(param); break;
    case 'orders': html = viewOrders(); break;
    case 'routes': html = viewRoutes(); break;
    case 'learn': html = viewLearn(); break;
    case 'course': html = viewCourse(param); break;
    case 'pitch': html = viewPitch(); break;
    case 'profile': html = viewProfile(); break;
    case 'publish': html = viewPublish(); break;
    case 'about': html = viewAbout(); break;
    case 'panel': html = viewPanel(); break;
    case 'panel/products': html = viewPanelProducts(); break;
    case 'panel/product': html = viewPanelProduct(param); break;
    case 'panel/orders': html = viewPanelOrders(); break;
    case 'panel/profile': html = viewPanelProfile(); break;
    case 'admin':
    case 'admin/users':
    case 'admin/orders': html = viewAdmin(page); break;
    default: html = viewNotFound(); break;
  }
  const view = $('#view');
  view.innerHTML = html;
  updateChrome(route.parts);
  document.title = pageTitle(page, param);
  window.scrollTo(0, 0);
  afterRender(page, param, route.query);
}
function pageTitle(page, param) {
  const names = {
    welcome: 'Bienvenida', home: 'Inicio', market: 'Mercado', cart: 'Canasta', checkout: 'Finalizar pedido',
    orders: 'Mis pedidos', routes: 'Entregas', learn: 'Aprender', pitch: 'Constructor de pitch', profile: 'Mi perfil',
    publish: 'Publicar la app', about: 'Acerca de', panel: 'Panel del productor', 'panel/products': 'Productos',
    'panel/orders': 'Pedidos', 'panel/profile': 'Perfil del productor', 'panel/product': 'Producto',
    verify: 'Verificar correo', reset: 'Nueva contraseña', forgot: 'Recuperar contraseña',
    admin: 'Administración', 'admin/users': 'Cuentas', 'admin/orders': 'Pedidos y pagos'
  };
  if (page === 'product') return (productById(param) || {}).name || 'Producto';
  if (page === 'producer') return (producerById(param) || {}).name || 'Productor';
  if (page === 'order') return 'Pedido';
  if (page === 'course') return ((COURSES.find((c) => c.id === param) || {}).title || 'Cápsula') + ' · InnovaAgro-App';
  return `${names[page] || 'InnovaAgro'} · InnovaAgro-App`;
}
function afterRender(page, param, query = '') {
  if (marketFocusPending) {
    marketFocusPending = false;
    const input = $('#market-search');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }
  if (page === 'checkout' && checkoutErrors && Object.keys(checkoutErrors).length) {
    const first = $('[aria-invalid="true"]');
    if (first) first.focus();
  }
  if (page === 'panel/profile' && !ownProducer()) {
    const view = $('#view');
    if (view) view.innerHTML = emptyState('store', 'Necesitás una cuenta de productor', 'Para editar un perfil público tenés que ingresar con una cuenta de productor.', '<a class="btn btn-primary" href="#/panel">Volver al panel</a>');
  }
  if (page === 'verify') verifyEmailFromRoute(param);
  if (page === 'profile') refreshPushState();
  if (page === 'admin' || page === 'admin/users' || page === 'admin/orders') loadAdminDashboard();
  if (page === 'order' && query && /payment=/.test(query)) refreshOrderAfterPayment(param, query);
}

/* ---------- filters ---------- */
function filteredProducts() {
  const m = db.market;
  let list = activeProducts().slice();
  const q = String(m.q || '').trim().toLowerCase();
  if (q) {
    list = list.filter((p) => {
      const prod = producerById(p.producerId) || {};
      return [p.name, p.category, p.short, p.description, p.lot, prod.name, prod.place, ...(p.highlights || [])]
        .join(' ').toLowerCase().includes(q);
    });
  }
  if (m.cat && m.cat !== 'Todos') list = list.filter((p) => p.category === m.cat);
  if (m.producerId) list = list.filter((p) => p.producerId === m.producerId);
  if (m.maxPrice > 0) list = list.filter((p) => p.price <= m.maxPrice);
  if (m.onlyAvailable) list = list.filter((p) => p.stock > 0);
  if (m.onlyOrganic) list = list.filter((p) => p.organic);
  if (m.onlyFav) list = list.filter((p) => (db.buyer.favorites || []).includes(p.id));
  if (m.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (m.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (m.sort === 'producer') list.sort((a, b) => producerName(a.producerId).localeCompare(producerName(b.producerId), 'es'));
  else list.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name, 'es'));
  return list;
}
function activeFilterCount() {
  const m = db.market;
  let n = 0;
  if (m.cat && m.cat !== 'Todos') n++;
  if (m.producerId) n++;
  if (m.maxPrice > 0) n++;
  if (m.onlyAvailable) n++;
  if (m.onlyOrganic) n++;
  if (m.onlyFav) n++;
  return n;
}
