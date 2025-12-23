# Despliegue de PTAR Checklist PWA

## Requisitos
- Servidor web con HTTPS (obligatorio para PWA)
- Node.js 18+ para builds

## Generar Build de Producción

```bash
cd mobile-app

# Instalar dependencias
npm install

# Generar build web
npx expo export --platform web

# Copiar assets PWA
cp public/icon-192.svg public/icon-512.svg public/manifest.json public/sw.js dist/
```

## Estructura del Build

```
dist/
├── _expo/
│   └── static/js/web/
│       └── App-*.js          # Aplicación React compilada
├── favicon.ico               # Icono del navegador
├── icon-192.svg              # Icono PWA 192x192
├── icon-512.svg              # Icono PWA 512x512
├── index.html                # Página principal
├── manifest.json             # Manifest PWA
├── metadata.json             # Metadata de Expo
└── sw.js                     # Service Worker
```

## Opciones de Despliegue

### 1. Servidor Propio (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name ptar.santapriscila.com;

    root /var/www/ptar-checklist;
    index index.html;

    # HTTPS (obligatorio para PWA)
    ssl_certificate /etc/letsencrypt/live/ptar.santapriscila.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ptar.santapriscila.com/privkey.pem;

    # Servir archivos estáticos
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache headers para PWA
    location /sw.js {
        add_header Cache-Control "no-cache";
    }

    location /manifest.json {
        add_header Cache-Control "max-age=604800";
    }

    location /_expo/ {
        add_header Cache-Control "max-age=31536000, immutable";
    }

    # Proxy API al backend
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Netlify

1. Subir la carpeta `dist/` a Netlify
2. Crear `netlify.toml`:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 3. Vercel

1. Subir la carpeta `dist/`
2. Crear `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 4. Firebase Hosting

```bash
firebase init hosting
# Seleccionar dist como directorio público
# Configurar SPA: Yes

firebase deploy
```

## Configuración de API

Por defecto, la app detecta si está en producción y usa la misma URL base del servidor.

Para cambiar la URL de la API manualmente, editar `App.tsx`:

```typescript
const API_URL = 'https://tu-servidor.com/api'
```

## Verificar PWA

1. Abrir la app en Chrome
2. DevTools > Application > Manifest
3. Verificar que muestra "App is installed" o botón de instalación
4. DevTools > Application > Service Workers
5. Verificar que el SW está registrado

## Lighthouse PWA Audit

1. DevTools > Lighthouse
2. Seleccionar "Progressive Web App"
3. Generar reporte
4. Verificar puntuación de PWA

## Notas

- El Service Worker cachea la app para uso offline
- Las llamadas a `/api/` siempre van a la red (no se cachean)
- Para actualizar la PWA, cambiar el `CACHE_NAME` en `sw.js`
