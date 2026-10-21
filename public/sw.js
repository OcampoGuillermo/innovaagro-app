'use strict';

const VERSION = 'innovaagro-v4';
const CORE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/data.js',
  '/js/courses.js',
  '/js/app-core.js',
  '/js/app-views.js',
  '/js/app-panel.js',
  '/js/app-init.js',
  '/manifest.webmanifest',
  '/robots.txt',
  '/assets/logo-256.webp',
  '/assets/logo-640.webp',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/fonts/bricolage.woff2',
  '/assets/fonts/publicsans-regular.woff2',
  '/assets/fonts/publicsans-semibold.woff2',
  '/assets/fonts/publicsans-bold.woff2',
  '/assets/fonts/publicsans-italic.woff2'
];

const PHOTOS = [
  'hero', 'orchard', 'pomelo', 'pomelo_tree', 'citricos', 'mandioca', 'mandioca_plant',
  'almidon', 'batata', 'miel', 'honeycomb', 'beekeeper', 'queso', 'queso_shop', 'dulce',
  'hojas', 'market_greens', 'tomate', 'mango', 'banana', 'algodon', 'algodon_open',
  'textil', 'pescado', 'pescado_grill', 'farmer', 'farmer_woman', 'farmer_field', 'vendor'
].map((name) => `/assets/photos/${name}.webp`);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE).catch(() => {});
    await cache.addAll(PHOTOS).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(VERSION);
          cache.put('/index.html', response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(VERSION);
        cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});
