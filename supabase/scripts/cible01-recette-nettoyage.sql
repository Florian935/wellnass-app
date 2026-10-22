-- =============================================================================
-- US CIBLE-01 — retire tout le jeu de recette de `cible01-recette-donnees.sql`
-- =============================================================================
-- Identifiants fixes `c1b1e001-0000-4000-8000-…` : rien d'autre n'est touché, aucun UUID à renseigner.
-- Le profil et le profil nutritionnel posés sur le compte de test restent tels quels (compte de test).
-- ⚠️ Une activité saisie à la main pendant la recette (critère hors ligne) n'est pas connue d'ici :
-- la supprimer dans l'app avant de rejouer le jeu, sinon sa garde refusera de jouer.
-- Où : dashboard Supabase › SQL Editor. Rouvrir l'app ensuite : les lignes disparaissent du téléphone.
-- Ordre : séries avant la séance, séances planifiées avant le programme (clés étrangères) ; la
-- suppression du programme emporte sa séance et son nom en cascade.
-- =============================================================================
delete from public.food_entries      where id between 'c1b1e001-0000-4000-8000-000000000070' and 'c1b1e001-0000-4000-8000-000000000077';
delete from public.workout_sets      where id between 'c1b1e001-0000-4000-8000-000000000101' and 'c1b1e001-0000-4000-8000-000000000112';
delete from public.workouts          where id =  'c1b1e001-0000-4000-8000-000000000010';
delete from public.activities        where id =  'c1b1e001-0000-4000-8000-000000000020';
delete from public.runs              where id =  'c1b1e001-0000-4000-8000-000000000030';
delete from public.planned_sessions  where id between 'c1b1e001-0000-4000-8000-000000000050' and 'c1b1e001-0000-4000-8000-000000000055';
delete from public.programs          where id =  'c1b1e001-0000-4000-8000-000000000040';
delete from public.real_life_periods where id =  'c1b1e001-0000-4000-8000-000000000060';
