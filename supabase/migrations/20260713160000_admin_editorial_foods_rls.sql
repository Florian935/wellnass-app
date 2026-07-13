-- US 8.5 — Admin : RLS d'écriture éditoriale sur la base d'aliments.
-- 🔴 checkpoint cloud : appliqué manuellement par un humain (dashboard SQL Editor).
-- AUCUN `db:types` (RLS ne change pas les types). AUCUN redéploiement de sync rules
-- (l'archivage passe par `deleted_at`, déjà couvert par les buckets ; l'éditorial
-- `owner_id IS NULL` est déjà sélectionnable).
-- Réf. : docs/specs/functional/us/8.5-gestion-aliments.md §3,
--        docs/plans/8.5-gestion-aliments.md (Tâche 1).
--
-- Contexte :
--   - Tables « contenu partageable » (owner_id) : foods, food_translations.
--     `owner_id IS NULL` = contenu éditorial (bibliothèque).
--   - RLS d'origine (20260706150001_food_rls.sql) : insert/update réservés à
--     `owner_id = auth.uid()` → un éditeur de contenu ne peut PAS écrire l'éditorial.
--     On rouvre l'écriture éditoriale aux **éditeurs de contenu** (super_admin + content_editor).
--   - Cette migration DÉBLOQUE aussi l'US 8.6 (import CSV) : `importFoods` écrit
--     `owner_id NULL` et était donc refusé par la RLS d'origine.
--   - `public.is_content_editor()` est RÉUTILISÉE (migration 8.2,
--     20260713110000_admin_editorial_exercises.sql) : NON recréée ici.
--   - Postgres n'a PAS de `CREATE OR REPLACE POLICY` → DROP puis CREATE (noms exacts d'origine).
--   - RLS déjà activée sur ces tables (migration d'origine) : non réactivée ici.
--   - Les policies SELECT ({table}_select) sont laissées INCHANGÉES.

-- Même logique que les migrations 8.2 (exercises) et 8.4 (programs) : rouvrir insert/update
-- aux éditeurs de contenu, appliquée aux 2 tables « contenu partageable » des aliments.
do $$
declare t text;
begin
  foreach t in array array['foods','food_translations']
  loop
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (owner_id = auth.uid() or public.is_content_editor());', t, t);

    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format('create policy %I_update on public.%I for update using (owner_id = auth.uid() or public.is_content_editor()) with check (owner_id = auth.uid() or public.is_content_editor());', t, t);
  end loop;
end $$;
