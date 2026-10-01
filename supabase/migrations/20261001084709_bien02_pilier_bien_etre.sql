-- US BIEN-02 → BIEN-07 — le pilier Bien-être (décisions de Florian du 01/10/2026, D1 à D8).
--
-- Une seule migration, **additive** : aucune colonne retirée, aucune donnée reprise, aucune table
-- neuve. ✅ **Aucune sync rule à redéployer** : `user_settings` et `daily_wellbeing` sont déjà publiées
-- et lues en `select *` (même cas que `pain_journal_enabled`, DOUL-01).
--
-- 🔴 En revanche, chaque colonne DOIT être déclarée dans `apps/mobile/src/powersync/schema.ts`.
-- Absente du schéma local, elle n'existe pas dans la base SQLite embarquée : l'écriture échoue et
-- l'erreur est avalée (panne de CYCLE-01, constatée en recette le 31/07/2026).
--
-- ⚠️ Données de santé (RGPD art. 9) : nuit, qualité, humeur, envie, stress, maladie, alcool.
-- Toutes restent sous le patron existant : RLS par propriétaire, soft delete, export RGPD (la table est
-- déjà dans la liste explicite de `data-export.ts`), purge par cascade à la suppression du compte.

-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- 1. `user_settings` — le pilier, ses modules, la nuit lue dans Health Connect
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Décision D1 : un pilier **activable**, mais pas un `Pillar` (il ne porte ni disque au Labo, ni
-- paire, ni programme, ni guidage). Il vit à côté de `active_pillars`, comme le suivi du cycle :
-- un drapeau. `default false` : donnée de santé, l'absence ne vaut jamais consentement.
alter table public.user_settings
  add column if not exists wellbeing_pillar_enabled boolean not null default false,
  -- Décision D6 : les modules, éteints par défaut. L'hydratation n'est pas ici (NUTR-12, Nutrition).
  add column if not exists wellbeing_alcohol_enabled boolean not null default false,
  add column if not exists wellbeing_caffeine_enabled boolean not null default false,
  add column if not exists wellbeing_nap_enabled boolean not null default false,
  add column if not exists wellbeing_cravings_enabled boolean not null default false,
  -- Décision D3 : lire la nuit dans Health Connect. Indépendant de `health_connect_enabled` (les
  -- permissions de sommeil sont un jeu à part, comme celles du cycle).
  add column if not exists sleep_health_connect_enabled boolean not null default false;

comment on column public.user_settings.wellbeing_pillar_enabled is
  'US BIEN-02 — pilier Bien-être activé (donnée de santé, opt-in). Désactivé par défaut.';
comment on column public.user_settings.sleep_health_connect_enabled is
  'US BIEN-06 — lecture de la nuit dans Health Connect (READ_SLEEP). Désactivée par défaut.';

-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- 2. `daily_wellbeing` — le check-in en deux temps
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Toujours une ligne par jour civil local : le check-in du matin et celui du soir écrivent la MÊME
-- ligne. Toutes les colonnes sont facultatives (saisie partielle, décision D3 de BIEN-01).
alter table public.daily_wellbeing
  -- Décision D5 : les deux échelles du matin.
  add column if not exists sleep_quality smallint check (sleep_quality is null or sleep_quality between 1 and 5),
  add column if not exists motivation smallint check (motivation is null or motivation between 1 and 5),
  -- Décision D5 : les quatre étiquettes, liste fermée. Des booléens plutôt qu'un tableau : un tableau
  -- jsonb se sérialise mal entre SQLite et Postgres (réparation du 30/09/2026), une colonne par
  -- étiquette se croise directement en SQL.
  add column if not exists sick boolean not null default false,
  add column if not exists busy_day boolean not null default false,
  add column if not exists late_night boolean not null default false,
  add column if not exists travel boolean not null default false,
  -- Décision D6 : les modules. `null` = pas répondu (ce n'est pas « zéro verre »).
  add column if not exists alcohol_drinks smallint check (alcohol_drinks is null or alcohol_drinks between 0 and 3),
  add column if not exists late_caffeine boolean,
  add column if not exists nap_minutes smallint check (nap_minutes is null or nap_minutes between 0 and 180),
  add column if not exists cravings smallint check (cravings is null or cravings between 1 and 5),
  -- Décision D3 : d'où vient la nuit. Une saisie manuelle n'est jamais écrasée par une lecture.
  add column if not exists sleep_source text check (sleep_source is null or sleep_source in ('manual', 'health_connect')),
  -- Début et fin de la nuit lue (régularité du coucher). Jamais saisis à la main.
  add column if not exists sleep_start_at timestamptz,
  add column if not exists sleep_end_at timestamptz;

comment on column public.daily_wellbeing.sleep_source is
  'US BIEN-06 — origine de sleep_minutes : manual (saisie, prioritaire) ou health_connect (lue).';
