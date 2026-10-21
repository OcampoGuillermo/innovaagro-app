'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const name = process.argv[2] || 'page';
const hash = process.argv[3] || '#/home';
const width = Number(process.argv[4] || 390);
const height = Number(process.argv[5] || 844);
const role = process.argv[6] || 'buyer';
const full = process.argv[7] !== 'viewport';
const profile = path.join(__dirname, 'chrome-profile');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitJson(url, tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (_) {}
    await sleep(150);
  }
  throw new Error('Chrome no respondiÃ³ en ' + url);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
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
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--user-data-dir=' + profile,
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
      width, height, deviceScaleFactor: 1, mobile: width < 700
    });
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/#/welcome' });
    await sleep(1400);

    if (role !== 'guest') {
      const email = role === 'producer' ? 'finca@innovaagro.app' : 'demo@innovaagro.app';
      const login = await cdp.send('Runtime.evaluate', {
        expression: `(async () => {
          const r = await fetch('/api/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:${JSON.stringify(email)},password:'demo1234'})});
          return { status: r.status, body: await r.text() };
        })()`,
        awaitPromise: true, returnByValue: true
      });
      if (login.result.value.status !== 200) throw new Error('Login fallÃ³: ' + JSON.stringify(login.result.value));
    }

    await cdp.send('Page.navigate', { url: 'http://localhost:3000/?shot=1' + hash });
    await sleep(1800);
    if (process.env.PRE) {
      const pre = await cdp.send('Runtime.evaluate', {
        expression: process.env.PRE, awaitPromise: true, returnByValue: true
      });
      if (pre.exceptionDetails) throw new Error('PRE falló: ' + JSON.stringify(pre.exceptionDetails));
      await sleep(300);
    }
    if (process.env.POST_HASH) {
      await cdp.send('Page.navigate', { url: 'http://localhost:3000/?shot=2' + process.env.POST_HASH });
      await sleep(1400);
    }
    if (process.env.SCROLL) {
      await cdp.send('Runtime.evaluate', { expression: `scrollTo(0, ${Number(process.env.SCROLL)})` });
      await sleep(300);
    }
    if (process.env.METRICS) {
      const metrics = await cdp.send('Runtime.evaluate', {
        expression: process.env.METRICS, returnByValue: true
      });
      if (metrics.exceptionDetails) throw new Error('METRICS falló: ' + JSON.stringify(metrics.exceptionDetails));
      console.log(JSON.stringify(metrics.result.value, null, 2));
    }
    const cookies = await cdp.send('Runtime.evaluate', {
      expression: 'document.title + " | " + location.hash + " | " + document.body.scrollHeight + " | w=" + document.documentElement.scrollWidth + " vw=" + innerWidth + " sx=" + scrollX',
      returnByValue: true
    });
    console.log(cookies.result.value);

    let clip;
    const crop = process.env.CROP ? process.env.CROP.split(',').map(Number) : null;
    if (crop) {
      clip = { x: crop[0], y: crop[1], width: crop[2], height: crop[3], scale: Number(process.env.SCALE || 2) };
    } else if (full) {
      const metrics = await cdp.send('Page.getLayoutMetrics');
      const size = metrics.cssContentSize || metrics.contentSize;
      clip = { x: 0, y: 0, width: size.width, height: Math.min(size.height, 9000), scale: 1 };
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width, height: Math.min(size.height, 9000), deviceScaleFactor: 1, mobile: width < 700
      });
      await sleep(400);
    }
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: !!full, ...(clip ? { clip } : {})
    });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(shot.data, 'base64'));
    console.log('ok', name + '.png');
    ws.close();
  } finally {
    chrome.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
