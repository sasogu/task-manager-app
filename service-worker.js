const CACHE_NAME = 'task-manager-cache-v1.0.35';
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