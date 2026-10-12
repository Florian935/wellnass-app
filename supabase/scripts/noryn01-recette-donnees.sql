-- =============================================================================
-- US NORYN-01 — jeu de données de RECETTE de la fonction `noryn-context`
-- =============================================================================
-- But : remplir un jour (dimanche 11/10/2026) et quelques séances avec des valeurs CONNUES D'AVANCE,
-- pour comparer la réponse de `context/day` et `context/week` à ce qu'elles doivent être.
-- Joué une première fois par Florian le 12/10/2026 (recette RECETTES §92, clôturée).
--
-- ⚠️ Données de test DANS LE COMPTE RÉEL : elles apparaissent dans l'app (historique, planning, série)
-- jusqu'au nettoyage. Nettoyer ensuite avec `noryn01-recette-nettoyage.sql`.
-- ⚠️ Pour rejouer à une autre date : changer `v_d` ET les dates écrites en dur (09/10, 12/10, instants
-- UTC), en gardant la fenêtre servie (J−8 … J+15).
--
-- Où : dashboard Supabase › SQL Editor. Remplacer SEULEMENT le UUID de `v_user` (ne jamais le commiter).
-- Les écritures faites ici ne posent PAS de reçu de synchro (auth.uid() est nul) : c'est voulu.
--
-- Réponses attendues (si aucune vraie donnée n'existait déjà ces jours-là) :
--   context/day?date=2026-10-11   → pas 8421, 1450 kcal, 76 g, eau 1500 ml (750 supprimés ignorés),
--                                   check-in 425/4/3/4, une séance strength 18:30, 30 min, done, [heavy_lower]
--   context/week?start=2026-10-05 → course du 09/10 07:00 moderate 90 min done [long_run] + la séance du 11/10 ;
--                                   done {strength:1, running:1} ; sleep {425, 1}
--   context/week?start=2026-10-12 → done {strength:1} (séance finie lundi 00 h 30 à Paris) ;
--                                   séance du jour 18:30 planned 30 min [heavy_lower]
-- =============================================================================
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000000';  -- ← TON UUID ICI (ne pas commiter)
  v_d    date := date '2026-10-11';
  v_ex   uuid[];
begin
  if not exists (select 1 from auth.users where id = v_user) then
    raise exception 'UUID inconnu : remplace v_user par ton UUID';
  end if;

  select array_agg(id order by id) into v_ex from (
    select id from public.exercises
     where owner_id is null and muscle_primary = 'legs' and status = 'published' and deleted_at is null
     order by id limit 3) e;
  if coalesce(array_length(v_ex, 1), 0) < 3 then
    raise exception 'Moins de 3 exercices de jambes publiés dans la bibliothèque';
  end if;

  -- Deux programmes personnels inactifs, avec un nom pour les retrouver dans l'app
  insert into public.programs (id, owner_id, pillar, status, is_active) values
    ('eeeeeeee-0000-4000-8000-000000000001', v_user, 'strength', 'draft', false),
    ('eeeeeeee-0000-4000-8000-000000000002', v_user, 'running',  'draft', false);
  insert into public.program_translations (id, program_id, owner_id, lang, name) values
    ('eeeeeeee-0000-4000-8000-000000000003', 'eeeeeeee-0000-4000-8000-000000000001', v_user, 'fr', 'Recette Noryn — jambes'),
    ('eeeeeeee-0000-4000-8000-000000000004', 'eeeeeeee-0000-4000-8000-000000000002', v_user, 'fr', 'Recette Noryn — sortie longue');
  insert into public.sessions (id, program_id, owner_id, order_index, name, session_type, target_duration_seconds) values
    ('eeeeeeee-0000-4000-8000-000000000005', 'eeeeeeee-0000-4000-8000-000000000001', v_user, 0, 'Jambes lourdes (recette Noryn)', null, null),
    ('eeeeeeee-0000-4000-8000-000000000006', 'eeeeeeee-0000-4000-8000-000000000002', v_user, 0, 'Sortie longue (recette Noryn)', 'sortie_longue', 5400);
  -- 11 séries de jambes : 4 × 150 s de repos, 4 × 120 s, 3 × 90 s → environ 30 min et heavy_lower
  insert into public.exercise_plans (id, session_id, owner_id, exercise_id, order_index, target_sets, rest_seconds) values
    ('eeeeeeee-0000-4000-8000-000000000007', 'eeeeeeee-0000-4000-8000-000000000005', v_user, v_ex[1], 0, 4, 150),
    ('eeeeeeee-0000-4000-8000-000000000008', 'eeeeeeee-0000-4000-8000-000000000005', v_user, v_ex[2], 1, 4, 120),
    ('eeeeeeee-0000-4000-8000-000000000009', 'eeeeeeee-0000-4000-8000-000000000005', v_user, v_ex[3], 2, 3, 90);
  insert into public.planned_sessions (id, owner_id, program_id, session_id, scheduled_date, scheduled_time, status) values
    ('eeeeeeee-0000-4000-8000-000000000010', v_user, 'eeeeeeee-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000005', v_d,               '18:30', 'done'),
    ('eeeeeeee-0000-4000-8000-000000000011', v_user, 'eeeeeeee-0000-4000-8000-000000000002', 'eeeeeeee-0000-4000-8000-000000000006', date '2026-10-09', '07:00', 'done'),
    ('eeeeeeee-0000-4000-8000-000000000012', v_user, 'eeeeeeee-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000005', date '2026-10-12', '18:30', 'planned');
  -- Séances faites : muscu dim. 11/10 19 h 30 (Paris), course ven. 09/10,
  -- et une muscu finie lun. 12/10 à 00 h 30 Paris (= 11/10 22 h 30 UTC) : elle compte pour la semaine du 12/10.
  insert into public.workouts (id, user_id, status, started_at, finished_at, duration_seconds, planned_session_id) values
    ('eeeeeeee-0000-4000-8000-000000000013', v_user, 'completed', '2026-10-11T16:40:00Z', '2026-10-11T17:30:00Z', 3000, 'eeeeeeee-0000-4000-8000-000000000010'),
    ('eeeeeeee-0000-4000-8000-000000000015', v_user, 'completed', '2026-10-11T21:50:00Z', '2026-10-11T22:30:00Z', 2400, null);
  insert into public.runs (id, user_id, status, source, started_at, finished_at, duration_seconds, distance_m, planned_session_id) values
    ('eeeeeeee-0000-4000-8000-000000000014', v_user, 'completed', 'manual', '2026-10-09T05:00:00Z', '2026-10-09T06:30:00Z', 5400, 15000, 'eeeeeeee-0000-4000-8000-000000000011');

  -- Dimanche 11/10 : repas (1 450 kcal, 76,2 g de protéines), eau (1 500 ml + 750 ml SUPPRIMÉS)
  insert into public.food_entries (id, user_id, log_date, meal_type, order_index, name, quantity_g, kcal, protein_g, carbs_g, fat_g) values
    ('eeeeeeee-0000-4000-8000-000000000021', v_user, v_d, 'breakfast', 0, 'Recette Noryn — petit-déjeuner', 250, 512, 21.6, 60, 18),
    ('eeeeeeee-0000-4000-8000-000000000022', v_user, v_d, 'lunch',     0, 'Recette Noryn — déjeuner',       400, 748, 46.2, 80, 22),
    ('eeeeeeee-0000-4000-8000-000000000023', v_user, v_d, 'snack',     0, 'Recette Noryn — collation',       60, 190,  8.4, 20,  7);
  insert into public.water_entries (id, user_id, log_date, volume_ml, deleted_at) values
    ('eeeeeeee-0000-4000-8000-000000000024', v_user, v_d, 500, null),
    ('eeeeeeee-0000-4000-8000-000000000025', v_user, v_d, 500, null),
    ('eeeeeeee-0000-4000-8000-000000000026', v_user, v_d, 500, null),
    ('eeeeeeee-0000-4000-8000-000000000027', v_user, v_d, 750, now());

  -- Pas et check-in : seulement si tu n'en as pas déjà pour ce jour-là (le 12/10/2026, les vrais pas
  -- du 11/10 existaient : le script les a gardés, et la réponse a rendu 7 533 au lieu de 8 421)
  insert into public.daily_steps (id, user_id, log_date, steps, source)
  select 'eeeeeeee-0000-4000-8000-000000000020', v_user, v_d, 8421, 'health_connect'
   where not exists (select 1 from public.daily_steps where user_id = v_user and log_date = v_d and deleted_at is null);
  if not found then raise notice 'Pas du 11/10 déjà présents : gardés tels quels'; end if;

  -- Humeur et stress posés exprès : ils ne doivent JAMAIS apparaître dans une réponse (critère 18)
  insert into public.daily_wellbeing (id, user_id, log_date, sleep_minutes, sleep_quality, energy, motivation, sick, mood, stress)
  select 'eeeeeeee-0000-4000-8000-000000000028', v_user, v_d, 425, 4, 3, 4, false, 2, 4
   where not exists (select 1 from public.daily_wellbeing where user_id = v_user and log_date = v_d and deleted_at is null);
  if not found then raise notice 'Check-in du 11/10 déjà présent : gardé tel quel'; end if;
end $$;
