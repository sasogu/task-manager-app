const CACHE_NAME = 'task-manager-cache-v1.3.38'; // Versión incrementada
const urlsToCache = [
  'https://sasogu.github.io/task-manager-app/',
  'https://sasogu.github.io/task-manager-app/index.html',
  'https://sasogu.github.io/task-manager-app/archivo.html', // AÑADIDO
  'https://sasogu.github.io/task-manager-app/css/styles.css',
  'https://sasogu.github.io/task-manager-app/js/app.js',
  'https://sasogu.github.io/task-manager-app/js/archivo.js', // AÑADIDO
  'https://sasogu.github.io/task-manager-app/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// REEMPLAZA EL ANTIGUO 'fetch' LISTENER POR ESTE:
self.addEventListener('fetch', event => {
  // Ignorar peticiones que no son GET (como POST a Dropbox)
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Ignorar peticiones a dominios externos (como la API de Dropbox)
  if (!event.request.url.startsWith(self.location.origin)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para las peticiones GET a nuestros propios archivos, usar estrategia de caché
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Si está en caché, devolverlo
      if (cachedResponse) {
        return cachedResponse;
      }
      // Si no, ir a la red
      return fetch(event.request).then(networkResponse => {
        // Y guardar la nueva respuesta en caché para la próxima vez
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
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