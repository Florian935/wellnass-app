-- US RUN-F4 (lot I) — rattache `session_translations` à la publication logique `powersync`.
--
-- Même patron que `run_intervals` (20260905090003) et `real_life_periods` (20260805140001).
--
-- ⚠️ La **sync rule** reste à déployer **À LA MAIN** dans le dashboard PowerSync. Celle-ci va
-- dans le bucket **global/éditorial** (comme `program_translations`), pas dans `user_data` :
-- les traductions de séances éditoriales ont `owner_id` NULL et doivent descendre à tout le
-- monde. Le YAML à coller est docs/specs/technical/powersync-sync-rules.yaml.
--
-- 🔴 C'est la 2e des 2 sync rules neuves de RUN-F4. Étape oubliée trois fois au registre
-- (BIEN-01, RUN-F2c, VIE-01) : sans elle, une séance traduite s'affiche en français pour tout
-- le monde, **sans aucune erreur visible**.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'session_translations'
  ) then
    alter publication powersync add table public.session_translations;
  end if;
end $$;
