const CACHE_NAME = 'task-manager-cache-v1.3.62'; // Versión incrementada
// URL base del scope del SW (funciona tanto en GitHub Pages como en localhost)
const SCOPE_BASE = self.registration?.scope || self.location.origin + '/';
const OFFLINE_FALLBACK_URL = new URL('index.html', SCOPE_BASE).toString();
// Usar rutas relativas al SW para que funcionen en cualquier host/path
const urlsToCache = [
  './',
  'index.html',
  'archivo.html',
  'recordatorios.html',
  'recordatorios.html',
  'css/styles.css',
  'js/app.js',
  'js/archivo.js',
  'js/recordatorios.js',
  'js/sw-register.js',
  'js/recordatorios.js',
  'manifest.json'
  // Nota: no precacheamos los iconos para acelerar la primera carga
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
  const url = new URL(event.request.url);
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

  // Para manifest.json: usar red primero para ver cambios de atajos/íconos
  if (url.pathname.endsWith('/manifest.json') || url.pathname.endsWith('manifest.json')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
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
          // Primero intentar servir la propia ruta desde caché
          const anyCached = await caches.match(event.request, { ignoreSearch: true });
          if (anyCached) return anyCached;
          // Fallback al shell (index) en caché para experiencia offline
          const cachedShell = await caches.match(OFFLINE_FALLBACK_URL, { ignoreSearch: true });
          if (cachedShell) return cachedShell;
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

// Al hacer clic en una notificación, enfocar/abrir la app
// (Eliminado listener de notificationclick; no se usan notificaciones push locales)
