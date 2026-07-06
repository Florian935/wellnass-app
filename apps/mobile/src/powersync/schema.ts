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
  main_goal: column.text,
  onboarding_completed_at: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const user_settings = new Table({
  user_id: column.text,
  theme: column.text,
  units: column.text,
  language: column.text,
  active_pillars: column.text,
  notifications: column.text,
  dashboard_layout: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
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

const workouts = new Table({
  user_id: column.text,
  session_id: column.text,
  program_id: column.text,
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

export const AppSchema = new Schema({
  profiles,
  user_settings,
  nutrition_profiles,
  exercises,
  exercise_translations,
  exercise_favorites,
  workouts,
  workout_sets,
  programs,
  program_translations,
  sessions,
  exercise_plans,
  personal_records,
});
