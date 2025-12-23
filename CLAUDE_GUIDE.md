# Guía para Claude - Santa Priscila PTAR

## 🎯 Propósito de este Documento

Este archivo contiene información crítica para que Claude pueda trabajar eficientemente en el proyecto en futuras sesiones.

---

## 🌐 DESPLIEGUE CON TÚNELES (Información Crítica)

### Cloudflare Tunnel (Recomendado)

```bash
# 1. Iniciar servidor (sirve frontend + backend + app móvil)
cd "/home/roman/Santa Priscila"
pnpm run dev

# 2. En otra terminal, crear túnel
cloudflared tunnel --url http://localhost:8080

# URL generada ejemplo: https://xxx-xxx-xxx.trycloudflare.com
```

**URLs disponibles:**
- App Principal: `https://[tunnel-url]/`
- App Móvil Checklist: `https://[tunnel-url]/mobile`

### Configuración CORS (api/app.ts)

El backend acepta dinámicamente estos orígenes:
```typescript
const allowedOrigins = [
  /localhost/,
  /\.loca\.lt$/,           // localtunnel
  /\.ngrok-free\.app$/,    // ngrok
  /\.trycloudflare\.com$/  // cloudflare (PREFERIDO)
]
```

### App Móvil - Rutas Críticas (mobile-app/dist/index.html)

**IMPORTANTE**: Cuando se sirve desde `/mobile`, TODOS los assets deben tener prefijo `/mobile/`:

```html
<!-- CORRECTO -->
<link rel="icon" href="/mobile/icon-192.svg">
<link rel="manifest" href="/mobile/manifest.json">
<script src="/mobile/_expo/static/js/web/App-xxx.js" defer></script>
navigator.serviceWorker.register('/mobile/sw.js')

<!-- INCORRECTO (causará pantalla blanca) -->
<link rel="icon" href="/icon-192.svg">
<script src="/_expo/static/js/web/App-xxx.js" defer></script>
```

### App Móvil - Detección de API URL (mobile-app/App.tsx líneas 34-46)

```typescript
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    // Si NO es localhost, usar la misma URL base
    if (host !== 'localhost') {
      return `${window.location.protocol}//${window.location.host}/api`
    }
  }
  return 'http://localhost:8080/api'
}
```

### Recompilar App Móvil después de Cambios

```bash
cd mobile-app
npx expo export --platform web --clear
cp public/*.svg public/manifest.json public/sw.js dist/

# CRÍTICO: Editar dist/index.html para cambiar rutas a /mobile/
# Buscar: href="/ y src="/
# Cambiar a: href="/mobile/ y src="/mobile/
```

---

## 🔴 REGLAS CRÍTICAS - LEER PRIMERO

### 1. **NUNCA** Modificar sin Entender
- Leer completamente `README.md` antes de hacer cambios
- El archivo `src/pages/Maintenance.tsx` es el más crítico del proyecto
- Entender el sistema de "placeholders" antes de tocar mantenimientos

### 2. Sistema de Placeholders (CONCEPTO CLAVE)
```typescript
// ✅ CORRECTO: Así funciona actualmente
yearTasks = plants.map(plant => {
  if (existingTask) return existingTask  // Tarea real de BD
  return createPlaceholder(plant)         // Placeholder temporal
})

// ❌ INCORRECTO: NO hacer esto
yearTasks = tasks.filter(...)  // Esto ocultaría plantas sin tareas
```

**¿Por qué Placeholders?**
- El usuario quiere ver TODAS las plantas cada año
- Plantas sin tareas muestran fecha por defecto (1 julio)
- Al editar o marcar como realizado, el placeholder se convierte en tarea real

### 3. Actualización en Tiempo Real del Gantt
```typescript
// El Gantt DEBE leer editDates para preview en tiempo real
const scheduledDateStr = editDates[t.id]?.scheduled ?? t.scheduled_date

// ❌ NO quitar esta lógica, el usuario la requirió explícitamente
```

### 4. Colores del Gantt (NO CAMBIAR)
```typescript
// Azul: Pendiente
backgroundColor = '#60a5fa'

// Verde: Completado
if (isCompleted) backgroundColor = '#16a34a'

// Rojo: Vencido (pasó la fecha y no está completado)
if (isOverdue) backgroundColor = '#ef4444'
```

## 📋 Historial de Decisiones de Diseño

### Problema 1: Pantalla en Blanco al Cambiar a Año 2026
**Causa**: El Gantt recibía tareas con `start > end` para años futuros sin datos completados.

**Solución** (líneas 202-206 de Maintenance.tsx):
```typescript
// Ensure end is not before start (can happen when future year with no completion)
const validEndExec = clampedEndExec < clampedStartExec ? clampedStartExec : clampedEndExec
```

**Lección**: Siempre validar que las fechas de inicio/fin sean coherentes antes de pasarlas al Gantt.

### Problema 2: Fechas No Persistían en BD
**Causa Inicial**: `seedDatabase()` no insertaba tareas de mantenimiento.

**Solución**: Agregar seeding de maintenance_tasks en `api/lib/database.ts` líneas 331-357.

**Causa Secundaria**: El código intentaba editar placeholders directamente en lugar de crearlos primero.

**Solución**: Funciones `updateScheduledDate()` y `toggleDone()` detectan placeholders y los crean antes de modificar.

### Problema 3: Gantt No Se Actualizaba al Editar Fechas
**Requisito del Usuario**: "Debo de poder modificar las fecha de la planificacion y el gantt actualizarse automaticamente"

**Solución** (líneas 195 y 228 de Maintenance.tsx):
```typescript
// Agregar editDates como dependencia del useMemo
}, [yearTasks, doneMap, selectedYear, selectedPlants, durationDays, plantDurations, plantNameMap, editDates])

// Leer editDates en lugar de scheduled_date directamente
const scheduledDateStr = editDates[t.id]?.scheduled ?? t.scheduled_date.slice(0, 10)
```

## 🗂️ Estructura de Archivos Críticos

### `src/pages/Maintenance.tsx` (694 líneas)

**Secciones Importantes**:

1. **Tipos** (líneas 5-21):
   - `Maint`: Define estructura de tarea de mantenimiento
   - `isPlaceholder`: Flag crítico para diferenciar placeholders de tareas reales

2. **States** (líneas 24-43):
   - `tasks`: Tareas reales de la BD
   - `plants`: Lista de plantas
   - `editDates`: Fechas temporales mientras se edita
   - `doneMap`: Mapa de tareas completadas (localStorage)
   - `selectedYear`: Año actual seleccionado

3. **useMemos Críticos**:
   - `yearTasks` (151-178): **Genera placeholders automáticamente**
   - `ganttTasks` (180-224): **Convierte a formato Gantt con colores**
   - `planningRows` (493-498): Filtra tareas para la tabla

4. **Funciones de API**:
   - `reloadTasks()` (131-145): Recarga tareas desde backend
   - `toggleDone()` (235-297): Toggle completado/pendiente
   - `updateScheduledDate()` (299-332): Actualiza fecha programada
   - `updateCompletedDate()` (334-360): Actualiza fecha de realización

5. **Renderizado UI**:
   - Tabla (605-665): Muestra plantas con fechas editables
   - Gantt (666-689): Visualización anual con colores

### `api/routes/maintenance.ts` (308 líneas)

**Endpoints Implementados**:

1. `GET /tasks` (10-24): Lista tareas con filtros
2. `POST /tasks` (27-56): Crea nueva tarea (admin)
3. `POST /tasks/generate-monthly` (58-113): Genera tareas para año (admin)
4. `PATCH /tasks/:id` (116-148): Actualiza tarea
5. `DELETE /tasks/:id` (151-159): Elimina tarea (admin)
6. `GET /emergencies` (164-181): Lista emergencias
7. `POST /emergencies` (184-222): Crea emergencia (admin)
8. `PATCH /emergencies/:id` (225-263): Actualiza emergencia (admin)
9. `DELETE /emergencies/:id` (266-274): Elimina emergencia (admin)
10. `GET /stats` (277-306): Estadísticas agregadas

**Validaciones**:
- Todos los endpoints usan `express-validator`
- Campos requeridos están validados
- Tipos de datos verificados antes de procesar

### `api/lib/database.ts`

**Responsabilidades**:
1. Inicialización del schema SQLite
2. Seeding de datos iniciales
3. Creación de tablas si no existen

**Tablas**:
- `plants`: 4 plantas demo
- `environmental_data`: Datos de ejemplo
- `maintenance_tasks`: **Tareas de mantenimiento iniciales** (líneas 331-357)
- `emergencies`: Emergencias de ejemplo

## 🔧 Patrones de Código

### Patrón 1: Crear o Actualizar con Placeholders
```typescript
async function updateScheduledDate(task: Maint, date: string) {
  if (task.isPlaceholder) {
    // 1. Crear tarea en BD
    const res = await fetch('/api/maintenance/tasks', { method: 'POST', ... })
    // 2. Recargar desde BD
    await reloadTasks()
  } else {
    // Actualizar tarea existente
    const res = await fetch(`/api/maintenance/tasks/${task.id}`, { method: 'PATCH', ... })
    // Actualizar state local
    setTasks(prev => prev.map(...))
  }
}
```

### Patrón 2: UseMemo con Dependencias Correctas
```typescript
// ✅ CORRECTO: Incluir TODAS las dependencias usadas dentro
const ganttTasks = useMemo(() => {
  // Usa: yearTasks, doneMap, selectedYear, selectedPlants, durationDays, plantDurations, plantNameMap, editDates
  // ...
}, [yearTasks, doneMap, selectedYear, selectedPlants, durationDays, plantDurations, plantNameMap, editDates])

// ❌ INCORRECTO: Faltan dependencias
}, [yearTasks, selectedYear])  // Faltarían: doneMap, editDates, etc.
```

### Patrón 3: Cálculo de Estados
```typescript
const isCompleted = t.status === 'completed' || !!doneMap[t.id]
const isOverdue = !isCompleted && scheduledDateStr < todayStr

// Colores basados en lógica clara
const backgroundColor = isCompleted ? '#16a34a' : isOverdue ? '#ef4444' : '#60a5fa'
```

## 🚨 Errores Comunes a Evitar

### Error 1: Filtrar Tasks sin Considerar Placeholders
```typescript
// ❌ INCORRECTO
const planningRows = tasks.filter(t => t.year === selectedYear)
// Problema: Solo mostraría plantas con tareas reales

// ✅ CORRECTO
const planningRows = yearTasks.filter(...)
// yearTasks ya incluye placeholders para todas las plantas
```

### Error 2: No Validar Fechas en Gantt
```typescript
// ❌ INCORRECTO: Puede causar start > end
rows.push({ start: clampedStart, end: clampedEnd, ... })

// ✅ CORRECTO: Validar coherencia
const validEnd = clampedEnd < clampedStart ? clampedStart : clampedEnd
rows.push({ start: clampedStart, end: validEnd, ... })
```

### Error 3: No Incluir editDates en Dependencias
```typescript
// ❌ INCORRECTO: Gantt no se actualiza al editar
}, [yearTasks, selectedYear])

// ✅ CORRECTO: Se actualiza en tiempo real
}, [yearTasks, selectedYear, editDates])
```

## 📦 Dependencias Clave

### Frontend
```json
{
  "react": "^18.x",
  "react-router-dom": "^6.x",
  "gantt-task-react": "^0.3.9",  // ⚠️ Biblioteca específica para Gantt
  "recharts": "^2.x",
  "tailwindcss": "^3.x"
}
```

### Backend
```json
{
  "express": "^4.x",
  "better-sqlite3": "^11.x",  // ⚠️ SQLite síncrono (no async)
  "jsonwebtoken": "^9.x",
  "express-validator": "^7.x",
  "express-rate-limit": "^7.x"
}
```

## 🧪 Testing del Sistema de Mantenimientos

### Caso de Prueba 1: Año sin Datos
```
1. Seleccionar año 2027 (probablemente sin datos)
2. Verificar que todas las plantas aparecen
3. Verificar que tienen fecha por defecto (1 julio 2027)
4. Cambiar fecha de una planta
5. Verificar que Gantt se actualiza en tiempo real
6. Hacer click en "Guardar"
7. Recargar página
8. Verificar que la fecha se guardó
```

### Caso de Prueba 2: Marcar como Realizado
```
1. Seleccionar año actual
2. Hacer click en checkbox de una planta sin tarea
3. Verificar que se crea la tarea y marca como completada
4. Verificar que el color en Gantt cambió a verde
5. Recargar página
6. Verificar persistencia
```

### Caso de Prueba 3: Fechas Vencidas
```
1. Cambiar fecha a una fecha pasada
2. Verificar que aparece en rojo (vencido)
3. Marcar como realizado
4. Verificar que cambia a verde (completado)
```

## 📝 Checklist para Modificaciones

Antes de hacer cambios en mantenimientos:

- [ ] He leído este documento completo
- [ ] Entiendo el sistema de placeholders
- [ ] Conozco las líneas críticas (151-178, 180-224)
- [ ] Sé que editDates debe estar en dependencias del Gantt
- [ ] Entiendo los 3 colores y cuándo se aplican
- [ ] He verificado que el servidor está corriendo
- [ ] He probado en diferentes años (2023, 2025, 2026, 2027)

## 🔄 Comandos de Inicio Rápido

```bash
# Desarrollo local
cd "/home/roman/Santa Priscila"
pnpm run dev

# Esperar a ver:
# [0] VITE ready in XXXms
# [1] Server ready on port 8080

# Acceso local:
# - Frontend: http://localhost:5173
# - Backend: http://localhost:8080
# - App Móvil: http://localhost:8080/mobile

# Despliegue con túnel (acceso desde internet/celular):
cloudflared tunnel --url http://localhost:8080
# Copiar la URL generada (https://xxx.trycloudflare.com)
```

## 🔑 Credenciales

| Usuario | Email | Password |
|---------|-------|----------|
| Admin | admin@santapriscila.com | admin123 |
| Operador | operador@santapriscila.com | operador123 |

**Nota**: Los passwords están hasheados con bcrypt en `api/config/users.json`

## 📞 Contacto con Usuario

Si el usuario reporta un problema:

1. **Reproducir el problema** primero
2. **Leer logs** del servidor (ya están en consola)
3. **Verificar consola del navegador** (F12)
4. **Revisar este archivo** para decisiones de diseño previas
5. **Preguntar detalles** si no está claro

## ✅ Proyecto Completado

Este proyecto está **funcional y completo**. Los cambios futuros deben:
- Mantener la funcionalidad existente
- Respetar los patrones establecidos
- Documentar decisiones importantes
- Actualizar este archivo si es necesario

---

**Última actualización**: 22 Diciembre 2025
**Por**: Claude (Anthropic)
**Para**: Futuras sesiones de Claude trabajando en este proyecto

---

## 🐛 Problemas Resueltos (Histórico)

### Problema: App móvil muestra pantalla blanca después de login
**Causa**: Los assets se cargan desde `/` pero la app está en `/mobile`
**Solución**: Editar `mobile-app/dist/index.html` y cambiar todas las rutas a `/mobile/`

### Problema: ngrok requiere autenticación
**Solución**: Usar Cloudflare Tunnel (cloudflared) - no requiere cuenta

### Problema: localtunnel muy lento
**Causa**: Servidores sobrecargados
**Solución**: Usar Cloudflare Tunnel (más rápido y estable)

### Problema: Credencial de operador no funciona
**Causa**: Hash incorrecto en users.json (ambos usuarios tenían el mismo hash)
**Solución**: Regenerar hash con bcrypt para operador123
