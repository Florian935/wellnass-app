-- US CYCLE-01 — rattache `menstrual_periods` et `menstrual_daily_logs` à la publication logique
-- `powersync`.
--
-- Étape **indispensable** pour toute table synchronisée : sans elle, le déploiement des sync rules
-- échoue avec « table not part of publication ». Même patron que `daily_wellbeing` (20260728185759),
-- `daily_steps` (20260728132601) et `analytics_events` (20260724123616, l'oubli du 24/07) — d'où une
-- migration séparée plutôt qu'un rejeu de 20260730230615.
--
-- ⚠️ Cette migration ne suffit pas : les **sync rules** elles-mêmes restent à déployer **à la main**
-- dans le dashboard PowerSync (docs/specs/technical/powersync-sync-rules.yaml). Sans elles, les
-- données restent locales et ne remontent jamais — **sans aucune erreur visible**. C'est l'oubli le
-- plus coûteux du projet parce qu'il est silencieux.
--
-- Gardées : le `if not exists` rend la migration rejouable, et couvre aussi le cas d'une publication
-- déclarée `for all tables` (où `alter publication … add table` échouerait, la table y étant déjà).

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'powersync'
      and schemaname = 'public'
      and tablename = 'menstrual_periods'
  ) then
    alter publication powersync add table public.menstrual_periods;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'powersync'
      and schemaname = 'public'
      and tablename = 'menstrual_daily_logs'
  ) then
    alter publication powersync add table public.menstrual_daily_logs;
  end if;
end $$;
