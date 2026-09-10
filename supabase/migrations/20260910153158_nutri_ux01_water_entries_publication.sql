-- US NUTRI-UX01 — rattache `water_entries` à la publication logique `powersync`.
--
-- Sans elle, le déploiement des sync rules échoue « table not part of publication ». Même patron
-- que `pain_reports` (20260806090001), `real_life_periods` (20260805140001) et `streak_jokers`.
--
-- ⚠️ La **sync rule** elle-même reste à déployer **À LA MAIN** dans le dashboard PowerSync (bucket
-- `user_data` — donnée personnelle). Le YAML à coller est
-- docs/specs/technical/powersync-sync-rules.yaml.
--
-- 🔴 Étape oubliée **trois fois** dans ce projet (BIEN-01, RUN-F2c, VIE-01). Sans elle, les verres
-- bus restent locaux et ne remontent jamais, **sans aucune erreur visible** : l'hydratation
-- marcherait sur un téléphone et pas sur l'autre.
--
-- ℹ️ Les deux colonnes ajoutées à `nutrition_profiles` (water_target_ml, glass_size_ml) n'ont
-- besoin de rien ici : la table est déjà publiée et lue en `select *`.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'water_entries'
  ) then
    alter publication powersync add table public.water_entries;
  end if;
end $$;
