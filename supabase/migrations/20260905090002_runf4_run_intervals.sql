-- US RUN-F4 (lot F) — le réalisé descend au niveau de la RÉPÉTITION.
-- Réf. : docs/product/analyse-seances-structurees-running.md (mur M10)
--
-- Aujourd'hui `runs` = 12 champs globaux + la trace GPS, et les 3 colonnes `interval_phase_*`
-- ajoutées par RUN-F2d sont un CURSEUR de position en direct (écrasé à chaque transition),
-- pas un résultat. Une séance de fractionné se lit pourtant « reps 1 à 5 à 4:01, la 7e a
-- lâché à 4:40 », pas « j'ai couru 8 km ». Cette table est l'équivalent de l'onglet
-- « Détail des tours » du plan analysé : une ligne par phase franchie.
--
-- Alimentée à chaque transition de phase par le tracker, depuis le curseur qui existe déjà.
-- Aucune donnée dérivable n'est stockée deux fois : l'allure réalisée est recalculée à la
-- lecture quand distance et durée sont là — sauf `actual_pace_s_per_km`, matérialisée parce
-- qu'elle est lue dans des listes et des agrégats (même arbitrage que `runs.avg_pace_s_per_km`).

create table if not exists public.run_intervals (
  id                          uuid primary key,
  run_id                      uuid not null references public.runs (id) on delete cascade,
  user_id                     uuid not null references auth.users (id) on delete cascade,

  -- Position dans la linéarisation de la séance (`expandIntervalPhases`). Sert de clé
  -- naturelle avec `run_id` : une phase franchie deux fois (rattrapage après remontage
  -- d'écran) ne doit pas produire deux lignes.
  phase_index                 integer not null,

  -- Segment d'origine. Nullable **volontairement** : la séance planifiée peut être modifiée
  -- ou supprimée après coup, et le réalisé d'une course passée ne doit jamais disparaître
  -- avec elle. Pas de FK pour la même raison (une FK avec on delete cascade effacerait
  -- l'historique, une FK restrictive bloquerait l'édition du programme).
  block_id                    uuid,

  -- 'fast' | 'recovery' : la phase telle que linéarisée. La NATURE du segment d'origine
  -- (warmup/work/cooldown…) est recopiée dans `segment_kind` — recopiée et non jointe, pour
  -- que le réalisé reste lisible même si le segment est modifié ensuite.
  phase_kind                  text not null,
  segment_kind                text,

  rep                         integer,
  total_reps                  integer,

  -- Le PRÉVU, figé au moment où la phase est franchie (photo de la consigne du jour).
  planned_distance_m          integer,
  planned_duration_seconds    integer,
  planned_pace_min_s_per_km   integer,
  planned_pace_max_s_per_km   integer,

  -- Le RÉALISÉ.
  actual_distance_m           numeric,
  actual_duration_seconds     numeric,
  actual_pace_s_per_km        numeric,

  started_at                  timestamptz,
  finished_at                 timestamptz,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz
);

create index if not exists run_intervals_run_idx
  on public.run_intervals (run_id, phase_index)
  where deleted_at is null;

-- Une phase franchie ne produit qu'une ligne, même après un rattrapage silencieux
-- (RUN-F2d R8 bis rejoue la progression au remontage de l'écran). Index unique **partiel** :
-- une ligne soft-deletée ne doit pas empêcher d'en recréer une — patron `pain_reports`.
create unique index if not exists run_intervals_run_phase_uq
  on public.run_intervals (run_id, phase_index)
  where deleted_at is null;

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
drop trigger if exists set_updated_at on public.run_intervals;
create trigger set_updated_at before update on public.run_intervals
  for each row execute function public.set_updated_at();

-- RLS — table « utilisateur » (user_id) : select / insert / update, pas de delete
-- (soft delete via deleted_at). Même patron que `runs`.
alter table public.run_intervals enable row level security;

drop policy if exists run_intervals_select on public.run_intervals;
drop policy if exists run_intervals_insert on public.run_intervals;
drop policy if exists run_intervals_update on public.run_intervals;

create policy run_intervals_select on public.run_intervals
  for select using (user_id = auth.uid());
create policy run_intervals_insert on public.run_intervals
  for insert with check (user_id = auth.uid());
create policy run_intervals_update on public.run_intervals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
