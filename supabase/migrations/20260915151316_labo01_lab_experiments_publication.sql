-- US LABO-01 — rattache `lab_experiments` à la publication logique `powersync`.
--
-- Étape **indispensable** pour toute table synchronisée : sans elle, le déploiement des sync rules
-- échoue avec « table not part of publication ». Même patron que `daily_wellbeing`
-- (20260728185759) — d'où une migration séparée.
--
-- ⚠️ Cette migration ne suffit pas : la **sync rule** reste à déployer **à la main** dans le
-- dashboard PowerSync (docs/specs/technical/powersync-sync-rules.yaml). Sans elle, les expériences
-- restent locales et ne remontent jamais — sans aucune erreur visible.
--
-- La colonne `daily_wellbeing.sleep_minutes` n'a besoin de rien ici : la table est déjà publiée et
-- sa sync rule est un `select *`.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'powersync'
      and schemaname = 'public'
      and tablename = 'lab_experiments'
  ) then
    alter publication powersync add table public.lab_experiments;
  end if;
end $$;
