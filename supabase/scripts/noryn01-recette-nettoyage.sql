-- =============================================================================
-- US NORYN-01 — retire tout le jeu de recette de `noryn01-recette-donnees.sql`
-- =============================================================================
-- Identifiants fixes `eeeeeeee-0000-4000-8000-…` : rien d'autre n'est touché, aucun UUID à renseigner.
-- Où : dashboard Supabase › SQL Editor. Rouvrir l'app ensuite : les lignes disparaissent du téléphone.
-- Ordre : séances faites avant les séances planifiées (clés étrangères), programmes en dernier
-- (la suppression emporte séances, plans d'exercices et noms en cascade).
-- =============================================================================
delete from public.workouts         where id in ('eeeeeeee-0000-4000-8000-000000000013','eeeeeeee-0000-4000-8000-000000000015');
delete from public.runs             where id =  'eeeeeeee-0000-4000-8000-000000000014';
delete from public.planned_sessions where id in ('eeeeeeee-0000-4000-8000-000000000010','eeeeeeee-0000-4000-8000-000000000011','eeeeeeee-0000-4000-8000-000000000012');
delete from public.programs         where id in ('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000002');
delete from public.food_entries     where id in ('eeeeeeee-0000-4000-8000-000000000021','eeeeeeee-0000-4000-8000-000000000022','eeeeeeee-0000-4000-8000-000000000023');
delete from public.water_entries    where id in ('eeeeeeee-0000-4000-8000-000000000024','eeeeeeee-0000-4000-8000-000000000025','eeeeeeee-0000-4000-8000-000000000026','eeeeeeee-0000-4000-8000-000000000027');
delete from public.daily_steps      where id =  'eeeeeeee-0000-4000-8000-000000000020';
delete from public.daily_wellbeing  where id =  'eeeeeeee-0000-4000-8000-000000000028';
