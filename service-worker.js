const CACHE_NAME = 'task-manager-cache-v1.3.39'; // Versión incrementada
// URL base del scope del SW (e.g., https://sasogu.github.io/task-manager-app/)
const SCOPE_BASE = self.registration?.scope || self.location.origin + '/';
const OFFLINE_FALLBACK_URL = new URL('index.html', SCOPE_BASE).toString();
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
      .then(() => self.skipWaiting())
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

  // Navegación de documentos (HTML): red primero con fallback offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          // Opcional: cachear navegaciones exitosas
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        } catch (err) {
          // Fallback a index.html en caché para experiencia offline
          const cachedShell = await caches.match(OFFLINE_FALLBACK_URL, { ignoreSearch: true });
          if (cachedShell) return cachedShell;
          // Como último recurso, intenta cualquier caché previo de la navegación
          const anyCached = await caches.match(event.request, { ignoreSearch: true });
          if (anyCached) return anyCached;
          throw err;
        }
      })()
    );
    return;
  }

  // Para las peticiones GET a nuestros propios archivos, usar estrategia de caché
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
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
      }).catch(async () => {
        // Fallback si la red falla: intentar el shell offline para documentos
        if (event.request.destination === 'document') {
          const cachedShell = await caches.match(OFFLINE_FALLBACK_URL, { ignoreSearch: true });
          if (cachedShell) return cachedShell;
        }
        // En otros casos, no hay fallback razonable
        return Response.error();
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
      ).then(() => self.clients.claim());
    })
  );
});
