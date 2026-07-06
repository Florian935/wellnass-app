-- Running R1 — table runs (tracker GPS nu, course libre).
-- Appliqué manuellement par un humain sur le cloud Supabase ou en local (Docker).
-- Publication `powersync` : ce fichier ajoute public.runs à la réplication logique.
-- Réf. : docs/specs/technical/running-r1-tracker-gps.md §3.

create table public.runs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  source text not null default 'gps' check (source in ('gps','manual')),
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_seconds integer,
  distance_m numeric,
  avg_pace_s_per_km numeric,
  gps_track text,
  rpe integer check (rpe between 1 and 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.runs for each row execute function public.set_updated_at();

-- Index partiel (lignes non supprimées uniquement)
create index on public.runs (user_id, status) where deleted_at is null;

-- Publication logique PowerSync
alter publication powersync add table public.runs;

-- RLS (Row Level Security) — table utilisateur runs.
-- Table utilisateur (user_id) : select / insert / update — pas de delete (soft delete via deleted_at).
alter table public.runs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['runs']
  loop
    execute format('create policy %I_select on public.%I for select using (user_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (user_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t, t);
  end loop;
end $$;
