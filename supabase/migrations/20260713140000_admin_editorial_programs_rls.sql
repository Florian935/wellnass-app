-- US 8.4 — Admin : constructeur de programmes + RLS d'écriture éditoriale admin.
-- 🔴 checkpoint cloud : appliqué manuellement par un humain (dashboard SQL Editor),
-- puis `db:types`. AUCUN redéploiement de sync rules (programs filtre déjà status='published' ;
-- séances/exos d'un brouillon restent orphelins invisibles côté mobile — cf. spec §3).
-- Réf. : docs/specs/functional/us/8.4-admin-constructeur-programmes.md,
--        docs/plans/8.4-admin-constructeur-programmes.md.
--
-- Contexte :
--   - Tables « contenu partageable » (owner_id) : programs, program_translations,
--     sessions, exercise_plans. `owner_id IS NULL` = contenu éditorial (bibliothèque).
--   - RLS d'origine (20260706130001_programmes_rls.sql) : insert/update réservés à
--     `owner_id = auth.uid()` → l'admin ne peut PAS écrire l'éditorial. On rouvre
--     l'écriture éditoriale aux **éditeurs de contenu** (super_admin + content_editor).
--   - `public.is_content_editor()` est RÉUTILISÉE de la migration 8.2
--     (20260713110000_admin_editorial_exercises.sql) : NON recréée ici.
--   - Postgres n'a PAS de `CREATE OR REPLACE POLICY` → DROP puis CREATE (noms exacts d'origine).
--   - RLS déjà activée sur ces tables (migration d'origine) : non réactivée ici.
--   - Les policies SELECT ({table}_select) sont laissées INCHANGÉES.

-- Même logique que la migration 8.2 (exercises) : rouvrir insert/update aux éditeurs de contenu,
-- appliquée aux 4 tables « contenu partageable » des programmes.
do $$
declare t text;
begin
  foreach t in array array['programs','program_translations','sessions','exercise_plans']
  loop
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (owner_id = auth.uid() or public.is_content_editor());', t, t);

    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format('create policy %I_update on public.%I for update using (owner_id = auth.uid() or public.is_content_editor()) with check (owner_id = auth.uid() or public.is_content_editor());', t, t);
  end loop;
end $$;
