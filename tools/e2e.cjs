'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;
const PROFILE = path.join(__dirname, 'chrome-profile-e2e');
const BASE = 'http://localhost:3000';

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function assert(value, message) {
  if (!value) throw new Error('FALLO: ' + message);
  console.log('ok · ' + message);
}

async function waitJson(url, tries = 100) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (_) {}
    await sleep(150);
  }
  throw new Error('Chrome no respondió: ' + url);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Timeout: ' + method));
        }
      }, 30000);
    });
  }
}

(async () => {
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) {}
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--user-data-dir=' + PROFILE,
    '--remote-debugging-port=' + PORT,
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    await waitJson(`http://127.0.0.1:${PORT}/json/version`);
    const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });
    const cdp = new CDP(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: true
    });

    async function evaluate(expression) {
      const result = await cdp.send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true
      });
      if (result.exceptionDetails) {
        throw new Error('JS falló: ' + (result.exceptionDetails.exception?.description || JSON.stringify(result.exceptionDetails)));
      }
      return result.result.value;
    }

    async function navigate(hash, wait = 1400) {
      await cdp.send('Page.navigate', { url: `${BASE}/?e2e=${Date.now()}${hash}` });
      await sleep(wait);
    }

    await navigate('#/welcome');
    const login = await evaluate(`(async () => {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email:'demo@innovaagro.app', password:'demo1234' }) });
      return { status: r.status, body: await r.text() };
    })()`);
    assert(login.status === 200, 'login de comprador desde el navegador');

    await navigate('#/market');
    const marketCount = await evaluate(`(() => ({
      cards: document.querySelectorAll('.product-card').length,
      active: activeProducts().length
    }))()`);
    assert(marketCount.cards === marketCount.active, `el mercado muestra los ${marketCount.active} productos activos`);

    const sort = await evaluate(`(() => {
      const select = document.querySelector('[data-action="market-sort"]');
      select.value = 'price-asc';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    assert(sort, 'selector de orden cambiado');
    await sleep(600);
    const sorted = await evaluate(`(() => {
      const cards = [...document.querySelectorAll('.product-card')];
      const first = cards[0].querySelector('[data-action="add-cart"]').dataset.id;
      const min = Math.min(...activeProducts().map((p) => p.price));
      const max = Math.max(...activeProducts().map((p) => p.price));
      return { first, min, max, firstPrice: productById(first).price, count: cards.length };
    })()`);
    assert(sorted.firstPrice === sorted.min, 'el orden por menor precio pone primero el más barato');

    const added = await evaluate(`(() => {
      const a = document.querySelector('[data-action="add-cart"][data-id="miel"]');
      const b = document.querySelector('[data-action="add-cart"][data-id="pomelo"]');
      if (!a || !b) return { error: 'faltan productos' };
      a.click(); b.click();
      return { lines: db.cart.length, units: db.cart.reduce((n, line) => n + line.qty, 0), ids: db.cart.map((line) => line.productId) };
    })()`);
    assert(added.lines === 2 && added.units === 2, 'dos productos de productores distintos agregados a la canasta');

    await navigate('#/cart');
    const cart = await evaluate(`(() => ({
      groups: document.querySelectorAll('.cart-group').length,
      items: document.querySelectorAll('.cart-item').length,
      title: document.querySelector('h1')?.textContent,
      count: document.querySelectorAll('[data-cart-qty]').length
    }))()`);
    assert(cart.groups === 2, 'la canasta agrupa por productor');
    assert(cart.items === 2, 'la canasta muestra los dos productos');

    await navigate('#/checkout');
    const submitted = await evaluate(`(() => {
      const form = document.querySelector('form[data-form="checkout"]');
      if (!form) return { error: 'sin formulario' };
      form.elements.name.value = 'Compra E2E';
      form.elements.phone.value = '3704111222';
      form.elements.note.value = 'Pedido automático de prueba.';
      form.elements.terms.checked = true;
      form.requestSubmit();
      return { ok: true };
    })()`);
    assert(submitted.ok, 'formulario de checkout enviado');
    await sleep(2200);
    const orderPage = await evaluate(`(() => ({ hash: location.hash, title: document.title, groups: document.querySelectorAll('.order-group').length }))()`);
    assert(orderPage.hash.startsWith('#/order/'), 'el checkout lleva al detalle del pedido');
    const orderId = orderPage.hash.split('/').pop();

    const apiOrder = await evaluate(`(async () => {
      const data = await (await fetch('/api/bootstrap')).json();
      const order = data.orders.find((o) => o.id === ${JSON.stringify(orderId)});
      return order ? {
        id: order.id, demo: order.demo, groups: Object.keys(order.groups).length,
        items: order.items.length, buyer: order.buyer.name, total: order.total,
        cart: db.cart.length, stock: data.products.find((p) => p.id === 'miel').stock
      } : null;
    })()`);
    assert(apiOrder, 'el pedido nuevo existe en el servidor');
    assert(apiOrder.demo === false, 'el pedido hecho por la interfaz queda demo=0');
    assert(apiOrder.groups === 2, 'el pedido se divide en dos productores');
    assert(apiOrder.buyer === 'Compra E2E', 'el pedido guarda el nombre ingresado');
    assert(apiOrder.cart === 0, 'la canasta se vacía después de confirmar');

    await navigate('#/market');
    const productHref = await evaluate(`document.querySelector('.product-card .product-name a').getAttribute('href')`);
    await evaluate(`document.querySelector('.product-card .product-name a').click()`);
    await sleep(900);
    assert((await evaluate('location.hash.startsWith("#/product/")')), 'se abre el detalle del producto');
    await evaluate('history.back()');
    await sleep(900);
    assert((await evaluate('location.hash === "#/market"')), 'el botón atrás vuelve al mercado');

    await navigate('#/pitch');
    assert((await evaluate('!!document.querySelector("[data-action=\\"open-timer\\"]")')), 'el constructor de pitch abre');
    await evaluate(`document.querySelector('[data-action="open-timer"]').click()`);
    await sleep(300);
    assert(await evaluate('document.getElementById("timer-dialog").open'), 'el temporizador abre');
    await evaluate(`document.querySelector('#timer-dialog [data-action="close-dialog"]').click()`);
    await sleep(200);
    assert(!(await evaluate('document.getElementById("timer-dialog").open')), 'el botón de cierre cierra el temporizador');

    await evaluate(`document.querySelector('[data-action="open-timer"]').click()`);
    await sleep(250);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(250);
    assert(!(await evaluate('document.getElementById("timer-dialog").open')), 'Escape cierra el temporizador');

    await evaluate(`document.querySelector('[data-action="open-timer"]').click()`);
    await sleep(250);
    await evaluate(`document.getElementById('timer-dialog').click()`);
    await sleep(200);
    assert(!(await evaluate('document.getElementById("timer-dialog").open')), 'el clic en el fondo cierra el temporizador');

    await evaluate(`document.querySelector('[data-action="open-timer"]').click()`);
    await sleep(200);
    await evaluate(`document.querySelector('[data-action="timer-toggle"]').click()`);
    await sleep(1300);
    const timerValue = Number(await evaluate('document.getElementById("timer-value").textContent'));
    assert(timerValue < 60 && timerValue > 0, 'el temporizador descuenta segundos');
    await evaluate(`document.querySelector('#timer-dialog [data-action="close-dialog"]').click()`);

    const sw = await evaluate(`(async () => {
      const registration = await navigator.serviceWorker.ready;
      await new Promise((resolve) => setTimeout(resolve, 600));
      return { active: !!registration.active, controller: !!navigator.serviceWorker.controller, caches: await caches.keys() };
    })()`);
    assert(sw.active, 'service worker activo');
    assert(sw.caches.includes('innovaagro-v4'), 'caché PWA v4 instalada');
    if (!sw.controller) {
      await cdp.send('Page.reload');
      await sleep(1800);
    }

    await cdp.send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
    });
    await cdp.send('Page.reload');
    await sleep(2500);
    const offline = await evaluate(`(() => ({
      title: document.title,
      online: navigator.onLine,
      titleText: document.querySelector('h1')?.textContent || '',
      marketLink: !!document.querySelector('a[href="#/market"]')
    }))()`);
    assert(offline.online === false, 'el navegador queda sin red');
    assert(offline.title.includes('InnovaAgro'), 'la app abre offline desde el service worker');
    assert(offline.marketLink || offline.titleText, 'la interfaz offline conserva navegación y contenido');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1
    });
    await cdp.send('Page.reload');
    await sleep(1500);

    console.log('\\nE2E OK. Pedido de prueba: ' + orderId);
    ws.close();
  } finally {
    chrome.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
