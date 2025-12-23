/**
 * Service Worker para PTAR Checklist PWA
 * Proporciona funcionalidad offline básica
 */

const CACHE_NAME = 'ptar-checklist-v1.0.0';
const RUNTIME_CACHE = 'ptar-runtime-v1';

// Assets estáticos para cachear en instalación
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

// Instalación - cachea assets estáticos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting();
      })
  );
});

// Activación - limpia caches antiguas
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch - estrategia Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo manejar GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Llamadas API - siempre network first, sin cache
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Sin conexión. Por favor verifica tu internet.'
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Assets estáticos - cache first
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Actualizar cache en background
          event.waitUntil(
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse.ok) {
                  caches.open(RUNTIME_CACHE)
                    .then((cache) => cache.put(request, networkResponse));
                }
              })
              .catch(() => {})
          );
          return cachedResponse;
        }

        return fetch(request)
          .then((networkResponse) => {
            // Cachear respuestas exitosas
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(RUNTIME_CACHE)
                .then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Página de navegación - devolver index.html del cache
            if (request.mode === 'navigate') {
              return caches.match('/');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Mensajes desde la app principal
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data === 'clearCache') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

// Notificaciones push (para futuro)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'PTAR Checklist';
  const options = {
    body: data.body || 'Nueva notificación',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: data.tag || 'default',
    data: data.url || '/'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

console.log('[SW] Service Worker loaded');
