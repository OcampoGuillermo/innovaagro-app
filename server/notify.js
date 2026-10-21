'use strict';

const { getDb } = require('./state');
const push = require('./push');

const STATUS_TEXT = {
  nuevo: 'Nuevo',
  preparando: 'En preparación',
  en_ruta: 'En ruta',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

async function safePush(userId, payload) {
  try {
    return await push.sendToUser(userId, payload);
  } catch (error) {
    console.error('Notificación push:', error.message);
    return { sent: 0, total: 0 };
  }
}

function notifyNewOrder(order) {
  const db = getDb();
  const producerIds = [...new Set((order.items || []).map((item) => item.producerId))];
  producerIds.forEach((producerId) => {
    const users = db.prepare('SELECT id FROM users WHERE producer_id = ? AND suspended = 0').all(producerId);
    users.forEach((user) => {
      safePush(user.id, {
        title: 'Nuevo pedido en InnovaAgro',
        body: `${order.buyer.name} hizo el pedido ${order.code}. Revisá tu parte y confirmá.`,
        url: '/#/panel/orders',
        tag: `order-${order.id}`
      });
    });
  });
}

function notifyOrderStatus(order, producerId, status) {
  const db = getDb();
  const producer = db.prepare('SELECT name FROM producers WHERE id = ?').get(producerId) || { name: 'Un productor' };
  safePush(order.user_id, {
    title: `Pedido ${order.code}: ${STATUS_TEXT[status] || status}`,
    body: `${producer.name} actualizó el estado de tu pedido.`,
    url: `/#/order/${order.id}`,
    tag: `order-${order.id}`
  });
}

function notifyPayment(order, status) {
  const titles = {
    pagado: `Pago aprobado · ${order.code}`,
    rechazado: `Pago rechazado · ${order.code}`,
    reembolsado: `Pago reembolsado · ${order.code}`,
    contracargo: `Pago en revisión · ${order.code}`,
    pendiente: `Pago pendiente · ${order.code}`
  };
  safePush(order.user_id, {
    title: titles[status] || `Actualización de pago · ${order.code}`,
    body: status === 'pagado'
      ? 'Mercado Pago confirmó el cobro. Ya podés descargar el comprobante desde tu pedido.'
      : status === 'rechazado'
        ? 'El pago no se completó. Podés intentarlo de nuevo desde el pedido.'
        : 'El estado del pago cambió. Revisá el detalle de tu pedido.',
    url: `/#/order/${order.id}`,
    tag: `payment-${order.id}`
  });
}

module.exports = { notifyNewOrder, notifyOrderStatus, notifyPayment };
