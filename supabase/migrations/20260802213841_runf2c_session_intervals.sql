-- US RUN-F2c (roadmap 5.9) — blocs fractionné/intervalles.
-- Une ligne = un bloc de répétitions (comme exercise_plans.target_sets), pas une ligne par
-- répétition individuelle. Étendue au type de séance 'fractionne' uniquement (appliqué côté app).
-- Réf. : docs/specs/functional/us/runf2c-blocs-fractionne.md.

create table public.session_intervals (
  id                          uuid primary key,
  session_id                  uuid not null references public.sessions (id) on delete cascade,
  owner_id                    uuid references auth.users (id) on delete cascade,
  order_index                 integer not null default 0,
  reps                        integer not null default 1,
  fast_distance_m             integer,
  fast_duration_seconds       integer,
  fast_pace_pct_vma           integer,
  recovery_distance_m         integer,
  recovery_duration_seconds   integer,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz
);

create index on public.session_intervals (session_id);

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.session_intervals
  for each row execute function public.set_updated_at();

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table public.session_intervals;

-- RLS (Row Level Security) — même patron que exercise_plans (contenu partageable, owner_id).
-- select : owner_id is null (éditorial/bibliothèque) ou owner_id = auth.uid() (custom utilisateur).
-- insert/update : uniquement si owner_id = auth.uid() (le contenu éditorial n'est jamais écrit
-- depuis l'app). Pas de delete (soft delete via deleted_at).

alter table public.session_intervals enable row level security;

create policy session_intervals_select on public.session_intervals
  for select using (owner_id is null or owner_id = auth.uid());
create policy session_intervals_insert on public.session_intervals
  for insert with check (owner_id = auth.uid());
create policy session_intervals_update on public.session_intervals
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
