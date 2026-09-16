/**
 * Repository des **autres activités** (US AUTRE-01) : table `activities`.
 *
 * Toute la règle vit dans `@wellness/shared` (`activity.ts` pour le catalogue, `energy.ts` pour la
 * dépense) : ici, uniquement des entrées/sorties SQL.
 *
 * 🔴 **La dépense n'est pas stockée** (décision D3) : aucune colonne `kcal` n'est écrite. Elle se
 * recalcule à la lecture, avec le **poids à la date** de l'activité — voir `energy-repository.ts`.
 * Seul `device_kcal`, un chiffre lu sur une montre, est conservé tel quel.
 *
 * ⚠️ L'écriture Health Connect est **déclenchée par l'appelant** (`pushActivity`), jamais ici : le
 * repository ne doit pas dépendre d'un module natif, et c'est ce qui permet de le tester.
 */

import { useMemo } from 'react';

import { useQuery } from '@powersync/react';
import {
  ACTIVITY_INTENSITY_RPE,
  activityHabits,
  localDayKey,
  type Activity,
  type ActivityHabit,
  type ActivityIntensity,
} from '@wellness/shared';

import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch, softDelete } from './_sql';

/** Ligne brute de `activities`. */
type ActivityDbRow = {
  id: string;
  activity_type: string;
  started_at: string;
  duration_seconds: number;
  intensity: string;
  rpe: number | null;
  distance_m: number | null;
  device_kcal: number | null;
  notes: string | null;
};

const SELECT_ACTIVITIES = `
  SELECT id, activity_type, started_at, duration_seconds, intensity, rpe, distance_m, device_kcal, notes
  FROM activities
  WHERE deleted_at IS NULL
  ORDER BY started_at DESC
`;

function toActivity(row: ActivityDbRow): Activity {
  return {
    id: row.id,
    activityType: row.activity_type,
    startedAt: row.started_at,
    durationSeconds: row.duration_seconds,
    // Une intensité inconnue ne peut venir que d'un client plus récent : on la lit telle quelle
    // plutôt que de jeter la ligne (le catalogue, lui, a son repli « Autre »).
    intensity: row.intensity as ActivityIntensity,
    rpe: row.rpe,
    distanceM: row.distance_m,
    deviceKcal: row.device_kcal,
    notes: row.notes,
  };
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** Toutes les activités, la plus récente d'abord. */
export function useActivities(): { activities: Activity[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<ActivityDbRow>(SELECT_ACTIVITIES);
  const activities = useMemo(() => data.map(toActivity), [data]);
  return { activities, isLoading };
}

/**
 * Les activités d'un jour donné.
 *
 * 🔴 Le filtrage se fait **en mémoire, sur la clé de jour locale**, jamais en SQL sur `started_at` :
 * la colonne est en UTC, et une sortie de 23 h 30 en France appartient à ce jour-là, pas au suivant.
 * Même règle que les courses (`localDayKey(finishedAt)`) — les mélanger ferait diverger la cible
 * calorique du jour selon le fuseau.
 */
export function useActivitiesOnDay(dayKey: string): { activities: Activity[]; isLoading: boolean } {
  const { activities, isLoading } = useActivities();
  return {
    activities: useMemo(
      () => activities.filter((a) => localDayKey(new Date(a.startedAt)) === dayKey),
      [activities, dayKey],
    ),
    isLoading,
  };
}

/** « Tes habituelles » : les combinaisons répétées, proposées en un geste à la saisie. */
export function useActivityHabits(limit = 3): { habits: ActivityHabit[]; isLoading: boolean } {
  const { activities, isLoading } = useActivities();
  return { habits: useMemo(() => activityHabits(activities, limit), [activities, limit]), isLoading };
}

/** Une activité par son id — pour l'écran d'édition. */
export function useActivity(id: string | null): { activity: Activity | null; isLoading: boolean } {
  const { activities, isLoading } = useActivities();
  return {
    activity: useMemo(() => (id ? (activities.find((a) => a.id === id) ?? null) : null), [activities, id]),
    isLoading,
  };
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’enregistrer une activité.');
  return userId;
}

export type ActivityInput = {
  activityType: string;
  startedAt: string;
  durationSeconds: number;
  intensity: ActivityIntensity;
  /** `null` = prérempli depuis l'intensité (voir ci-dessous). */
  rpe?: number | null;
  distanceM?: number | null;
  deviceKcal?: number | null;
  notes?: string | null;
};

/**
 * Enregistre une activité et rend son id.
 *
 * 🔴 **Le ressenti est prérempli quand il manque** (`ACTIVITY_INTENSITY_RPE`). Sans lui, la charge
 * sRPE de cette activité vaudrait **zéro** : trois heures de vélo ne pèseraient rien dans l'ACWR ni
 * dans le garde-fou de charge, et l'app dirait « repos » à quelqu'un qui vient de rouler 90 km.
 */
export async function addActivity(input: ActivityInput): Promise<string> {
  return insertWithSyncFields('activities', {
    user_id: currentUserId(),
    activity_type: input.activityType,
    started_at: input.startedAt,
    duration_seconds: Math.round(input.durationSeconds),
    intensity: input.intensity,
    rpe: input.rpe ?? ACTIVITY_INTENSITY_RPE[input.intensity],
    distance_m: input.distanceM != null ? Math.round(input.distanceM) : null,
    device_kcal: input.deviceKcal != null ? Math.round(input.deviceKcal) : null,
    notes: input.notes ?? null,
  });
}

/** Modifie une activité existante (champs fournis seulement). */
export async function updateActivity(id: string, input: Partial<ActivityInput>): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('activityType' in input) columns['activity_type'] = input.activityType;
  if ('startedAt' in input) columns['started_at'] = input.startedAt;
  if ('durationSeconds' in input && input.durationSeconds != null) {
    columns['duration_seconds'] = Math.round(input.durationSeconds);
  }
  if ('intensity' in input && input.intensity != null) {
    columns['intensity'] = input.intensity;
    // Le ressenti suit l'intensité **sauf** s'il est explicitement fourni : sinon changer
    // « soutenu » en « intense » laisserait une charge incohérente avec ce qui est affiché.
    if (!('rpe' in input)) columns['rpe'] = ACTIVITY_INTENSITY_RPE[input.intensity];
  }
  if ('rpe' in input) columns['rpe'] = input.rpe;
  if ('distanceM' in input) columns['distance_m'] = input.distanceM != null ? Math.round(input.distanceM) : null;
  if ('deviceKcal' in input) columns['device_kcal'] = input.deviceKcal != null ? Math.round(input.deviceKcal) : null;
  if ('notes' in input) columns['notes'] = input.notes;

  if (Object.keys(columns).length === 0) return;
  await patch('activities', id, columns);
}

/** Retire une activité (soft delete, comme partout dans ce schéma). */
export async function deleteActivity(id: string): Promise<void> {
  await softDelete('activities', id);
}
