-- US AUTRE-01 — les **autres activités** (vélo, natation, rando…), saisies à la main.
--
-- Jusqu'ici l'application ne connaissait que **deux** types d'activité, partout : la série, le jour
-- d'entraînement, la charge (ACWR / garde-fou), le temps d'entraînement et Health Connect. Trois
-- heures de vélo un dimanche comptaient pour un jour de repos — et cassaient la série.
--
-- ── 🔴 `activity_type` SANS contrainte CHECK, comme `pain_reports.zone` ───────────────────────────
-- Le catalogue (22 entrées, `packages/shared/src/activity.ts`) est **applicatif et destiné à
-- grossir** : le padel manque au Compendium 2011, les sports d'hiver sont regroupés. Un CHECK
-- imposerait une migration à chaque ajout et, surtout, **bloquerait la file d'upload PowerSync** si
-- un client plus récent écrivait un type que le serveur ne connaît pas encore. Une valeur inconnue
-- retombe sur « Autre » à la lecture, elle ne fait jamais disparaître la ligne.
--
-- `intensity` **garde** son CHECK : trois valeurs fermées par la spec (test de la parole), et une
-- valeur inconnue y serait un bug, pas une évolution. Même arbitrage que `pain_reports.level`.
--
-- ── 🔴 La dépense n'est PAS stockée (décision D3) ────────────────────────────────────────────────
-- Elle est recalculée à la lecture par `estimateActivityEnergy`, avec le **poids à la date** de
-- l'activité. C'est ce qui corrige le défaut constaté sur les courses (analyse §2, constat C6) :
-- la dernière pesée réécrivait l'estimation de tous les jours passés, et l'adhérence avec.
-- Seul `device_kcal` est conservé : un chiffre lu sur une montre est une **mesure**, pas une
-- estimation, et rien ne permettrait de le recalculer.
--
-- ── Aucune contrainte d'unicité, volontairement ──────────────────────────────────────────────────
-- On peut faire deux sorties vélo le même jour, et deux appareils hors réseau peuvent saisir la même
-- (le dédoublonnage est un problème d'IMPORT, pas de saisie). Une violation d'unicité bloquerait la
-- file d'upload pour un gain nul — même raisonnement que `shopping_lists` (REPAS-01, D6).

create table public.activities (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Clé du catalogue applicatif. Sans CHECK — voir l'en-tête.
  activity_type text not null,
  -- Début de l'activité (UTC). Le jour de rattachement se calcule en heure LOCALE côté client,
  -- comme pour `runs.finished_at` : une sortie de 23 h 30 appartient à ce jour-là, pas au suivant.
  started_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0),
  intensity text not null check (intensity in ('light', 'moderate', 'vigorous')),
  -- Ressenti 1-10, prérempli depuis l'intensité. 🔴 C'est LUI qui alimente la charge sRPE
  -- (RPE × minutes) : sans ressenti, une activité pèserait zéro dans l'ACWR et le garde-fou.
  rpe integer check (rpe between 1 and 10),
  distance_m integer check (distance_m >= 0),
  -- Calories ACTIVES lues sur une montre (décision D6) : remplacent l'estimation quand elles existent.
  device_kcal integer check (device_kcal >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.activities is
  'US AUTRE-01 — activités hors muscu et course, saisies à la main. La dépense n''est pas stockée : elle se recalcule avec le poids à la date (décision D3).';
comment on column public.activities.activity_type is
  'Clé du catalogue applicatif (ACTIVITY_TYPES). Volontairement sans CHECK — liste évolutive, un type inconnu ne doit pas bloquer la synchro.';
comment on column public.activities.device_kcal is
  'Calories actives lues sur une montre. Mesure conservée telle quelle, jamais recalculée.';

-- Lecture dominante : « mes activités récentes », pour le jour courant, l'historique et les totaux.
create index activities_user_started_idx on public.activities (user_id, started_at desc);

alter table public.activities enable row level security;

-- Pas de politique `delete` : soft delete, comme partout dans ce schéma.
create policy activities_select on public.activities
  for select using (user_id = auth.uid());
create policy activities_insert on public.activities
  for insert with check (user_id = auth.uid());
create policy activities_update on public.activities
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
