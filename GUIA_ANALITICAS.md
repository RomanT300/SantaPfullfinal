# Guía de Gestión de Analíticas Ambientales

## 📋 Resumen de Funcionalidades

El sistema ahora incluye una funcionalidad completa de CRUD (Crear, Leer, Actualizar, Eliminar) para las analíticas ambientales, manteniendo la visualización de gráficas existente.

## 🎯 Características Implementadas

### Backend (API)

**Nuevos Endpoints en `/api/analytics/environmental`:**

1. **GET** `/api/analytics/environmental` - Listar analíticas con filtros
   - Query params: `plantId`, `parameter`, `startDate`, `endDate`, `stream`, `page`, `limit`

2. **POST** `/api/analytics/environmental` - Crear nueva analítica (Admin)
   - Body: `{ plantId, parameter, measurementDate, value, stream? }`

3. **PUT** `/api/analytics/environmental/:id` - Actualizar analítica (Admin)
   - Body: `{ plantId?, parameter?, measurementDate?, value?, stream?, unit? }`

4. **DELETE** `/api/analytics/environmental/:id` - Eliminar analítica por ID (Admin)

### Frontend (Dashboard)

**Nuevas Funcionalidades:**

1. **Botón de Gestión** (solo visible para administradores)
   - Ubicación: Debajo de las gráficas
   - Acción: Muestra/oculta el panel de gestión

2. **Panel de Gestión de Analíticas**
   - **Formulario de Nueva Analítica:**
     - Parámetro (DQO, pH, SS)
     - Fecha de medición
     - Valor numérico
     - Unidad (ej: mg/L, ppm)
     - Flujo (Afluente/Efluente/Sin especificar)
     - Botón "Añadir"

   - **Tabla de Analíticas Existentes:**
     - Columnas: Parámetro, Fecha, Valor, Unidad, Flujo, Acciones
     - Edición inline (click en "Editar")
     - Eliminación con confirmación

## 🚀 Uso del Sistema

### Requisitos Previos

1. Usuario con rol **Admin** (requerido para crear/editar/eliminar)
2. Conexión a Supabase configurada
3. Seleccionar una **planta específica** en el filtro

### Paso a Paso

#### 1. Visualizar Analíticas

```
1. Ir a /dashboard
2. Seleccionar una planta del dropdown
3. Las gráficas se actualizan automáticamente con los datos
```

#### 2. Añadir Nueva Analítica

```
1. Hacer login como Admin
2. Ir a /dashboard
3. Seleccionar una planta específica
4. Click en "Mostrar Gestión de Analíticas"
5. Completar el formulario:
   - Parámetro: DQO, pH, o SS
   - Fecha: Seleccionar del calendario
   - Valor: Ingresar número (ej: 85.5)
   - Unidad: mg/L (por defecto)
   - Flujo: Afluente/Efluente (opcional)
6. Click en "Añadir"
7. La página se recarga con los nuevos datos
```

#### 3. Editar Analítica Existente

```
1. En el panel de gestión, localizar la analítica a editar
2. Click en "Editar"
3. Los campos se convierten en editables
4. Modificar los valores necesarios
5. Click en "Guardar" para confirmar
   o "Cancelar" para descartar cambios
6. La página se recarga con los datos actualizados
```

#### 4. Eliminar Analítica

```
1. En el panel de gestión, localizar la analítica a eliminar
2. Click en "Eliminar"
3. Confirmar en el diálogo de confirmación
4. La página se recarga sin el registro eliminado
```

## 🔒 Permisos y Seguridad

### Roles

- **Admin**: Acceso completo (crear, editar, eliminar)
- **Standard**: Solo visualización

### Validaciones Backend

- Parámetros válidos: DQO, pH, SS
- Valor mínimo: 0
- pH: Constraint en BD (0-14)
- Fechas en formato ISO8601
- Rate limiting en operaciones de escritura

### Validaciones Frontend

- Campos requeridos marcados
- Confirmación antes de eliminar
- Mensajes de error informativos
- Auto-selección de planta al cargar gestión

## 📊 Integración con Visualización

### Flujo de Datos

```
Usuario añade/edita → API Supabase → Recarga automática → Gráficas actualizadas
```

### Características de la Visualización Mantenidas

✅ Gráficas de área interactivas
✅ Filtros por planta, parámetro, fechas
✅ Modo unificado / afluente-efluente
✅ KPIs (promedio, min, max)
✅ Exportación CSV/PDF
✅ Indicadores de cumplimiento normativo
✅ Zoom y brush

## 🛠️ Estructura de Código

### Componentes Añadidos

```typescript
// Estados nuevos en Dashboard.tsx
const [showManagement, setShowManagement] = useState(false)
const [analytics, setAnalytics] = useState<AnalyticRecord[]>([])
const [loadingAnalytics, setLoadingAnalytics] = useState(false)
const [editingId, setEditingId] = useState<string | null>(null)
const [isAdmin, setIsAdmin] = useState(false)
const [newRecord, setNewRecord] = useState<Partial<AnalyticRecord>>({...})
```

### Funciones CRUD

```typescript
loadAnalytics()       // GET - Cargar analíticas de una planta
createAnalytic()      // POST - Crear nueva analítica
updateAnalytic(record) // PUT - Actualizar analítica existente
deleteAnalytic(id)    // DELETE - Eliminar analítica
```

## 📝 Ejemplos de Datos

### Crear Analítica DQO

```json
{
  "plantId": "LA LUZ",
  "parameter": "DQO",
  "measurementDate": "2025-01-15",
  "value": 95.5,
  "stream": "effluent"
}
```

### Crear Analítica pH

```json
{
  "plantId": "TAURA",
  "parameter": "pH",
  "measurementDate": "2025-01-15",
  "value": 7.2,
  "stream": "influent"
}
```

## 🐛 Troubleshooting

### "Solo Admin edita"
**Problema:** No aparece el botón de gestión
**Solución:** Verificar que el usuario tiene rol `admin` en Supabase

### "Seleccione una planta específica"
**Problema:** Panel de gestión muestra advertencia amarilla
**Solución:** Seleccionar una planta del dropdown (no "Todas las plantas")

### Datos no se actualizan
**Problema:** Después de crear/editar no se ven cambios
**Solución:** La página se recarga automáticamente. Si no, refrescar manualmente (F5)

### Error al crear analítica
**Problema:** "Error: No se pudo crear"
**Solución:**
- Verificar conexión a Supabase
- Revisar variables de entorno (SUPABASE_URL, SUPABASE_SERVICE_KEY)
- Verificar que la tabla `environmental_data` existe

## 🔄 Flujo de Recarga

Después de cada operación (crear/editar/eliminar), el sistema:

1. Llama a `loadAnalytics()` para actualizar la tabla
2. Ejecuta `window.location.reload()` para refrescar las gráficas
3. Los filtros y selección de planta se mantienen en el estado

> **Nota:** Para evitar la recarga completa en producción, se puede implementar un estado global (Zustand) o refetch manual de los datos de visualización.

## 📦 Archivos Modificados

```
api/routes/analytics.ts     → Endpoint PUT añadido
src/pages/Dashboard.tsx     → Panel de gestión completo
GUIA_ANALITICAS.md         → Este documento
```

## 🚀 Próximas Mejoras Sugeridas

1. **Validación en tiempo real** sin recarga de página
2. **Import masivo** de analíticas desde CSV/Excel
3. **Notificaciones toast** en lugar de alerts
4. **Historial de cambios** (auditoría)
5. **Gráfica de tendencias** por parámetro
6. **Límites normativos** configurables por planta
7. **Alertas automáticas** cuando se exceden límites
8. **Export a Excel** con formato personalizado
