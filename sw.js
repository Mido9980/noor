/* EASY NOOR — offline service worker */
const CACHE = 'noor-v3';
const CORE = [
  './', './index.html', './css/app.css', './js/i18n.js', './js/app.js',
  './data/quran.js', './amiri.ttf', './manifest.webmanifest',
  './icons/i192.png', './icons/i512.png', './icons/apple-touch-icon.png', './icons/maskable512.png'
];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const isTr = p => p.indexOf('/data/tr/') >= 0;
const isCode = p => /\.(html|js|css|webmanifest)$/.test(p) || p.endsWith('/');

function put(req, res) {
  if (!res || !res.ok) return res;
  const copy = res.clone();
  caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // translations never change: cache-first, download once
  if (isTr(url.pathname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => put(req, r))));
    return;
  }
  // app code: network-first so updates land immediately, cache as offline fallback
  if (isCode(url.pathname)) {
    e.respondWith(fetch(req).then(r => put(req, r)).catch(() =>
      caches.match(req).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  // fonts/icons: cache-first
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => put(req, r))));
});
