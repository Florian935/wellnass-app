-- =============================================================================
-- US CIBLE-01 — jeu de données de RECETTE : une seule « cible du jour » (RECETTES §94, spec §14)
-- =============================================================================
-- But : poser, autour d'aujourd'hui, des jours CONNUS D'AVANCE pour lire la même cible du jour dans le
-- calendrier, la page d'un jour passé, Statistiques, Progrès, le bilan hebdo, le Labo (APPORT-01), le
-- planning repas et le widget — dans les trois modes (Forfait, Auto, « Selon ce que tu fais »).
--
-- ⚠️ COMPTE DE TEST VIERGE uniquement (spec D11) : le script pose le profil A et le profil nutritionnel
-- du compte, et il REFUSE de jouer s'il trouve sur ce compte, non supprimés, des repas, séances, courses,
-- activités, séances planifiées ou périodes « vie réelle » entre J−30 et J+10, ou une pesée quelle
-- qu'elle soit. Couper l'import Health Connect des pesées sur ce téléphone avant de commencer.
-- ⚠️ Le nettoyage (`cible01-recette-nettoyage.sql`) retire les lignes posées ici, PAS le profil (compte de
-- test). Les chiffres attendus valent jusqu'au 14/01/2027 (le profil A a 30 ans jusque-là).
-- ⚠️ Dates RELATIVES à aujourd'hui à Paris, heures de Paris : un jour de recette = un jeu. Le lendemain,
-- nettoyer, puis rejouer (identifiants fixes).
--
-- Où : dashboard Supabase › SQL Editor (rôle du SQL Editor). Remplacer SEULEMENT le UUID de `v_user` par
-- celui du compte de test (ne jamais le commiter). Ouvrir l'app ensuite : les lignes descendent sur le
-- téléphone. Préalable : Musculation, Course et Nutrition actives (Réglages).
--
-- Ce qui est posé (J = aujourd'hui à Paris). Profil A : homme, 80 kg, 180 cm, né le 15/01/1996, but
-- « muscle » ; sèche, « modéré », forfait 300, mode Forfait, socle « debout », marge 10 %.
-- Socle `tdee` 2 759, hors sport 2 448 ; base 2 359 (Forfait, Auto) ou 2 048 (« Selon ce que tu fais »).
--   J−10      700 kcal mangées, rien d'autre
--   J−6       séance de muscu terminée 18 h → 19 h, RPE 7, 12 séries validées (8 × 60 kg) ; 2 650 kcal
--   J−5       AUTRE ACTIVITÉ SEULE : vélo 60 min, modéré, RPE 6, 25 km, à 10 h ; 2 650 kcal
--   J−4       rien ; 2 300 kcal
--   J−3       séance planifiée SAUTÉE ; 2 300 kcal
--   J−2       séance planifiée restée `planned` (manquée) ; 2 300 kcal
--   J−1       course terminée 7 h → 7 h 45, 8 km, RPE 5 ; 2 650 kcal
--   J         séance planifiée `planned`, pas faite ; 2 620 kcal
--   J+1       séance planifiée `planned`
--   J+2       séance planifiée SAUTÉE
--   J+4 → J+5 période « vie réelle » ; J+4 : séance planifiée `planned`
--
-- Chiffres attendus, écran par écran et mode par mode : spec §14.2 (figés par `cible01-recette.test.tsx`).
-- =============================================================================
do $$
declare
  v_user     uuid := '00000000-0000-0000-0000-000000000000';  -- ← UUID DU COMPTE DE TEST (ne pas commiter)
  v_today    date := (now() at time zone 'Europe/Paris')::date;
  v_exercise uuid;
  v_conflits integer;
begin
  if not exists (select 1 from auth.users where id = v_user) then
    raise exception 'UUID inconnu : remplace v_user par celui du compte de test';
  end if;

  -- Garde « compte vierge » : aucun chiffre attendu ne tiendrait avec d'autres lignes autour.
  select
      (select count(*) from public.food_entries      where user_id  = v_user and deleted_at is null and log_date between v_today - 30 and v_today + 10)
    + (select count(*) from public.workouts          where user_id  = v_user and deleted_at is null and (started_at at time zone 'Europe/Paris')::date between v_today - 30 and v_today + 10)
    + (select count(*) from public.runs              where user_id  = v_user and deleted_at is null and (started_at at time zone 'Europe/Paris')::date between v_today - 30 and v_today + 10)
    + (select count(*) from public.activities        where user_id  = v_user and deleted_at is null and (started_at at time zone 'Europe/Paris')::date between v_today - 30 and v_today + 10)
    + (select count(*) from public.planned_sessions  where owner_id = v_user and deleted_at is null and scheduled_date between v_today - 30 and v_today + 10)
    + (select count(*) from public.real_life_periods where user_id  = v_user and deleted_at is null and ends_on >= v_today - 30 and started_on <= v_today + 10)
    + (select count(*) from public.body_weight_entries where user_id = v_user and deleted_at is null)
    into v_conflits;
  if v_conflits > 0 then
    raise exception 'Compte non vierge : % ligne(s) gêneraient la recette (repas, séances, courses, activités, séances planifiées ou périodes entre J−30 et J+10, ou pesées). Utilise un compte de test vierge.', v_conflits;
  end if;

  select id into v_exercise from public.exercises
   where owner_id is null and deleted_at is null
   order by id limit 1;
  if v_exercise is null then
    raise exception 'Aucun exercice de bibliothèque : impossible de poser les séries de J−6';
  end if;

  -- Le profil A et le profil nutritionnel (sur le compte de test : non rétablis au nettoyage).
  insert into public.profiles (id, user_id, sex, height_cm, weight_kg, birth_date, main_goal) values
    ('c1b1e001-0000-4000-8000-000000000001', v_user, 'male', 180, 80, date '1996-01-15', 'muscle')
  on conflict (user_id) do update
    set sex = excluded.sex, height_cm = excluded.height_cm, weight_kg = excluded.weight_kg,
        birth_date = excluded.birth_date, main_goal = excluded.main_goal, deleted_at = null;
  insert into public.nutrition_profiles (id, user_id, objective, activity_level, manual_calories, manual_protein_g,
                                         manual_carbs_g, manual_fat_g, training_day_bonus, training_bonus_mode,
                                         sport_free_level, adherence_margin_pct) values
    ('c1b1e001-0000-4000-8000-000000000002', v_user, 'cut', 'moderate', null, null, null, null, 300, 'fixed', 'standing', 10)
  on conflict (user_id) do update
    set objective = excluded.objective, activity_level = excluded.activity_level,
        manual_calories = null, manual_protein_g = null, manual_carbs_g = null, manual_fat_g = null,
        training_day_bonus = excluded.training_day_bonus, training_bonus_mode = excluded.training_bonus_mode,
        sport_free_level = excluded.sport_free_level, adherence_margin_pct = excluded.adherence_margin_pct,
        deleted_at = null;

  -- J−6 : une séance de muscu terminée, 12 séries validées.
  insert into public.workouts (id, user_id, status, started_at, finished_at, duration_seconds, rpe) values
    ('c1b1e001-0000-4000-8000-000000000010', v_user, 'completed',
     ((v_today - 6) + time '18:00') at time zone 'Europe/Paris',
     ((v_today - 6) + time '19:00') at time zone 'Europe/Paris', 3600, 7);
  insert into public.workout_sets (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done)
  select ('c1b1e001-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
         'c1b1e001-0000-4000-8000-000000000010', v_user, v_exercise, n, 'normal', 8, 60, true
    from generate_series(1, 12) as n;

  -- J−5 : une autre activité, seule ce jour-là.
  insert into public.activities (id, user_id, activity_type, started_at, duration_seconds, intensity, rpe, distance_m, device_kcal) values
    ('c1b1e001-0000-4000-8000-000000000020', v_user, 'bike',
     ((v_today - 5) + time '10:00') at time zone 'Europe/Paris', 3600, 'moderate', 6, 25000, null);

  -- J−1 : une course terminée.
  insert into public.runs (id, user_id, status, source, started_at, finished_at, duration_seconds, distance_m, rpe, elevation_gain_m) values
    ('c1b1e001-0000-4000-8000-000000000030', v_user, 'completed', 'manual',
     ((v_today - 1) + time '07:00') at time zone 'Europe/Paris',
     ((v_today - 1) + time '07:45') at time zone 'Europe/Paris', 2700, 8000, 5, null);

  -- Les séances planifiées, dans un programme personnel brouillon (inactif).
  insert into public.programs (id, owner_id, pillar, status, is_active) values
    ('c1b1e001-0000-4000-8000-000000000040', v_user, 'strength', 'draft', false);
  insert into public.program_translations (id, program_id, owner_id, lang, name) values
    ('c1b1e001-0000-4000-8000-000000000041', 'c1b1e001-0000-4000-8000-000000000040', v_user, 'fr', 'Recette CIBLE-01');
  insert into public.sessions (id, program_id, owner_id, order_index, name, session_type, target_duration_seconds) values
    ('c1b1e001-0000-4000-8000-000000000042', 'c1b1e001-0000-4000-8000-000000000040', v_user, 0, 'Séance (recette CIBLE-01)', null, null);
  insert into public.planned_sessions (id, owner_id, program_id, session_id, scheduled_date, scheduled_time, status) values
    ('c1b1e001-0000-4000-8000-000000000050', v_user, 'c1b1e001-0000-4000-8000-000000000040', 'c1b1e001-0000-4000-8000-000000000042', v_today - 3, null, 'skipped'),
    ('c1b1e001-0000-4000-8000-000000000051', v_user, 'c1b1e001-0000-4000-8000-000000000040', 'c1b1e001-0000-4000-8000-000000000042', v_today - 2, null, 'planned'),
    ('c1b1e001-0000-4000-8000-000000000052', v_user, 'c1b1e001-0000-4000-8000-000000000040', 'c1b1e001-0000-4000-8000-000000000042', v_today,     null, 'planned'),
    ('c1b1e001-0000-4000-8000-000000000053', v_user, 'c1b1e001-0000-4000-8000-000000000040', 'c1b1e001-0000-4000-8000-000000000042', v_today + 1, null, 'planned'),
    ('c1b1e001-0000-4000-8000-000000000054', v_user, 'c1b1e001-0000-4000-8000-000000000040', 'c1b1e001-0000-4000-8000-000000000042', v_today + 2, null, 'skipped'),
    ('c1b1e001-0000-4000-8000-000000000055', v_user, 'c1b1e001-0000-4000-8000-000000000040', 'c1b1e001-0000-4000-8000-000000000042', v_today + 4, null, 'planned');

  -- J+4 → J+5 : une période « vie réelle ».
  insert into public.real_life_periods (id, user_id, started_on, ends_on) values
    ('c1b1e001-0000-4000-8000-000000000060', v_user, v_today + 4, v_today + 5);

  -- Les repas : une entrée par jour noté.
  insert into public.food_entries (id, user_id, log_date, meal_type, name, kcal, protein_g, carbs_g, fat_g) values
    ('c1b1e001-0000-4000-8000-000000000070', v_user, v_today - 10, 'lunch', 'Recette CIBLE-01',  700, 0, 0, 0),
    ('c1b1e001-0000-4000-8000-000000000071', v_user, v_today - 6,  'lunch', 'Recette CIBLE-01', 2650, 0, 0, 0),
    ('c1b1e001-0000-4000-8000-000000000072', v_user, v_today - 5,  'lunch', 'Recette CIBLE-01', 2650, 0, 0, 0),
    ('c1b1e001-0000-4000-8000-000000000073', v_user, v_today - 4,  'lunch', 'Recette CIBLE-01', 2300, 0, 0, 0),
    ('c1b1e001-0000-4000-8000-000000000074', v_user, v_today - 3,  'lunch', 'Recette CIBLE-01', 2300, 0, 0, 0),
    ('c1b1e001-0000-4000-8000-000000000075', v_user, v_today - 2,  'lunch', 'Recette CIBLE-01', 2300, 0, 0, 0),
    ('c1b1e001-0000-4000-8000-000000000076', v_user, v_today - 1,  'lunch', 'Recette CIBLE-01', 2650, 0, 0, 0),
    ('c1b1e001-0000-4000-8000-000000000077', v_user, v_today,      'lunch', 'Recette CIBLE-01', 2620, 0, 0, 0);

  raise notice 'Jeu CIBLE-01 posé autour du %', v_today;
end $$;
