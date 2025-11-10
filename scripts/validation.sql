-- Validación del esquema y automatizaciones

-- 1) Vista de tareas con status efectivo
select * from public.maintenance_tasks_effective order by scheduled_date limit 20;

-- 2) Trigger de status en tasks: crear una tarea atrasada y verificar que aparece como overdue
insert into public.maintenance_tasks(plant_id, task_type, description, scheduled_date, status)
select id, 'general', 'Prueba overdue', current_date - 5, 'pending' from public.plants limit 1;
select status from public.maintenance_tasks_effective where description = 'Prueba overdue';

-- 3) Emergencia resuelta: resolved_at se fija automáticamente al pasar solved=true
insert into public.maintenance_emergencies(plant_id, reason, solved)
select id, 'Prueba emergencia', false from public.plants limit 1;
update public.maintenance_emergencies set solved=true where reason='Prueba emergencia';
select solved, resolved_at from public.maintenance_emergencies where reason='Prueba emergencia';

-- 4) Estado de planta: cambia a maintenance si hay overdue o emergencias no resueltas
-- Nota: ejecuta tras los inserts anteriores
select id, name, status from public.plants order by name;

-- 5) Unicidad ambiental: intentar duplicar la misma medición debería fallar
-- Inserta una medición
with p as (select id from public.plants limit 1)
insert into public.environmental_data(plant_id, parameter_type, measurement_date, value, unit, stream)
select p.id, 'SS', now(), 100, 'mg/L', 'influent' from p;
-- Intenta duplicar la misma clave
with p as (select id from public.plants limit 1)
insert into public.environmental_data(plant_id, parameter_type, measurement_date, value, unit, stream)
select p.id, 'SS', (select measurement_date from public.environmental_data order by measurement_date desc limit 1), 101, 'mg/L', 'influent' from p;
-- Debe arrojar error de unicidad (ui_env_composite)

-- 6) Generación anual por RPC
select public.generate_yearly_tasks(extract(year from now())::int) as inserted_count;