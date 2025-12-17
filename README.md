# Santa Priscila PTAR - Sistema de Gestión de Plantas de Tratamiento

Sistema completo para gestión de Plantas de Tratamiento de Aguas Residuales (PTAR).

## 🚀 Inicio Rápido

### Desarrollo Local (Recomendado)

```bash
# Instalar dependencias
pnpm install

# Iniciar desarrollo (frontend + backend)
pnpm run dev
```

Acceso:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080

### Docker (Producción)

```bash
# Construir y levantar contenedores
sudo docker compose up --build -d

# Ver estado
sudo docker ps

# Ver logs
sudo docker logs ptar-backend
sudo docker logs ptar-frontend
```

## 👤 Credenciales de Acceso

| Usuario | Email | Password | Permisos |
|---------|-------|----------|----------|
| Admin | admin@santapriscila.com | Admin2025! | Completo |
| Operador | operador@santapriscila.com | Admin2025! | Solo lectura |

## 📁 Estructura del Proyecto

```
.
├── api/                    # Backend Node.js/Express
│   ├── routes/            # Endpoints API REST
│   │   ├── auth.ts        # Autenticación y usuarios
│   │   ├── plants.ts      # Gestión de plantas
│   │   ├── environmental.ts # Datos ambientales
│   │   ├── maintenance.ts  # Mantenimientos (CRÍTICO)
│   │   └── emergencies.ts # Emergencias
│   ├── lib/               # Lógica de negocio
│   │   ├── database.ts    # Inicialización SQLite
│   │   └── dal.ts         # Data Access Layer
│   ├── middleware/        # Middlewares Express
│   │   ├── auth.ts        # Autenticación JWT
│   │   └── rateLimit.ts   # Rate limiting
│   ├── config/            # Configuración
│   │   └── users.json     # Usuarios del sistema
│   ├── server.ts          # Entry point del servidor
│   └── app.ts             # Configuración Express
│
├── src/                   # Frontend React + TypeScript
│   ├── pages/             # Páginas principales
│   │   ├── Dashboard.tsx  # Dashboard principal
│   │   ├── Plants.tsx     # Gestión de plantas
│   │   ├── Environmental.tsx # Datos ambientales
│   │   ├── Maintenance.tsx # **PÁGINA CRÍTICA** - Ver sección abajo
│   │   ├── Emergencies.tsx # Gestión de emergencias
│   │   └── Login.tsx      # Página de login
│   ├── components/        # Componentes reutilizables
│   │   ├── Layout.tsx     # Layout principal
│   │   ├── Sidebar.tsx    # Barra lateral de navegación
│   │   └── ProtectedRoute.tsx # Rutas protegidas
│   ├── App.tsx            # Componente raíz
│   └── main.tsx           # Entry point
│
├── data/                  # Base de datos SQLite
│   └── database.sqlite    # BD persistente (no versionar)
│
├── uploads/               # Archivos subidos
│
├── nginx/                 # Configuración Nginx (Docker)
├── docker-compose.yml     # Orquestación Docker
├── Dockerfile.backend     # Imagen del backend
├── Dockerfile.frontend    # Imagen del frontend
├── .env                   # Variables de entorno
├── package.json           # Dependencias del proyecto
├── tsconfig.json          # Configuración TypeScript
└── vite.config.ts         # Configuración Vite
```

## 🔧 Tecnologías

### Frontend
- **React 18** con TypeScript
- **Vite** como build tool
- **TailwindCSS** para estilos
- **React Router** para navegación
- **Recharts** para gráficos
- **gantt-task-react** para Gantt charts

### Backend
- **Node.js** + **Express**
- **TypeScript**
- **SQLite** (better-sqlite3) como base de datos
- **JWT** para autenticación (cookies HttpOnly)
- **express-validator** para validación
- **express-rate-limit** para rate limiting

### DevOps
- **Docker** + **Docker Compose**
- **Nginx** como proxy reverso
- **pnpm** como package manager

## 🎯 Funcionalidades Principales

### 1. Dashboard
- Vista general de todas las plantas
- Gráficos de datos ambientales
- Estado de mantenimientos pendientes
- Alertas de emergencias activas

### 2. Gestión de Plantas
- CRUD completo de plantas
- Información detallada por planta
- Historial de mantenimientos
- Datos ambientales asociados

### 3. Datos Ambientales
- Registro de parámetros ambientales
- Gráficos históricos
- Alertas por valores fuera de rango
- Exportación de datos

### 4. **Mantenimientos** (FUNCIONALIDAD CRÍTICA)

#### Arquitectura de Mantenimientos

**Archivo**: `src/pages/Maintenance.tsx`

**Concepto Clave**: Sistema de **placeholders automáticos**
- Cada año muestra automáticamente TODAS las plantas
- Las plantas sin tareas guardadas muestran un "placeholder" (fecha por defecto: 1 de julio)
- Los placeholders se convierten en tareas reales al guardar o marcar como realizado

**Estados de una Tarea**:
```typescript
type Maint = {
  id: string                    // ID real o "placeholder-{plantId}-{year}"
  plant_id: string              // UUID de la planta
  task_type: 'general'          // Tipo de mantenimiento
  description: string           // Descripción
  scheduled_date: string        // Fecha programada (ISO)
  completed_date?: string       // Fecha de realización (opcional)
  status: 'pending' | 'completed' | 'overdue'
  isPlaceholder?: boolean       // Flag que indica si es placeholder
}
```

**Flujo de Datos**:

1. **`yearTasks` (líneas 151-178)**:
   ```typescript
   // Genera una tarea por cada planta para el año seleccionado
   // - Si existe en BD: usa la tarea real
   // - Si NO existe: crea un placeholder
   ```

2. **`ganttTasks` (líneas 180-224)**:
   ```typescript
   // Convierte yearTasks en tareas de Gantt
   // - Lee editDates para mostrar cambios en tiempo real
   // - Calcula colores según estado:
   //   * Azul (#60a5fa): pendiente
   //   * Verde (#16a34a): completado
   //   * Rojo (#ef4444): vencido (fecha pasada y no completado)
   ```

3. **`editDates` State**:
   ```typescript
   // Almacena fechas temporales mientras el usuario edita
   // Permite preview en tiempo real en el Gantt
   // Se limpia al guardar
   ```

**Funciones Críticas**:

- **`toggleDone()`** (líneas 235-297):
  ```typescript
  // Marca una tarea como completada/pendiente
  // Si es placeholder: lo crea primero, luego marca como completado
  // Si es real: toggle del estado
  ```

- **`updateScheduledDate()`** (líneas 299-332):
  ```typescript
  // Actualiza la fecha programada
  // Si es placeholder: crea la tarea con la nueva fecha
  // Si es real: actualiza la fecha
  ```

**Características del Gantt**:
- Actualización en tiempo real al cambiar fechas
- Colores automáticos según estado
- Línea roja vertical marca "hoy"
- Vista semanal del año completo
- Filtrado por planta

**UI - Tabla de Mantenimientos** (líneas 605-665):
- Columnas: Planta | Fecha Programada | Realizado (checkbox) | Estado
- Solo Admin puede editar fechas
- Checkbox funciona para todos los usuarios autenticados
- Estados visuales con colores

### 5. Emergencias
- Registro de emergencias por planta
- Niveles de severidad (low, medium, high)
- Tiempo de resolución
- Estado (resuelto/sin resolver)
- Observaciones

## 📊 API Endpoints

### Autenticación
```
POST   /api/auth/login     # Login
POST   /api/auth/logout    # Logout
GET    /api/auth/me        # Usuario actual
```

### Plantas
```
GET    /api/plants         # Listar plantas
POST   /api/plants         # Crear planta (admin)
PATCH  /api/plants/:id     # Actualizar planta (admin)
DELETE /api/plants/:id     # Eliminar planta (admin)
```

### Datos Ambientales
```
GET    /api/environmental  # Listar datos
POST   /api/environmental  # Registrar datos (admin)
```

### Mantenimientos
```
GET    /api/maintenance/tasks                 # Listar tareas
POST   /api/maintenance/tasks                 # Crear tarea (admin)
POST   /api/maintenance/tasks/generate-monthly # Generar tareas para año (admin)
PATCH  /api/maintenance/tasks/:id             # Actualizar tarea
DELETE /api/maintenance/tasks/:id             # Eliminar tarea (admin)
GET    /api/maintenance/stats                 # Estadísticas (auth)
```

### Emergencias
```
GET    /api/maintenance/emergencies     # Listar emergencias
POST   /api/maintenance/emergencies     # Crear emergencia (admin)
PATCH  /api/maintenance/emergencies/:id # Actualizar emergencia (admin)
DELETE /api/maintenance/emergencies/:id # Eliminar emergencia (admin)
```

## 🔐 Seguridad

- **Autenticación**: JWT en cookies HttpOnly
- **Rate Limiting**: 100 req/15min por IP
- **Validación**: express-validator en todos los endpoints
- **CORS**: Configurado para desarrollo y producción
- **Roles**: Admin y Operador con permisos diferenciados

## 🗄️ Base de Datos

**Tipo**: SQLite (archivo: `data/database.sqlite`)

**Tablas**:
- `plants`: Plantas PTAR
- `environmental_data`: Datos ambientales por planta
- `maintenance_tasks`: Tareas de mantenimiento (**CRÍTICA**)
- `emergencies`: Registro de emergencias

**Inicialización**: Automática en primer arranque
- Schema en `api/lib/database.ts`
- Datos de ejemplo incluidos
- 4 plantas demo (LA LUZ, TAURA, SANTA MONICA, SAN DIEGO)

## 🐛 Debugging

### Logs del Backend
```bash
# Ver logs en tiempo real
pnpm run dev  # Ya muestra logs

# O si usas Docker
sudo docker logs -f ptar-backend
```

### Problemas Comunes

1. **Puerto en uso**:
   ```bash
   # Liberar puerto 8080
   fuser -k 8080/tcp
   ```

2. **Base de datos corrupta**:
   ```bash
   # Eliminar y regenerar
   rm data/database.sqlite
   pnpm run dev  # Se regenera automáticamente
   ```

3. **Dependencias desactualizadas**:
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

4. **Proxy Vite no funciona**:
   - Verificar que backend esté en puerto 8080
   - Ver `vite.config.ts` línea 20

## 📝 Variables de Entorno

**Archivo**: `.env`

```bash
PORT=8080                    # Puerto del backend
NODE_ENV=development         # development | production
DATABASE_PATH=./data/database.sqlite
JWT_SECRET=auto-generated    # Se genera automáticamente
```

## 🔄 Flujo de Trabajo para Claude (Futuras Sesiones)

### Al Iniciar Sesión:
1. Leer este README completo
2. Revisar `src/pages/Maintenance.tsx` - Es el archivo más crítico
3. Entender el sistema de placeholders
4. Verificar que el servidor esté corriendo (`pnpm run dev`)

### Para Modificar Mantenimientos:
1. **NUNCA** eliminar el concepto de placeholders
2. Mantener la actualización en tiempo real del Gantt
3. Preservar la lógica de `yearTasks`, `ganttTasks`, `editDates`
4. Respetar los colores: azul=pendiente, verde=completado, rojo=vencido

### Para Agregar Funcionalidades:
1. Backend: Crear ruta en `api/routes/`
2. Agregar lógica de datos en `api/lib/dal.ts`
3. Frontend: Crear/modificar página en `src/pages/`
4. Actualizar rutas en `src/App.tsx`

## 📦 Comandos Útiles

```bash
# Desarrollo
pnpm run dev              # Iniciar dev (frontend + backend)
pnpm run client:dev       # Solo frontend
pnpm run server:dev       # Solo backend

# Producción
pnpm run build            # Build del frontend

# Docker
sudo docker compose up --build -d    # Construir y levantar
sudo docker compose down             # Detener
sudo docker compose restart          # Reiniciar
```

## 🎨 Personalización

### Colores del Sistema
- Primario: Blue (#3b82f6)
- Éxito: Green (#16a34a)
- Peligro: Red (#ef4444)
- Advertencia: Yellow (#eab308)

### Temas
- Light mode (por defecto)
- Dark mode (soporte completo con `dark:` classes)

## 📞 Soporte

Para problemas técnicos:
1. Revisar logs del servidor
2. Verificar consola del navegador
3. Comprobar estado de la BD SQLite
4. Revisar este README

## 🎯 Roadmap

- [ ] Exportación de datos a Excel/PDF
- [ ] Notificaciones por email
- [ ] Dashboard con métricas avanzadas
- [ ] Integración con sistemas externos
- [ ] App móvil (React Native)

---

**Última actualización**: Diciembre 2025
**Versión**: 1.0.0
**Desarrollado para**: Santa Priscila PTAR
