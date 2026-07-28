-- US BIEN-01 — rattache `daily_wellbeing` à la publication logique `powersync`.
--
-- Étape **indispensable** pour toute table synchronisée : sans elle, le déploiement des sync rules
-- échoue avec « table not part of publication ». Même patron que `daily_steps` (20260728132601) et
-- `analytics_events` (20260724123616, l'oubli du 24/07) — d'où une migration séparée plutôt qu'un
-- rejeu de 20260728185757.
--
-- ⚠️ Cette migration ne suffit pas : la **sync rule** elle-même reste à déployer **à la main** dans
-- le dashboard PowerSync (docs/specs/technical/powersync-sync-rules.yaml). Sans elle, les données
-- restent locales et ne remontent jamais — sans aucune erreur visible.
--
-- Gardée : le `if not exists` rend la migration rejouable, et couvre aussi le cas d'une publication
-- déclarée `for all tables` (où `alter publication … add table` échouerait, la table y étant déjà).

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'powersync'
      and schemaname = 'public'
      and tablename = 'daily_wellbeing'
  ) then
    alter publication powersync add table public.daily_wellbeing;
  end if;
end $$;
