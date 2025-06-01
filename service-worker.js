const CACHE_NAME = 'task-manager-cache-v1.0.21';
const urlsToCache = [
  '/task-manager-app/',
  '/task-manager-app/index.html',
  '/task-manager-app/css/styles.css',
  '/task-manager-app/js/app.js',
  // Añade aquí otros archivos que quieras cachear
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