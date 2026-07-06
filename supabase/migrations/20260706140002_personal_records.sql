-- US3 : table personal_records — records personnels muscu (max_weight, estimated_1rm, best_volume).
-- Appliqué manuellement par un humain sur le cloud Supabase ou en local (Docker).
-- Vérifier que la publication `powersync` existe avant d'appliquer
-- (créée dans la migration 20260706120000_socle_muscu_tables.sql).
-- Réf. : docs/specs/technical/schema-donnees-muscu.md §4.4.

create table public.personal_records (
  id           uuid        primary key,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  exercise_id  uuid        not null references public.exercises (id),
  type         text        not null check (type in ('max_weight','estimated_1rm','best_volume')),
  value        numeric     not null,
  reps         integer,
  weight_kg    numeric,
  workout_id   uuid        references public.workouts (id),
  achieved_at  timestamptz not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at
  before update on public.personal_records
  for each row execute function public.set_updated_at();

-- Index partiel pour les lookups fréquents (user + exercice + type, lignes non supprimées)
create index on public.personal_records (user_id, exercise_id, type)
  where deleted_at is null;

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table public.personal_records;

-- RLS (table utilisateur — même patron que workouts/workout_sets) :
-- select / insert / update restreints à user_id = auth.uid() ; pas de delete (soft delete).
alter table public.personal_records enable row level security;

create policy personal_records_select on public.personal_records
  for select using (user_id = auth.uid());

create policy personal_records_insert on public.personal_records
  for insert with check (user_id = auth.uid());

create policy personal_records_update on public.personal_records
  for update using  (user_id = auth.uid())
            with check (user_id = auth.uid());
