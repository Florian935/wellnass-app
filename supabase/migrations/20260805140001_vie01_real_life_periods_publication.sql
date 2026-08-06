-- US VIE-01 — rattache `real_life_periods` à la publication logique `powersync`.
--
-- Sans elle, le déploiement des sync rules échoue « table not part of publication ». Même patron que
-- `streak_jokers` (20260729095705), `body_measurements` (20260729091953), `daily_wellbeing`
-- (20260728185759) et `daily_steps`.
--
-- ⚠️ La **sync rule** elle-même reste à déployer **À LA MAIN** dans le dashboard PowerSync (bucket
-- `user_data` — c'est une donnée personnelle). Le YAML à coller est
-- docs/specs/technical/powersync-sync-rules.yaml.
--
-- 🔴 Étape déjà oubliée **deux fois** : BIEN-01, puis RUN-F2c — qui reste bloquée avant recette pour
-- cette raison. Sans le déploiement, les périodes restent locales et ne remontent jamais, **sans
-- aucune erreur visible** : le mode marcherait sur un appareil et pas sur l'autre.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'real_life_periods'
  ) then
    alter publication powersync add table public.real_life_periods;
  end if;
end $$;
