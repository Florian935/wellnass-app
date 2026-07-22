-- MUSC-F10c-2 : variantes / alternatives d'exercice (table de liaison symétrique).
-- owner_id NULL = lien éditorial global (admin) ; non-null = lien personnel (utilisateur).
-- Stockage canonique (a < b) → une paire = une ligne quel que soit le sens.
create table public.exercise_variants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  exercise_id_a uuid not null references public.exercises(id),
  exercise_id_b uuid not null references public.exercises(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint exercise_variants_canonical check (exercise_id_a < exercise_id_b)
);

create unique index exercise_variants_unique
  on public.exercise_variants (owner_id, exercise_id_a, exercise_id_b) nulls not distinct;
create index exercise_variants_a on public.exercise_variants (exercise_id_a) where deleted_at is null;
create index exercise_variants_b on public.exercise_variants (exercise_id_b) where deleted_at is null;

create trigger set_updated_at before update on public.exercise_variants
  for each row execute function public.set_updated_at();

alter table public.exercise_variants enable row level security;

create policy exercise_variants_select on public.exercise_variants for select
  using (owner_id is null or owner_id = auth.uid() or public.is_admin());

create policy exercise_variants_insert on public.exercise_variants for insert
  with check (owner_id = auth.uid() or (owner_id is null and public.is_content_editor()));

create policy exercise_variants_update on public.exercise_variants for update
  using (owner_id = auth.uid() or (owner_id is null and public.is_content_editor()))
  with check (owner_id = auth.uid() or (owner_id is null and public.is_content_editor()));

alter publication powersync add table public.exercise_variants;
