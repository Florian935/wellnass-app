-- US RUN-F4 (lots A, G, I) — la séance de course porte enfin sa consigne.
-- Réf. : docs/product/analyse-seances-structurees-running.md (murs M1, M4, M9, M11)
--        docs/specs/functional/us/runf4-seances-structurees.md
--
-- Constat de l'analyse du 04/09/2026 : il n'existe nulle part une allure cible SAISIE par un
-- humain. Toutes les allures de l'app sont dérivées de l'unique `running_profiles.ref_5k_pace`
-- par `sessionTargetPace()` (5 bandes figées). Sur 24 séances d'un plan réel, 0 est
-- intégralement représentable. Cette migration rend l'allure, le chrono et la consigne
-- saisissables — **additive et rétrocompatible** : toutes les colonnes sont nullables, une
-- séance existante (cibles vides) garde exactement le comportement dérivé d'aujourd'hui.

alter table public.sessions
  -- Lot A — plage d'allure cible saisie. Deux bornes en secondes/km, jamais un scalaire :
  -- un plan réel écrit systématiquement des fourchettes (« 4:05–4:10/km »), et l'app en
  -- calculait déjà une (PaceRange) sans jamais pouvoir en stocker une.
  -- Convention : `min` = la borne RAPIDE (chiffre de secondes le plus petit),
  -- `max` = la borne LENTE. Même sens que `PaceRange.minSPerKm/maxSPerKm` côté TS.
  add column if not exists target_pace_min_s_per_km integer,
  add column if not exists target_pace_max_s_per_km integer,

  -- Lot A — RPE cible de la séance (le plan analysé en donne un pour chacune de ses 24
  -- séances : « 7–8 / 10 »). `runs.rpe` existe déjà pour le RESSENTI post-séance ; celui-ci
  -- est la CONSIGNE. Les deux coexistent et se comparent.
  add column if not exists target_rpe integer,

  -- Lot G — objectif chrono d'une séance de test ou de course (« 5 km en 20:00 »).
  -- Distinct de `target_duration_seconds`, qui est une DURÉE À COUVRIR (« cours 45 min ») :
  -- ici c'est un temps à NE PAS DÉPASSER sur `target_distance_m`.
  add column if not exists target_time_seconds integer,

  -- Lot G — plan de passage par kilomètre (séance de course). JSON et non des colonnes :
  -- le nombre de kilomètres varie par séance. Forme : [{"km":1,"paceMinSPerKm":242,
  -- "paceMaxSPerKm":242}, ...]. Validé côté applicatif (Zod), jamais par une contrainte —
  -- voir la note sur les CHECK plus bas.
  add column if not exists pacing_plan jsonb,

  -- Lot I — les trois textes que le plan analysé consacre à chaque séance, et qui font la
  -- différence entre « 5×1 000 m » et « 5×1 000 m — ne pas accélérer le premier ».
  add column if not exists description text,           -- l'objectif de la séance
  add column if not exists instructions text,          -- la consigne d'exécution
  add column if not exists adaptation_criterion text;  -- « réduire à 4 reps si la foulée se dégrade »

-- Lot G — ouverture des types de séance à `test` et `course`.
--
-- ⚠️ On DROP la contrainte au lieu de la réécrire, délibérément. C'est la leçon écrite au
-- registre pour `pain_reports.zone` (DOUL-01) et `food_entries.meal_type` : un CHECK sur un
-- enum **applicatif et évolutif** est un piège en offline-first — si un client plus récent
-- écrit une valeur que le serveur ne connaît pas encore, la violation **bloque toute la file
-- d'upload PowerSync**, pas seulement la ligne fautive. La liste fait foi côté TS
-- (`SESSION_TYPES` dans packages/shared/src/running-paces.ts) et est validée par Zod.
alter table public.sessions drop constraint if exists sessions_session_type_check;

comment on column public.sessions.target_pace_min_s_per_km is
  'Borne RAPIDE de la plage d''allure cible (s/km). NULL = allure dérivée de sessionTargetPace().';
comment on column public.sessions.target_time_seconds is
  'Objectif chrono (s) sur target_distance_m — séances test/course. Distinct de target_duration_seconds.';
