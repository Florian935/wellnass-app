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

import type { MuscleGroup } from '../exercise';
import { parseJsonColumn } from '../json-column';
import { isPillarArray, PILLARS, type Pillar } from '../pillar';
import type { PlannedExerciseDuration } from '../session-estimate';
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
  const active = parseJsonColumn<Pillar[]>(settings?.active_pillars ?? null, [...PILLARS], isPillarArray);
  return {
    steps: settings?.health_connect_enabled === true,
    nutrition: active.includes('nutrition'),
    wellbeingPillar: settings?.wellbeing_pillar_enabled === true,
  };
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
