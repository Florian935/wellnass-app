-- US Refonte-C3 : note persistante par (utilisateur, exercice), affichée en séance.
-- Réf. : docs/specs/functional/us/refonte-muscu-c3-ajustements-live.md.

create table public.exercise_notes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index exercise_notes_user_exercise_uidx
  on public.exercise_notes (user_id, exercise_id)
  where deleted_at is null;

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.exercise_notes
  for each row execute function public.set_updated_at();

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table public.exercise_notes;

-- RLS (Row Level Security) — table « utilisateur », pas de delete (soft delete).
alter table public.exercise_notes enable row level security;

create policy exercise_notes_select on public.exercise_notes
  for select using (user_id = auth.uid());
create policy exercise_notes_insert on public.exercise_notes
  for insert with check (user_id = auth.uid());
create policy exercise_notes_update on public.exercise_notes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
