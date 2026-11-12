/* EASY NOOR — offline service worker */
const CACHE = 'noor-v2';
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
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // cache-first for core + translations, network fallback
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) {
        fetch(req).then(res => { if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {}); }).catch(() => {});
        return hit;
      }
      return fetch(req).then(res => {
        if (res && res.ok && (url.pathname.includes('/data/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.ttf'))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
