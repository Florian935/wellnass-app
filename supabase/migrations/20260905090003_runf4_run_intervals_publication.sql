-- US RUN-F4 (lot F) — rattache `run_intervals` à la publication logique `powersync`.
--
-- Sans elle, le déploiement des sync rules échoue « table not part of publication ». Même patron
-- que `real_life_periods` (20260805140001), `pain_reports` (20260806090001) et `streak_jokers`.
--
-- ⚠️ La **sync rule** elle-même reste à déployer **À LA MAIN** dans le dashboard PowerSync
-- (bucket `user_data` — c'est une donnée personnelle). Le YAML à coller est
-- docs/specs/technical/powersync-sync-rules.yaml, où la ligne est déjà ajoutée.
--
-- 🔴 Étape oubliée **trois fois** au registre : BIEN-01, RUN-F2c, VIE-01. Sans le déploiement,
-- le réalisé par répétition reste local et ne remonte jamais, **sans aucune erreur visible**.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'run_intervals'
  ) then
    alter publication powersync add table public.run_intervals;
  end if;
end $$;
