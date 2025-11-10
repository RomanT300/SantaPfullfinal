# 🚀 Inicio Rápido - Sistema de Gestión de Analíticas

## 📦 Instalación

```bash
# Opción 1: Usar pnpm (recomendado)
pnpm install

# Opción 2: Usar npm con legacy peer deps
npm install --legacy-peer-deps
```

## ⚙️ Configuración

### Variables de Entorno Requeridas

Crear archivo `.env` en la raíz del proyecto:

```env
# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_KEY=tu_service_key

# JWT Secret (mínimo 32 caracteres en producción)
JWT_SECRET=tu_jwt_secret_super_seguro_minimo_32_caracteres

# CORS (opcional, para producción)
CORS_ORIGIN=https://tu-dominio.com

# Node Environment
NODE_ENV=development
```

### Obtener Credenciales de Supabase

1. Ir a [https://supabase.com](https://supabase.com)
2. Crear/seleccionar proyecto
3. Ir a Settings → API
4. Copiar:
   - Project URL → `SUPABASE_URL`
   - anon/public key → `SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_KEY`

## 🗄️ Setup Base de Datos

Ejecutar el script SQL en Supabase SQL Editor:

```bash
# El script está en:
scripts/schema.sql
```

Este script crea:
- ✅ Tabla `plants` (plantas)
- ✅ Tabla `environmental_data` (analíticas ambientales)
- ✅ Tabla `maintenance_tasks` (tareas de mantenimiento)
- ✅ Tabla `maintenance_emergencies` (emergencias)
- ✅ Tabla `documents` (documentos)
- ✅ Triggers automáticos
- ✅ Constraints y validaciones

## 🏃 Ejecutar Aplicación

### Desarrollo (Frontend + Backend simultáneamente)

```bash
npm run dev
```

Esto inicia:
- **Frontend**: http://localhost:5173 (Vite)
- **Backend**: http://localhost:3001 (Express)

### Solo Frontend

```bash
npm run client:dev
```

### Solo Backend

```bash
npm run server:dev
```

## 🔐 Usuarios de Prueba

### Crear Usuario Admin (Método 1: API)

```bash
# POST /api/auth/dev-login (Solo en desarrollo)
curl -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo",
    "role": "admin"
  }'
```

### Crear Usuario Admin (Método 2: Supabase)

1. Ir a Supabase → Authentication → Users
2. Click "Add user"
3. Email: `admin@test.com`
4. Password: `password123`
5. User Metadata (JSON):
```json
{
  "name": "Admin User",
  "role": "admin"
}
```

## 📊 Probar el Sistema de Analíticas

### 1. Login
```
1. Ir a http://localhost:5173/login
2. Email: admin@test.com
3. Password: password123
4. Click "Login"
```

### 2. Ir al Dashboard
```
http://localhost:5173/dashboard
```

### 3. Ver Gestión de Analíticas
```
1. Seleccionar una planta del dropdown
2. Scroll down hasta ver el botón "Mostrar Gestión de Analíticas"
3. Click en el botón
```

### 4. Añadir Analítica
```
Formulario "Nueva Analítica":
- Parámetro: DQO
- Fecha: Hoy
- Valor: 95.5
- Unidad: mg/L
- Flujo: Efluente
- Click "Añadir"
```

### 5. Editar Analítica
```
1. Localizar la analítica en la tabla
2. Click "Editar"
3. Cambiar valor
4. Click "Guardar"
```

### 6. Ver en Gráfica
```
La gráfica se actualiza automáticamente
Puedes filtrar por:
- Planta
- Parámetro (DQO, pH, SS)
- Rango de fechas
- Modo (Unificado / Afluente-Efluente)
```

## 🐛 Troubleshooting

### Error: "Cannot find module"
```bash
# Limpiar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Error: "CORS origin not allowed"
```bash
# Agregar al .env:
CORS_ORIGIN=http://localhost:5173
```

### Error: "JWT_SECRET must be set"
```bash
# Agregar al .env un secret de 32+ caracteres:
JWT_SECRET=tu_secreto_muy_largo_y_seguro_32_caracteres_minimo
```

### Error: "Supabase connection failed"
```bash
# Verificar:
1. Variables de entorno correctas
2. Supabase proyecto activo
3. API keys válidas
4. Tablas creadas (ejecutar schema.sql)
```

### No aparece botón "Gestión de Analíticas"
```
Usuario debe tener role = "admin" en Supabase
Verificar en: Authentication → Users → User Metadata
```

### Las gráficas están vacías
```
1. Añadir datos de prueba con el formulario
2. O ejecutar el script de seed:
   npm run seed
```

## 📁 Estructura del Proyecto

```
D:\SantaPriscilaApp-Working\
├── api/                      # Backend Express
│   ├── routes/
│   │   ├── analytics.ts      # ✨ CRUD de analíticas (NUEVO)
│   │   ├── plants.ts
│   │   ├── maintenance.ts
│   │   ├── auth.ts
│   │   └── documents.ts
│   ├── middleware/
│   ├── lib/
│   ├── app.ts
│   └── server.ts
├── src/                      # Frontend React
│   ├── pages/
│   │   ├── Dashboard.tsx     # ✨ Gestión integrada (NUEVO)
│   │   ├── Maintenance.tsx
│   │   ├── Documents.tsx
│   │   └── ...
│   ├── components/
│   └── main.tsx
├── scripts/
│   ├── schema.sql           # Schema de base de datos
│   └── seed.ts              # Datos de prueba
├── .env                     # Variables de entorno (crear)
├── package.json
├── GUIA_ANALITICAS.md      # ✨ Documentación completa (NUEVO)
└── START.md                # Este archivo
```

## 🎯 Funcionalidades Nuevas

### ✨ CRUD Completo de Analíticas
- ✅ Crear nueva analítica
- ✅ Editar analítica existente (inline)
- ✅ Eliminar analítica con confirmación
- ✅ Ver todas las analíticas por planta

### 📊 Visualización Mantenida
- ✅ Gráficas de área interactivas
- ✅ Filtros múltiples
- ✅ KPIs en tiempo real
- ✅ Export CSV/PDF
- ✅ Modo Afluente/Efluente

### 🔒 Seguridad
- ✅ Solo Admin puede crear/editar/eliminar
- ✅ Autenticación JWT
- ✅ Validaciones backend y frontend
- ✅ Rate limiting

## 📚 Documentación Adicional

- [GUIA_ANALITICAS.md](GUIA_ANALITICAS.md) - Guía completa de uso
- [README.md](README.md) - Documentación general
- [scripts/DB_SETUP.md](scripts/DB_SETUP.md) - Setup de base de datos

## 🆘 Soporte

Si encuentras problemas:
1. Verifica las variables de entorno
2. Revisa los logs en consola (Frontend y Backend)
3. Consulta GUIA_ANALITICAS.md para troubleshooting
4. Verifica que las tablas existen en Supabase

## 🚀 Siguiente Paso

Una vez instaladas las dependencias:

```bash
npm run dev
```

Luego ir a: http://localhost:5173
