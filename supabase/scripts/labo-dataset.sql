-- =================================================================================================
-- US LABO-01 — JEU DE DONNÉES POUR VOIR LES TROIS DISQUES DU LABO
-- =================================================================================================
--
-- ⚠️ CE N'EST PAS UNE MIGRATION DE SCHÉMA. C'est un script de DONNÉES.
--    → À jouer dans le SQL Editor de Supabase (cloud `nsxzflxsgovriwwvflxe`),
--      **PAS** via `npm run db:push`. Ne modifie aucune structure de table.
--    → Exécuté sous le rôle du SQL Editor (bypass RLS) : l'écriture pour ton user_id passe.
--
-- ── Pourquoi ce script existe ────────────────────────────────────────────────────────────────────
-- La scène du Labo ne montre que ce qui existe. Sur un compte à **0 séance et 0 km cette semaine**,
-- seule l'assiette s'affiche — c'est exact, mais impossible à recetter. Ce script fabrique une
-- semaine complète sur les trois piliers pour que les **trois disques** soient visibles : la pile de
-- disques de fonte, la piste d'athlétisme et l'assiette.
--
-- ── 🔴 CE QUI N'EST JAMAIS TOUCHÉ ────────────────────────────────────────────────────────────────
--   · `auth.users` — ton compte et ton authentification. Aucune ligne n'y est lue autrement que
--     pour retrouver ton `id` à partir de ton e-mail, et **aucune** n'y est écrite ou supprimée.
--   · `profiles`, `user_settings`, `nutrition_profiles`, `running_profiles` — conservés tels quels
--     (donc tes piliers actifs, ton objectif et ton régime de guidage ne bougent pas).
--   · La **bibliothèque partagée** (exercices et aliments `owner_id is null`) — jamais effleurée.
--
-- ── Ce qu'il efface (hard delete), pour ton compte uniquement ────────────────────────────────────
-- Séances et séries, records, courses, planning, journal alimentaire, pesées, programmes et
-- contenus personnels. Même périmètre que `recette-dataset.sql`, dont la liste est reprise telle
-- quelle. Rien d'autre.
--
-- ── Ce qu'il crée ────────────────────────────────────────────────────────────────────────────────
--   · Un programme de musculation (4 séances/semaine) et un programme de course (3 sorties).
--   · La **semaine en cours**, du lundi au dimanche, avec du fait ET du prévu :
--       – muscu   : 4 séances planifiées, dont **2 faites** (avec leurs séries réelles) ;
--       – course  : 3 sorties planifiées pour **24 km**, dont **2 courues** (14,5 km) ;
--       – nutrition : un journal par jour ÉCOULÉ de la semaine, ~1,8 g/kg de protéines ;
--       – sommeil : une nuit notée par jour écoulé, dont deux courtes (5 h 30, mercredi et
--         samedi) — de quoi voir l'anneau du socle s'éteindre par endroits.
--       ⚠️ Rien n'est fabriqué dans le FUTUR : lancé un mardi, tu auras 2 jours de journal, pas 7.
--   · **8 semaines d'historique** avant, pour que le ratio de charge, l'onglet « Pourquoi ? » et
--     les cartes d'acquis aient de quoi calculer au lieu d'afficher leur état vide.
--
-- ⚠️ Les chiffres sont **inventés** et cohérents entre eux, mais ils ne décrivent personne : c'est
-- un décor de recette, pas un historique réel.
--
-- ── MODE OPÉRATOIRE ──────────────────────────────────────────────────────────────────────────────
--   1. Renseigne ton e-mail ci-dessous (`v_email`).
--   2. Exécute tout le bloc. Tout est dans une seule transaction (`do $$ … $$`) : à la moindre
--      erreur, **rien** n'est appliqué.
--   3. Sur le téléphone, device connecté : PowerSync propage l'effacement puis le jeu de données.
--      Si un résidu persiste (base SQLite locale), Réglages Android → l'app → Effacer les données,
--      puis reconnexion — on repart d'un instantané cloud propre.
-- =================================================================================================

do $$
declare
  ---------------------------------------------------------------------------
  -- 👉 SEUL PARAMÈTRE À RENSEIGNER
  ---------------------------------------------------------------------------
  v_email text := 'florian.martin63000@gmail.com';

  v_user      uuid;
  v_prog_m    uuid := gen_random_uuid();   -- programme musculation
  v_prog_r    uuid := gen_random_uuid();   -- programme course
  v_poids     numeric := 78;               -- sert aux protéines par kilo

  -- Lundi de la semaine en cours. `date_trunc('week')` est lundi en PostgreSQL (norme ISO),
  -- ce qui correspond exactement au `startOfWeek` de l'app.
  v_lundi     date := (date_trunc('week', current_date))::date;

  -- Séances de musculation du programme (nom, jour de la semaine 0=lundi)
  v_sess_m    uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_sess_r    uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];

  v_ex        uuid[];                      -- exercices tirés de la bibliothèque partagée
  v_ex_jambes uuid[];                      -- exercices à dominante jambes (pour les collisions)

  v_workout   uuid;
  v_ps        uuid;
  i           int;
  s           int;
  j           int;
  v_jour      date;
begin
  ---------------------------------------------------------------------------
  -- 0. Résolution du compte — lecture seule sur auth.users
  ---------------------------------------------------------------------------
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'Aucun compte pour l''e-mail %. Vérifie avec : select id, email from auth.users;', v_email;
  end if;
  raise notice 'Compte trouvé : % (%). Authentification et profils CONSERVÉS.', v_email, v_user;

  ---------------------------------------------------------------------------
  -- 1. Exercices de la bibliothèque partagée (jamais modifiés, seulement lus)
  ---------------------------------------------------------------------------
  select array_agg(id) into v_ex from (
    select id from public.exercises
    where owner_id is null and status = 'published' and deleted_at is null
    order by id limit 8
  ) q;

  if v_ex is null or array_length(v_ex, 1) < 4 then
    raise exception 'Bibliothèque d''exercices vide ou trop courte : impossible de fabriquer des séries.';
  end if;

  -- Un sous-ensemble « jambes », pour que le détecteur de collisions du Labo ait de quoi mordre.
  -- On filtre sur `muscle_primary` et non sur le nom : une recherche textuelle française casserait
  -- sur une bibliothèque en anglais, et raterait « hack squat » comme « leg press ».
  select coalesce(array_agg(id), v_ex[1:2]) into v_ex_jambes from (
    select e.id
    from public.exercises e
    where e.owner_id is null and e.status = 'published' and e.deleted_at is null
      and e.muscle_primary = 'legs'
    order by e.id limit 3
  ) q;

  ---------------------------------------------------------------------------
  -- 2. EFFACEMENT (hard delete) — périmètre repris de `recette-dataset.sql`
  --    🔴 auth.users, profiles, user_settings, *_profiles : NON touchés.
  ---------------------------------------------------------------------------
  delete from public.workout_sets         where user_id  = v_user;
  delete from public.personal_records     where user_id  = v_user;
  delete from public.workouts             where user_id  = v_user;

  delete from public.running_pace_records where user_id  = v_user;
  delete from public.run_intervals        where user_id  = v_user;
  delete from public.runs                 where user_id  = v_user;

  delete from public.planned_sessions     where owner_id = v_user;

  delete from public.food_entries         where user_id  = v_user;
  delete from public.recipe_ingredients   where user_id  = v_user;
  delete from public.recipes              where user_id  = v_user;
  delete from public.meal_template_items  where user_id  = v_user;
  delete from public.meal_templates       where user_id  = v_user;
  delete from public.body_weight_entries  where user_id  = v_user;
  delete from public.daily_wellbeing      where user_id  = v_user;

  delete from public.food_favorites       where user_id  = v_user;
  delete from public.exercise_favorites   where user_id  = v_user;

  delete from public.session_intervals    where owner_id = v_user;
  delete from public.session_translations where owner_id = v_user;
  delete from public.exercise_plans       where owner_id = v_user;
  delete from public.sessions             where owner_id = v_user;
  delete from public.program_translations where owner_id = v_user;
  delete from public.programs             where owner_id = v_user;
  delete from public.food_translations    where owner_id = v_user;
  delete from public.foods                where owner_id = v_user;
  delete from public.exercise_translations where owner_id = v_user;
  delete from public.exercises            where owner_id = v_user;

  raise notice 'Données personnelles effacées. Compte, profils et bibliothèque partagée intacts.';

  ---------------------------------------------------------------------------
  -- 3. Les deux programmes
  ---------------------------------------------------------------------------
  insert into public.programs (id, owner_id, pillar, status, is_active, level, goal, duration_weeks)
  values (v_prog_m, v_user, 'strength', 'published', true, 'intermediate', 'hypertrophy', 12),
         (v_prog_r, v_user, 'running',  'published', true, 'intermediate', 'endurance',   12);

  insert into public.program_translations (id, program_id, owner_id, lang, name, summary)
  values (gen_random_uuid(), v_prog_m, v_user, 'fr', 'Force & volume', 'Quatre séances par semaine'),
         (gen_random_uuid(), v_prog_r, v_user, 'fr', 'Route 10 km',    'Trois sorties par semaine');

  -- Séances de musculation : 4 par semaine.
  insert into public.sessions (id, program_id, owner_id, order_index, name, session_type)
  values (v_sess_m[1], v_prog_m, v_user, 0, 'Haut du corps — poussée', null),
         (v_sess_m[2], v_prog_m, v_user, 1, 'Bas du corps',            null),
         (v_sess_m[3], v_prog_m, v_user, 2, 'Haut du corps — tirage',  null),
         (v_sess_m[4], v_prog_m, v_user, 3, 'Full body',               null);

  -- Sorties de course : 3 par semaine, 24 km au total (8 + 6 + 10).
  insert into public.sessions (id, program_id, owner_id, order_index, name, session_type, target_distance_m)
  values (v_sess_r[1], v_prog_r, v_user, 0, 'Endurance',      'endurance',     8000),
         (v_sess_r[2], v_prog_r, v_user, 1, 'Fractionné 6×3''','fractionne',   6000),
         (v_sess_r[3], v_prog_r, v_user, 2, 'Sortie longue',  'sortie_longue', 10000);

  -- Exercices prévus par séance de musculation (4 par séance).
  for s in 1..4 loop
    for i in 1..4 loop
      insert into public.exercise_plans
        (id, session_id, owner_id, exercise_id, order_index, target_sets, target_reps, target_weight_kg, rest_seconds)
      values (
        gen_random_uuid(), v_sess_m[s], v_user,
        -- La séance 2 est la séance « jambes » : elle sert aux collisions muscu ↔ course.
        case when s = 2 then v_ex_jambes[1 + ((i - 1) % greatest(array_length(v_ex_jambes, 1), 1))]
             else v_ex[1 + ((s * 4 + i - 1) % array_length(v_ex, 1))] end,
        i - 1, 4, 8, 60 + i * 5, 120
      );
    end loop;
  end loop;

  ---------------------------------------------------------------------------
  -- 4. LA SEMAINE EN COURS — c'est elle que la scène du Labo lit
  --
  --    Muscu   : lundi FAIT · mardi FAIT · jeudi PRÉVU · samedi PRÉVU   → 2 sur 4
  --    Course  : mardi COURU 8 km · vendredi PRÉVU 6 km · dimanche COURU 6,5 km
  --              → 14,5 km courus sur 24 km prévus
  --    🔴 La séance de JAMBES est placée le mardi, la veille de rien — et le FRACTIONNÉ le
  --       vendredi : de quoi laisser le détecteur de collisions tranquille par défaut. Décale la
  --       séance jambes au jeudi si tu veux voir la carte « jambes la veille » apparaître.
  ---------------------------------------------------------------------------
  for s in 1..4 loop
    v_ps := gen_random_uuid();
    v_jour := v_lundi + (array[0, 1, 3, 5])[s];

    insert into public.planned_sessions
      (id, owner_id, program_id, session_id, scheduled_date, status, week_index, completed_at)
    values (
      v_ps, v_user, v_prog_m, v_sess_m[s], v_jour,
      case when s <= 2 then 'done' else 'planned' end,
      0,
      case when s <= 2 then (v_jour + time '18:30')::timestamptz else null end
    );

    -- Les deux séances faites reçoivent une vraie séance avec ses séries.
    if s <= 2 then
      v_workout := gen_random_uuid();
      insert into public.workouts
        (id, user_id, program_id, session_id, planned_session_id, status, started_at, finished_at, duration_seconds, rpe)
      values (
        v_workout, v_user, v_prog_m, v_sess_m[s], v_ps, 'completed',
        (v_jour + time '18:30')::timestamptz, (v_jour + time '19:35')::timestamptz, 3900, 7
      );

      for i in 1..4 loop
        for j in 1..4 loop
          insert into public.workout_sets
            (id, user_id, workout_id, exercise_id, order_index, reps, weight_kg, done, set_type, rpe)
          values (
            gen_random_uuid(), v_user, v_workout,
            case when s = 2 then v_ex_jambes[1 + ((i - 1) % greatest(array_length(v_ex_jambes, 1), 1))]
                 else v_ex[1 + ((s * 4 + i - 1) % array_length(v_ex, 1))] end,
            (i - 1) * 4 + (j - 1), 8, 60 + i * 5, true, 'normal', 7
          );
        end loop;
      end loop;
    end if;
  end loop;

  -- Course : 3 sorties planifiées, 2 réellement courues.
  for s in 1..3 loop
    v_ps := gen_random_uuid();
    v_jour := v_lundi + (array[1, 4, 6])[s];

    insert into public.planned_sessions
      (id, owner_id, program_id, session_id, scheduled_date, status, week_index, completed_at)
    values (
      v_ps, v_user, v_prog_r, v_sess_r[s], v_jour,
      case when s = 2 then 'planned' else 'done' end,
      0,
      case when s = 2 then null else (v_jour + time '07:15')::timestamptz end
    );

    if s <> 2 then
      insert into public.runs
        (id, user_id, planned_session_id, status, started_at, finished_at,
         distance_m, duration_seconds, avg_pace_s_per_km, elevation_gain_m, source, rpe)
      values (
        gen_random_uuid(), v_user, v_ps, 'completed',
        (v_jour + time '07:15')::timestamptz, (v_jour + time '08:00')::timestamptz,
        case when s = 1 then 8000 else 6500 end,
        case when s = 1 then 2640 else 2145 end,   -- 5:30/km
        330, 45, 'gps', 6
      );
    end if;
  end loop;

  ---------------------------------------------------------------------------
  -- 5. Nutrition, sommeil et poids de la semaine
  --    Protéines visées ~1,8 g/kg → ~140 g/jour pour 78 kg.
  ---------------------------------------------------------------------------
  for j in 0..6 loop
    v_jour := v_lundi + j;
    exit when v_jour > current_date;        -- on ne fabrique pas de journal dans le futur

    insert into public.food_entries
      (id, user_id, log_date, meal_type, name, quantity_g, kcal, protein_g, carbs_g, fat_g, order_index)
    values
      (gen_random_uuid(), v_user, v_jour, 'breakfast', 'Flocons d''avoine et skyr', 350, 620, 42, 78, 14, 0),
      (gen_random_uuid(), v_user, v_jour, 'lunch',     'Poulet, riz, brocolis',     500, 780, 58, 92, 16, 1),
      (gen_random_uuid(), v_user, v_jour, 'dinner',    'Saumon, patate douce',      450, 720, 44, 66, 28, 2);

    -- Deux nuits courtes (mercredi et samedi) : l'anneau du socle doit les montrer éteintes.
    insert into public.daily_wellbeing (id, user_id, log_date, mood, energy, stress, sleep_minutes)
    values (
      gen_random_uuid(), v_user, v_jour,
      case when j in (2, 5) then 2 else 4 end,
      case when j in (2, 5) then 2 else 4 end,
      case when j in (2, 5) then 4 else 2 end,
      case when j in (2, 5) then 330 else 450 end   -- 5 h 30 vs 7 h 30
    );

    insert into public.body_weight_entries (id, user_id, log_date, weight_kg)
    values (gen_random_uuid(), v_user, v_jour, v_poids - j * 0.05);
  end loop;

  ---------------------------------------------------------------------------
  -- 6. HUIT SEMAINES D'HISTORIQUE avant la semaine en cours
  --    Sans ça, le ratio de charge, l'onglet « Pourquoi ? » et les acquis restent vides.
  ---------------------------------------------------------------------------
  for i in 1..8 loop
    for s in 1..3 loop
      v_jour := v_lundi - (i * 7) + (array[0, 2, 4])[s];
      v_ps := gen_random_uuid();

      insert into public.planned_sessions
        (id, owner_id, program_id, session_id, scheduled_date, status, week_index, completed_at)
      values (v_ps, v_user, v_prog_m, v_sess_m[s], v_jour, 'done', 0, (v_jour + time '18:30')::timestamptz);

      v_workout := gen_random_uuid();
      insert into public.workouts
        (id, user_id, program_id, session_id, planned_session_id, status, started_at, finished_at, duration_seconds, rpe)
      values (v_workout, v_user, v_prog_m, v_sess_m[s], v_ps, 'completed',
              (v_jour + time '18:30')::timestamptz, (v_jour + time '19:30')::timestamptz, 3600, 7);

      -- La charge progresse doucement en remontant vers aujourd'hui : une pente, pas du bruit.
      for j in 1..3 loop
        insert into public.workout_sets
          (id, user_id, workout_id, exercise_id, order_index, reps, weight_kg, done, set_type, rpe)
        values (gen_random_uuid(), v_user, v_workout,
                v_ex[1 + ((s * 3 + j - 1) % array_length(v_ex, 1))],
                j - 1, 8, 55 + (8 - i) * 1.25 + j * 5, true, 'normal', 7);
      end loop;
    end loop;

    -- Deux courses par semaine d'historique.
    for s in 1..2 loop
      v_jour := v_lundi - (i * 7) + (array[1, 5])[s];
      insert into public.runs
        (id, user_id, status, started_at, finished_at, distance_m, duration_seconds,
         avg_pace_s_per_km, elevation_gain_m, source, rpe)
      values (gen_random_uuid(), v_user, 'completed',
              (v_jour + time '07:15')::timestamptz, (v_jour + time '08:05')::timestamptz,
              case when s = 1 then 8000 else 11000 end,
              case when s = 1 then 2640 else 3740 end,
              340, 50, 'gps', 6);
    end loop;

    -- Journal alimentaire, sommeil et poids de l'historique (3 jours par semaine suffisent
    -- pour que les moyennes et l'enquête aient de la matière).
    for s in 1..3 loop
      v_jour := v_lundi - (i * 7) + (array[0, 3, 5])[s];
      insert into public.food_entries
        (id, user_id, log_date, meal_type, name, quantity_g, kcal, protein_g, carbs_g, fat_g, order_index)
      values (gen_random_uuid(), v_user, v_jour, 'lunch',  'Poulet, riz, brocolis', 500, 780, 58, 92, 16, 0),
             (gen_random_uuid(), v_user, v_jour, 'dinner', 'Saumon, patate douce',  450, 720, 44, 66, 28, 1);

      insert into public.daily_wellbeing (id, user_id, log_date, mood, energy, stress, sleep_minutes)
      values (gen_random_uuid(), v_user, v_jour, 4, 4, 2, 440);

      insert into public.body_weight_entries (id, user_id, log_date, weight_kg)
      values (gen_random_uuid(), v_user, v_jour, v_poids + i * 0.12);
    end loop;
  end loop;

  raise notice '--------------------------------------------------------------';
  raise notice 'Semaine du % : muscu 2 faites / 4 prévues · course 14,5 km courus / 24 km prévus.', v_lundi;
  raise notice '8 semaines d''historique créées avant cette semaine.';
  raise notice 'Les TROIS disques du Labo doivent maintenant être visibles.';
  raise notice '--------------------------------------------------------------';
end $$;

-- =================================================================================================
-- VÉRIFICATION — à exécuter APRÈS le bloc ci-dessus (sélection seule, n'écrit rien).
-- Remplace l'e-mail si tu as changé `v_email`.
-- Attendu : muscu 2 faites / 4 prévues · course 14,5 km courus / 24,0 km prévus.
-- =================================================================================================
with moi as (
  select id from auth.users where lower(email) = lower('florian.martin63000@gmail.com')
), semaine as (
  select (date_trunc('week', current_date))::date as lundi
)
select
  (select lundi from semaine)                                          as "lundi de la semaine",
  (select count(*) from public.planned_sessions ps
     join public.programs p on p.id = ps.program_id
    where ps.owner_id = (select id from moi) and p.pillar = 'strength'
      and ps.deleted_at is null
      and ps.scheduled_date between (select lundi from semaine) and (select lundi from semaine) + 6
  )                                                                     as "muscu prévues",
  (select count(*) from public.planned_sessions ps
     join public.programs p on p.id = ps.program_id
    where ps.owner_id = (select id from moi) and p.pillar = 'strength'
      and ps.status = 'done' and ps.deleted_at is null
      and ps.scheduled_date between (select lundi from semaine) and (select lundi from semaine) + 6
  )                                                                     as "muscu faites",
  (select round(coalesce(sum(s.target_distance_m), 0) / 1000.0, 1)
     from public.planned_sessions ps
     join public.sessions s on s.id = ps.session_id
     join public.programs p on p.id = ps.program_id
    where ps.owner_id = (select id from moi) and p.pillar = 'running'
      and ps.deleted_at is null
      and ps.scheduled_date between (select lundi from semaine) and (select lundi from semaine) + 6
  )                                                                     as "km prévus",
  (select round(coalesce(sum(r.distance_m), 0) / 1000.0, 1)
     from public.runs r
    where r.user_id = (select id from moi) and r.status = 'completed' and r.deleted_at is null
      and r.finished_at::date between (select lundi from semaine) and (select lundi from semaine) + 6
  )                                                                     as "km courus",
  (select count(*) from public.daily_wellbeing w
    where w.user_id = (select id from moi) and w.deleted_at is null and w.sleep_minutes is not null
      and w.log_date between (select lundi from semaine) and (select lundi from semaine) + 6
  )                                                                     as "nuits notées";
