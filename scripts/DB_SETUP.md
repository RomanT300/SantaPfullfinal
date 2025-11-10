# Configuración de Base de Datos (Supabase/Postgres)

Este proyecto incluye un esquema SQL para crear todas las tablas, índices, triggers y vistas necesarias para que los datos se gestionen automáticamente y escalen bien.

## Archivos

- `scripts/schema.sql`: DDL completo (tablas, índices, triggers, vista `maintenance_tasks_effective`).
- `scripts/seed.ts`: script de ejemplo que inserta datos demo usando la service key.

## Cómo aplicar el esquema

1. Abre tu proyecto en Supabase.
2. Ve a `SQL` → `Nuevo Query`.
3. Copia y pega el contenido de `scripts/schema.sql` y ejecútalo.
4. Verifica que las tablas se hayan creado (`Table editor`).

> Nota: El esquema usa `pgcrypto` y `pg_trgm`. Si tu proyecto no permite habilitarlas, retira las líneas `create extension if not exists ...` y los índices `trgm`.

## Qué automatiza el esquema

- `maintenance_tasks`: trigger que actualiza `status` en inserción/actualización, y vista `maintenance_tasks_effective` que calcula `status` en tiempo real.
- `maintenance_emergencies`: trigger que fija `resolved_at` cuando `solved=true` y lo limpia si `solved=false`.
- `plants`: triggers que refrescan automáticamente el `status` de la planta a `maintenance` si hay tareas atrasadas o emergencias no resueltas; vuelve a `active` cuando se resuelven. No cambia `inactive` automáticamente.
- `environmental_data`: unicidad por `plant_id + parameter_type + measurement_date + stream(NULL→'')` para evitar duplicados; índices optimizan consultas por fecha y planta; constraint para `pH` en rango 0–14.
- `documents`: índice `trgm` para búsquedas por nombre (`ilike`), y índices por `plant_id`, `category`, `uploaded_at`.

## Validación rápida

Incluí `scripts/validation.sql` con consultas de prueba para:
- Comprobar la vista `maintenance_tasks_effective` y su cálculo de `status` en tiempo real.
- Verificar triggers en `maintenance_emergencies` (auto `resolved_at`).
- Confirmar el refresco automático del `status` de `plants` ante tareas vencidas o emergencias.
- Probar la unicidad compuesta en `environmental_data` para evitar duplicados.
- Ejecutar la RPC `generate_yearly_tasks` y ver cuántas tareas inserta.

Puedes copiar y ejecutar cada bloque en el editor SQL de Supabase.

## Uso desde la API

- Listado de tareas usa la vista `maintenance_tasks_effective` si existe; si no, hace fallback a la tabla.
- Endpoints tienen filtros y paginación opcional (`page`, `limit`). Si no los envías, devuelven todo para mantener compatibilidad.

## Sembrado de datos demo

Configura las variables en `.env` y ejecuta:

```
node scripts/seed.ts
```

El seed usa `SUPABASE_SERVICE_KEY` para evitar fricción con RLS. Ajusta datasets según tus plantas reales.

## Observaciones de operación

- El backend usa `SUPABASE_SERVICE_KEY`, por lo que las consultas de servidor no requieren RLS; puedes añadir RLS más adelante para clientes.
- Si `maintenance_tasks_effective` aún no existe, el backend hace fallback a la tabla `maintenance_tasks`.
- En `plants`, `inactive` no se cambia automáticamente; los triggers sólo alternan entre `active` y `maintenance`.

## Generación automática anual (opcional)

- Ejecuta la función: `select public.generate_yearly_tasks(2025);`
- Puedes programarlo con `pg_cron` si tu proyecto lo permite:
  - `select cron.schedule('yearly_tasks', '0 3 1 1 *', $$select public.generate_yearly_tasks(extract(year from now())::int);$$);`
  - Esto corre cada 1 de enero a las 03:00.
  - Si `pg_cron` no está disponible, usa el endpoint `POST /api/maintenance/tasks/generate-monthly` que intenta usar RPC y hace fallback en backend.