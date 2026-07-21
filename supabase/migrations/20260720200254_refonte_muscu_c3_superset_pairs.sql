-- US Refonte-C3 (révision recette) : liaison superset explicite, choix libre du
-- partenaire (plus de contrainte d'adjacence), valable pour toute la séance.
-- Réf. : docs/specs/functional/us/refonte-muscu-c3-ajustements-live.md.

create table public.workout_superset_pairs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id_a uuid not null references public.exercises (id) on delete cascade,
  exercise_id_b uuid not null references public.exercises (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on public.workout_superset_pairs (workout_id) where deleted_at is null;

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.workout_superset_pairs
  for each row execute function public.set_updated_at();

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table public.workout_superset_pairs;

-- RLS (Row Level Security) — table « utilisateur », pas de delete (soft delete).
alter table public.workout_superset_pairs enable row level security;

create policy workout_superset_pairs_select on public.workout_superset_pairs
  for select using (user_id = auth.uid());
create policy workout_superset_pairs_insert on public.workout_superset_pairs
  for insert with check (user_id = auth.uid());
create policy workout_superset_pairs_update on public.workout_superset_pairs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
