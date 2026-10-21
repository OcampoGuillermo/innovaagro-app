'use strict';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

function assert(condition, message) {
  if (!condition) throw new Error('FALLO: ' + message);
  console.log('ok · ' + message);
}

async function request(path, { method = 'GET', body, cookie } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual'
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  const session = setCookies.map((value) => value.split(';')[0]).find((value) => value.startsWith('ia_session=')) || null;
  return { status: response.status, data, session };
}

async function login(email, password = 'demo1234') {
  const response = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  assert(response.status === 200, `login ${email}`);
  assert(response.session, `cookie de sesión ${email}`);
  return response.session;
}

(async () => {
  const health = await request('/api/health');
  assert(health.status === 200 && health.data.ok, 'health responde');
  const guest = await request('/api/bootstrap');
  assert(guest.status === 200 && guest.data.user === null, 'bootstrap de invitado');
  assert(guest.data.products.length === 0, 'invitado no recibe catálogo');

  const buyer = await login('demo@innovaagro.app');
  const buyerBoot = await request('/api/bootstrap', { cookie: buyer });
  assert(buyerBoot.status === 200, 'bootstrap de comprador');
  assert(buyerBoot.data.products.length === 23, 'catálogo inicial de 23 productos');
  assert(buyerBoot.data.producers.length === 9, '9 productores iniciales');
  assert(buyerBoot.data.orders.length === 7, '7 pedidos iniciales');
  assert(buyerBoot.data.orders.every((order) => order.demo), 'pedidos iniciales marcados demo');
  assert(buyerBoot.data.products.every((product) => product.demo), 'productos iniciales marcados demo');

  const camino = buyerBoot.data.products.find((product) => product.id === 'camino');
  assert(camino && camino.stock === 5, 'stock inicial de camino');
  const pickup = buyerBoot.data.config.pickups[0];
  assert(pickup && pickup.id, 'punto de retiro disponible');

  const created = await request('/api/orders', {
    method: 'POST',
    cookie: buyer,
    body: {
      items: [{ productId: 'camino', qty: 1 }],
      name: 'Prueba de humo',
      phone: '3704000000',
      city: 'Formosa Capital',
      mode: 'pickup',
      pointId: pickup.id,
      payment: 'efectivo'
    }
  });
  assert(created.status === 201, 'pedido real creado');
  assert(created.data.order.demo === false, 'pedido nuevo queda demo=0');
  const orderId = created.data.order.id;

  const afterOrder = await request('/api/bootstrap', { cookie: buyer });
  assert(afterOrder.data.products.find((product) => product.id === 'camino').stock === 4, 'stock descontado al confirmar');

  const producer = await login('artesanas@innovaagro.app');
  const producerBoot = await request('/api/bootstrap', { cookie: producer });
  const visible = producerBoot.data.orders.find((order) => order.id === orderId);
  assert(visible && visible.groups.p6.status === 'nuevo', 'pedido visible en el panel del productor');
  const cancelled = await request(`/api/orders/${orderId}/groups/p6`, {
    method: 'PATCH',
    cookie: producer,
    body: { status: 'cancelado' }
  });
  assert(cancelled.status === 200, 'productor cancela su grupo');
  assert(cancelled.data.order.groups.p6.status === 'cancelado', 'estado cancelado aplicado');

  const afterCancel = await request('/api/bootstrap', { cookie: buyer });
  assert(afterCancel.data.products.find((product) => product.id === 'camino').stock === 5, 'stock repuesto al cancelar');

  const finca = await login('finca@innovaagro.app');
  const productCreated = await request('/api/products', {
    method: 'POST',
    cookie: finca,
    body: {
      name: 'Producto de prueba de humo',
      category: 'Miel',
      price: 1500,
      unit: '1 u',
      stock: 3,
      photo: 'miel',
      lot: 'SMOKE-1',
      short: 'Producto temporal para verificar la API.',
      description: 'Producto temporal creado por la prueba automática.'
    }
  });
  assert(productCreated.status === 201, 'producto creado por productor');
  assert(productCreated.data.product.demo === false, 'producto nuevo queda demo=0');

  console.log('\nSmoke test OK. Reiniciá el servidor para verificar que los datos nuevos sigan en demo=0.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
