-- US STREAK-01 — rattache `streak_jokers` à la publication logique `powersync`.
--
-- Sans elle, le déploiement des sync rules échoue « table not part of publication ». Même patron que
-- `body_measurements` (20260729091953), `daily_wellbeing` (20260728185759) et `daily_steps`.
--
-- ⚠️ La **sync rule** elle-même reste à déployer **à la main** dans le dashboard PowerSync (bucket
-- `user_data` — c'est une donnée personnelle). Sans elle, les jokers restent locaux et ne remontent
-- jamais, sans aucune erreur visible.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'streak_jokers'
  ) then
    alter publication powersync add table public.streak_jokers;
  end if;
end $$;
