-- Chantier « le Labo, carrefour des piliers » (30/09/2026) — US LIENS-01 et LABO-04.
-- Deux ajouts, strictement additifs, sans reprise de données.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- 1. `cross_link_weeks` — l'histoire d'un lien, figée semaine par semaine (US LIENS-01, décision Q5)
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Chaque fiche du Labo montre les huit dernières semaines de son lien (garde-fou, à régler, ça
-- tient, à découvrir). Florian a tranché le 30/09/2026 : l'histoire est **figée**, pas recalculée à
-- chaque ouverture. Recalculer rejouerait des semaines passées avec des données qui ont bougé
-- depuis (un repas saisi en retard, un poids corrigé) : l'histoire se réécrirait, exactement le
-- défaut du verdict d'expérience que LABO-04 corrige juste en dessous.
--
-- Une ligne = un lien × une semaine (lundi). L'app met à jour la ligne de la semaine **en cours**
-- quand l'état change, et ne touche **jamais** une semaine passée : c'est ce qui la fige.
--
-- 🔴 **Aucune contrainte d'unicité**, délibérément (patron `activities`, `run_efforts`). L'identifiant
-- est **déterministe** côté app (`stableUuid(user|semaine|lien)`) : deux appareils qui figent la même
-- semaine du même lien écrivent la même ligne, et la seconde écriture remplace la première. Un index
-- unique aurait rendu l'upload de la seconde **rejeté** — et un rejet fige la file PowerSync de
-- **toutes** les tables (leçon LABO-01 R7 bis).
--
-- 🔴 **`link_id` et `state` sans CHECK**, pour la même raison que `activities.activity_type` : le
-- registre des liens grossira (un lien = une question), et une valeur inconnue venue d'un client
-- plus récent bloquerait la file d'upload. L'app filtre ce qu'elle ne connaît pas à la lecture.

create table public.cross_link_weeks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  link_id text not null,
  state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index cross_link_weeks_user_week_idx on public.cross_link_weeks (user_id, week_start desc);

alter table public.cross_link_weeks enable row level security;

-- Calque de `lab_experiments` : pas de politique `delete`, le projet fait du soft delete.
create policy cross_link_weeks_select on public.cross_link_weeks
  for select using (user_id = auth.uid());
create policy cross_link_weeks_insert on public.cross_link_weeks
  for insert with check (user_id = auth.uid());
create policy cross_link_weeks_update on public.cross_link_weeks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- La suppression de compte (CONF-02) passe par `delete from auth.users` : la cascade FK purge cette
-- table sans toucher à `purge_expired_accounts()`.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'powersync'
      and schemaname = 'public'
      and tablename = 'cross_link_weeks'
  ) then
    alter publication powersync add table public.cross_link_weeks;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- 2. `lab_experiments.verdict` — le verdict figé à la clôture (US LABO-04)
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- La migration LABO-01 écrivait : « Pas de colonne verdict : il se calcule à la fin sur les données
-- réelles ». La recette l'a contredite (constat LABO-01 §4 bis-1) : le calcul lit une fenêtre
-- **glissante** de 56 jours, une expérience en dure 28 — vingt-huit jours après son verdict, ses
-- premières semaines sortent de la fenêtre et « vérifié » redevient « pas assez de mesures ». Un
-- acquis ne se désapprend pas parce que le temps passe.
--
-- Le verdict est donc écrit **une fois**, quand l'app clôt l'expérience (`status = 'finished'`).
-- Nullable : une ligne close avant LABO-04 n'en a pas, et l'app recalcule alors comme avant.

alter table public.lab_experiments
  add column verdict jsonb;
