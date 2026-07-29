-- US OBJ-01 — objectifs personnels à échéance (roadmap 7.15).
--
-- ── Ce que cette table ne contient PAS, et pourquoi (décision D5) ─────────────────────────────
-- Ni `status`, ni `progress`. Les deux sont **dérivables** de la fenêtre `[start_date, deadline]`
-- par `computeGoalProgress` (packages/shared/src/goals.ts). Les stocker créerait une seconde vérité
-- à maintenir, **et surtout un écrivain à déclencher** : il faudrait un cron ou un job au démarrage
-- pour clôturer les objectifs échus. Une app mobile hors ligne n'offre aucun moment fiable pour ça.
--
-- Corollaire heureux : le verdict est **stable**. Un record battu deux mois après l'échéance tombe
-- hors fenêtre et ne peut pas « réussir » rétroactivement un objectif passé.
--
-- ⚠️ La **sync rule** reste à déployer **à la main** dans le dashboard PowerSync (bucket
-- `user_data` — donnée personnelle). Sans elle, les objectifs restent locaux et ne remontent jamais,
-- sans aucune erreur visible.

create table public.personal_goals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- `check` plutôt qu'un type enum : ajouter un type d'objectif plus tard (volume, poids, pas,
  -- nombre de séances) ne demandera que de remplacer ce check — pas de migration de données.
  kind text not null check (kind in ('run_distance', 'exercise_1rm')),

  -- Cible : mètres pour `run_distance`, kilogrammes pour `exercise_1rm`.
  target_value numeric(10, 2) not null check (target_value > 0),

  -- Valeur de départ **figée à la création** (décision D6) : le 1RM du jour où l'objectif est posé.
  -- « +5 kg au développé » n'a de sens que par rapport à ce point de référence. Même patron que
  -- `start_weight_kg` (NUTR-11). NULL pour un cumul, qui part de zéro par construction.
  start_value numeric(10, 2),

  -- Exercice visé, requis pour `exercise_1rm`. `on delete set null` et **non** cascade : si un
  -- exercice éditorial disparaît, l'objectif ne doit pas s'évaporer avec lui. Il devient non
  -- calculable, et l'UI le **dit** plutôt que d'afficher 0 % — qui se lirait comme un échec.
  exercise_id uuid references public.exercises (id) on delete set null,

  start_date date not null,
  deadline date not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Une échéance antérieure au début rendrait la fenêtre de mesure vide, donc la progression
  -- ininterprétable. Contrôlé aussi côté applicatif (`validateGoalTarget`).
  constraint personal_goals_deadline_after_start check (deadline >= start_date)
);

-- L'affichage trie par échéance : l'objectif le plus urgent en premier.
create index personal_goals_user_deadline_idx
  on public.personal_goals (user_id, deadline desc)
  where deleted_at is null;

alter table public.personal_goals enable row level security;

-- Pas de politique `delete` : le projet fait du soft delete (`deleted_at`).
create policy personal_goals_select on public.personal_goals
  for select using (user_id = auth.uid());
create policy personal_goals_insert on public.personal_goals
  for insert with check (user_id = auth.uid());
create policy personal_goals_update on public.personal_goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
