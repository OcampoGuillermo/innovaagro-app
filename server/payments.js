'use strict';

const crypto = require('node:crypto');
const config = require('./config');

const MP_API = 'https://api.mercadopago.com';

class PaymentError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function enabled() {
  return Boolean(config.payments.accessToken && config.payments.webhookSecret && /^https:\/\//i.test(config.payments.publicUrl));
}

async function mpFetch(pathname, options = {}) {
  if (!config.payments.accessToken) throw new PaymentError('Mercado Pago no está configurado.', 503);
  let response;
  try {
    response = await fetch(MP_API + pathname, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.payments.accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw new PaymentError('No pudimos comunicarnos con Mercado Pago. Intentá de nuevo en unos minutos.', 502);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data && (data.message || data.error || data.cause);
    console.error('Mercado Pago respondió con error:', response.status, typeof detail === 'string' ? detail : JSON.stringify(detail || {}));
    throw new PaymentError('Mercado Pago no aceptó la operación. Revisá la configuración de la cuenta.', 502);
  }
  return data;
}

async function createPreference(order, user, existingUrl = '') {
  if (!enabled()) throw new PaymentError('El pago online no está habilitado en este servidor.', 503);
  const items = order.items.map((item) => ({
    id: item.productId,
    title: item.name.slice(0, 120),
    description: `Lote de ${item.producerId} · ${item.unit}`,
    quantity: item.qty,
    currency_id: 'ARS',
    unit_price: Number(item.price)
  }));
  if (order.shipping > 0) {
    items.push({
      id: 'envio',
      title: 'Envío a domicilio',
      description: 'Entrega en la próxima ruta',
      quantity: 1,
      currency_id: 'ARS',
      unit_price: Number(order.shipping)
    });
  }
  const base = config.payments.publicUrl;
  const body = {
    items,
    payer: {
      name: order.buyer.name,
      email: user.email
    },
    external_reference: order.id,
    statement_descriptor: 'INNOVAAGRO',
    notification_url: `${base}/api/payments/webhook`,
    back_urls: {
      success: `${base}/pago/retorno?order=${encodeURIComponent(order.id)}&result=success`,
      failure: `${base}/pago/retorno?order=${encodeURIComponent(order.id)}&result=failure`,
      pending: `${base}/pago/retorno?order=${encodeURIComponent(order.id)}&result=pending`
    },
    auto_return: 'approved',
    binary_mode: false,
    metadata: {
      order_id: order.id,
      order_code: order.code
    }
  };
  if (order.buyer.phone) {
    body.payer.phone = { area_code: '', number: String(order.buyer.phone).replace(/[^\d]/g, '').slice(-15) };
  }
  const preference = await mpFetch('/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `order-${order.id}` },
    body: JSON.stringify(body)
  });
  return {
    id: preference.id,
    initPoint: preference.init_point || existingUrl,
    sandboxInitPoint: preference.sandbox_init_point || '',
    preference
  };
}

async function getPayment(paymentId) {
  const id = String(paymentId || '').replace(/[^\d]/g, '');
  if (!id) throw new PaymentError('Pago inválido.', 400);
  return mpFetch(`/v1/payments/${id}`);
}

function verifySignature(req) {
  const secret = config.payments.webhookSecret;
  if (!secret) return false;
  const signature = String(req.get('x-signature') || '');
  const requestId = String(req.get('x-request-id') || '');
  const body = req.body || {};
  const dataId = String((req.query && req.query['data.id']) || (body.data && body.data.id) || '').trim();
  if (!signature || !dataId) return false;
  const parts = {};
  signature.split(',').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    parts[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const received = String(parts.v1).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

function isPaymentNotification(req) {
  const body = req.body || {};
  const type = String((req.query && req.query.type) || body.type || '').toLowerCase();
  return type === 'payment' || type === 'payments';
}

function paymentIdFrom(req) {
  const body = req.body || {};
  return String((req.query && req.query['data.id']) || (body.data && body.data.id) || '').replace(/[^\d]/g, '');
}

function mapStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'approved') return 'pagado';
  if (value === 'refunded') return 'reembolsado';
  if (value === 'charged_back') return 'contracargo';
  if (['rejected', 'cancelled'].includes(value)) return 'rechazado';
  if (['pending', 'in_process', 'authorized'].includes(value)) return 'pendiente';
  return 'pendiente';
}

module.exports = {
  enabled,
  createPreference,
  getPayment,
  verifySignature,
  isPaymentNotification,
  paymentIdFrom,
  mapStatus,
  PaymentError
};
