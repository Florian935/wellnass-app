-- US LABO-01 — le Labo (roadmap 7.30). Deux ajouts, tous deux sans reprise de données.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- 1. `daily_wellbeing.sleep_minutes` — la nuit, saisie au check-in (décision Florian, 15/09/2026)
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Le Labo a besoin du sommeil (l'anneau des nuits, la proposition « nuit courte », les enquêtes et
-- les acquis). Le sommeil de Health Connect reste **écarté** (arbitrage du 28/07/2026 : la
-- déclaration Play ne porte pas `READ_SLEEP`) : c'est donc une durée **saisie**, facultative, comme
-- les trois indicateurs de BIEN-01. BIEN-01 l'avait anticipé (spec D1 : « un 4ᵉ indicateur coûterait
-- une colonne, à ajouter plus tard sans rien casser »).
--
-- Sémantique : la nuit **qui précède** `log_date` (le check-in se fait le matin). En minutes, de 0 à
-- 14 h — au-delà, c'est une erreur de saisie, pas une nuit.
--
-- ⚠️ Donnée de santé **synchronisée**, comme humeur / énergie / stress : la politique de
-- confidentialité doit mentionner la durée de sommeil saisie.

alter table public.daily_wellbeing
  add column sleep_minutes smallint
  check (sleep_minutes is null or sleep_minutes between 0 and 840);

-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- 2. `lab_experiments` — les expériences sur soi
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Une expérience = un modèle (`kind`), une date de début (un lundi), et l'ordre tiré au sort de ses
-- quatre semaines (`schedule`, deux « test » et deux « usual »). L'ordre est **enregistré** : le
-- retirer au sort à chaque lecture changerait le protocole en cours de route.
--
-- Pas de colonne « verdict » : il se **calcule** à la fin sur les données réelles (allure, énergie),
-- par une fonction pure testée (`experimentVerdict`, @wellness/shared). Le stocker figerait un
-- résultat qu'une séance saisie en retard doit pouvoir corriger.
--
-- Les modèles sont une liste fermée côté application ; la contrainte `check` la tient aussi côté
-- base, pour qu'un client obsolète ne puisse pas écrire un modèle inconnu.

create table public.lab_experiments (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('legs48h', 'carbsHardDays', 'earlierBedtime')),
  start_date date not null,
  schedule jsonb not null,
  -- Trois états, et ils ne disent pas la même chose :
  --   running  = les 4 semaines courent encore, verdict scellé ;
  --   finished = elles sont passées, le verdict est rendu — l'expérience est un ACQUIS ;
  --   stopped  = arrêtée en cours de route, elle ne rendra pas de verdict (et le dit).
  -- 🔴 `finished` n'est pas décoratif : sans lui, l'index partiel ci-dessous garderait à vie la
  -- ligne d'une expérience TERMINÉE, et son modèle ne pourrait plus jamais être relancé.
  status text not null default 'running' check (status in ('running', 'finished', 'stopped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Une seule expérience EN COURS d'un même modèle à la fois : deux « jambes 48 h » en parallèle se
-- contamineraient (la semaine « habitude » de l'une serait la semaine « essai » de l'autre). Index
-- partiel, même patron que `daily_wellbeing` (une ligne soft-deleted ne bloque rien).
--
-- ⚠️ Le prédicat porte sur `'running'` SEUL : une expérience `finished` ou `stopped` ne bloque plus
-- son modèle, sans quoi on ne pourrait refaire un essai qu'une fois dans sa vie.
create unique index lab_experiments_user_kind_running_uq
  on public.lab_experiments (user_id, kind)
  where deleted_at is null and status = 'running';

create index lab_experiments_user_start_idx on public.lab_experiments (user_id, start_date desc);

alter table public.lab_experiments enable row level security;

-- Calque de `daily_wellbeing` : pas de politique `delete`, le projet fait du soft delete.
create policy lab_experiments_select on public.lab_experiments
  for select using (user_id = auth.uid());
create policy lab_experiments_insert on public.lab_experiments
  for insert with check (user_id = auth.uid());
create policy lab_experiments_update on public.lab_experiments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- La suppression de compte (CONF-02) passe par `delete from auth.users` : la cascade FK purge cette
-- table sans toucher à `purge_expired_accounts()`.
