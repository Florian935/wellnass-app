-- US PAS-01 — rattache `daily_steps` à la publication logique `powersync`.
--
-- Étape **indispensable** pour toute table synchronisée : sans elle, le déploiement des sync rules
-- échoue avec « table not part of publication ». Exactement l'oubli corrigé le 24/07/2026 pour
-- `analytics_events` (migration 20260724123616) — d'où cette migration séparée plutôt qu'un
-- rejeu de 20260728132424, déjà appliquée.
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
      and tablename = 'daily_steps'
  ) then
    alter publication powersync add table public.daily_steps;
  end if;
end $$;
