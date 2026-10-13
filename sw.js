// 서비스 워커: 게임 파일을 보관해 두었다가 인터넷·서버가 없을 때 대신 내준다.
// 방식: 네트워크 먼저, 안 되면 보관본. 저장 데이터(localStorage)는 다루지 않음.
const CACHE = 'dark-station-v1';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.json',
  'data.js', 'engine.js', 'ui.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return; // 글꼴 등 외부는 그대로
  event.respondWith(
    fetch(url.href, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
