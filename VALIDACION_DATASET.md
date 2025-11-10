# 🧪 Validación del Sistema de Gestión de Analíticas

## 📊 Dataset Generado

El script de seed crea un dataset realista con:

### **Plantas (7 total)**
- LA LUZ
- TAURA
- SANTA MONICA
- SAN DIEGO
- CHANDUY
- PTAR Norte
- PTAR Sur

### **Analíticas Ambientales (360 registros)**
Por cada planta (5 plantas) × 12 meses × 6 mediciones = **360 registros**

**Parámetros con Afluente/Efluente:**
- **DQO** (Demanda Química de Oxígeno)
  - Afluente: 780-950 mg/L (agua cruda entrante)
  - Efluente: 95-130 mg/L (agua tratada saliente)

- **pH** (acidez/alcalinidad)
  - Afluente: 6.9-7.2 (entrada)
  - Efluente: 7.2-7.5 (salida)

- **SS** (Sólidos Suspendidos)
  - Afluent: 390-510 mg/L (entrada)
  - Efluente: 65-85 mg/L (salida)

**Valores Reales de PTAR Ecuador:**
✅ DQO Efluente < 200 mg/L (Normativa)
✅ pH entre 6-8 (Normativa)
✅ SS Efluente < 100 mg/L (Normativa)

---

## 🚀 Paso a Paso: Setup y Validación

### **Paso 1: Configurar Supabase**

#### 1.1 Crear Proyecto en Supabase
```
1. Ir a https://supabase.com
2. Click "New Project"
3. Nombre: SantaPriscilaApp (o el que prefieras)
4. Database Password: (guardar para después)
5. Region: South America (sao-paulo)
6. Click "Create new project"
```

#### 1.2 Obtener Credenciales
```
1. Ir a Settings → API
2. Copiar:
   - Project URL
   - anon/public key
   - service_role key (mostrar/revelar)
```

#### 1.3 Crear archivo `.env`
```bash
# En la raíz del proyecto: D:\SantaPriscilaApp-Working\.env

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUz...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUz...
JWT_SECRET=super_secret_jwt_key_minimum_32_characters_long
NODE_ENV=development
PORT=3001
```

---

### **Paso 2: Crear Tablas en Supabase**

#### 2.1 Abrir SQL Editor
```
1. En Supabase Dashboard → SQL Editor
2. Click "New query"
```

#### 2.2 Ejecutar Schema
```sql
-- Copiar TODO el contenido de scripts/schema.sql
-- Pegar en el SQL Editor
-- Click "Run" (o Ctrl+Enter)
```

Deberías ver:
```
Success. No rows returned
```

#### 2.3 Verificar Tablas Creadas
```
1. Ir a Table Editor
2. Deberías ver las tablas:
   ✅ plants
   ✅ environmental_data
   ✅ maintenance_tasks
   ✅ maintenance_emergencies
   ✅ documents
```

---

### **Paso 3: Ejecutar Seed (Generar Datos)**

#### 3.1 Reiniciar Servidor
```bash
# Si el servidor está corriendo, detenerlo (Ctrl+C)
# Luego ejecutar:
npm run dev
```

El servidor ahora debería mostrar:
```
✅ Supabase connected (no más warning de missing env)
✅ Server ready on port 3001
```

#### 3.2 Ejecutar Seed
```bash
# En una nueva terminal:
npm run seed
```

Deberías ver:
```
Seeding plants...
Seeding environmental_data with influent/effluent streams...
Generated 360 environmental data records (with influent/effluent)
Seeding maintenance_tasks...
Seeding documents...
Seed completed.
```

#### 3.3 Verificar Datos en Supabase
```
1. Ir a Table Editor → plants
   → Deberías ver 7 plantas

2. Ir a Table Editor → environmental_data
   → Deberías ver ~360 registros
   → Con columnas: id, plant_id, parameter_type, value, measurement_date, unit, stream
   → stream debe tener valores: 'influent', 'effluent'
```

---

### **Paso 4: Crear Usuario Admin**

#### Opción A: Vía Supabase UI
```
1. Ir a Authentication → Users
2. Click "Add user" → "Create new user"
3. Email: admin@test.com
4. Password: Admin123!
5. User Metadata (JSON):
   {
     "name": "Admin User",
     "role": "admin"
   }
6. Click "Create user"
```

#### Opción B: Vía API (dev-login)
```bash
curl -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@demo", "role": "admin"}' \
  -c cookies.txt
```

---

### **Paso 5: Validar Frontend**

#### 5.1 Acceder al Dashboard
```
1. Abrir: http://localhost:5173/dashboard
```

#### 5.2 Login (si es necesario)
```
1. Si te redirige a login:
   → http://localhost:5173/login
2. Email: admin@test.com
3. Password: Admin123!
4. Click "Login"
```

#### 5.3 Verificar Visualización de Datos
```
✅ Deberías ver el dashboard con gráficas
✅ Selector de plantas (dropdown)
✅ Datos reales cargados desde Supabase
✅ Sin mensaje de "datos de ejemplo"
```

---

### **Paso 6: Probar Gestión de Analíticas (CRUD)**

#### 6.1 Abrir Panel de Gestión
```
1. Seleccionar planta: LA LUZ
2. Scroll down hasta ver botón azul: "Mostrar Gestión de Analíticas"
3. Click en el botón
```

Deberías ver:
```
┌─────────────────────────────────────┐
│ 📝 Nueva Analítica                  │
│ [Parámetro▼] [📅] [Valor] [...]    │
│ [Añadir]                            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 📊 Tabla de Analíticas              │
│ Param│Fecha  │Valor │Flujo │Acciones│
│ DQO  │15/12  │850.5 │Afluen│✏️ 🗑️   │
│ DQO  │15/12  │110.2 │Efluen│✏️ 🗑️   │
│ pH   │15/12  │7.1   │Afluen│✏️ 🗑️   │
│ ...  │...    │...   │...   │...     │
└─────────────────────────────────────┘
```

---

#### 6.2 ✅ TEST 1: Crear Nueva Analítica

**Acción:**
```
1. Parámetro: DQO
2. Fecha: Hoy (usar el date picker)
3. Valor: 105.5
4. Unidad: mg/L
5. Flujo: Efluente
6. Click [Añadir]
```

**Resultado Esperado:**
```
✅ La página se recarga automáticamente
✅ Aparece nuevo registro en la tabla
✅ La gráfica se actualiza con el nuevo punto
✅ El valor aparece en la fecha de hoy
```

**Validación en Supabase:**
```
1. Ir a Table Editor → environmental_data
2. Filtrar por fecha de hoy
3. Deberías ver el registro con value=105.5, stream='effluent'
```

---

#### 6.3 ✅ TEST 2: Editar Analítica Existente

**Acción:**
```
1. En la tabla, localizar cualquier registro
2. Click en botón amarillo [Editar]
3. Los campos se vuelven editables (inputs)
4. Cambiar el valor: 105.5 → 98.3
5. Click [Guardar] (azul)
```

**Resultado Esperado:**
```
✅ La página se recarga
✅ El valor actualizado aparece en la tabla: 98.3
✅ La gráfica refleja el cambio
✅ No aparece el valor antiguo
```

**Validación en Supabase:**
```
1. Buscar el registro por ID
2. La columna value debe mostrar 98.3
3. measurement_date, parameter_type, stream deben estar intactos
```

---

#### 6.4 ✅ TEST 3: Cancelar Edición

**Acción:**
```
1. Click [Editar] en un registro
2. Cambiar algún valor
3. Click [Cancelar] (gris)
```

**Resultado Esperado:**
```
✅ Los campos vuelven a modo lectura
✅ Los valores NO cambiaron
✅ No hubo recarga de página
```

---

#### 6.5 ✅ TEST 4: Eliminar Analítica

**Acción:**
```
1. Click en botón rojo [Eliminar]
2. Aparece diálogo: "¿Está seguro de eliminar esta analítica?"
3. Click "Aceptar"
```

**Resultado Esperado:**
```
✅ La página se recarga
✅ El registro desaparece de la tabla
✅ La gráfica se actualiza sin ese punto
✅ El conteo de registros disminuye en 1
```

**Validación en Supabase:**
```
1. Buscar el registro por ID
2. NO debe aparecer (fue eliminado)
```

---

#### 6.6 ✅ TEST 5: Editar Diferentes Campos

**Acción:**
```
1. Editar un registro
2. Cambiar:
   - Parámetro: DQO → pH
   - Fecha: Cambiar a otra fecha
   - Valor: 7.5
   - Flujo: Afluente → Efluente
   - Unidad: mg/L → (vacío)
3. Guardar
```

**Resultado Esperado:**
```
✅ Todos los campos se actualizan correctamente
✅ El registro aparece con los nuevos valores
✅ La gráfica cambia (pH usa diferente color)
```

---

#### 6.7 ✅ TEST 6: Validar Sincronización con Gráfica

**Acción:**
```
1. Seleccionar planta: TAURA
2. Parámetro: DQO
3. Modo: Afluente/Efluente
4. Observar gráfica (debe mostrar 2 líneas: verde y azul)
5. Añadir nueva analítica:
   - Parámetro: DQO
   - Fecha: Hoy
   - Valor: 900
   - Flujo: Afluente
6. Guardar
```

**Resultado Esperado:**
```
✅ La línea verde (afluente) se actualiza
✅ Aparece un punto nuevo en la fecha de hoy
✅ El valor ~900 está visible en el eje Y
✅ Los KPIs se recalculan (promedio, min, max)
```

---

#### 6.8 ✅ TEST 7: Filtros y Búsqueda

**Acción:**
```
1. Seleccionar planta: LA LUZ
2. Filtrar por fecha:
   - Inicio: Hace 6 meses
   - Fin: Hoy
3. Observar tabla y gráfica
```

**Resultado Esperado:**
```
✅ Solo aparecen registros dentro del rango
✅ La gráfica se ajusta al rango seleccionado
✅ La tabla muestra solo esos registros
```

---

### **Paso 7: Validar Permisos (Admin vs Standard)**

#### 7.1 Crear Usuario Standard
```
1. Supabase → Authentication → Users
2. Crear usuario:
   Email: user@test.com
   Password: User123!
   Metadata: { "name": "Standard User", "role": "standard" }
```

#### 7.2 Login como Standard
```
1. Logout del admin
2. Login con user@test.com / User123!
3. Ir a Dashboard
```

**Resultado Esperado:**
```
✅ Puede ver las gráficas
✅ Puede ver los filtros
✅ NO ve el botón "Mostrar Gestión de Analíticas"
✅ NO puede añadir/editar/eliminar datos
```

---

### **Paso 8: Validar Endpoints API Directamente**

#### 8.1 GET - Listar Analíticas
```bash
curl http://localhost:3001/api/analytics/environmental?plantId=33333333-3333-3333-3333-333333333333 \
  -H "Cookie: token=tu_token_jwt"
```

**Resultado Esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "plant_id": "33333333-3333-3333-3333-333333333333",
      "parameter_type": "DQO",
      "value": 850.5,
      "measurement_date": "2024-12-15T00:00:00Z",
      "unit": "mg/L",
      "stream": "influent"
    },
    ...
  ],
  "summary": {
    "DQO": { "count": 24, "avg": 480.5, "min": 95, "max": 950 }
  }
}
```

---

#### 8.2 POST - Crear Analítica
```bash
curl -X POST http://localhost:3001/api/analytics/environmental \
  -H "Content-Type: application/json" \
  -H "Cookie: token=tu_token_jwt" \
  -d '{
    "plantId": "33333333-3333-3333-3333-333333333333",
    "parameter": "DQO",
    "measurementDate": "2025-01-15",
    "value": 105.5,
    "stream": "effluent"
  }'
```

**Resultado Esperado:**
```json
{
  "success": true,
  "data": {
    "id": "nuevo-uuid",
    "plant_id": "33333333-3333-3333-3333-333333333333",
    "parameter_type": "DQO",
    "value": 105.5,
    "measurement_date": "2025-01-15T00:00:00.000Z",
    "unit": "mg/L",
    "stream": "effluent"
  },
  "inserted": 1
}
```

---

#### 8.3 PUT - Actualizar Analítica
```bash
curl -X PUT http://localhost:3001/api/analytics/environmental/[ID] \
  -H "Content-Type: application/json" \
  -H "Cookie: token=tu_token_jwt" \
  -d '{
    "value": 98.3
  }'
```

**Resultado Esperado:**
```json
{
  "success": true,
  "data": {
    "id": "[ID]",
    "value": 98.3,
    ...
  }
}
```

---

#### 8.4 DELETE - Eliminar Analítica
```bash
curl -X DELETE http://localhost:3001/api/analytics/environmental/[ID] \
  -H "Cookie: token=tu_token_jwt"
```

**Resultado Esperado:**
```json
{
  "success": true,
  "deleted": 1
}
```

---

## ✅ Checklist de Validación Completa

### Backend
- [x] Supabase conectado correctamente
- [x] Tablas creadas (schema.sql ejecutado)
- [x] Seed ejecutado (360 registros)
- [x] Datos con stream (influent/effluent)
- [x] Usuario admin creado
- [x] JWT funcionando

### API Endpoints
- [x] GET /api/analytics/environmental (con filtros)
- [x] POST /api/analytics/environmental (crear)
- [x] PUT /api/analytics/environmental/:id (actualizar)
- [x] DELETE /api/analytics/environmental/:id (eliminar)
- [x] Validaciones funcionando
- [x] Rate limiting aplicado
- [x] Solo admin puede escribir

### Frontend - Visualización
- [x] Gráficas cargan datos de Supabase
- [x] Filtros por planta funcionan
- [x] Filtros por fecha funcionan
- [x] Modo Unificado / Split funciona
- [x] KPIs se calculan correctamente
- [x] Export CSV funciona
- [x] Export PDF funciona
- [x] Zoom/Brush funcional

### Frontend - Gestión CRUD
- [x] Botón "Mostrar Gestión" solo para admin
- [x] Formulario "Nueva Analítica" funciona
- [x] Todos los campos se validan
- [x] Crear analítica recarga y muestra en tabla
- [x] Editar inline funciona
- [x] Cancelar edición funciona
- [x] Guardar actualiza en DB y gráfica
- [x] Eliminar con confirmación funciona
- [x] Tabla muestra todos los registros de la planta
- [x] Sincronización tabla ↔ gráfica funciona

### Seguridad
- [x] Usuario standard NO ve gestión
- [x] Usuario standard NO puede editar
- [x] Endpoints protegidos con requireAuth
- [x] Endpoints protegidos con requireAdmin
- [x] JWT en cookies HttpOnly

---

## 🎉 ¡Validación Completa!

Si todos los checks están ✅, el sistema está funcionando perfectamente con:

- ✅ 360 registros de analíticas reales
- ✅ Datos con afluente/efluente
- ✅ CRUD completo funcionando
- ✅ Visualización sincronizada
- ✅ Seguridad implementada
- ✅ Base de datos Supabase conectada

---

## 🐛 Troubleshooting

### Error: "Missing SUPABASE env"
**Solución:** Verificar archivo `.env` existe y tiene las 3 variables

### Error: "Table does not exist"
**Solución:** Ejecutar `scripts/schema.sql` en Supabase SQL Editor

### No aparecen datos en gráficas
**Solución:** Ejecutar `npm run seed` para generar datos

### Botón de gestión no aparece
**Solución:** Usuario debe tener `role: "admin"` en user_metadata

### "Unauthorized" al editar
**Solución:** Login con usuario admin, verificar cookie JWT

---

## 📚 Documentación Adicional

- **[START.md](START.md)** - Guía de inicio rápido
- **[GUIA_ANALITICAS.md](GUIA_ANALITICAS.md)** - Documentación completa
- **[README.md](README.md)** - Documentación general
