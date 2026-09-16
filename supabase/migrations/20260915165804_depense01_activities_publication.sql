-- US AUTRE-01 — rattache `activities` à la publication logique `powersync`.
--
-- Sans elle, le déploiement des sync rules échoue « table not part of publication ». Même patron que
-- `pain_reports` (20260806090001), `real_life_periods` et `daily_wellbeing`.
--
-- ⚠️ La **sync rule** elle-même reste à déployer **À LA MAIN** dans le dashboard PowerSync (bucket
-- `user_data`). Le YAML à coller est docs/specs/technical/powersync-sync-rules.yaml.
--
-- 🔴 Étape déjà oubliée **deux fois** (BIEN-01, RUN-F2c). Sans elle, les activités restent locales et
-- ne remontent jamais, **sans aucune erreur visible** : le vélo du dimanche existerait sur un
-- téléphone et pas sur l'autre, et la cible calorique différerait d'un appareil à l'autre.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'activities'
  ) then
    alter publication powersync add table public.activities;
  end if;
end $$;
