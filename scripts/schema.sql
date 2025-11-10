-- PTAR Santa Priscila - Esquema base de datos (Supabase/Postgres)
-- Ejecutar en el SQL Editor de Supabase o con psql. Asegúrate de tener permisos.

-- Extensiones útiles
create extension if not exists pgcrypto;        -- gen_random_uuid()
create extension if not exists pg_trgm;         -- índices para búsquedas ilike

-- Tabla: plants
create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text,
  latitude double precision not null,
  longitude double precision not null,
  status text not null default 'active' check (status in ('active','maintenance','inactive'))
);

-- Tabla: maintenance_tasks
create table if not exists public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  task_type text not null check (task_type in ('preventive','corrective','general')),
  description text not null,
  scheduled_date date not null,
  completed_date date null,
  status text not null default 'pending' check (status in ('pending','completed','overdue'))
);

create index if not exists idx_tasks_plant_status_date on public.maintenance_tasks (plant_id, status, scheduled_date);

-- Trigger para actualizar status en inserción/actualización
create or replace function public.fn_update_task_status() returns trigger as $$
begin
  if new.completed_date is not null then
    new.status := 'completed';
  elsif new.scheduled_date < current_date then
    new.status := 'overdue';
  else
    new.status := coalesce(new.status, 'pending');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_task_status on public.maintenance_tasks;
create trigger trg_update_task_status
before insert or update on public.maintenance_tasks
for each row execute function public.fn_update_task_status();

-- Vista con status efectivo calculado en tiempo real
create or replace view public.maintenance_tasks_effective as
select
  t.id,
  t.plant_id,
  t.task_type,
  t.description,
  t.scheduled_date,
  t.completed_date,
  case
    when t.completed_date is not null then 'completed'
    when t.scheduled_date < current_date then 'overdue'
    else 'pending'
  end as status
from public.maintenance_tasks t;

-- Tabla: maintenance_emergencies
create table if not exists public.maintenance_emergencies (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  reason text not null,
  solved boolean not null default false,
  resolve_time_hours integer null check (resolve_time_hours is null or resolve_time_hours >= 0),
  severity text null check (severity in ('low','medium','high')),
  reported_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists idx_emergencies_plant_solved_reported on public.maintenance_emergencies (plant_id, solved, reported_at);

-- Trigger: set resolved_at al marcar solved=true; limpiarlo si solved=false
create or replace function public.fn_emergency_resolved_ts() returns trigger as $$
begin
  if new.solved is true and new.resolved_at is null then
    new.resolved_at := now();
  end if;
  if new.solved is false then
    new.resolved_at := null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_emergency_resolved_ts on public.maintenance_emergencies;
create trigger trg_emergency_resolved_ts
before insert or update on public.maintenance_emergencies
for each row execute function public.fn_emergency_resolved_ts();

-- Tabla: environmental_data
create table if not exists public.environmental_data (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  parameter_type text not null check (parameter_type in ('DQO','pH','SS')),
  measurement_date timestamptz not null,
  value numeric not null check (value >= 0),
  unit text not null default '',
  stream text null check (stream in ('influent','effluent'))
);

create index if not exists idx_env_plant_param_date on public.environmental_data (plant_id, parameter_type, measurement_date);
-- Unicidad por clave compuesta, tratando NULL en stream como '' para evitar duplicados
create unique index if not exists ui_env_composite on public.environmental_data (
  plant_id, parameter_type, measurement_date, (coalesce(stream, ''))
);

-- Tabla: documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  category text not null check (category in ('technical_report','blueprint','other')),
  description text null,
  uploaded_by text null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_docs_plant_category_uploaded on public.documents (plant_id, category, uploaded_at);
create index if not exists idx_docs_file_name_trgm on public.documents using gin (file_name gin_trgm_ops);

-- Fin del esquema

-- =========================
-- Automatización de estado de planta
-- =========================

-- Función: recalcula status de planta según tareas y emergencias
create or replace function public.fn_refresh_plant_status(p_plant_id uuid) returns void as $$
declare
  v_overdue_tasks int := 0;
  v_unresolved_emergencies int := 0;
begin
  select count(*) into v_overdue_tasks
  from public.maintenance_tasks t
  where t.plant_id = p_plant_id
    and (
      (t.completed_date is null and t.scheduled_date < current_date) -- atrasadas
      or t.status = 'overdue'
    );

  select count(*) into v_unresolved_emergencies
  from public.maintenance_emergencies e
  where e.plant_id = p_plant_id and e.solved = false;

  update public.plants p
  set status = case
    when v_unresolved_emergencies > 0 or v_overdue_tasks > 0 then 'maintenance'
    else 'active'
  end
  where p.id = p_plant_id and p.status <> 'inactive'; -- no auto-cambiar si está inactiva manualmente
end;
$$ language plpgsql;

-- Triggers para refrescar al cambiar tareas
create or replace function public.fn_tasks_refresh_plant_status() returns trigger as $$
begin
  perform public.fn_refresh_plant_status(coalesce(new.plant_id, old.plant_id));
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_refresh_plant_status on public.maintenance_tasks;
create trigger trg_tasks_refresh_plant_status
after insert or update or delete on public.maintenance_tasks
for each row execute function public.fn_tasks_refresh_plant_status();

-- Triggers para refrescar al cambiar emergencias
create or replace function public.fn_emergencies_refresh_plant_status() returns trigger as $$
begin
  perform public.fn_refresh_plant_status(coalesce(new.plant_id, old.plant_id));
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_emergencies_refresh_plant_status on public.maintenance_emergencies;
create trigger trg_emergencies_refresh_plant_status
after insert or update or delete on public.maintenance_emergencies
for each row execute function public.fn_emergencies_refresh_plant_status();

-- =========================
-- Constraints adicionales (calidad de datos)
-- =========================

alter table public.plants
  add constraint if not exists chk_plants_latitude_range check (latitude between -90 and 90);
alter table public.plants
  add constraint if not exists chk_plants_longitude_range check (longitude between -180 and 180);

alter table public.environmental_data
  add constraint if not exists chk_ph_range check (
    parameter_type <> 'pH' or (value between 0 and 14)
  );

-- =========================
-- Generador anual de tareas (RPC opcional)
-- =========================

create or replace function public.generate_yearly_tasks(p_year int default extract(year from now())) returns int as $$
declare
  v_inserted int := 0;
begin
  with plant_ids as (
    select id from public.plants
  ),
  existing as (
    select distinct plant_id from public.maintenance_tasks
    where scheduled_date between make_date(p_year,1,1) and make_date(p_year,12,31)
  ),
  to_create as (
    select p.id as plant_id
    from plant_ids p
    left join existing e on e.plant_id = p.id
    where e.plant_id is null
  )
  insert into public.maintenance_tasks (plant_id, task_type, description, scheduled_date, status)
  select plant_id, 'general', 'Mantenimiento completo', make_date(p_year,7,1), 'pending'
  from to_create;

  get diagnostics v_inserted = row_count;
  return coalesce(v_inserted, 0);
end;
$$ language plpgsql security definer;