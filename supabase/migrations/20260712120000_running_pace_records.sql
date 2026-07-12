-- Running R4b : records d'allure personnels (1 ligne par utilisateur × distance).
-- Appliqué manuellement sur le cloud APRÈS 20260712090000/100000/110000 (ordre des timestamps).
-- Réf. : docs/specs/functional/us/5.30-5.31-running-r4b-records.md.

create table public.running_pace_records (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  distance_key text not null check (distance_key in ('1k','5k','10k','semi','marathon')),
  best_time_seconds integer not null,
  run_id uuid not null references public.runs (id) on delete cascade,
  achieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index running_pace_records_user_distance_uidx
  on public.running_pace_records (user_id, distance_key)
  where deleted_at is null;

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.running_pace_records
  for each row execute function public.set_updated_at();

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table public.running_pace_records;

-- RLS (Row Level Security) — pilier Running, records d'allure.
-- Table « utilisateur » (user_id) : select / insert / update — pas de delete (soft delete).

alter table public.running_pace_records enable row level security;

create policy running_pace_records_select on public.running_pace_records
  for select using (user_id = auth.uid());
create policy running_pace_records_insert on public.running_pace_records
  for insert with check (user_id = auth.uid());
create policy running_pace_records_update on public.running_pace_records
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
