'use strict';

const crypto = require('node:crypto');
const PDFDocument = require('pdfkit');
const config = require('./config');
const { getDb } = require('./state');
const { transaction } = require('./db');

function money(value) {
  return '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0));
}

function invoiceOut(row, items) {
  if (!row) return null;
  const parsed = items || (() => {
    try { return JSON.parse(row.items); } catch (_) { return []; }
  })();
  return {
    id: row.id,
    number: row.number,
    orderId: row.order_id,
    producerId: row.producer_id,
    buyerUserId: row.buyer_user_id,
    buyerName: row.buyer_name,
    buyerEmail: row.buyer_email,
    buyerTaxId: row.buyer_tax_id,
    sellerName: row.seller_name,
    sellerOwner: row.seller_owner,
    sellerTaxId: row.seller_tax_id,
    sellerAddress: row.seller_address,
    sellerPhone: row.seller_phone,
    items: parsed,
    subtotal: row.subtotal,
    shipping: row.shipping,
    total: row.total,
    currency: row.currency,
    status: row.status,
    note: row.note,
    fiscal: !!row.fiscal,
    issuedBy: row.issued_by,
    issuedAt: row.issued_at,
    pdfUrl: `/api/invoices/${row.id}.pdf`
  };
}

function nextInvoiceNumber(year) {
  const db = getDb();
  const key = `invoice_seq_${year}`;
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  const next = row ? Number(row.value) + 1 : 1;
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(next));
  return `${config.store.invoicePrefix}-${year}-${String(next).padStart(5, '0')}`;
}

function issueInvoice(orderId, producerId, issuedBy = 'sistema') {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 'Pedido no encontrado.', status: 404 };
  const group = db.prepare('SELECT * FROM order_groups WHERE order_id = ? AND producer_id = ?').get(orderId, producerId);
  if (!group) return { error: 'El pedido no pertenece a ese productor.', status: 404 };
  if (group.status === 'cancelado') return { error: 'No se puede emitir un comprobante de una parte cancelada.', status: 409 };
  const existing = db.prepare('SELECT * FROM invoices WHERE order_id = ? AND producer_id = ?').get(orderId, producerId);
  if (existing) return { invoice: invoiceOut(existing, null), existing: true };
  const producer = db.prepare('SELECT * FROM producers WHERE id = ?').get(producerId) || {};
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? AND producer_id = ? ORDER BY id').all(orderId, producerId);
  if (!items.length) return { error: 'No hay productos para comprobante.', status: 409 };
  const buyer = db.prepare('SELECT email FROM users WHERE id = ?').get(order.user_id) || {};
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const year = new Date().getFullYear();
  const id = 'inv-' + crypto.randomUUID();

  const row = transaction(() => {
    const number = nextInvoiceNumber(year);
    db.prepare(`
      INSERT INTO invoices
      (id, number, order_id, producer_id, buyer_user_id, buyer_name, buyer_email, buyer_tax_id,
       seller_name, seller_owner, seller_tax_id, seller_address, seller_phone,
       subtotal, shipping, total, currency, items, status, note, fiscal, issued_by, issued_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'ARS', ?, 'emitida', ?, 0, ?, ?)
    `).run(
      id, number, orderId, producerId, order.user_id, order.buyer_name, buyer.email || '', order.buyer_tax_id || '',
      producer.name || 'Productor', producer.owner || '', producer.tax_id || '',
      [producer.place, producer.zone].filter(Boolean).join(', ') || 'Formosa, Argentina', producer.whatsapp || '',
      subtotal, subtotal, JSON.stringify(items.map((item) => ({
        name: item.name, unit: item.unit, qty: item.qty, price: item.price, line: item.price * item.qty
      }))), config.invoices.note, issuedBy, new Date().toISOString()
    );
    return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  });
  return { invoice: invoiceOut(row, null) };
}

function invoicesForOrder(orderId, producerId = null) {
  const rows = producerId
    ? getDb().prepare('SELECT * FROM invoices WHERE order_id = ? AND producer_id = ? ORDER BY issued_at').all(orderId, producerId)
    : getDb().prepare('SELECT * FROM invoices WHERE order_id = ? ORDER BY issued_at').all(orderId);
  return rows.map((row) => invoiceOut(row, null));
}

function findInvoice(id) {
  const row = getDb().prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  return row ? invoiceOut(row, null) : null;
}

function invoicePdf(invoice, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 46,
    info: {
      Title: `${invoice.number} · ${config.store.name}`,
      Author: config.store.name,
      Subject: 'Comprobante interno de venta'
    }
  });
  doc.pipe(stream);
  const left = 46;
  const right = 549;
  const width = right - left;
  let y = 46;

  doc.rect(0, 0, 595, 96).fill('#132c2a');
  doc.fillColor('#fbfaf4').font('Helvetica-Bold').fontSize(21).text('InnovaAgro', left, 32, { continued: true });
  doc.fillColor('#f1b84b').text('-App');
  doc.fillColor('#c9d6ca').font('Helvetica').fontSize(8.5).text('TECNOLOGIA & NATURALEZA · FORMOSA', left, 60, { characterSpacing: 1.1 });
  doc.fillColor('#fbfaf4').font('Helvetica-Bold').fontSize(10).text('COMPROBANTE INTERNO DE VENTA', left, 104);
  doc.fillColor('#182521').font('Helvetica').fontSize(9).text('No válido como factura fiscal', left, 120);

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#182521')
    .text(invoice.number, 380, 100, { width: 169, align: 'right' });
  doc.font('Helvetica').fontSize(8.5).fillColor('#50635a')
    .text('Emitido: ' + new Date(invoice.issuedAt).toLocaleDateString('es-AR'), 380, 124, { width: 169, align: 'right' });

  y = 154;
  doc.roundedRect(left, y, (width - 14) / 2, 112, 8).strokeColor('#d8d7cc').lineWidth(1).stroke();
  doc.roundedRect(left + (width + 14) / 2, y, (width - 14) / 2, 112, 8).strokeColor('#d8d7cc').stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#9b6239').text('VENDEDOR', left + 12, y + 12, { characterSpacing: 1 });
  doc.fillColor('#182521').font('Helvetica-Bold').fontSize(11).text(invoice.sellerName, left + 12, y + 28, { width: (width - 38) / 2 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#50635a')
    .text(invoice.sellerOwner || '', left + 12, y + 44, { width: (width - 38) / 2 })
    .text(invoice.sellerAddress || '', left + 12, y + 58, { width: (width - 38) / 2 })
    .text(invoice.sellerTaxId ? 'CUIT: ' + invoice.sellerTaxId : 'CUIT no informado', left + 12, y + 78, { width: (width - 38) / 2 });
  const x2 = left + (width + 14) / 2 + 12;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#9b6239').text('COMPRADOR', x2, y + 12, { characterSpacing: 1 });
  doc.fillColor('#182521').font('Helvetica-Bold').fontSize(11).text(invoice.buyerName || 'Consumidor final', x2, y + 28, { width: (width - 38) / 2 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#50635a')
    .text(invoice.buyerEmail || '', x2, y + 44, { width: (width - 38) / 2 })
    .text(invoice.buyerTaxId ? 'CUIT/CUIL: ' + invoice.buyerTaxId : 'Documento no informado', x2, y + 60, { width: (width - 38) / 2 })
    .text('Pedido: ' + invoice.orderId, x2, y + 78, { width: (width - 38) / 2 });

  y += 134;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#fbfaf4').rect(left, y, width, 22).fill('#3e6b51');
  doc.fillColor('#fbfaf4').text('DETALLE', left + 8, y + 7).text('CANT.', 344, y + 7, { width: 42, align: 'right' })
    .text('PRECIO', 395, y + 7, { width: 65, align: 'right' }).text('IMPORTE', 468, y + 7, { width: 73, align: 'right' });
  y += 22;
  doc.font('Helvetica').fontSize(9).fillColor('#182521');
  invoice.items.forEach((item, index) => {
    if (y > 690) {
      doc.addPage();
      y = 46;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#fbfaf4').rect(left, y, width, 22).fill('#3e6b51');
      doc.fillColor('#fbfaf4').text('DETALLE', left + 8, y + 7).text('CANT.', 344, y + 7, { width: 42, align: 'right' })
        .text('PRECIO', 395, y + 7, { width: 65, align: 'right' }).text('IMPORTE', 468, y + 7, { width: 73, align: 'right' });
      y += 22;
      doc.font('Helvetica').fontSize(9).fillColor('#182521');
    }
    if (index % 2 === 0) doc.rect(left, y, width, 24).fill('#f5f4ea');
    doc.fillColor('#182521').text(item.name, left + 8, y + 7, { width: 320, lineBreak: false, ellipsis: true })
      .text(String(item.qty) + ' ' + item.unit, 344, y + 7, { width: 42, align: 'right' })
      .text(money(item.price), 395, y + 7, { width: 65, align: 'right' })
      .text(money(item.line), 468, y + 7, { width: 73, align: 'right' });
    y += 24;
    doc.moveTo(left, y).lineTo(right, y).strokeColor('#e6e5db').lineWidth(0.5).stroke();
  });

  y += 14;
  doc.font('Helvetica').fontSize(9).fillColor('#50635a').text('Subtotal productos', 360, y, { width: 110, align: 'right' });
  doc.font('Helvetica-Bold').fillColor('#182521').text(money(invoice.subtotal), 470, y, { width: 75, align: 'right' });
  y += 18;
  doc.font('Helvetica').fontSize(8.5).fillColor('#75877d')
    .text('El envío y la coordinación de entrega se informan en el pedido original.', left, y, { width: 330 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#132c2a').text('TOTAL', 360, y, { width: 110, align: 'right' });
  doc.fontSize(13).text(money(invoice.total), 470, y - 2, { width: 75, align: 'right' });

  y += 52;
  doc.roundedRect(left, y, width, 62, 8).fill('#f5f4ea');
  doc.fillColor('#50635a').font('Helvetica-Bold').fontSize(8).text('ALCANCE DEL COMPROBANTE', left + 12, y + 11, { characterSpacing: 1 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#50635a')
    .text(invoice.note || config.invoices.note, left + 12, y + 26, { width: width - 24, lineGap: 2 });

  doc.font('Helvetica').fontSize(7.5).fillColor('#75877d')
    .text(`${config.store.name} · ${config.store.address} · ${config.store.email}`, left, 786, { width, align: 'center' })
    .text('Comprobante generado por el sistema. Conservá este archivo como respaldo de tu compra.', left, 798, { width, align: 'center' });
  doc.end();
}

module.exports = {
  issueInvoice,
  invoicesForOrder,
  findInvoice,
  invoicePdf,
  invoiceOut
};
