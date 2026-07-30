-- US CYCLE-01 — suivi du cycle menstruel (roadmap 1.25 / 1.26).
--
-- **Deux tables volontairement indépendantes** (spec §2, R1) :
--   * `menstrual_periods`     — une ligne par période de règles (début, fin).
--   * `menstrual_daily_logs`  — une ligne par jour saisi (flux, symptômes).
-- Un jour de flux peut exister sans période déclarée (saisie au fil de l'eau), et une période peut
-- n'avoir aucun log quotidien. Les lier par une clé étrangère imposerait un ordre de saisie que
-- personne ne respecte en pratique.
--
-- Le découpage calque **volontairement** la façon dont Health Connect modélise le sujet
-- (`MenstruationPeriod` = un intervalle · `MenstruationFlow` = un enregistrement par jour) : la
-- synchronisation de l'étape 7 devient une correspondance directe au lieu d'une couche de traduction.
--
-- ⚠️ **Donnée de santé SENSIBLE, et synchronisée hors de l'appareil.** Comme les pas (PAS-01) et le
-- bien-être (BIEN-01), ces lignes remontent sur nos serveurs — mais celle-ci relève d'une catégorie
-- particulière au sens du RGPD et de Google Play. Trois conséquences, toutes hors SQL :
--   1. politique de confidentialité : paragraphe dédié (docs/specs/technical/lance00-…md) ;
--   2. formulaire « Sécurité des données » : catégorie sensible, collectée ET transmise ;
--   3. déclaration Health apps étendue à 6 types (docs/specs/technical/health-connect-play-declaration.md).
--
-- ⚠️ **Opt-in strict** (spec R16) : tant que `user_settings.cycle_tracking_enabled` est faux, aucune
-- ligne n'est écrite ici. La garde est applicative (repository), pas SQL — une contrainte SQL
-- empêcherait de *conserver* les données quand l'utilisatrice désactive le suivi sans les supprimer
-- (R17, « garder » doit rester possible).

-- ---------------------------------------------------------------------------
-- 1. Périodes
-- ---------------------------------------------------------------------------

create table public.menstrual_periods (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_on date not null,
  -- `null` = période **en cours**. C'est un état normal, pas une donnée manquante.
  ended_on date,
  -- Origine de la ligne. Sert à la déduplication Health Connect (R21 : la saisie manuelle gagne).
  source text not null default 'manual' check (source in ('manual', 'health_connect')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Invariant de base : une période ne se termine pas avant d'avoir commencé.
-- La borne des 15 jours (R3) n'est **pas** une contrainte SQL : c'est une clôture *automatique*
-- côté application. En faire un `check` rejetterait aussi les imports Health Connect plus longs,
-- alors que la règle veut les accueillir puis les signaler — refuser la donnée serait pire.
alter table public.menstrual_periods
  add constraint menstrual_periods_dates_ck check (ended_on is null or ended_on >= started_on);

-- R2 — **une seule période en cours à la fois**. Sans cet index, un oubli de « fin » laisse deux
-- périodes ouvertes et toute la suite (longueurs de cycle, moyenne, prédiction) devient fausse
-- silencieusement. Partiel deux fois : sur `ended_on is null` (en cours) et sur `deleted_at is null`
-- (une période supprimée ne doit pas bloquer).
create unique index menstrual_periods_one_open_uq
  on public.menstrual_periods (user_id)
  where ended_on is null and deleted_at is null;

-- Deux périodes vivantes ne peuvent pas commencer le même jour : c'est ce qui rend la déduplication
-- Health Connect (R21) déterministe, `started_on` servant de clé de rapprochement.
create unique index menstrual_periods_user_start_uq
  on public.menstrual_periods (user_id, started_on)
  where deleted_at is null;

-- Lecture dominante : l'historique d'une utilisatrice, du plus récent au plus ancien.
create index menstrual_periods_user_start_idx
  on public.menstrual_periods (user_id, started_on desc);

alter table public.menstrual_periods enable row level security;

-- Calque de `daily_wellbeing` : pas de politique `delete`, le projet fait du soft delete.
create policy menstrual_periods_select on public.menstrual_periods
  for select using (user_id = auth.uid());
create policy menstrual_periods_insert on public.menstrual_periods
  for insert with check (user_id = auth.uid());
create policy menstrual_periods_update on public.menstrual_periods
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Journal quotidien
-- ---------------------------------------------------------------------------

create table public.menstrual_daily_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  -- Nullable : un jour peut ne porter que des symptômes, sans flux.
  flow text check (flow is null or flow in ('spotting', 'light', 'medium', 'heavy')),
  -- **Liste fermée, aucun champ libre** (R7) : un texte libre dans une donnée de santé sensible est
  -- un risque disproportionné, et il ne serait ni traduisible ni exploitable en croisement.
  -- Le contrôle du vocabulaire est applicatif (schéma Zod partagé) ; SQL ne garantit que la forme.
  symptoms jsonb not null default '[]'::jsonb check (jsonb_typeof(symptoms) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Une seule ligne vivante par jour (même patron que `daily_wellbeing` et `daily_steps`).
create unique index menstrual_daily_logs_user_day_uq
  on public.menstrual_daily_logs (user_id, log_date)
  where deleted_at is null;

create index menstrual_daily_logs_user_date_idx
  on public.menstrual_daily_logs (user_id, log_date desc);

alter table public.menstrual_daily_logs enable row level security;

create policy menstrual_daily_logs_select on public.menstrual_daily_logs
  for select using (user_id = auth.uid());
create policy menstrual_daily_logs_insert on public.menstrual_daily_logs
  for insert with check (user_id = auth.uid());
create policy menstrual_daily_logs_update on public.menstrual_daily_logs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Réglages d'activation
-- ---------------------------------------------------------------------------

-- R16 — opt-in strict, **désactivé par défaut**, et **accessible à tout le monde** : aucun filtre sur
-- `profiles.sex` (arbitrage Damien du 30/07/2026). Le `default false` est ce qui garantit qu'aucun
-- compte existant ne voit apparaître la fonctionnalité à la mise à jour.
alter table public.user_settings
  add column if not exists cycle_tracking_enabled boolean not null default false;

-- Second interrupteur, indépendant (R20) : synchroniser avec Health Connect suppose **les deux**
-- opt-in actifs, plus la permission système. Aucune écriture silencieuse.
alter table public.user_settings
  add column if not exists cycle_health_connect_enabled boolean not null default false;

-- La suppression de compte (CONF-02) passe par `delete from auth.users` : les cascades FK ci-dessus
-- purgent donc les deux tables sans modifier `purge_expired_accounts()`.
