-- US EFFORT-01 — rattache `run_efforts` à la publication logique `powersync`.
--
-- Sans elle, le déploiement des sync rules échoue « table not part of publication ». Même patron
-- que `activities` (20260915165804), `lab_experiments`, `pain_reports` (20260806090001).
--
-- ⚠️ La **sync rule** elle-même reste à déployer **À LA MAIN** dans le dashboard PowerSync (bucket
-- `user_data`). Le YAML à coller est docs/specs/technical/powersync-sync-rules.yaml.
--
-- 🔴 Étape déjà oubliée **trois fois** (BIEN-01, RUN-F2c, VIE-01). Ici, l'oubli serait silencieux
-- et durable : les efforts seraient calculés et écrits **en local seulement**. Tout marcherait sur
-- le téléphone qui a couru — et les rangs seraient **faux sur tout autre appareil**, sans la
-- moindre erreur, parce qu'un classement calculé sur un journal partiel reste un classement
-- plausible.
--
-- ✅ `runs.efforts_computed_at` n'a besoin de rien : `runs` est publiée depuis 20260707120000 et lue
-- en `select *` — le réflexe « migration ⇒ sync rule à la main » ne vaut que pour une **table
-- neuve**, jamais pour une colonne.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'run_efforts'
  ) then
    alter publication powersync add table public.run_efforts;
  end if;
end $$;
