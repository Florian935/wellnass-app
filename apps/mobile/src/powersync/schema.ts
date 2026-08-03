import { column, Schema, Table } from '@powersync/react-native';

/**
 * Schéma de la base **locale SQLite** gérée par PowerSync.
 *
 * Ce fichier déclare les 7 tables du socle US1 + pilier Musculation, en miroir exact
 * des tables Supabase (colonnes snake_case, types PowerSync : text / integer / real).
 * Référence : docs/specs/technical/schema-donnees-muscu.md §4
 *
 * US2 : 4 tables programmes ajoutées — programs, program_translations, sessions,
 * exercise_plans. Migration : supabase/migrations/20260706130000_programmes_tables.sql
 *
 * US3 : table personal_records ajoutée.
 * Migration : supabase/migrations/20260706140002_personal_records.sql
 *
 * Running R1 : table runs ajoutée (tracker GPS nu, course libre).
 * Migration : supabase/migrations/20260707120000_running_runs.sql
 *
 * Conventions :
 * - L'`id` (UUID, PK texte) est **implicite** dans PowerSync ; on ne le déclare pas.
 * - Les timestamps sont des chaînes ISO 8601 UTC → type `text`.
 * - Les booléens (`is_active`, `done`) sont stockés en `integer` (0 = false, 1 = true).
 * - Le mapping camelCase se fait dans la couche Zod partagée, pas ici.
 */

const profiles = new Table({
  user_id: column.text,
  first_name: column.text,
  birth_date: column.text,
  sex: column.text,
  height_cm: column.real,
  weight_kg: column.real,
  target_weight_kg: column.real,
  start_weight_kg: column.real,
  main_goal: column.text,
  workout_display_level: column.text,
  // US PAS-01 — objectif de pas quotidien (1000-50000). Migration :
  // 20260728132424_pas01_daily_steps.sql. ⚠️ Ajoutée après coup : la colonne existait déjà côté
  // Supabase et dans `profile-repository.ts` sans être déclarée ici, donc toute lecture/écriture
  // locale de `daily_step_goal` échouait silencieusement (même anti-pattern que
  // `cycle_tracking_enabled` ci-dessous — constaté en recette le 03/08/2026).
  daily_step_goal: column.integer,
  onboarding_completed_at: column.text,
  // US ACTIV-01 (1.27) : fermeture explicite du widget « Parcours 7 jours pour démarrer ».
  activation_path_dismissed_at: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const user_settings = new Table({
  user_id: column.text,
  theme: column.text,
  units: column.text,
  // US UX-05 — échelle d'intensité AFFICHÉE ('rpe' | 'rir'). La donnée reste `workout_sets.rpe` :
  // le RIR est calculé à l'affichage, jamais stocké.
  intensity_scale: column.text,
  language: column.text,
  active_pillars: column.text,
  notifications: column.text,
  dashboard_layout: column.text,
  analytics_enabled: column.integer, // 0/1 — consentement analytics (US 9.10)
  health_connect_enabled: column.integer, // 0/1 — opt-in Health Connect (US CONF-06)
  // US CYCLE-01 — opt-in strict du suivi de cycle, et sa synchro Health Connect. ⚠️ Toute colonne
  // absente d'ici n'existe pas dans la base locale : l'écriture échoue, et `void updateSettings()`
  // avale l'erreur — l'interrupteur reste éteint sans le moindre message (constaté en recette
  // device du 31/07/2026).
  cycle_tracking_enabled: column.integer, // 0/1
  cycle_health_connect_enabled: column.integer, // 0/1
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US 9.10 : analytics produit (append-only, first-party) ─────────────────
// Migration : supabase/migrations/20260724112210_analytics_events.sql
const analytics_events = new Table({
  user_id: column.text,
  event_name: column.text,
  properties: column.text, // JSON sérialisé
  app_version: column.text,
  platform: column.text,
  occurred_at: column.text,
  created_at: column.text,
});

// ── V0.4 : profil nutritionnel (une ligne par compte) ──────────────────────
// Migration : supabase/migrations/20260706140000_nutrition_tables.sql
const nutrition_profiles = new Table({
  user_id: column.text,
  objective: column.text,
  activity_level: column.text,
  manual_calories: column.integer,
  manual_protein_g: column.integer,
  manual_carbs_g: column.integer,
  manual_fat_g: column.integer,
  restrictions: column.text, // JSON sérialisé
  allergens: column.text, // JSON sérialisé
  training_day_bonus: column.integer,
  training_bonus_mode: column.text,
  adherence_margin_pct: column.integer, // % de marge d'adhérence (NUTR-10)
  meals: column.text, // JSON [{key,label}] — repas personnalisés (4.15)
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── V0.4 : base d'aliments + journal ───────────────────────────────────────
// Migration : supabase/migrations/20260706150000_food_tables.sql
const foods = new Table({
  owner_id: column.text, // null = bibliothèque (app/CIQUAL), non-null = perso/OFF
  source: column.text,
  category: column.text,
  barcode: column.text,
  kcal_per_100g: column.real,
  protein_per_100g: column.real,
  carbs_per_100g: column.real,
  sugars_per_100g: column.real,
  fat_per_100g: column.real,
  saturated_fat_per_100g: column.real,
  fiber_per_100g: column.real,
  portions: column.text, // JSON [{labelFr,labelEn,grams}]
  micronutrients: column.text, // JSON socle 4.33 (pour 100 g)
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const food_translations = new Table({
  food_id: column.text,
  owner_id: column.text,
  lang: column.text,
  name: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const food_favorites = new Table({
  user_id: column.text,
  food_id: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const food_entries = new Table({
  user_id: column.text,
  log_date: column.text,
  meal_type: column.text,
  order_index: column.integer,
  food_id: column.text,
  name: column.text,
  quantity_g: column.real,
  kcal: column.integer,
  protein_g: column.real,
  carbs_g: column.real,
  fat_g: column.real,
  micronutrients: column.text, // JSON socle 4.33 (snapshot figé pour la quantité)
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const exercises = new Table({
  owner_id: column.text,
  source: column.text,
  muscle_primary: column.text,
  equipment: column.text,
  media_url: column.text,
  muscles_secondary: column.text, // JSON [MuscleGroup] — MUSC-F10c-1 (éditorial)
  muscles_fine: column.text, // JSON [FineMuscle] — MUSC-F1b, additif et indépendant de muscles_secondary
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const exercise_translations = new Table({
  exercise_id: column.text,
  owner_id: column.text,
  lang: column.text,
  name: column.text,
  instructions: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const exercise_favorites = new Table({
  user_id: column.text,
  exercise_id: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US Refonte-C3 : note persistante par (utilisateur, exercice) ──────────
// Migration : supabase/migrations/20260720121317_refonte_muscu_c3_note_exercice.sql
const exercise_notes = new Table({
  user_id: column.text,
  exercise_id: column.text,
  note: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── MUSC-F10c-2 : variantes / alternatives (liaison symétrique) ───────────
// Migration : supabase/migrations/20260722151024_muscf10c2_exercise_variants.sql
const exercise_variants = new Table({
  owner_id: column.text,
  exercise_id_a: column.text,
  exercise_id_b: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US Refonte-C3 (révision recette) : liaison superset explicite ─────────
// Migration : supabase/migrations/20260720200254_refonte_muscu_c3_superset_pairs.sql
const workout_superset_pairs = new Table({
  user_id: column.text,
  workout_id: column.text,
  exercise_id_a: column.text,
  exercise_id_b: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const workouts = new Table({
  user_id: column.text,
  session_id: column.text,
  program_id: column.text,
  planned_session_id: column.text, // US Refonte-A : occurrence planifiée réalisée (nullable)
  status: column.text,
  started_at: column.text,
  finished_at: column.text,
  duration_seconds: column.integer,
  rpe: column.integer,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const workout_sets = new Table({
  workout_id: column.text,
  user_id: column.text,
  exercise_id: column.text,
  order_index: column.integer,
  set_type: column.text,
  reps: column.integer,
  weight_kg: column.real,
  duration_seconds: column.integer,
  done: column.integer,
  // US Refonte-C2 : RPE par série (1-10) + charge planifiée figée au démarrage.
  rpe: column.integer,
  planned_weight_kg: column.real,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US2 : tables programmes ───────────────────────────────────────────────

const programs = new Table({
  owner_id: column.text,
  pillar: column.text,
  status: column.text,
  is_active: column.integer,
  level: column.text,
  goal: column.text,
  duration_weeks: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const program_translations = new Table({
  program_id: column.text,
  owner_id: column.text,
  lang: column.text,
  name: column.text,
  summary: column.text,
  description: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const sessions = new Table({
  program_id: column.text,
  owner_id: column.text,
  order_index: column.integer,
  name: column.text,
  // Running R3b-i : contenu de séance de course (additif, rétrocompatible muscu)
  session_type: column.text,
  target_distance_m: column.integer,
  target_duration_seconds: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const exercise_plans = new Table({
  session_id: column.text,
  owner_id: column.text,
  exercise_id: column.text,
  order_index: column.integer,
  set_type: column.text,
  target_sets: column.integer,
  target_reps: column.text,
  target_weight_kg: column.real,
  rest_seconds: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US RUN-F2c : blocs fractionné/intervalles (une ligne = un bloc de répétitions) ──────────

const session_intervals = new Table({
  session_id: column.text,
  owner_id: column.text,
  order_index: column.integer,
  reps: column.integer,
  fast_distance_m: column.integer,
  fast_duration_seconds: column.integer,
  fast_pace_pct_vma: column.integer,
  recovery_distance_m: column.integer,
  recovery_duration_seconds: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US3 : records personnels ───────────────────────────────────────────────

const personal_records = new Table({
  user_id: column.text,
  exercise_id: column.text,
  type: column.text,
  value: column.real,
  reps: column.integer,
  weight_kg: column.real,
  workout_id: column.text,
  achieved_at: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── Running R3a : profil coureur ──────────────────────────────────────────
// Migration : supabase/migrations/20260712090000_running_profiles.sql

const running_profiles = new Table({
  user_id: column.text,
  objective: column.text,
  level: column.text,
  ref_5k_pace_s_per_km: column.real,
  weekly_frequency: column.integer,
  // US RUN-F2a (5.19) : premier réglage de comportement de course exposé à l'utilisateur,
  // désactivé par défaut (une annonce vocale peut interrompre une musique en cours).
  voice_announcements_enabled: column.integer, // 0/1
  voice_announcement_interval_m: column.integer,
  // US RUN-F2d (5.18) : guidage vocal + vibration à chaque changement de phase fractionné,
  // réglage indépendant de voice_announcements_enabled (usages différents), désactivé par défaut.
  interval_guidance_enabled: column.integer, // 0/1
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── Running R1 : course libre ─────────────────────────────────────────────

const runs = new Table({
  user_id: column.text,
  status: column.text,
  source: column.text,
  started_at: column.text,
  finished_at: column.text,
  duration_seconds: column.integer,
  distance_m: column.real,
  avg_pace_s_per_km: column.real,
  gps_track: column.text,
  rpe: column.integer,
  notes: column.text,
  // US RUN-F3 (5.25) : lien vers la séance planifiée réalisée + terrain (D3). Toute colonne
  // absente d'ici échoue silencieusement à l'écriture (leçon du 01/08/2026, CYCLE-01).
  planned_session_id: column.text,
  terrain: column.text,
  // US RUN-F1b (5.32) : scalaires cumulés en direct par le tracker, comme distance_m/
  // duration_seconds — jamais recalculés depuis gps_track. `null` = donnée absente (course
  // manuelle, ou course enregistrée avant cette US), jamais 0 (spec R5/§0).
  elevation_gain_m: column.real,
  elevation_loss_m: column.real,
  // US RUN-F2d (5.18) : progression du guidage fractionné, persistée pour reconstruire la phase
  // courante et son point de départ au remontage de l'écran (rattrapage silencieux, spec R8/R8 bis)
  // — `null` = guidage non démarré ou non applicable à cette course.
  interval_phase_index: column.integer,
  interval_phase_start_distance_m: column.integer,
  interval_phase_start_duration_s: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── Running R3c-i : planification datée (table générique pilier-agnostique) ──
// Migration : supabase/migrations/20260712110000_planned_sessions.sql

const planned_sessions = new Table({
  owner_id: column.text,
  program_id: column.text,
  session_id: column.text,
  scheduled_date: column.text, // AAAA-MM-JJ
  status: column.text,
  week_index: column.integer,
  completed_at: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── Running R4b : records d'allure personnels (1 ligne par utilisateur × distance) ──
// Migration : supabase/migrations/20260712120000_running_pace_records.sql

const running_pace_records = new Table({
  user_id: column.text,
  distance_key: column.text,
  best_time_seconds: column.integer,
  run_id: column.text,
  achieved_at: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── V0.4 : recettes, repas types, poids corporel ──────────────────────────
// Migration : supabase/migrations/20260707130000_recipes_bodyweight.sql
const recipes = new Table({
  user_id: column.text,
  name: column.text,
  servings: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const recipe_ingredients = new Table({
  recipe_id: column.text,
  user_id: column.text,
  food_id: column.text,
  name: column.text,
  quantity_g: column.real,
  kcal: column.integer,
  protein_g: column.real,
  carbs_g: column.real,
  fat_g: column.real,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const meal_templates = new Table({
  user_id: column.text,
  name: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const meal_template_items = new Table({
  template_id: column.text,
  user_id: column.text,
  food_id: column.text,
  name: column.text,
  quantity_g: column.real,
  kcal: column.integer,
  protein_g: column.real,
  carbs_g: column.real,
  fat_g: column.real,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const body_weight_entries = new Table({
  user_id: column.text,
  log_date: column.text,
  weight_kg: column.real,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US PAS-01 : pas quotidiens lus dans Health Connect ─────────────────────
// Migrations : supabase/migrations/20260728132424_pas01_daily_steps.sql
//              + 20260728132601_pas01_daily_steps_publication.sql
const daily_steps = new Table({
  user_id: column.text,
  log_date: column.text,
  steps: column.integer,
  source: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US BIEN-01 : check-in quotidien de bien-être ───────────────────────────
// Migrations : supabase/migrations/20260728185757_bien01_daily_wellbeing.sql
//              + 20260728185759_bien01_daily_wellbeing_publication.sql
// Les 3 indicateurs sont nullables : la saisie partielle est acceptée (décision D3). Le poids
// n'est PAS ici — il reste dans `body_weight_entries`.
const daily_wellbeing = new Table({
  user_id: column.text,
  log_date: column.text,
  mood: column.integer,
  energy: column.integer,
  stress: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US CYCLE-01 : suivi du cycle menstruel ────────────────────────────────
// Migrations : supabase/migrations/20260730230615_cycle01_menstrual_tracking.sql
//              + 20260730230617_cycle01_menstrual_tracking_publication.sql
//
// Deux tables **indépendantes** (aucune FK entre elles) : un jour de flux peut exister sans période
// déclarée, et une période peut n'avoir aucun log quotidien. Le découpage calque Health Connect
// (`MenstruationPeriod` = un intervalle · `MenstruationFlow` = un enregistrement par jour).
//
// ⚠️ Donnée de santé **sensible**, écrite uniquement si `user_settings.cycle_tracking_enabled`.
// `ended_on` à `null` = période **en cours** — un état normal, pas une donnée manquante.
const menstrual_periods = new Table({
  user_id: column.text,
  started_on: column.text,
  ended_on: column.text,
  source: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// `symptoms` est un tableau JSON **sérialisé en texte** côté SQLite (PowerSync n'a pas de type
// jsonb) : toujours passer par `JSON.parse` / `JSON.stringify` au franchissement du repository.
// Vocabulaire fermé (8 valeurs), validé par le schéma Zod partagé — jamais de champ libre.
const menstrual_daily_logs = new Table({
  user_id: column.text,
  log_date: column.text,
  flow: column.text,
  symptoms: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US STREAK-01 : jokers de série ────────────────────────────────────────
// Migrations : supabase/migrations/20260729095446_streak01_jokers.sql
//              + 20260729095705_streak01_jokers_publication.sql
// `log_date` = le jour manqué que le joker couvre. Un joker protège la SÉRIE et rien d'autre :
// aucune activité n'est écrite ailleurs (décision D3).
const streak_jokers = new Table({
  user_id: column.text,
  log_date: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US MESUR-01 : mensurations corporelles ─────────────────────────────────
// Migrations : supabase/migrations/20260729091950_mesur01_body_measurements.sql
//              + 20260729091953_mesur01_body_measurements_publication.sql
// Modèle **normalisé** (décision D1) : une ligne par (jour, type de mesure). `value_cm` est en
// `real` côté local — la colonne Postgres est `numeric(5,1)`, non représentable en integer.
// Le poids n'est PAS ici : il reste dans `body_weight_entries`.
const body_measurements = new Table({
  user_id: column.text,
  log_date: column.text,
  kind: column.text,
  value_cm: column.real,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US OBJ-01 : objectifs personnels à échéance ────────────────────────────
// Migrations : supabase/migrations/20260729131013_obj01_personal_goals.sql
//              + 20260729131107_obj01_personal_goals_publication.sql
// **Ni `status` ni `progress`** (décision D5) : les deux sont dérivés de la fenêtre
// `[start_date, deadline]` par `computeGoalProgress` (@wellness/shared). Conséquence directe : tout
// le calcul est local, donc l'écran fonctionne hors ligne sans rien devoir écrire.
// `target_value` / `start_value` en `real` : les colonnes Postgres sont `numeric(10,2)`.
const personal_goals = new Table({
  user_id: column.text,
  kind: column.text,
  target_value: column.real,
  start_value: column.real,
  exercise_id: column.text,
  start_date: column.text,
  deadline: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// ── US Refonte-D : templates de séance libre ──────────────────────────────
// Migration : supabase/migrations/20260721074949_refonte_muscu_d_workout_templates.sql

const workout_templates = new Table({
  user_id: column.text,
  name: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const workout_template_exercises = new Table({
  template_id: column.text,
  user_id: column.text,
  exercise_id: column.text,
  order_index: column.integer,
  set_type: column.text,
  target_sets: column.integer,
  target_reps: column.text,
  target_weight_kg: column.real,
  rest_seconds: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

export const AppSchema = new Schema({
  profiles,
  user_settings,
  analytics_events,
  nutrition_profiles,
  foods,
  food_translations,
  food_favorites,
  food_entries,
  recipes,
  recipe_ingredients,
  meal_templates,
  meal_template_items,
  body_weight_entries,
  daily_steps,
  daily_wellbeing,
  menstrual_periods,
  menstrual_daily_logs,
  body_measurements,
  streak_jokers,
  personal_goals,
  exercises,
  exercise_translations,
  exercise_favorites,
  exercise_notes,
  exercise_variants,
  workout_superset_pairs,
  workouts,
  workout_sets,
  programs,
  program_translations,
  sessions,
  exercise_plans,
  session_intervals,
  personal_records,
  running_profiles,
  runs,
  planned_sessions,
  running_pace_records,
  workout_templates,
  workout_template_exercises,
});
