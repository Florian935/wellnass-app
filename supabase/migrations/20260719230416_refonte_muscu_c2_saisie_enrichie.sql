-- US Refonte-C2 : saisie enrichie de l'écran de séance muscu.
-- 1) RPE par série (1-10, optionnel).
-- 2) Charge planifiée figée (snapshot au démarrage, comparaison prévu/réalisé).
-- 3) Nouveaux types de séries : 'dropset' et 'failure' (échec) — assouplissement des CHECK.
--
-- Migration NON idempotente (drop+add de contrainte) : ne jamais rejouer.
-- 🔴 Checkpoint cloud : poussée via le CLI (npm run db:push) après go explicite. Jamais de SQL collé à la main.

-- 1) RPE par série (même borne que workouts.rpe / runs.rpe).
alter table public.workout_sets
  add column if not exists rpe integer check (rpe between 1 and 10);

-- 2) Charge planifiée (cible du plan figée au démarrage ; nullable hors plan / séance libre).
alter table public.workout_sets
  add column if not exists planned_weight_kg numeric
    check (planned_weight_kg is null or planned_weight_kg >= 0);

-- 3) Assouplir le CHECK set_type : ajout de 'dropset' et 'failure' sur les deux tables porteuses.
--    Noms de contraintes = auto-nommage Postgres des CHECK de colonne inline anonymes d'origine.
alter table public.workout_sets   drop constraint if exists workout_sets_set_type_check;
alter table public.workout_sets   add  constraint workout_sets_set_type_check
  check (set_type in ('normal','warmup','superset','duration','bodyweight','dropset','failure'));

alter table public.exercise_plans drop constraint if exists exercise_plans_set_type_check;
alter table public.exercise_plans add  constraint exercise_plans_set_type_check
  check (set_type in ('normal','warmup','superset','duration','bodyweight','dropset','failure'));
