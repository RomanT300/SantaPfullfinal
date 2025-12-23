/**
 * Script para generar assets PWA y Service Worker
 * Ejecutar después de: expo export --platform web
 */
const fs = require('fs')
const path = require('path')

const distPath = path.join(__dirname, '..', 'dist')

// Manifest para PWA
const manifest = {
  name: 'PTAR Checklist - Santa Priscila',
  short_name: 'PTAR Check',
  description: 'Sistema de checklist operativo para plantas de tratamiento de aguas residuales',
  start_url: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#F3F4F6',
  theme_color: '#2563EB',
  lang: 'es',
  icons: [
    {
      src: '/assets/icon.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/assets/adaptive-icon.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable'
    }
  ],
  categories: ['utilities', 'productivity'],
  shortcuts: [
    {
      name: 'Nuevo Checklist',
      short_name: 'Checklist',
      description: 'Iniciar nuevo checklist diario',
      url: '/',
      icons: [{ src: '/assets/icon.png', sizes: '192x192' }]
    }
  ]
}

// Service Worker para offline
const serviceWorker = `
// PTAR Checklist Service Worker v1.0
const CACHE_NAME = 'ptar-checklist-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls (always fetch from network)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return offline page if available
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
`

// HTML modificado para incluir PWA
const injectPWAMeta = (htmlPath) => {
  if (!fs.existsSync(htmlPath)) {
    console.log('HTML file not found at:', htmlPath)
    return
  }

  let html = fs.readFileSync(htmlPath, 'utf-8')

  // Inyectar meta tags PWA antes de </head>
  const pwaHead = `
    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#2563EB">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="PTAR Check">
    <link rel="apple-touch-icon" href="/assets/icon.png">
    <link rel="manifest" href="/manifest.json">
  `

  // Inyectar registro del Service Worker antes de </body>
  const swScript = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js')
            .then((reg) => console.log('SW registered:', reg.scope))
            .catch((err) => console.log('SW registration failed:', err));
        });
      }
    </script>
  `

  html = html.replace('</head>', pwaHead + '</head>')
  html = html.replace('</body>', swScript + '</body>')

  fs.writeFileSync(htmlPath, html)
  console.log('PWA meta tags injected into index.html')
}

// Main
console.log('Generating PWA assets...')

if (!fs.existsSync(distPath)) {
  console.log('dist folder not found. Run "expo export --platform web" first.')
  process.exit(1)
}

// Write manifest.json
fs.writeFileSync(
  path.join(distPath, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
)
console.log('manifest.json created')

// Write service worker
fs.writeFileSync(path.join(distPath, 'sw.js'), serviceWorker.trim())
console.log('sw.js created')

// Inject PWA meta into HTML
injectPWAMeta(path.join(distPath, 'index.html'))

console.log('\nPWA assets generated successfully!')
console.log('The dist/ folder is ready for deployment.')
console.log('\nTo deploy:')
console.log('1. Copy dist/ contents to your web server')
console.log('2. Ensure HTTPS is enabled (required for PWA)')
console.log('3. Configure server to serve index.html for all routes')
