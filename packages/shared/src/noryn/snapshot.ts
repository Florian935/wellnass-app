/**
 * US NORYN-01 — l'instantané : les lignes du propriétaire dont les synthèses ont besoin, telles que la
 * base les rend (colonnes `snake_case`), et ce qui se déduit d'elles sans formule : domaines suivis,
 * `synced_at`, séances avec leurs liens résolus.
 *
 * ⚠️ **Le contenu tel que le téléphone le voit.** Les règles de synchro PowerSync ne font pas descendre
 * toute la base : de la bibliothèque, seuls les programmes et exercices **publiés** ; de ses propres
 * lignes, seules les non supprimées — mais les exercices **archivés** de la bibliothèque descendent
 * (ADMIN-01, pour que l'historique garde leur nom). Les requêtes de l'app joignent ce qu'elle a en
 * local ; on reproduit donc ce « visible sur le téléphone » avant d'appliquer leurs propres filtres.
 */

import { activityIntensitySchema } from '../activity';
import type { EnergyActivity, EnergyRun, EnergyWorkout, WeightPoint } from '../day-energy';
import type { RealLifeSpan, TargetNutritionProfile, TargetProfile } from '../day-target';
import type { MuscleGroup } from '../exercise';
import { parseJsonColumn } from '../json-column';
import {
  activityLevelSchema,
  nutritionObjectiveSchema,
  sportFreeLevelSchema,
  trainingBonusModeSchema,
} from '../nutrition';
import { isPillarArray, PILLARS, type Pillar } from '../pillar';
import { goalSchema, sexSchema } from '../profile';
import type { PlannedExerciseDuration } from '../session-estimate';
import type { LoadSession } from '../training-time';
import type { LocalWellbeing } from '../wellbeing';
import type { NorynSessionInput } from './sessions';

export type SettingsRow = {
  user_id: string;
  active_pillars: unknown;
  health_connect_enabled: boolean | null;
  wellbeing_pillar_enabled: boolean | null;
};
export type ProfileRow = { user_id: string; daily_step_goal: number | null };
export type NutritionProfileRow = { user_id: string; water_target_ml: number | null };
export type RunningProfileRow = { user_id: string; ref_5k_pace_s_per_km: number | null };
export type StepsRow = { user_id: string; log_date: string; steps: number };
export type FoodRow = { user_id: string; log_date: string; kcal: number; protein_g: number };
export type WaterRow = { user_id: string; log_date: string; volume_ml: number };
export type WellbeingRow = {
  user_id: string;
  log_date: string;
  sleep_minutes: number | null;
  sleep_quality: number | null;
  energy: number | null;
  motivation: number | null;
  sick: boolean | null;
};
export type PlannedRow = {
  owner_id: string;
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  session_id: string;
  program_id: string;
};
export type SessionRow = {
  owner_id: string | null;
  id: string;
  session_type: string | null;
  order_index: number;
  target_duration_seconds: number | null;
  target_distance_m: number | null;
};
export type ProgramRow = { owner_id: string | null; id: string; pillar: string; status: string };
export type ExercisePlanRow = {
  owner_id: string | null;
  session_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  rest_seconds: number | null;
};
export type ExerciseRow = {
  owner_id: string | null;
  id: string;
  muscle_primary: string | null;
  status: string;
  deleted_at: string | null;
};
export type IntervalRow = {
  owner_id: string | null;
  session_id: string;
  order_index: number;
  reps: number;
  fast_distance_m: number | null;
  recovery_distance_m: number | null;
};
export type FinishedRow = { user_id: string; finished_at: string | null };

// ── US NORYN-02 — les lignes des cibles et du verdict ─────────────────────────────────────────────
// Noms locaux à ce module : `ProfileRow` et `NutritionProfileRow` du paquet (camelCase) n'y sont pas
// importés, d'où `Target…Row` pour les lignes Postgres (snake_case) qui servent à la cible.

export type TargetProfileRow = {
  user_id: string;
  birth_date: string | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  main_goal: string | null;
};
export type TargetNutritionRow = {
  user_id: string;
  objective: string | null;
  activity_level: string | null;
  manual_calories: number | null;
  manual_protein_g: number | null;
  manual_carbs_g: number | null;
  manual_fat_g: number | null;
  training_day_bonus: number | null;
  training_bonus_mode: string | null;
  sport_free_level: string | null;
};
export type PeriodRow = { user_id: string; started_on: string; ends_on: string };
export type WeightRow = { user_id: string; log_date: string; weight_kg: number };
export type ActivityRow = {
  user_id: string;
  id: string;
  activity_type: string;
  started_at: string;
  duration_seconds: number;
  intensity: string;
  rpe: number | null;
  distance_m: number | null;
  device_kcal: number | null;
};
export type TargetWorkoutRow = {
  user_id: string;
  id: string;
  started_at: string;
  finished_at: string;
  duration_seconds: number | null;
  rpe: number | null;
};
/** Une course **finie**, tout statut (comme `SELECT_RUNS`) ; le statut sépare les terminées. */
export type TargetRunRow = {
  user_id: string;
  id: string;
  status: string;
  finished_at: string;
  duration_seconds: number | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  rpe: number | null;
};
/** Une série **validée**, non supprimée : on n'en lit que la séance (jamais charge ni répétitions). */
export type WorkoutSetRow = { user_id: string; workout_id: string };
export type LoadRow = { user_id: string; finished_at: string | null; duration_seconds: number | null; rpe: number | null };
export type ActivityLoadRow = { user_id: string; started_at: string; duration_seconds: number; rpe: number | null };
export type FoodKcalRow = { user_id: string; log_date: string; kcal: number };
export type ReadinessWellbeingRow = {
  user_id: string;
  log_date: string;
  energy: number | null;
  stress: number | null;
  sleep_minutes: number | null;
  sleep_quality: number | null;
  sick: boolean | null;
};

/** Les entrées de la cible d'une date — lues seulement si le pilier Nutrition est actif (D9). */
export type TargetRows = {
  /** La date pour laquelle ces entrées ont été lues (périodes couvrant cette date, séances autour). */
  date: string;
  profile: TargetProfileRow | null;
  nutritionProfile: TargetNutritionRow | null;
  /** Périodes « vie réelle » couvrant la date. */
  periods: PeriodRow[];
  /** Mode `auto` seulement : la dernière pesée, sans borne de date. */
  latestWeight: WeightRow | null;
  /** Mode `activities` seulement : la plus récente au plus tard le jour dit, et la plus ancienne. */
  weightAtDate: WeightRow | null;
  oldestWeight: WeightRow | null;
  workouts: TargetWorkoutRow[];
  /** Mode `activities` seulement. */
  workoutSets: WorkoutSetRow[];
  runs: TargetRunRow[];
  activities: ActivityRow[];
};

/** Les entrées du verdict — lues seulement si la date demandée est aujourd'hui (D4, D9). */
export type ReadinessRows = {
  workouts: LoadRow[];
  runs: LoadRow[];
  activities: ActivityLoadRow[];
  /** Pilier Nutrition actif seulement. */
  food: FoodKcalRow[];
  wellbeing: ReadinessWellbeingRow[];
};

/** Tout ce que lit une synthèse, pour un propriétaire et une plage de dates. */
export type OwnerSnapshot = {
  owner: string;
  /** `sync_receipts.received_at`, ou `null` si le serveur n'a jamais rien reçu. */
  receivedAt: string | null;
  settings: SettingsRow | null;
  profile: ProfileRow | null;
  nutritionProfile: NutritionProfileRow | null;
  runningProfile: RunningProfileRow | null;
  steps: StepsRow[];
  food: FoodRow[];
  water: WaterRow[];
  wellbeing: WellbeingRow[];
  planned: PlannedRow[];
  sessions: SessionRow[];
  programs: ProgramRow[];
  exercisePlans: ExercisePlanRow[];
  exercises: ExerciseRow[];
  intervals: IntervalRow[];
  /** Séances de muscu terminées (`status = 'completed'`) — semaine seulement. */
  workouts: FinishedRow[];
  /** Courses terminées (`status = 'completed'`) — semaine seulement. */
  runs: FinishedRow[];
  /** US NORYN-02 — les entrées de la cible (journée, pilier Nutrition actif, synchronisé). */
  targets?: TargetRows | null;
  /** US NORYN-02 — les entrées du verdict (aujourd'hui, synchronisé). */
  readiness?: ReadinessRows | null;
};

const RECEIPT = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * `synced_at` : le reçu de synchro, **tronqué** à la milliseconde par le texte (Postgres en rend six
 * chiffres ; on ne dépend pas de ce qu'un moteur accepte de lire), puis **borné** à `now` — la
 * réponse ne peut pas dire qu'une synchro a eu lieu après elle. Tronquer va toujours vers le passé :
 * le sens prudent. Un reçu illisible lève : la base ne doit jamais en produire.
 */
export function syncedAtOf(receivedAt: string | null, now: Date): string | null {
  if (receivedAt === null) return null;
  const match = RECEIPT.exec(receivedAt);
  const ms = match === null ? Number.NaN : Date.parse(`${match[1]}${(match[2] ?? '').slice(0, 4)}${match[3]}`);
  if (Number.isNaN(ms)) throw new Error('noryn: reçu de synchro illisible');
  return new Date(Math.min(ms, now.getTime())).toISOString();
}

export type TrackedDomains = {
  /** Les pas viennent de Health Connect, et de lui seul (PAS-01). */
  steps: boolean;
  /** Nutrition **et** eau : le pilier Nutrition est actif. */
  nutrition: boolean;
  /** Le pilier Bien-être est allumé (pour « malade », D4). */
  wellbeingPillar: boolean;
};

/**
 * Les domaines suivis (D5), décodés **comme l'app** : piliers actifs par `parseJsonColumn` et
 * `isPillarArray` avec repli sur tous les piliers ; interrupteurs absents = éteints.
 */
export function trackedDomains(settings: SettingsRow | null): TrackedDomains {
  const active = activePillarsOf(settings);
  return {
    steps: settings?.health_connect_enabled === true,
    nutrition: active.includes('nutrition'),
    wellbeingPillar: settings?.wellbeing_pillar_enabled === true,
  };
}

/** Les piliers actifs, décodés comme l'app : `parseJsonColumn` + `isPillarArray`, repli sur tous. */
export function activePillarsOf(settings: SettingsRow | null): Pillar[] {
  return parseJsonColumn<Pillar[]>(settings?.active_pillars ?? null, [...PILLARS], isPillarArray);
}

/** L'allure de référence du coureur (5 km), pour estimer une course sans durée cible. */
export function refPaceOf(snapshot: OwnerSnapshot): number | null {
  return snapshot.runningProfile?.ref_5k_pace_s_per_km ?? null;
}

/** Une valeur entière dans des bornes, sinon `null` (DD6 : jamais rognée). */
export function boundedInt(value: number | null | undefined, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** Contenu de la bibliothèque, ou du propriétaire. */
function libraryOrOwn(rowOwner: string | null, owner: string): boolean {
  return rowOwner === null || rowOwner === owner;
}

/** Un programme est sur le téléphone : à soi, ou publié dans la bibliothèque. */
function programOnPhone(row: ProgramRow, owner: string): boolean {
  return row.owner_id === owner || (row.owner_id === null && row.status === 'published');
}

/** Un exercice est sur le téléphone : à soi et non archivé, ou publié dans la bibliothèque (archivé compris). */
function exerciseOnPhone(row: ExerciseRow, owner: string): boolean {
  return (row.owner_id === owner && row.deleted_at === null) || (row.owner_id === null && row.status === 'published');
}

/**
 * Les séances planifiées de ces dates, leurs liens résolus comme la vue semaine de l'app
 * (`SELECT_PLANNED_BETWEEN` : séance et programme présents). Pour une séance de muscu :
 * - `durationPlans` = les lignes de la carte du jour du hub (`SELECT_TODAY_PLAN` : exercice présent
 *   **et** non archivé), dans l'ordre des plans ;
 * - `setsByMuscle` = la somme de COLLIS-01 (`SELECT_PLANNED_MUSCLE_SETS` : exercice présent, archivé
 *   compris, muscle principal renseigné ; des séries non chiffrées ne comptent pas, comme `SUM`).
 */
export function sessionInputsFor(snapshot: OwnerSnapshot, dates: readonly string[]): NorynSessionInput[] {
  const { owner } = snapshot;
  const sessions = new Map(snapshot.sessions.filter((s) => libraryOrOwn(s.owner_id, owner)).map((s) => [s.id, s]));
  const programs = new Map(snapshot.programs.filter((p) => programOnPhone(p, owner)).map((p) => [p.id, p]));
  const exercises = new Map(snapshot.exercises.filter((e) => exerciseOnPhone(e, owner)).map((e) => [e.id, e]));
  const plans = snapshot.exercisePlans
    .filter((p) => libraryOrOwn(p.owner_id, owner))
    .sort((a, b) => a.order_index - b.order_index);
  const intervals = snapshot.intervals
    .filter((i) => libraryOrOwn(i.owner_id, owner))
    .sort((a, b) => a.order_index - b.order_index);

  const inputs: NorynSessionInput[] = [];
  for (const planned of snapshot.planned) {
    if (!dates.includes(planned.scheduled_date)) continue;
    const session = sessions.get(planned.session_id);
    const program = programs.get(planned.program_id);
    if (session === undefined || program === undefined) continue;

    const durationPlans: PlannedExerciseDuration[] = [];
    const setsByMuscle: Partial<Record<MuscleGroup, number | null>> = {};
    for (const plan of plans) {
      if (plan.session_id !== session.id) continue;
      const exercise = exercises.get(plan.exercise_id);
      if (exercise === undefined) continue;
      if (exercise.deleted_at === null) {
        durationPlans.push({ targetSets: plan.target_sets, restSeconds: plan.rest_seconds });
      }
      if (exercise.muscle_primary !== null) {
        const muscle = exercise.muscle_primary as MuscleGroup;
        const sum = setsByMuscle[muscle] ?? null;
        setsByMuscle[muscle] = plan.target_sets === null ? sum : (sum ?? 0) + plan.target_sets;
      }
    }

    inputs.push({
      id: planned.id,
      scheduledDate: planned.scheduled_date,
      scheduledTime: planned.scheduled_time,
      status: planned.status,
      pillar: program.pillar,
      sessionType: session.session_type,
      orderIndex: session.order_index,
      targetDurationSeconds: session.target_duration_seconds,
      targetDistanceM: session.target_distance_m,
      durationPlans,
      setsByMuscle,
      blocks: intervals
        .filter((i) => i.session_id === session.id)
        .map((i) => ({ reps: i.reps, fastDistanceM: i.fast_distance_m, recoveryDistanceM: i.recovery_distance_m })),
    });
  }
  return inputs;
}

// ---------------------------------------------------------------------------
// US NORYN-02 — des lignes Postgres aux entrées des compositions (spec D8, R4)
// ---------------------------------------------------------------------------
//
// Ce n'est que du **décodage de représentation** : renommer, garder les booléens natifs, valider les
// énumérations protégées par un `CHECK` avec les schémas zod du paquet. Les **replis** (mode `fixed`,
// forfait 0, niveau « modéré »…) ne sont pas appliqués ici : ils vivent dans les compositions, une
// seule fois pour l'app et pour la fonction. Une valeur hors domaine rend l'entrée **invalide** (DD4) :
// la cible sort à `null` plutôt qu'un `NaN` ou un repli inventé.

type EnumSchema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

/** Une énumération qui admet `null` : la valeur, `null`, ou `undefined` si elle est hors domaine. */
function nullableEnum<T>(schema: EnumSchema<T>, value: string | null): T | null | undefined {
  if (value === null) return null;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** Le profil de la cible, `null` sans ligne, `'invalid'` si une énumération est hors domaine. */
export function decodeTargetProfile(row: TargetProfileRow | null): TargetProfile | null | 'invalid' {
  if (row === null) return null;
  const sex = nullableEnum(sexSchema, row.sex);
  const mainGoal = nullableEnum(goalSchema, row.main_goal);
  if (sex === undefined || mainGoal === undefined) return 'invalid';
  return { sex, mainGoal, birthDate: row.birth_date, heightCm: row.height_cm, weightKg: row.weight_kg };
}

/** Le profil nutritionnel de la cible, `null` sans ligne, `'invalid'` si une énumération est hors domaine. */
export function decodeTargetNutrition(row: TargetNutritionRow | null): TargetNutritionProfile | null | 'invalid' {
  if (row === null) return null;
  const objective = nullableEnum(nutritionObjectiveSchema, row.objective);
  const activityLevel = nullableEnum(activityLevelSchema, row.activity_level);
  const trainingBonusMode = nullableEnum(trainingBonusModeSchema, row.training_bonus_mode);
  const sportFreeLevel = nullableEnum(sportFreeLevelSchema, row.sport_free_level);
  if (
    objective === undefined ||
    activityLevel === undefined ||
    trainingBonusMode === undefined ||
    sportFreeLevel === undefined
  ) {
    return 'invalid';
  }
  return {
    objective,
    activityLevel,
    trainingBonusMode,
    sportFreeLevel,
    manualCalories: row.manual_calories,
    manualProteinG: row.manual_protein_g,
    manualCarbsG: row.manual_carbs_g,
    manualFatG: row.manual_fat_g,
    trainingDayBonus: row.training_day_bonus,
  };
}

/** Le mode de la cible tel que les compositions le liront (`fixed` par défaut) — pour décider des lectures. */
export function bonusModeOf(row: { training_bonus_mode: string | null } | null): string {
  return row?.training_bonus_mode ?? 'fixed';
}

export function decodePeriods(rows: readonly PeriodRow[]): RealLifeSpan[] {
  return rows.map((r) => ({ startedOn: r.started_on, endsOn: r.ends_on }));
}

/** Les pesées utiles à `weightAtDate` pour la date lue : la plus récente au plus tard ce jour, la plus ancienne. */
export function decodeWeights(rows: ReadonlyArray<WeightRow | null>): WeightPoint[] {
  return rows.filter((r): r is WeightRow => r !== null).map((r) => ({ logDate: r.log_date, weightKg: r.weight_kg }));
}

/** Séances terminées, avec leurs séries **validées** (échauffements compris) comptées par séance. */
export function decodeEnergyWorkouts(rows: readonly TargetWorkoutRow[], sets: readonly WorkoutSetRow[]): EnergyWorkout[] {
  const counts = new Map<string, number>();
  for (const set of sets) counts.set(set.workout_id, (counts.get(set.workout_id) ?? 0) + 1);
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationSeconds: r.duration_seconds,
    rpe: r.rpe,
    totalSets: counts.get(r.id) ?? 0,
  }));
}

/** Toutes les courses finies (`SELECT_RUNS` : tout statut) — la dépense. */
export function decodeFinishedRuns(rows: readonly TargetRunRow[]): EnergyRun[] {
  return rows.map((r) => ({
    id: r.id,
    finishedAt: r.finished_at,
    distanceM: r.distance_m,
    durationSeconds: r.duration_seconds,
    elevationGainM: r.elevation_gain_m,
    rpe: r.rpe,
  }));
}

/** Les courses **terminées** (`SELECT_HISTORY` : `completed`) — jour d'entraînement, bonus `auto`. */
export function decodeCompletedRuns(rows: readonly TargetRunRow[]): EnergyRun[] {
  return decodeFinishedRuns(rows.filter((r) => r.status === 'completed'));
}

/** Les autres activités ; une intensité hors domaine rend la liste invalide (`activity_type`, lui, passe). */
export function decodeActivities(rows: readonly ActivityRow[]): EnergyActivity[] | 'invalid' {
  const out: EnergyActivity[] = [];
  for (const r of rows) {
    const intensity = activityIntensitySchema.safeParse(r.intensity);
    if (!intensity.success) return 'invalid';
    out.push({
      id: r.id,
      activityType: r.activity_type,
      startedAt: r.started_at,
      durationSeconds: r.duration_seconds,
      intensity: intensity.data,
      rpe: r.rpe,
      distanceM: r.distance_m,
      deviceKcal: r.device_kcal,
    });
  }
  return out;
}

/** Séance planifiée `planned` ou `done` ce jour-là, sans jointure (`SELECT_HAS_PLANNED`). */
export function hasPlannedOn(rows: readonly PlannedRow[], date: string): boolean {
  return rows.some((r) => r.scheduled_date === date && (r.status === 'planned' || r.status === 'done'));
}

export function decodeLoad(rows: readonly LoadRow[]): LoadSession[] {
  return rows.map((r) => ({ rpe: r.rpe, durationSeconds: r.duration_seconds, finishedAt: r.finished_at }));
}

export function decodeActivityLoad(
  rows: readonly ActivityLoadRow[],
): { rpe: number | null; durationSeconds: number; startedAt: string }[] {
  return rows.map((r) => ({ rpe: r.rpe, durationSeconds: r.duration_seconds, startedAt: r.started_at }));
}

/** Totaux de kcal par jour noté, arrondis **jour par jour** (`SELECT_DAILY_TOTALS` + `useDailyTotals`). */
export function decodeDailyKcal(rows: readonly FoodKcalRow[]): { logDate: string; kcal: number }[] {
  const sums = new Map<string, number>();
  for (const r of rows) sums.set(r.log_date, (sums.get(r.log_date) ?? 0) + r.kcal);
  return [...sums.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([logDate, kcal]) => ({ logDate, kcal: Math.round(kcal) }));
}

/** Les check-ins du verdict : énergie, stress, nuit, « malade » — rien d'autre de la ligne. */
export function decodeReadinessWellbeing(rows: readonly ReadinessWellbeingRow[]): LocalWellbeing[] {
  return rows.map((r) => ({
    logDate: r.log_date,
    energy: r.energy,
    stress: r.stress,
    sleepMinutes: r.sleep_minutes,
    sleepQuality: r.sleep_quality,
    sick: r.sick === true,
    deletedAt: null,
  }));
}
