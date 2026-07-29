-- US OBJ-01 — rattache `personal_goals` à la publication logique `powersync`.
--
-- Sans elle, le déploiement des sync rules échoue « table not part of publication ». Même patron que
-- `streak_jokers` (20260729095705), `body_measurements` (20260729091953) et
-- `daily_wellbeing` (20260728185759).
--
-- Garde `if not exists` : la publication peut déjà porter la table si quelqu'un l'a ajoutée
-- autrement. `alter publication ... add table` échouerait alors, et ferait échouer toute la migration.
--
-- ⚠️ La **sync rule** elle-même reste à déployer **à la main** dans le dashboard PowerSync
-- (bucket `user_data`). C'est le 4ᵉ changement en attente de déploiement — voir RECETTES.md.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'personal_goals'
  ) then
    alter publication powersync add table public.personal_goals;
  end if;
end $$;
