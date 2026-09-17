-- =================================================================================================
-- US IA-LAB-01 — REMISE À PLAT + JEU DE DONNÉES FACTICES POUR TESTER L'IA
-- =================================================================================================
--
-- ⚠️⚠️ CES DEUX SCRIPTS DE JEU DE DONNÉES S'EXCLUENT MUTUELLEMENT ⚠️⚠️
--
--   · supabase/scripts/ia-purge-et-dataset.sql   — 120 jours, 6 signaux plantés  (US IA-LAB-01)
--   · supabase/scripts/labo-dataset.sql          — 1 semaine, 3 disques visibles (US LABO-01)
--
-- Les deux effacent les MÊMES tables (séances, courses, journal alimentaire, pesées, bien-être) et
-- les repeuplent différemment. Jouer l'un APRÈS l'autre ne « complète » rien : le second écrase.
--
-- 🔴 Pire : ils n'effacent pas exactement le même périmètre. `daily_steps`, `activities`,
-- `personal_goals`, `water_entries`, `body_measurements`, `pain_reports` et six autres tables
-- survivent à `labo-dataset` mais pas à `ia-purge-et-dataset`. Enchaîner les deux laisse donc une
-- base **chimère** : une semaine de séances, et 90 jours de pas.
--
-- ── Comment ça s'est vu (17/09/2026) ─────────────────────────────────────────────────────────────
-- Le labo IA a rendu une analyse parfaitement cohérente sur une base qui ne l'était pas : 26 séances
-- (Labo) mais 620 min de vélo (IA), 1589 kcal (Labo) mais 9457 pas (IA). Aucun chiffre inventé —
-- le modèle lisait fidèlement un monstre. Une heure perdue à soupçonner une hallucination.
--
-- 👉 **Rejouer le script voulu remet tout d'aplomb** : chacun commence par tout effacer. Vérifier
--    ensuite avec `ia-verification.sql`, dont la ligne « Cohérence » détecte précisément ce cas.
--
-- ⚠️ CE N'EST PAS UNE MIGRATION DE SCHÉMA. C'est un script de DONNÉES.
--    → À jouer dans le SQL Editor de Supabase (cloud `nsxzflxsgovriwwvflxe`),
--      PAS via `npm run db:push`. Ne modifie aucune structure de table.
--
-- ── Pourquoi ce script existe ────────────────────────────────────────────────────────────────────
-- Le labo IA tourne sur un **palier gratuit** (Gemini), et le palier gratuit de Google peut
-- **utiliser les requêtes pour entraîner ses modèles** (`docs/product/ia-integration-analyse.md`
-- §7.2). Envoyer des données réelles de poids, de repas et d'activité à un tel service serait un
-- manquement au §5 du même document. Ce script fabrique donc un historique **entièrement inventé**,
-- pour que la seule chose qui parte soit de la fiction.
--
-- ── Ce qu'il fait, dans l'ordre ──────────────────────────────────────────────────────────────────
--   1. EFFACE (hard delete) toutes les données personnelles du compte visé.
--   2. CONSERVE le compte, l'authentification, et les profils (qui sont ensuite pré-réglés).
--   3. NE TOUCHE JAMAIS la bibliothèque partagée (exercices, aliments — `owner_id IS NULL`).
--   4. GÉNÈRE 120 jours d'historique cohérent sur les 3 piliers + bien-être + pas + activités.
--
-- ── 🔴 Six signaux sont PLANTÉS volontairement ───────────────────────────────────────────────────
-- Un jeu de données aléatoire ne prouve rien : le modèle a toujours quelque chose à dire, et on ne
-- peut pas juger s'il a raison. Ici, l'histoire est écrite à l'avance, et on peut donc **noter** la
-- réponse. Un bon modèle doit retrouver tout ou partie de ceci :
--
--   S1  Le développé couché STAGNE depuis ~7 semaines (bloqué à 82,5 kg), alors que le squat
--       continue de monter sans interruption. → « pourquoi je stagne ? »
--   S2  Les calories ont CHUTÉ de ~20 % sur les 28 derniers jours (2700 → 2150 kcal) et les
--       protéines de 165 g à 115 g, à volume d'entraînement inchangé. → sous-alimentation.
--   S3  L'énergie et l'humeur BAISSENT, le stress MONTE et le sommeil passe de ~7 h 30 à ~6 h sur
--       les 28 derniers jours. → fatigue accumulée, cohérente avec S1 et S2.
--   S4  ANGLE MORT : zéro série d'épaules, de bras et de gainage en 120 jours. Tout le volume est
--       sur pectoraux / dos / jambes. → « quel est mon angle mort ? »
--   S5  L'allure de course SE DÉGRADE de ~30 s/km sur les 28 derniers jours, après avoir progressé
--       de 5:45/km à 5:11/km. → même cause que S3.
--   S6  Le poids STAGNE sur les 30 derniers jours, après une perte régulière de 82 à 78 kg.
--
-- Ces six signaux forment une seule histoire : un déficit calorique trop agressif sur un volume
-- d'entraînement maintenu, qui produit de la fatigue, qui bloque la progression. **C'est la réponse
-- attendue.** Si le modèle conclut « mange moins » ou « entraîne-toi plus », il a échoué.
--
-- ── MODE OPÉRATOIRE ──────────────────────────────────────────────────────────────────────────────
--   1. Vérifie `v_email` ci-dessous (pré-rempli).
--   2. Exécute tout le bloc. Tout est dans un `DO $$ … $$` : une erreur = rien n'est appliqué.
--   3. Sur le téléphone, device CONNECTÉ : PowerSync propage l'effacement puis le jeu de données.
--      En cas de résidu local, forcer une resynchro (Android → Paramètres → App → Effacer les
--      données, puis reconnexion) : on repart d'un instantané cloud propre.
--
-- ── Compatible avec une base dont les dernières migrations ne sont pas encore poussées ───────────
-- `daily_wellbeing.sleep_minutes` et `lab_experiments` arrivent avec LABO-01, **non poussée au
-- 15/09/2026**. Le script détecte leur présence et s'adapte plutôt que d'échouer : le sommeil (S3)
-- n'est alors simplement pas généré. Jouer `npm run db:push` avant donne le jeu complet.
-- =================================================================================================

do $$
declare
  ---------------------------------------------------------------------------------------------
  -- 👉 SEUL PARAMÈTRE : l'e-mail du compte de TEST.
  --    (`select id, email from auth.users;` pour retrouver le tien.)
  ---------------------------------------------------------------------------------------------
  v_email text := 'florian.martin63000@gmail.com';

  v_user      uuid;
  d0          date := current_date;     -- ancrage « aujourd'hui »
  v_days      int  := 120;              -- profondeur de l'historique

  j           int;                      -- jours en arrière (0 = aujourd'hui)
  wk          int;                      -- semaines écoulées depuis le début de la période
  dow         int;                      -- jour de la semaine (0 = dimanche)
  d           date;
  w           uuid;                     -- séance de muscu courante
  r           uuid;                     -- sortie course courante
  o           int;                      -- ordre de série dans la séance

  -- Charges dérivées de la semaine (voir S1)
  v_bench     numeric;
  v_incline   numeric;
  v_squat     numeric;
  v_dead      numeric;
  v_row       numeric;
  v_pulldown  numeric;
  v_legpress  numeric;

  -- Course
  v_pace      int;                      -- secondes par km
  v_dist      int;                      -- mètres

  -- Nutrition
  v_kcal      int;
  v_prot      int;
  v_jitter    numeric;                  -- variation déterministe, pour ne pas avoir des jours clonés

  -- Bien-être / pas
  v_energy    int;
  v_mood      int;
  v_stress    int;
  v_sleep     int;
  v_steps     int;

  v_has_sleep boolean;
  v_has_lab   boolean;

  -- Exercices résolus depuis la bibliothèque (voir bloc 3)
  ex_bench    uuid; ex_incline uuid; ex_row uuid; ex_pulldown uuid;
  ex_squat    uuid; ex_dead    uuid; ex_legpress uuid;

  n_work int; n_sets int; n_runs int; n_food int; n_bw int; n_act int; n_wb int; n_steps int;

  -- Diagnostic du garde-fou d'utilisateur (voir bloc 0)
  n_users  int;
  v_emails text;
begin
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 0) L'utilisateur
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- `trim` en plus de `lower` : un espace insécable collé depuis un e-mail ou un gestionnaire de
  -- mots de passe ne se voit pas à l'écran et suffit à faire échouer la comparaison.
  select id into v_user from auth.users where lower(trim(email)) = lower(trim(v_email));

  if v_user is null then
    -- 🔴 Message auto-diagnostiquant. « Aucun utilisateur trouvé » n'aide personne : la cause est
    -- soit un e-mail différent de celui qu'on croit (connexion Google, alias `+`), soit — bien plus
    -- souvent — un SQL Editor ouvert sur un AUTRE projet que celui de l'app. Les deux se
    -- distinguent d'un coup d'œil si l'on affiche ce que la base contient réellement.
    select count(*) into n_users from auth.users;
    select string_agg(email, ', ' order by created_at) into v_emails
      from (select email, created_at from auth.users order by created_at limit 10) t;

    if n_users = 0 then
      raise exception
        'Aucun compte dans auth.users sur CETTE base. Le SQL Editor n''est pas sur le projet de l''app : vérifie que l''URL du dashboard contient « nsxzflxsgovriwwvflxe ».';
    else
      raise exception
        'Aucun utilisateur pour « % ». La base contient % compte(s) : %. Recopie l''e-mail exact dans v_email.',
        v_email, n_users, coalesce(v_emails, '(illisibles)');
    end if;
  end if;
  raise notice 'Compte cible : % (%)', v_email, v_user;

  -- Colonnes/tables qui n'existent que si LABO-01 a été poussée.
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'daily_wellbeing' and column_name = 'sleep_minutes'
  ) into v_has_sleep;
  v_has_lab := to_regclass('public.lab_experiments') is not null;

  if not v_has_sleep then
    raise notice 'ATTENTION : daily_wellbeing.sleep_minutes absente (migration LABO-01 non poussée). Le signal S3 sera partiel — pas de sommeil généré.';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 1) EFFACEMENT — hard delete, enfants avant parents (contraintes de clé étrangère).
  --
  --    🔴 Hard delete et non soft delete, volontairement : les sync rules PowerSync filtrent
  --    `deleted_at is null`, donc un soft delete ferait disparaître les lignes de l'appareil —
  --    mais elles s'accumuleraient sur le cloud à chaque rejeu du script, et « remis à plat »
  --    cesserait d'être vrai.
  --
  --    ⚠️ Ne touche PAS : le compte, l'authentification, ni la bibliothèque partagée
  --    (`exercises` / `foods` avec `owner_id IS NULL`), qui est du contenu et non de la donnée
  --    personnelle. Les profils sont conservés puis pré-réglés au bloc 2.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  if v_has_lab then delete from public.lab_experiments where user_id = v_user; end if;

  -- Musculation
  delete from public.workout_superset_pairs    where user_id  = v_user;
  delete from public.workout_sets              where user_id  = v_user;
  delete from public.personal_records          where user_id  = v_user;
  delete from public.workouts                  where user_id  = v_user;
  delete from public.workout_template_exercises where user_id = v_user;
  delete from public.workout_templates         where user_id  = v_user;
  -- Course
  delete from public.run_intervals             where user_id  = v_user;
  delete from public.running_pace_records      where user_id  = v_user;
  delete from public.runs                      where user_id  = v_user;
  -- Planification
  delete from public.planned_sessions          where owner_id = v_user;
  -- Nutrition
  delete from public.meal_plan_entries         where user_id  = v_user;
  delete from public.shopping_list_items       where user_id  = v_user;
  delete from public.shopping_lists            where user_id  = v_user;
  delete from public.food_entries              where user_id  = v_user;
  delete from public.water_entries             where user_id  = v_user;
  delete from public.recipe_ingredients        where user_id  = v_user;
  delete from public.recipes                   where user_id  = v_user;
  delete from public.meal_template_items       where user_id  = v_user;
  delete from public.meal_templates            where user_id  = v_user;
  -- Corps & suivi
  delete from public.body_weight_entries       where user_id  = v_user;
  delete from public.body_measurements         where user_id  = v_user;
  delete from public.daily_steps               where user_id  = v_user;
  delete from public.daily_wellbeing           where user_id  = v_user;
  delete from public.pain_reports              where user_id  = v_user;
  delete from public.menstrual_daily_logs      where user_id  = v_user;
  delete from public.menstrual_periods         where user_id  = v_user;
  delete from public.activities                where user_id  = v_user;
  delete from public.personal_goals            where user_id  = v_user;
  delete from public.streak_jokers             where user_id  = v_user;
  delete from public.real_life_periods         where user_id  = v_user;
  -- Favoris et contenu PERSO (la bibliothèque `owner_id IS NULL` n'est jamais touchée)
  delete from public.food_favorites            where user_id  = v_user;
  delete from public.exercise_favorites        where user_id  = v_user;
  delete from public.exercise_notes            where user_id  = v_user;
  delete from public.exercise_plans            where owner_id = v_user;
  delete from public.session_intervals         where owner_id = v_user;
  delete from public.session_translations      where owner_id = v_user;
  delete from public.sessions                  where owner_id = v_user;
  delete from public.program_translations      where owner_id = v_user;
  delete from public.programs                  where owner_id = v_user;
  delete from public.exercise_variants         where owner_id = v_user;
  delete from public.food_translations         where owner_id = v_user;
  delete from public.foods                     where owner_id = v_user;
  delete from public.exercise_translations     where owner_id = v_user;
  delete from public.exercises                 where owner_id = v_user;

  raise notice 'Effacement terminé.';

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 2) PROFILS — conservés, puis pré-réglés pour que le contexte IA soit complet.
  --
  --    Le contexte envoyé au modèle porte l'âge, la taille, les piliers actifs et les cibles
  --    caloriques : sans profil renseigné, la moitié du bloc PROFIL manquerait et on testerait
  --    l'IA sur un contexte appauvri.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  update public.profiles
     set sex        = 'male',
         birth_date = (d0 - interval '34 years')::date,
         height_cm  = 178,
         weight_kg  = 78,
         start_weight_kg  = 82,
         target_weight_kg = 75,
         main_goal        = 'weightloss',
         training_level   = 'intermediate',
         weekly_availability = 4,
         deleted_at = null,
         updated_at = now()
   where user_id = v_user;

  update public.nutrition_profiles
     set objective        = 'weightloss',
         activity_level   = 'active',
         manual_calories  = 2400,
         manual_protein_g = 165,
         manual_carbs_g   = 240,
         manual_fat_g     = 75,
         deleted_at       = null,
         updated_at       = now()
   where user_id = v_user;
  if not found then
    insert into public.nutrition_profiles
      (id, user_id, objective, activity_level, manual_calories, manual_protein_g, manual_carbs_g, manual_fat_g)
    values
      (gen_random_uuid(), v_user, 'weightloss', 'active', 2400, 165, 240, 75);
  end if;

  update public.running_profiles
     set objective            = 'semi',
         level                = 'regulier',
         ref_5k_pace_s_per_km = 310,
         weekly_frequency     = 3,
         deleted_at           = null,
         updated_at           = now()
   where user_id = v_user;
  if not found then
    insert into public.running_profiles
      (id, user_id, objective, level, ref_5k_pace_s_per_km, weekly_frequency)
    values (gen_random_uuid(), v_user, 'semi', 'regulier', 310, 3);
  end if;

  -- Les 3 piliers actifs. 🔴 `ai_consent_at` est laissé à NULL **exprès** : le consentement fait
  -- partie de ce qu'on recette (la fonction Edge doit refuser sans lui). Le donner ici court-
  -- circuiterait le garde qu'on veut justement éprouver.
  update public.user_settings
     set active_pillars = '["strength","running","nutrition"]',
         deleted_at     = null,
         updated_at     = now()
   where user_id = v_user;
  if not found then
    insert into public.user_settings (id, user_id, active_pillars)
    values (gen_random_uuid(), v_user, '["strength","running","nutrition"]');
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 3) EXERCICES — résolus depuis la BIBLIOTHÈQUE, jamais codés en dur.
  --
  --    🔴 Les UUID « du seed » (`a1000001-…`) ne sont PAS fiables ici : `seed.sql` n'est joué que
  --    par `db:reset`, qui suppose Docker — que personne n'a. Le contenu du cloud vient du
  --    back-office, avec d'autres identifiants. On résout donc par NOM, avec un repli sur
  --    « n'importe quel exercice de ce groupe musculaire », et on échoue bruyamment si la
  --    bibliothèque est vide.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  create temp table if not exists _ia_ex (slot text primary key, exercise_id uuid) on commit drop;
  delete from _ia_ex;

  insert into _ia_ex (slot, exercise_id)
  select v.slot,
         coalesce(
           (select e.id
              from public.exercises e
              join public.exercise_translations t
                on t.exercise_id = e.id and t.deleted_at is null
             where e.owner_id is null and e.deleted_at is null
               and lower(t.name) = lower(v.wanted)
             limit 1),
           (select e.id
              from public.exercises e
             where e.owner_id is null and e.deleted_at is null
               and e.muscle_primary = v.muscle
             order by e.id
             limit 1)
         )
    from (values
      ('bench',    'Développé couché',  'chest'),
      ('incline',  'Développé incliné', 'chest'),
      ('row',      'Rowing barre',      'back'),
      ('pulldown', 'Tirage vertical',   'back'),
      ('squat',    'Squat',             'legs'),
      ('dead',     'Soulevé de terre',  'legs'),
      ('legpress', 'Presse à cuisses',  'legs')
    ) as v(slot, wanted, muscle);

  select exercise_id into ex_bench    from _ia_ex where slot = 'bench';
  select exercise_id into ex_incline  from _ia_ex where slot = 'incline';
  select exercise_id into ex_row      from _ia_ex where slot = 'row';
  select exercise_id into ex_pulldown from _ia_ex where slot = 'pulldown';
  select exercise_id into ex_squat    from _ia_ex where slot = 'squat';
  select exercise_id into ex_dead     from _ia_ex where slot = 'dead';
  select exercise_id into ex_legpress from _ia_ex where slot = 'legpress';

  if ex_bench is null or ex_squat is null or ex_row is null then
    raise exception
      'Bibliothèque d''exercices vide ou incomplète : impossible de résoudre pectoraux / jambes / dos. Importe la bibliothèque depuis le back-office avant de rejouer ce script.';
  end if;
  -- Repli : si un exercice secondaire manque, on retombe sur son voisin du même groupe plutôt que
  -- d'écrire un NULL (la colonne est `not null` et la séance entière échouerait).
  ex_incline  := coalesce(ex_incline,  ex_bench);
  ex_pulldown := coalesce(ex_pulldown, ex_row);
  ex_dead     := coalesce(ex_dead,     ex_squat);
  ex_legpress := coalesce(ex_legpress, ex_squat);

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 4) POIDS — S6 : perte régulière de 82 à 78 kg, puis PLATEAU sur les 30 derniers jours.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  j := 0;
  while j <= v_days loop
    insert into public.body_weight_entries (id, user_id, log_date, weight_kg)
    values (
      gen_random_uuid(), v_user, d0 - j,
      round((
        case
          when j <= 30 then 78.0 + (30 - j) * 0.008          -- plateau : 78,2 → 78,0
          else 78.2 + (j - 30) * 0.0425                       -- descente régulière jusqu'à ~82
        end
        + ((j * 17) % 7 - 3) * 0.08                           -- bruit de balance, ±0,25 kg
      )::numeric, 1)
    );
    j := j + 7;
  end loop;

  -- Un tour de taille toutes les 3 semaines : le poids stagne, mais la taille descend encore un peu.
  j := 0;
  while j <= v_days loop
    insert into public.body_measurements (id, user_id, kind, value_cm, log_date)
    values (gen_random_uuid(), v_user, 'waist', round((86 + j * 0.033)::numeric, 1), d0 - j);
    j := j + 21;
  end loop;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 5) MUSCULATION — 4 séances/semaine.
  --
  --    S1 : le développé couché plafonne à 82,5 kg après 10 semaines de progression (`least(wk,10)`),
  --         alors que le squat monte SANS PLAFOND sur toute la période.
  --    S4 : uniquement pectoraux / dos / jambes. Aucune série d'épaules, de bras, de gainage.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  for j in reverse v_days .. 0 loop
    d   := d0 - j;
    wk  := (v_days - j) / 7;                    -- 0 = début de période, ~17 = cette semaine
    dow := extract(dow from d)::int;

    continue when dow not in (1, 3, 5, 6);      -- lun / mer / ven / sam

    -- 🔴 S1 : `least(wk, 10)` est TOUT le signal. Au-delà de la 10ᵉ semaine, la charge ne bouge plus.
    v_bench    := 70 + 1.25 * least(wk, 10);
    v_incline  := 55 + 1.00 * least(wk, 10);
    v_squat    := 100 + 2.00 * wk;              -- aucun plafond : la progression continue
    v_dead     := 120 + 2.00 * wk;
    v_row      := 60 + 1.00 * wk;
    v_pulldown := 55 + 1.00 * wk;
    v_legpress := 140 + 3.00 * wk;

    w := gen_random_uuid();
    insert into public.workouts (id, user_id, status, started_at, finished_at, duration_seconds, rpe)
    values (
      w, v_user, 'completed',
      d::timestamp + time '18:15',
      d::timestamp + time '18:15' + make_interval(mins => 55 + (j % 4) * 5),
      (55 + (j % 4) * 5) * 60,
      -- Le ressenti monte sur les 3 dernières semaines (S3) : même charge, plus dur.
      case when j <= 21 then 8 + (j % 2) else 6 + (j % 3) end
    );
    o := 0;

    if dow in (1, 5) then
      -- ── Haut du corps : pectoraux + dos ─────────────────────────────────────────────────────
      insert into public.workout_sets
        (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done)
      select gen_random_uuid(), w, v_user, ex_bench, o + g, 'normal', 5, v_bench, true
        from generate_series(0, 3) g;
      o := o + 4;

      insert into public.workout_sets
        (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done)
      select gen_random_uuid(), w, v_user,
             case when dow = 1 then ex_row else ex_incline end,
             o + g, 'normal', 8, case when dow = 1 then v_row else v_incline end, true
        from generate_series(0, 2) g;
      o := o + 3;

      insert into public.workout_sets
        (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done)
      select gen_random_uuid(), w, v_user, ex_pulldown, o + g, 'normal', 10, v_pulldown, true
        from generate_series(0, 2) g;
    else
      -- ── Bas du corps ────────────────────────────────────────────────────────────────────────
      insert into public.workout_sets
        (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done)
      select gen_random_uuid(), w, v_user, ex_squat, o + g, 'normal', 5, v_squat, true
        from generate_series(0, 3) g;
      o := o + 4;

      insert into public.workout_sets
        (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done)
      select gen_random_uuid(), w, v_user, ex_dead, o + g, 'normal', 5, v_dead, true
        from generate_series(0, 2) g;
      o := o + 3;

      insert into public.workout_sets
        (id, workout_id, user_id, exercise_id, order_index, set_type, reps, weight_kg, done)
      select gen_random_uuid(), w, v_user, ex_legpress, o + g, 'normal', 12, v_legpress, true
        from generate_series(0, 2) g;
    end if;
  end loop;

  -- Records : le plafond du développé couché est daté, celui du squat est récent. L'écart entre les
  -- deux dates est lisible tel quel, et c'est un indice de plus pour S1.
  insert into public.personal_records (id, user_id, exercise_id, type, value, reps, weight_kg, achieved_at)
  values
    (gen_random_uuid(), v_user, ex_bench, 'max_weight',    82.5, 5, 82.5, (d0 - 49)::timestamp + time '19:00'),
    (gen_random_uuid(), v_user, ex_bench, 'estimated_1rm', 92.8, 5, 82.5, (d0 - 49)::timestamp + time '19:00'),
    (gen_random_uuid(), v_user, ex_squat, 'max_weight',    134,  5, 134,  (d0 - 2)::timestamp  + time '19:00'),
    (gen_random_uuid(), v_user, ex_squat, 'estimated_1rm', 150.8, 5, 134, (d0 - 2)::timestamp  + time '19:00');

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 6) COURSE — 3 sorties/semaine.
  --    S5 : l'allure progresse de 5:45/km à ~5:11/km, puis SE DÉGRADE de 18 s sur 3 semaines.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  for j in reverse v_days .. 0 loop
    d   := d0 - j;
    wk  := (v_days - j) / 7;
    dow := extract(dow from d)::int;

    continue when dow not in (0, 2, 4);         -- dim / mar / jeu

    -- 🔴 La dégradation porte sur 28 jours, et vaut 30 s — pas 18 sur 21 jours comme au premier
    -- jet. Le contexte compare deux fenêtres de 28 jours : une pénalité plus courte que la fenêtre
    -- se diluait avec les semaines de progression qu'elle contenait, et l'écart net tombait à +7 s
    -- (~2 %), que le rendu classe « stable ». Un signal qu'on ne peut pas lire n'est pas un signal.
    v_pace := 345 - 2 * wk + case when j <= 28 then 30 else 0 end;
    v_dist := case dow
                when 2 then 7000 + (j % 3) * 500      -- mardi : footing
                when 4 then 9000 + (j % 4) * 500      -- jeudi : allure soutenue
                else        13000 + (j % 5) * 800     -- dimanche : sortie longue
              end;

    r := gen_random_uuid();
    insert into public.runs
      (id, user_id, status, source, started_at, finished_at, distance_m, duration_seconds,
       avg_pace_s_per_km, elevation_gain_m, rpe, terrain)
    values (
      r, v_user, 'completed', 'gps',
      d::timestamp + time '07:30',
      d::timestamp + time '07:30' + make_interval(secs => (v_dist::numeric / 1000 * v_pace)::int),
      v_dist,
      (v_dist::numeric / 1000 * v_pace)::int,
      v_pace,
      case when dow = 0 then 120 + (j % 6) * 15 else 35 + (j % 4) * 10 end,
      case when j <= 21 then 7 + (j % 2) else 5 + (j % 3) end,
      'road'
    );
  end loop;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 7) NUTRITION — journal quotidien, 4 repas/jour.
  --    S2 : 2700 kcal / 165 g de protéines jusqu'à J-29, puis 2150 kcal / 115 g sur 28 jours —
  --         à volume d'entraînement INCHANGÉ. C'est la cause probable de S1, S3, S5 et S6.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  for j in reverse v_days .. 0 loop
    d := d0 - j;
    -- Deux jours sans journal par mois : un historique parfait est le seul qui n'existe jamais, et
    -- l'IA doit savoir dire « tu n'as pas tout journalisé » plutôt que de conclure sur du vide.
    continue when (j % 17) = 5;

    v_kcal   := case when j <= 28 then 2150 else 2700 end;
    v_prot   := case when j <= 28 then 115  else 165  end;
    v_jitter := 1 + ((j * 29) % 13 - 6) * 0.015;      -- ±9 %, déterministe

    insert into public.food_entries
      (id, user_id, log_date, meal_type, order_index, name, quantity_g, kcal, protein_g, carbs_g, fat_g)
    select
      gen_random_uuid(), v_user, d, m.meal, m.ord, m.label,
      round((m.share * 900)::numeric),
      round((v_kcal * m.share * v_jitter)::numeric),
      round((v_prot * m.share * v_jitter)::numeric),
      round((v_kcal * m.share * v_jitter * 0.42 / 4)::numeric),
      round((v_kcal * m.share * v_jitter * 0.28 / 9)::numeric)
    from (values
      ('breakfast', 0, 0.22, 'Flocons d''avoine, fromage blanc, fruits'),
      ('lunch',     1, 0.33, 'Riz, poulet, légumes verts'),
      ('dinner',    2, 0.33, 'Pâtes complètes, saumon, salade'),
      ('snack',     3, 0.12, 'Amandes et yaourt grec')
    ) as m(meal, ord, share, label);

    -- Hydratation : deux prises par jour sur les 60 derniers jours.
    if j <= 60 then
      insert into public.water_entries (id, user_id, log_date, volume_ml)
      values (gen_random_uuid(), v_user, d, 900 + (j % 4) * 100),
             (gen_random_uuid(), v_user, d, 800 + (j % 3) * 150);
    end if;
  end loop;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 8) BIEN-ÊTRE, PAS, AUTRES ACTIVITÉS
  --    S3 : énergie et humeur chutent, stress monte, sommeil passe de ~7 h 30 à ~6 h sur 21 jours.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  for j in reverse 75 .. 0 loop
    d := d0 - j;
    continue when (j % 11) = 3;                  -- quelques check-ins manqués

    -- 28 jours et non 21 : même raison que S5 — la fenêtre de comparaison du contexte fait 28 jours,
    -- et un signal plus court s'y mélange à la période saine qu'il chevauche.
    if j <= 28 then
      v_energy := 2 + (j % 2);                   -- 2-3
      v_mood   := 2 + ((j + 1) % 2);
      v_stress := 4 - (j % 2);                   -- 3-4
      v_sleep  := 345 + (j % 4) * 10;            -- ~5 h 45 – 6 h 15
    else
      v_energy := 4 - (j % 2);                   -- 3-4
      v_mood   := 4 - ((j + 1) % 2);
      v_stress := 2 + (j % 2);                   -- 2-3
      v_sleep  := 440 + (j % 5) * 8;             -- ~7 h 20 – 7 h 50
    end if;

    if v_has_sleep then
      -- Colonne présente : insertion dynamique, parce que ce bloc doit aussi compiler sur une base
      -- où elle n'existe pas encore (plpgsql résout les noms de colonne à l'exécution, pas le SQL
      -- statique imbriqué).
      execute
        'insert into public.daily_wellbeing (id, user_id, log_date, mood, energy, stress, sleep_minutes)
         values (gen_random_uuid(), $1, $2, $3, $4, $5, $6)'
        using v_user, d, v_mood, v_energy, v_stress, v_sleep;
    else
      insert into public.daily_wellbeing (id, user_id, log_date, mood, energy, stress)
      values (gen_random_uuid(), v_user, d, v_mood, v_energy, v_stress);
    end if;
  end loop;

  -- Pas quotidiens : la baisse des 3 dernières semaines accompagne S3 (moins d'énergie, moins bougé).
  for j in reverse 90 .. 0 loop
    d       := d0 - j;
    v_steps := case when j <= 28 then 6200 else 9600 end + ((j * 23) % 15 - 7) * 120;
    insert into public.daily_steps (id, user_id, log_date, steps, source)
    values (gen_random_uuid(), v_user, d, v_steps, 'manual');
  end loop;

  -- Vélo une semaine sur deux, natation une fois par mois : de quoi tester que l'IA tient compte
  -- d'une dépense hors des deux piliers sportifs.
  for j in reverse v_days .. 0 loop
    d := d0 - j;
    if (j % 14) = 3 then
      insert into public.activities
        (id, user_id, activity_type, started_at, duration_seconds, intensity, rpe, distance_m)
      values (gen_random_uuid(), v_user, 'cycling', d::timestamp + time '10:00',
              4800 + (j % 3) * 600, 'moderate', 5, 32000 + (j % 4) * 2000);
    elsif (j % 30) = 10 then
      insert into public.activities
        (id, user_id, activity_type, started_at, duration_seconds, intensity, rpe, distance_m)
      values (gen_random_uuid(), v_user, 'swimming', d::timestamp + time '12:30',
              2700, 'moderate', 6, 1500);
    end if;
  end loop;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 9) OBJECTIFS — deux échéances, dont une que S1 rend compromise.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  insert into public.personal_goals
    (id, user_id, kind, exercise_id, start_date, deadline, start_value, target_value)
  values
    (gen_random_uuid(), v_user, 'exercise_1rm', ex_bench, d0 - 90, d0 + 30, 78, 100),
    -- 🔴 `run_distance` s'exprime en MÈTRES (migration OBJ-01), pas en kilomètres : 21,1 aurait
    -- affiché un objectif de 21 mètres, atteint depuis toujours.
    (gen_random_uuid(), v_user, 'run_distance', null,     d0 - 60, d0 + 45, 13000, 21100);

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 10) COMPTE RENDU
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  select count(*) into n_work  from public.workouts             where user_id = v_user;
  select count(*) into n_sets  from public.workout_sets         where user_id = v_user;
  select count(*) into n_runs  from public.runs                 where user_id = v_user;
  select count(*) into n_food  from public.food_entries         where user_id = v_user;
  select count(*) into n_bw    from public.body_weight_entries  where user_id = v_user;
  select count(*) into n_act   from public.activities           where user_id = v_user;
  select count(*) into n_wb    from public.daily_wellbeing      where user_id = v_user;
  select count(*) into n_steps from public.daily_steps          where user_id = v_user;

  raise notice '─────────────────────────────────────────────────────────';
  raise notice 'Jeu de données FACTICES généré sur % jours :', v_days;
  raise notice '  séances muscu : %  (% séries)', n_work, n_sets;
  raise notice '  sorties course : %', n_runs;
  raise notice '  lignes de journal alimentaire : %', n_food;
  raise notice '  pesées : %  ·  activités : %', n_bw, n_act;
  raise notice '  check-ins bien-être : %  ·  jours de pas : %', n_wb, n_steps;
  raise notice '─────────────────────────────────────────────────────────';
  raise notice 'Signaux plantés à retrouver : S1 stagnation du développé couché · S2 chute';
  raise notice 'calorique sur 28 j · S3 fatigue sur 21 j · S4 angle mort épaules/bras/gainage ·';
  raise notice 'S5 allure dégradée · S6 plateau de poids.';
  raise notice 'Prochaine étape : activer Réglages → Labo IA (le consentement est volontairement';
  raise notice 'laissé désactivé, c''est un des points de recette).';
end $$;
