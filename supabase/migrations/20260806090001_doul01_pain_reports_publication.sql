-- US DOUL-01 — rattache `pain_reports` à la publication logique `powersync`.
--
-- Sans elle, le déploiement des sync rules échoue « table not part of publication ». Même patron que
-- `real_life_periods` (20260805140001), `streak_jokers` (20260729095705) et `daily_wellbeing`.
--
-- ⚠️ La **sync rule** elle-même reste à déployer **À LA MAIN** dans le dashboard PowerSync (bucket
-- `user_data` — donnée personnelle de santé). Le YAML à coller est
-- docs/specs/technical/powersync-sync-rules.yaml.
--
-- 🔴 Étape oubliée **deux fois** (BIEN-01, RUN-F2c). Sans elle, les déclarations restent locales et
-- ne remontent jamais, **sans aucune erreur visible** : le journal marcherait sur un téléphone et
-- pas sur l'autre.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'pain_reports'
  ) then
    alter publication powersync add table public.pain_reports;
  end if;
end $$;
