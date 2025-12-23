# Santa Priscila PTAR - Sistema de Gestión de Plantas de Tratamiento

Sistema completo para gestión de Plantas de Tratamiento de Aguas Residuales (PTAR).

## Inicio Rápido

### Opción 1: Doble clic (Linux)
```bash
./iniciar-app.sh
```
Abre automáticamente http://localhost:5173

### Opción 2: Comandos
```bash
pnpm install    # Primera vez
pnpm run dev    # Iniciar desarrollo
```

Acceso:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **App Móvil (local)**: http://localhost:8080/mobile

## Credenciales de Acceso

| Usuario | Email | Password | Permisos |
|---------|-------|----------|----------|
| Admin | admin@santapriscila.com | admin123 | Completo |
| Operador | operador@santapriscila.com | operador123 | Lectura + Checklist |

## Despliegue con Túnel (Acceso desde Internet/Celular)

### Usando Cloudflare Tunnel (Recomendado - Rápido y estable)

```bash
# 1. Iniciar el servidor backend (sirve todo)
cd "/home/roman/Santa Priscila"
pnpm run dev

# 2. En otra terminal, iniciar túnel Cloudflare
cloudflared tunnel --url http://localhost:8080

# 3. Copiar la URL generada (ej: https://xxx-xxx.trycloudflare.com)
```

**URLs disponibles via túnel:**
- App Principal: `https://[tunnel-url]/`
- App Móvil Checklist: `https://[tunnel-url]/mobile`

**Ventajas de Cloudflare:**
- No requiere cuenta ni password
- Muy rápido y estable
- HTTPS automático

### Alternativa: Localtunnel (Más lento)

```bash
npx localtunnel --port 8080
# Password requerido: tu IP pública (curl ifconfig.me)
```

## App Móvil PWA (Checklist para Operadores)

### Acceso
- **Local**: http://localhost:8080/mobile
- **Via túnel**: https://[tunnel-url]/mobile

### Instalación como PWA en iPhone/Android
1. Abrir la URL en Safari (iOS) o Chrome (Android)
2. Menú compartir > "Añadir a pantalla de inicio"
3. Se instala como app nativa

### Características
- Login con credenciales de operador
- Selección de planta
- Checklist diario con items por sección
- Marcar items como OK o Problema (con comentario obligatorio)
- Reporte de emergencias
- Funciona offline (Service Worker)

### Archivos clave de la app móvil
```
mobile-app/
├── App.tsx              # Aplicación completa (lógica + UI)
├── app.json             # Configuración Expo
├── public/
│   ├── manifest.json    # PWA manifest
│   ├── sw.js            # Service Worker
│   ├── icon-192.svg     # Icono PWA
│   └── icon-512.svg     # Icono PWA grande
└── dist/                # Build compilado (se sirve desde /mobile)
```

### Compilar app móvil después de cambios
```bash
cd mobile-app
npx expo export --platform web --clear
cp public/*.svg public/manifest.json public/sw.js dist/
# Ajustar rutas en dist/index.html (cambiar / por /mobile/)
```

## Estructura del Proyecto

```
Santa Priscila/
├── api/                    # Backend Node.js/Express
│   ├── routes/
│   │   ├── auth.ts         # Autenticación JWT
│   │   ├── plants.ts       # CRUD plantas
│   │   ├── analytics.ts    # Datos analíticos
│   │   ├── maintenance.ts  # Mantenimientos + Emergencias
│   │   ├── checklist.ts    # API del checklist móvil
│   │   ├── documents.ts    # Gestión de documentos
│   │   └── dashboard.ts    # Datos del dashboard
│   ├── lib/
│   │   ├── database.ts     # Inicialización SQLite
│   │   └── dal.ts          # Data Access Layer
│   ├── config/users.json   # Usuarios (passwords hasheados bcrypt)
│   ├── app.ts              # Express app + CORS + Static serving
│   └── server.ts           # Entry point
│
├── src/                    # Frontend React + TypeScript
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Maintenance.tsx # Sistema de placeholders automáticos
│   │   ├── Documents.tsx
│   │   └── ...
│   └── App.tsx
│
├── mobile-app/             # App móvil Expo/React Native
│   ├── App.tsx             # App completa
│   └── dist/               # Build web (servido desde /mobile)
│
├── data/                   # Base de datos SQLite
├── uploads/                # Archivos subidos
├── iniciar-app.sh          # Script de inicio Linux
└── CLAUDE_GUIDE.md         # Guía para Claude (sesiones futuras)
```

## Configuración del Backend para Servir App Móvil

En `api/app.ts`:
```typescript
// Servir frontend principal
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

// Servir app móvil desde /mobile
const mobileDistPath = path.join(__dirname, '..', 'mobile-app', 'dist')
app.use('/mobile', express.static(mobileDistPath))

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API not found' })
  }
  if (req.path.startsWith('/mobile')) {
    return res.sendFile(path.join(mobileDistPath, 'index.html'))
  }
  res.sendFile(path.join(distPath, 'index.html'))
})
```

## CORS para Túneles

En `api/app.ts`, el CORS acepta dinámicamente:
- localhost (varios puertos)
- *.loca.lt (localtunnel)
- *.ngrok-free.app (ngrok)
- *.trycloudflare.com (cloudflare)

## API del Checklist Móvil

```
POST   /api/auth/login              # Login
GET    /api/auth/me                 # Usuario actual
GET    /api/plants                  # Listar plantas
GET    /api/checklist/today/:plantId # Checklist del día
PATCH  /api/checklist/item/:itemId  # Actualizar item
POST   /api/checklist/:id/complete  # Completar checklist
POST   /api/maintenance/emergencies/report # Reportar emergencia
```

## Sistema de Mantenimientos (Página Crítica)

### Concepto de Placeholders
- Cada año muestra TODAS las plantas automáticamente
- Si no hay tarea guardada, se muestra un "placeholder"
- Al guardar/completar, el placeholder se convierte en tarea real

### Estados y Colores
- **Azul (#60a5fa)**: Pendiente
- **Verde (#16a34a)**: Completado
- **Rojo (#ef4444)**: Vencido (fecha pasada sin completar)

### Flujo de Datos
1. `yearTasks`: Genera tarea por planta (real o placeholder)
2. `ganttTasks`: Convierte a formato Gantt con colores
3. `editDates`: Estado temporal para edición en tiempo real

## Troubleshooting

### Puerto en uso
```bash
lsof -i :8080
kill -9 [PID]
```

### Base de datos corrupta
```bash
rm data/santa-priscila.db
pnpm run dev  # Se regenera
```

### App móvil muestra pantalla blanca
1. Verificar que `dist/index.html` tenga rutas con `/mobile/`
2. Limpiar caché del navegador (Ctrl+Shift+R)
3. Abrir en ventana incógnito

### Túnel lento o no conecta
- Cloudflare: Reiniciar `cloudflared tunnel --url http://localhost:8080`
- Localtunnel: Usar cloudflared en su lugar (más estable)

## Variables de Entorno (.env)

```bash
PORT=8080
NODE_ENV=development
DATABASE_PATH=./data/santa-priscila.db
JWT_SECRET=tu-secreto-jwt
```

## Comandos Útiles

```bash
# Desarrollo
pnpm run dev              # Frontend + Backend
pnpm run server:dev       # Solo backend
pnpm run client:dev       # Solo frontend

# Build
pnpm run build            # Build frontend

# App móvil
cd mobile-app && npx expo export --platform web

# Túnel
cloudflared tunnel --url http://localhost:8080

# Ver IP pública (para localtunnel password)
curl ifconfig.me
```

## Backup

Los backups se guardan en el directorio padre con formato:
`backup-DD-MM-YYYY-revX/`

---

**Última actualización**: 22 de Diciembre 2025
**Versión**: 3.0.0
**Desarrollado para**: Santa Priscila PTAR
