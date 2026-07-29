-- US MESUR-01 — rattache `body_measurements` à la publication logique `powersync`.
--
-- Indispensable pour toute table synchronisée : sans elle, le déploiement des sync rules échoue
-- « table not part of publication ». Même patron que `daily_wellbeing` (20260728185759) et
-- `daily_steps` (20260728132601).
--
-- ⚠️ Cette migration ne suffit pas : la **sync rule** elle-même reste à déployer **à la main** dans
-- le dashboard PowerSync (bucket `user_data` — c'est une donnée personnelle). Sans elle, les
-- mensurations restent locales et ne remontent jamais, sans aucune erreur visible.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'powersync'
      and schemaname = 'public'
      and tablename = 'body_measurements'
  ) then
    alter publication powersync add table public.body_measurements;
  end if;
end $$;
