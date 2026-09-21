/* 离线缓存：装到桌面后没网也能开 */
const CACHE = 'wb-v3';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './icon-180.png', './favicon-32.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './assets/app.css', './assets/data.js', './assets/app.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 页面和代码永远先问网络：不然改了 app.js 不换 CACHE 名，手机上会一直开着旧版本
const NET_FIRST = ['', 'index.html', 'app.js', 'app.css', 'data.js', 'manifest.webmanifest', 'sw.js'];
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const file = url.pathname.split('/').pop();
  if (NET_FIRST.indexOf(file) > -1) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
