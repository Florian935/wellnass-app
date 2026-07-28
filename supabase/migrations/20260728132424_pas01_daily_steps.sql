-- US PAS-01 — pas quotidiens lus dans Health Connect (roadmap 9.15).
--
-- Une ligne par (utilisateur, jour civil local). Le total vient de l'API d'agrégation de Health
-- Connect, donc déjà dédoublonné entre les sources (téléphone, montre, Google Fit) — on ne stocke
-- jamais les records bruts : un total quotidien ne permet pas de reconstituer des déplacements,
-- une série de records horodatés si (minimisation, spec §7).
--
-- ⚠️ Donnée de santé **synchronisée** : contrairement à CONF-06 (échange local appareil ↔ hub),
-- ces lignes remontent sur nos serveurs. La politique de confidentialité et la section
-- « Sécurité des données » de la fiche Play doivent le refléter.

create table public.daily_steps (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  steps integer not null check (steps >= 0),
  -- Ouvre la porte à une saisie manuelle ultérieure sans nouvelle migration.
  source text not null default 'health_connect',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Une seule ligne vivante par jour. Index **partiel** : une ligne soft-deleted ne doit pas empêcher
-- d'en recréer une pour le même jour (même patron que les autres tables « une ligne par jour »).
create unique index daily_steps_user_day_uq
  on public.daily_steps (user_id, log_date)
  where deleted_at is null;

-- Lecture dominante : l'historique récent d'un utilisateur, du plus récent au plus ancien.
create index daily_steps_user_date_idx on public.daily_steps (user_id, log_date desc);

alter table public.daily_steps enable row level security;

-- Calque de body_weight_entries : pas de politique `delete`, le projet fait du soft delete.
create policy daily_steps_select on public.daily_steps
  for select using (user_id = auth.uid());
create policy daily_steps_insert on public.daily_steps
  for insert with check (user_id = auth.uid());
create policy daily_steps_update on public.daily_steps
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Objectif de pas quotidien. NULL toléré (comptes antérieurs à cette migration) : la coercition
-- vers le défaut (8 000) est faite côté application, comme `profiles.workout_display_level`.
alter table public.profiles
  add column daily_step_goal integer
  check (daily_step_goal is null or (daily_step_goal between 1000 and 50000));
