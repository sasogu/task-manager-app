const CACHE_NAME = 'task-manager-cache-v1.0.51';
const urlsToCache = [
  'https://sasogu.github.io/task-manager-app/',
  'https://sasogu.github.io/task-manager-app/index.html',
  'https://sasogu.github.io/task-manager-app/css/styles.css',
  'https://sasogu.github.io/task-manager-app/js/app.js',
  'https://sasogu.github.io/task-manager-app/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Añade este evento para limpiar caches antiguos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Borrando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});