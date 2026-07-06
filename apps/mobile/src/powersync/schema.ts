import { column, Schema, Table } from '@powersync/react-native';

/**
 * Schéma de la base **locale SQLite** gérée par PowerSync.
 *
 * Ce fichier déclare les 7 tables du socle US1 + pilier Musculation, en miroir exact
 * des tables Supabase (colonnes snake_case, types PowerSync : text / integer / real).
 * Référence : docs/specs/technical/schema-donnees-muscu.md §4
 *
 * Conventions :
 * - L'`id` (UUID, PK texte) est **implicite** dans PowerSync ; on ne le déclare pas.
 * - Les timestamps sont des chaînes ISO 8601 UTC → type `text`.
 * - Les booléens (`done`) sont stockés en `integer` (0 = false, 1 = true).
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

export const AppSchema = new Schema({
  profiles,
  user_settings,
  exercises,
  exercise_translations,
  exercise_favorites,
  workouts,
  workout_sets,
});
