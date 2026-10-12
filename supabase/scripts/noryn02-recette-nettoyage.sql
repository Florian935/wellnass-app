-- =============================================================================
-- US NORYN-02 — retire tout le jeu de recette de `noryn02-recette-donnees.sql`
-- =============================================================================
-- Identifiants fixes `ffffffff-0000-4000-8000-…` : rien d'autre n'est touché, aucun UUID à renseigner.
-- Où : dashboard Supabase › SQL Editor. Rouvrir l'app ensuite : les lignes disparaissent du téléphone.
-- Ordre : séance planifiée avant le programme (clés étrangères) ; la suppression du programme emporte
-- sa séance et son nom en cascade.
-- =============================================================================
delete from public.activities        where id in ('ffffffff-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000002');
delete from public.runs              where id =  'ffffffff-0000-4000-8000-000000000003';
delete from public.planned_sessions  where id =  'ffffffff-0000-4000-8000-000000000007';
delete from public.programs          where id =  'ffffffff-0000-4000-8000-000000000004';
delete from public.real_life_periods where id =  'ffffffff-0000-4000-8000-000000000008';
