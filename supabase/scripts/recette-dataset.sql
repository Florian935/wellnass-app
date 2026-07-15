-- =============================================================================
-- Jeu de données de RECETTE — remise à plat + dataset de test
-- =============================================================================
-- But : repartir d'un compte propre (training / alimentation / course) puis
--       injecter ~3 mois d'historique cohérent couvrant les recettes 🔴 en
--       attente (voir TODO.md) :
--         · MUSC-04  courbe 1RM estimé + périodes (30j / 90j / 1 an / tout)
--         · MUSC-05  équilibre musculaire 14 j (groupes délaissés)
--         · META-06  comparaison période N vs N-1 (muscu / course / nutrition)
--         · 4.32     alerte croisée déficit calorique + fort volume muscu
--         · RN-01/02 dépense course → objectif du jour (mode Auto)
--
-- ⚠️ CE N'EST PAS UNE MIGRATION DE SCHÉMA. C'est un script de DONNÉES de test.
--    → À jouer dans le SQL Editor de Supabase (cloud nsxzflxsgovriwwvflxe),
--      PAS via le CLI `db push`. Ne modifie aucune structure de table.
--    → Exécuté sous le rôle du SQL Editor (bypass RLS), donc l'écriture pour
--      ton user_id passe sans souci.
--
-- MODE OPÉRATOIRE :
--   1. Renseigne ton EMAIL de connexion ci-dessous (variable v_email).
--      (Astuce : `select id, email from auth.users;` pour retrouver le tien.)
--   2. Exécute tout le bloc. Tout est en une transaction (DO $$ … $$) :
--      en cas d'erreur, rien n'est appliqué.
--   3. Sur le téléphone : device CONNECTÉ → PowerSync propage l'effacement
--      puis le dataset. Si résidu (base SQLite locale), forcer une resync
--      (Paramètres Android → app → Effacer les données, puis reconnexion),
--      ce qui repart d'un snapshot cloud propre.
--
-- EFFACEMENT = HARD DELETE (choix acté). Ne touche PAS :
--   · la bibliothèque d'exercices / aliments (owner_id null),
--   · ton compte, tes profils (nutrition / running / settings) — qui sont
--     conservés puis PRÉ-RÉGLÉS pour la recette.
-- =============================================================================

do $$
declare
  ---------------------------------------------------------------------------
  -- 👉 SEUL PARAMÈTRE À RENSEIGNER : ton email de connexion à l'app.
  ---------------------------------------------------------------------------
  v_email text := 'REMPLACE-MOI@exemple.fr';

  v_user  uuid;
  d0      date := current_date;      -- ancrage « aujourd'hui »
  j       int;
  h       int;
  w       uuid;                       -- id de workout courant
  r       uuid;                       -- id de run courant
  rec     record;
  v_kcal  int;                        -- kcal cible du jour (nutrition)
  mk      int;                        -- kcal du repas
  n_work  int; n_sets int; n_runs int; n_food int; n_bw int;

  -- Exercices de bibliothèque (UUID déterministes du seed, owner_id null)
  ex_dc        uuid := 'a1000001-0000-4000-8000-000000000001'; -- Développé couché (chest)
  ex_pushup    uuid := 'a1000003-0000-4000-8000-000000000003'; -- Pompes (chest)
  ex_pullup    uuid := 'a1000004-0000-4000-8000-000000000004'; -- Traction (back, poids du corps)
  ex_row       uuid := 'a1000005-0000-4000-8000-000000000005'; -- Rowing barre (back)
  ex_pulldown  uuid := 'a1000006-0000-4000-8000-000000000006'; -- Tirage vertical (back)
  ex_squat     uuid := 'a1000007-0000-4000-8000-000000000007'; -- Squat (legs)
  ex_deadlift  uuid := 'a1000008-0000-4000-8000-000000000008'; -- Soulevé de terre (legs)
  ex_ohp       uuid := 'a1000011-0000-4000-8000-000000000011'; -- Développé militaire (shoulders)
  ex_curl      uuid := 'a1000013-0000-4000-8000-000000000013'; -- Curl biceps (arms)
  ex_plank     uuid := 'a1000015-0000-4000-8000-000000000015'; -- Gainage (core)
begin
  ---------------------------------------------------------------------------
  -- 0) Résolution de l'utilisateur
  ---------------------------------------------------------------------------
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'Aucun utilisateur trouvé pour l''email « % ». Corrige v_email.', v_email;
  end if;
  raise notice 'Utilisateur cible : % (%).', v_email, v_user;

  ---------------------------------------------------------------------------
  -- 1) EFFACEMENT (hard delete) — enfants avant parents (contraintes FK).
  --    Données perso muscu / nutrition / course + contenu perso créé par toi.
  ---------------------------------------------------------------------------
  -- Muscu (journal + records)
  delete from public.workout_sets      where user_id  = v_user;
  delete from public.personal_records  where user_id  = v_user;
  delete from public.workouts          where user_id  = v_user;
  -- Course
  delete from public.running_pace_records where user_id = v_user;
  delete from public.runs                 where user_id = v_user;
  -- Planification datée (running + muscu)
  delete from public.planned_sessions  where owner_id = v_user;
  -- Nutrition (journal, recettes, repas types, poids)
  delete from public.food_entries          where user_id = v_user;
  delete from public.recipe_ingredients    where user_id = v_user;
  delete from public.recipes               where user_id = v_user;
  delete from public.meal_template_items   where user_id = v_user;
  delete from public.meal_templates        where user_id = v_user;
  delete from public.body_weight_entries   where user_id = v_user;
  -- Favoris
  delete from public.food_favorites     where user_id = v_user;
  delete from public.exercise_favorites where user_id = v_user;
  -- Contenu PERSO créé par toi (programmes / séances / exos / aliments custom).
  -- La bibliothèque (owner_id null) n'est jamais touchée.
  delete from public.exercise_plans      where owner_id = v_user;
  delete from public.sessions            where owner_id = v_user;
  delete from public.program_translations where owner_id = v_user;
  delete from public.programs            where owner_id = v_user;
  delete from public.food_translations   where owner_id = v_user;
  delete from public.foods               where owner_id = v_user;
  delete from public.exercise_translations where owner_id = v_user;
  delete from public.exercises           where owner_id = v_user;

  ---------------------------------------------------------------------------
  -- 2) PROFILS DE CONFIG — conservés et pré-réglés pour la recette.
  ---------------------------------------------------------------------------
  -- Profil nutrition : objectif 2500 kcal (base des alertes), mode AUTO (RN-02),
  -- forfait 300 kcal pour le repli « jour de séance » (muscu seul en Auto).
  update public.nutrition_profiles
     set objective           = 'maintain',
         activity_level      = 'moderate',
         manual_calories     = 2500,
         manual_protein_g    = 160,
         manual_carbs_g      = 250,
         manual_fat_g        = 80,
         training_day_bonus  = 300,
         training_bonus_mode = 'auto',
         deleted_at          = null,
         updated_at          = now()
   where user_id = v_user;
  if not found then
    insert into public.nutrition_profiles
      (id, user_id, objective, activity_level, manual_calories,
       manual_protein_g, manual_carbs_g, manual_fat_g,
       training_day_bonus, training_bonus_mode)
    values
      (gen_random_uuid(), v_user, 'maintain', 'moderate', 2500,
       160, 250, 80, 300, 'auto');
  end if;

  -- Profil coureur (META-06 course + cohérence running).
  update public.running_profiles
     set objective            = '10k',
         level                = 'regulier',
         ref_5k_pace_s_per_km = 330,
         weekly_frequency     = 3,
         deleted_at           = null,
         updated_at           = now()
   where user_id = v_user;
  if not found then
    insert into public.running_profiles
      (id, user_id, objective, level, ref_5k_pace_s_per_km, weekly_frequency)
    values
      (gen_random_uuid(), v_user, '10k', 'regulier', 330, 3);
  end if;

  -- Réglages : 3 piliers actifs (pour tester le gating en (dés)activant ensuite).
  update public.user_settings
     set active_pillars = '["strength","running","nutrition"]',
         deleted_at     = null,
         updated_at     = now()
   where user_id = v_user;
  if not found then
    insert into public.user_settings (id, user_id, active_pillars)
    values (gen_random_uuid(), v_user, '["strength","running","nutrition"]');
  end if;

  -- Profil de base : poids/taille (secours ; la formule course utilise la pesée).
  update public.profiles
     set weight_kg  = coalesce(weight_kg, 75),
         height_cm  = coalesce(height_cm, 178),
         deleted_at = null,
         updated_at = now()
   where user_id = v_user;

  ---------------------------------------------------------------------------
  -- 3) POIDS CORPOREL — pesée hebdo sur 60 j (la dernière = aujourd'hui, 75 kg).
  --    Indispensable au mode Auto (dépense course = poids × distance).
  ---------------------------------------------------------------------------
  j := 0;
  while j <= 60 loop
    insert into public.body_weight_entries (id, user_id, log_date, weight_kg)
    values (gen_random_uuid(), v_user, d0 - j, round((75 + j * 0.05)::numeric, 1));
    j := j + 7;
  end loop;

  ---------------------------------------------------------------------------
  -- 4) MUSCU — SÉANCES RÉCENTES (14 derniers jours)
  --    Sert MUSC-05 (équilibre par groupe), 4.32 (volume 7 j ≥ 8000) et
  --    META-06 muscu (volume hebdo courant vs précédent).
  --    Réparti : legs/back/chest bien fournis ; épaules/bras/core délaissés.
  ---------------------------------------------------------------------------
  -- J-1 : chest + legs + back
  w := gen_random_uuid();
  insert into public.workouts (id, user_id, status, started_at, finished_at, duration_seconds)
  values (w, v_user, 'completed', (d0-1)::timestamp + time '18:00', (d0-1)::timestamp + time '19:00', 3600);
  insert into public.workout_sets (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done) values
    (gen_random_uuid(), w, v_user, ex_dc,    0, 'normal', 4, 80,  true),
    (gen_random_uuid(), w, v_user, ex_dc,    1, 'normal', 5, 75,  true),
    (gen_random_uuid(), w, v_user, ex_dc,    2, 'normal', 6, 70,  true),
    (gen_random_uuid(), w, v_user, ex_squat, 3, 'normal', 5, 100, true),
    (gen_random_uuid(), w, v_user, ex_squat, 4, 'normal', 5, 100, true),
    (gen_random_uuid(), w, v_user, ex_squat, 5, 'normal', 5, 100, true),
    (gen_random_uuid(), w, v_user, ex_row,   6, 'normal', 8, 70,  true),
    (gen_random_uuid(), w, v_user, ex_row,   7, 'normal', 8, 70,  true),
    (gen_random_uuid(), w, v_user, ex_row,   8, 'normal', 8, 70,  true);

  -- J-3 : legs (squat + deadlift) + back (tirage)
  w := gen_random_uuid();
  insert into public.workouts (id, user_id, status, started_at, finished_at, duration_seconds)
  values (w, v_user, 'completed', (d0-3)::timestamp + time '18:00', (d0-3)::timestamp + time '19:10', 4200);
  insert into public.workout_sets (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done) values
    (gen_random_uuid(), w, v_user, ex_squat,    0, 'normal', 5, 100, true),
    (gen_random_uuid(), w, v_user, ex_squat,    1, 'normal', 5, 100, true),
    (gen_random_uuid(), w, v_user, ex_squat,    2, 'normal', 5, 100, true),
    (gen_random_uuid(), w, v_user, ex_deadlift, 3, 'normal', 5, 120, true),
    (gen_random_uuid(), w, v_user, ex_deadlift, 4, 'normal', 5, 120, true),
    (gen_random_uuid(), w, v_user, ex_deadlift, 5, 'normal', 5, 120, true),
    (gen_random_uuid(), w, v_user, ex_pulldown, 6, 'normal', 10, 60, true),
    (gen_random_uuid(), w, v_user, ex_pulldown, 7, 'normal', 10, 60, true),
    (gen_random_uuid(), w, v_user, ex_pulldown, 8, 'normal', 10, 60, true);

  -- J-6 : chest + back
  w := gen_random_uuid();
  insert into public.workouts (id, user_id, status, started_at, finished_at, duration_seconds)
  values (w, v_user, 'completed', (d0-6)::timestamp + time '18:00', (d0-6)::timestamp + time '19:00', 3600);
  insert into public.workout_sets (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done) values
    (gen_random_uuid(), w, v_user, ex_dc,  0, 'normal', 5, 70, true),
    (gen_random_uuid(), w, v_user, ex_dc,  1, 'normal', 5, 70, true),
    (gen_random_uuid(), w, v_user, ex_dc,  2, 'normal', 5, 70, true),
    (gen_random_uuid(), w, v_user, ex_row, 3, 'normal', 8, 70, true),
    (gen_random_uuid(), w, v_user, ex_row, 4, 'normal', 8, 70, true),
    (gen_random_uuid(), w, v_user, ex_row, 5, 'normal', 8, 70, true);

  -- J-8 (semaine précédente) : legs + chest + 1 série épaules (délaissé)
  w := gen_random_uuid();
  insert into public.workouts (id, user_id, status, started_at, finished_at, duration_seconds)
  values (w, v_user, 'completed', (d0-8)::timestamp + time '18:00', (d0-8)::timestamp + time '19:00', 3600);
  insert into public.workout_sets (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done) values
    (gen_random_uuid(), w, v_user, ex_squat, 0, 'normal', 5, 100, true),
    (gen_random_uuid(), w, v_user, ex_squat, 1, 'normal', 5, 100, true),
    (gen_random_uuid(), w, v_user, ex_squat, 2, 'normal', 5, 100, true),
    (gen_random_uuid(), w, v_user, ex_dc,    3, 'normal', 5, 70,  true),
    (gen_random_uuid(), w, v_user, ex_dc,    4, 'normal', 5, 70,  true),
    (gen_random_uuid(), w, v_user, ex_dc,    5, 'normal', 5, 70,  true),
    (gen_random_uuid(), w, v_user, ex_ohp,   6, 'normal', 8, 40,  true);

  -- J-10 (semaine précédente) : back + 1 série bras (délaissé)
  w := gen_random_uuid();
  insert into public.workouts (id, user_id, status, started_at, finished_at, duration_seconds)
  values (w, v_user, 'completed', (d0-10)::timestamp + time '18:00', (d0-10)::timestamp + time '19:00', 3600);
  insert into public.workout_sets (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done) values
    (gen_random_uuid(), w, v_user, ex_row,      0, 'normal', 8,  70, true),
    (gen_random_uuid(), w, v_user, ex_row,      1, 'normal', 8,  70, true),
    (gen_random_uuid(), w, v_user, ex_row,      2, 'normal', 8,  70, true),
    (gen_random_uuid(), w, v_user, ex_pulldown, 3, 'normal', 10, 60, true),
    (gen_random_uuid(), w, v_user, ex_pulldown, 4, 'normal', 10, 60, true),
    (gen_random_uuid(), w, v_user, ex_pulldown, 5, 'normal', 10, 60, true),
    (gen_random_uuid(), w, v_user, ex_curl,     6, 'normal', 10, 20, true);

  -- J-13 (semaine précédente) : legs + 1 série core (délaissé, en durée)
  w := gen_random_uuid();
  insert into public.workouts (id, user_id, status, started_at, finished_at, duration_seconds)
  values (w, v_user, 'completed', (d0-13)::timestamp + time '18:00', (d0-13)::timestamp + time '19:10', 4200);
  insert into public.workout_sets (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, duration_seconds, done) values
    (gen_random_uuid(), w, v_user, ex_squat,    0, 'normal',   5, 100, null, true),
    (gen_random_uuid(), w, v_user, ex_squat,    1, 'normal',   5, 100, null, true),
    (gen_random_uuid(), w, v_user, ex_squat,    2, 'normal',   5, 100, null, true),
    (gen_random_uuid(), w, v_user, ex_deadlift, 3, 'normal',   5, 120, null, true),
    (gen_random_uuid(), w, v_user, ex_deadlift, 4, 'normal',   5, 120, null, true),
    (gen_random_uuid(), w, v_user, ex_deadlift, 5, 'normal',   5, 120, null, true),
    (gen_random_uuid(), w, v_user, ex_plank,    6, 'duration', null, null, 60, true);

  ---------------------------------------------------------------------------
  -- 5) MUSCU — HISTORIQUE LONG du Développé couché (1 top set par séance).
  --    Sert MUSC-04 : courbe 1RM estimé sur les 4 périodes, avec une baisse.
  ---------------------------------------------------------------------------
  for rec in
    select * from (values
      (420, 60, 8),   -- ~14 mois : période « tout »
      (200, 65, 8),   -- ~7 mois  : période « 1 an »
      ( 95, 70, 6),   -- ~3 mois  : période « 90 j » / « 1 an »
      ( 60, 72, 6),
      ( 35, 75, 5),   -- pic
      ( 25, 65, 5),   -- baisse volontaire (deload) → visible sur la courbe
      ( 14, 72, 6)
    ) as t(doff, wt, rp)
  loop
    w := gen_random_uuid();
    insert into public.workouts (id, user_id, status, started_at, finished_at, duration_seconds)
    values (w, v_user, 'completed', (d0 - rec.doff)::timestamp + time '18:00',
            (d0 - rec.doff)::timestamp + time '18:45', 2700);
    insert into public.workout_sets (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done)
    values (gen_random_uuid(), w, v_user, ex_dc, 0, 'normal', rec.rp, rec.wt, true);
  end loop;

  ---------------------------------------------------------------------------
  -- 6) MUSCU — TRACTIONS au poids du corps (charge 0).
  --    Sert MUSC-04 : doit être ABSENT de la courbe 1RM (charge 0), placé
  --    hors des 14 j pour ne pas fausser l'équilibre MUSC-05.
  ---------------------------------------------------------------------------
  for rec in
    select * from (values (20, 8), (50, 8), (95, 6)) as t(doff, rp)
  loop
    w := gen_random_uuid();
    insert into public.workouts (id, user_id, status, started_at, finished_at, duration_seconds)
    values (w, v_user, 'completed', (d0 - rec.doff)::timestamp + time '12:00',
            (d0 - rec.doff)::timestamp + time '12:30', 1800);
    insert into public.workout_sets (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done)
    values (gen_random_uuid(), w, v_user, ex_pullup, 0, 'bodyweight', rec.rp, 0, true);
  end loop;

  ---------------------------------------------------------------------------
  -- 7) COURSE — runs sur ~2 mois. Sert META-06 (delta semaine/mois),
  --    RN-01/02 (2 courses AUJOURD'HUI = somme → objectif du jour ↑).
  ---------------------------------------------------------------------------
  for rec in
    select * from (values
      ( 0, 5000, 1500,  8),   -- aujourd'hui, matin
      ( 0, 3000,  900, 18),   -- aujourd'hui, soir (2ᵉ course → somme)
      ( 2, 8000, 2520,  7),
      ( 5, 5000, 1560,  7),
      ( 9, 6000, 1980,  7),   -- semaine précédente
      (12, 4000, 1320,  7),   -- semaine précédente
      (20,10000, 3300,  7),
      (28, 7000, 2310,  7),
      (35, 5000, 1620,  7),   -- mois précédent
      (45,12000, 4200,  7),   -- mois précédent
      (55, 6000, 2040,  7)    -- mois précédent
    ) as t(doff, dist, dur, hh)
  loop
    r := gen_random_uuid();
    insert into public.runs
      (id, user_id, status, source, started_at, finished_at,
       duration_seconds, distance_m, avg_pace_s_per_km, rpe)
    values
      (r, v_user, 'completed', 'gps',
       (d0 - rec.doff)::timestamp + make_interval(hours => rec.hh),
       (d0 - rec.doff)::timestamp + make_interval(hours => rec.hh, secs => rec.dur),
       rec.dur, rec.dist,
       round((rec.dur / (rec.dist / 1000.0))::numeric, 1), 5);
  end loop;

  -- Records d'allure (R4b) dérivés des meilleures courses (5k / 10k) — écran non vide.
  insert into public.running_pace_records (id, user_id, distance_key, best_time_seconds, run_id, achieved_at)
  select gen_random_uuid(), v_user, '5k', duration_seconds, id, finished_at
  from public.runs
  where user_id = v_user and status = 'completed' and distance_m between 4800 and 5200
  order by duration_seconds asc limit 1;
  insert into public.running_pace_records (id, user_id, distance_key, best_time_seconds, run_id, achieved_at)
  select gen_random_uuid(), v_user, '10k', duration_seconds, id, finished_at
  from public.runs
  where user_id = v_user and status = 'completed' and distance_m between 9500 and 10500
  order by duration_seconds asc limit 1;

  ---------------------------------------------------------------------------
  -- 8) NUTRITION — journal quotidien sur 60 j (3 repas/jour).
  --    Profil kcal :
  --      · J0..J6   ≈ 2000 kcal  → déficit 20 % (4.32 : ≥ 4 jours ; delta 7 j)
  --      · J7..J29  ≈ 2250 kcal
  --      · J30..J59 ≈ 2500 kcal  → META-06 : delta 30 j vs 30 j précédents
  ---------------------------------------------------------------------------
  for j in 0..59 loop
    v_kcal := case when j < 7 then 2000 when j < 30 then 2250 else 2500 end;
    for rec in
      select * from (values
        ('breakfast', 0.25, 'Petit-déjeuner'),
        ('lunch',     0.40, 'Déjeuner'),
        ('dinner',    0.35, 'Dîner')
      ) as t(meal, share, label)
    loop
      mk := round(v_kcal * rec.share);
      insert into public.food_entries
        (id, user_id, log_date, meal_type, order_index, name,
         quantity_g, kcal, protein_g, carbs_g, fat_g)
      values
        (gen_random_uuid(), v_user, d0 - j, rec.meal, 0, rec.label,
         null, mk,
         round((mk * 0.30 / 4)::numeric, 1),   -- protéines (~30 % kcal)
         round((mk * 0.45 / 4)::numeric, 1),   -- glucides  (~45 % kcal)
         round((mk * 0.25 / 9)::numeric, 1));  -- lipides   (~25 % kcal)
    end loop;
  end loop;

  ---------------------------------------------------------------------------
  -- 9) RECORDS MUSCU — HISTORIQUE des paliers (max_weight / estimated_1rm /
  --    best_volume), reconstitué comme le ferait l'app à la clôture des séances.
  --
  --    ⚠️ La courbe « charge max » (écran Progression) lit `personal_records` :
  --    chaque point = un record battu. Sans cet historique, on n'aurait qu'un
  --    seul point. On sème donc UNE ligne par palier réellement franchi (valeur
  --    strictement supérieure aux séances précédentes), datée de la séance.
  --    Les exercices au poids du corps (charge 0) sont exclus (pas de record de
  --    charge) → ils restent absents des courbes charge max / 1RM (voulu).
  ---------------------------------------------------------------------------
  insert into public.personal_records
    (id, user_id, exercise_id, type, value, reps, weight_kg, workout_id, achieved_at)
  with sess as (
    select ws.exercise_id, ws.workout_id, w.finished_at,
           max(ws.weight_kg)                       as sess_max,
           max(ws.weight_kg * (1 + ws.reps / 30.0)) as sess_1rm,  -- 1RM Epley
           max(ws.reps * ws.weight_kg)             as sess_vol
    from public.workout_sets ws
    join public.workouts w on w.id = ws.workout_id
    where ws.user_id = v_user and w.status = 'completed'
      and ws.set_type <> 'warmup'
      and ws.weight_kg > 0 and ws.reps is not null
    group by ws.exercise_id, ws.workout_id, w.finished_at
  ),
  ranked as (
    select s.*,
           max(sess_max) over w_ex as run_max,
           max(sess_1rm) over w_ex as run_1rm,
           max(sess_vol) over w_ex as run_vol
    from sess s
    window w_ex as (
      partition by exercise_id order by finished_at
      rows between unbounded preceding and 1 preceding
    )
  )
  select gen_random_uuid(), v_user, exercise_id, 'max_weight',
         round(sess_max, 1), null::int, sess_max, workout_id, finished_at
  from ranked where run_max is null or sess_max > run_max
  union all
  select gen_random_uuid(), v_user, exercise_id, 'estimated_1rm',
         round(sess_1rm, 1), null::int, null::numeric, workout_id, finished_at
  from ranked where run_1rm is null or sess_1rm > run_1rm
  union all
  select gen_random_uuid(), v_user, exercise_id, 'best_volume',
         round(sess_vol, 1), null::int, null::numeric, workout_id, finished_at
  from ranked where run_vol is null or sess_vol > run_vol;

  ---------------------------------------------------------------------------
  -- Récapitulatif
  ---------------------------------------------------------------------------
  select count(*) into n_work from public.workouts where user_id = v_user;
  select count(*) into n_sets from public.workout_sets where user_id = v_user;
  select count(*) into n_runs from public.runs where user_id = v_user;
  select count(*) into n_food from public.food_entries where user_id = v_user;
  select count(*) into n_bw   from public.body_weight_entries where user_id = v_user;
  raise notice 'Dataset injecté : % séances / % séries · % courses · % lignes nutrition · % pesées.',
    n_work, n_sets, n_runs, n_food, n_bw;
end $$;
