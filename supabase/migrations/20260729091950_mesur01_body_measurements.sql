-- US MESUR-01 — mensurations corporelles (roadmap 3.51). Fait descendre E8 de la spec muscu §5,
-- cadrée le 04/07/2026 et jamais dotée d'un modèle de données jusqu'ici.
--
-- ── Modèle NORMALISÉ, et c'est la décision structurante (spec, D1) ─────────────────────────────
-- Une ligne par (utilisateur, jour, type de mesure). L'alternative — une table large avec une
-- colonne par mesure — a été écartée pour trois raisons :
--   1. la liste des mesures a vocation à bouger (la spec E8 dit elle-même « etc. ») et chaque ajout
--      coûterait alors une **migration** ;
--   2. cette table serait majoritairement NULL : personne ne relève les six mesures ;
--   3. « une courbe par mesure » devient ici une requête naturelle au lieu d'un dépliage de colonnes.
-- Corollaire acquis gratuitement : ajouter un jour gauche/droite (décision D3, écartée en V1) ne
-- demandera **aucune migration**.
--
-- BIEN-01 est large, lui, **parce que** ses trois indicateurs sont figés par la roadmap. La
-- divergence est donc assumée, pas une incohérence.
--
-- ── Unités ────────────────────────────────────────────────────────────────────────────────────
-- Stockage **toujours en centimètres**. La bascule métrique/impérial est un fait d'affichage :
-- convertir au stockage ferait dériver l'historique à chaque changement de réglage.
--
-- ⚠️ **Pas de colonne poids** : il vit dans `body_weight_entries` (roadmap 4.30) et sa courbe existe.
-- ⚠️ **Pas de photos** : Storage privé + RLS + quota + effacement RGPD = sous-lot post-V1.

create table public.body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  -- `check` plutôt qu'un enum Postgres : remplacer un check est trivial, faire évoluer un enum ne
  -- l'est pas. Cohérent avec D1 — rester ouvert à l'ajout d'une mesure.
  kind text not null check (kind in ('waist', 'chest', 'hips', 'arm', 'thigh', 'calf')),
  -- Bornes de plausibilité : écarte la virgule oubliée (820 cm) sans juger la morphologie de personne.
  value_cm numeric(5, 1) not null check (value_cm >= 1 and value_cm <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Une seule valeur vivante par (jour, mesure). Index **partiel** : une ligne soft-deletée ne doit pas
-- empêcher d'en recréer une — même patron que `daily_steps` et `daily_wellbeing`.
create unique index body_measurements_user_day_kind_uq
  on public.body_measurements (user_id, log_date, kind)
  where deleted_at is null;

-- Lecture dominante : l'historique d'**une** mesure, c'est-à-dire exactement ce que trace une courbe.
create index body_measurements_user_kind_date_idx
  on public.body_measurements (user_id, kind, log_date desc);

alter table public.body_measurements enable row level security;

-- Calque de `daily_wellbeing` : pas de politique `delete`, le projet fait du soft delete.
create policy body_measurements_select on public.body_measurements
  for select using (user_id = auth.uid());
create policy body_measurements_insert on public.body_measurements
  for insert with check (user_id = auth.uid());
create policy body_measurements_update on public.body_measurements
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- La suppression de compte (CONF-02) passe par `delete from auth.users` : la cascade FK ci-dessus
-- purge donc cette table sans modifier `purge_expired_accounts()`.
