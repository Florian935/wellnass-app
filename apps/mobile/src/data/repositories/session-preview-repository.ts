/**
 * L'aperçu de la séance du jour — US MUSCU-UX07, §4.5.
 *
 * Il liste **exactement ce que Démarrer créera** : la même source que `startWorkoutFromSession`,
 * c'est-à-dire tous les `exercise_plans` non supprimés de la séance, dans l'ordre du plan.
 *
 * ⚠️ Pas de jointure sur `exercises` avec `deleted_at IS NULL`, contrairement à `SELECT_TODAY_PLAN`
 * et au brief immersif : un exercice archivé du catalogue depuis la création du programme reste dans
 * le plan, et donc dans la séance créée. L'aperçu qui l'omettrait mentirait. Son nom se lit malgré
 * l'archivage (`exerciseNameSql` garde les traductions archivées lisibles).
 */

import { useQuery } from '@powersync/react';
import { resolveSessionTarget, type SessionTarget } from '@wellness/shared';
import { getAppLanguage } from '@/i18n';
import { exerciseNameSql } from './_sql';

/** Paramètres : `[lang, sessionId]`. Exportée pour le test SQL. */
export const SELECT_SESSION_PREVIEW = `
  SELECT ep.exercise_id,
         ${exerciseNameSql('ep.exercise_id')} AS exercise_name,
         (SELECT e.equipment FROM exercises e WHERE e.id = ep.exercise_id) AS equipment,
         ep.target_sets, ep.target_reps, ep.target_weight_kg, ep.rest_seconds
  FROM exercise_plans ep
  WHERE ep.session_id = ? AND ep.deleted_at IS NULL
  ORDER BY ep.order_index
`;

type PreviewRow = {
  exercise_id: string;
  exercise_name: string | null;
  equipment: string | null;
  target_sets: number | null;
  target_reps: string | null;
  target_weight_kg: number | null;
  rest_seconds: number | null;
};

export type SessionPreviewExercise = {
  exerciseId: string;
  name: string | null;
  /** `barbell` → une charge suggérée est arrondie au chargeable (R11). */
  equipment: string | null;
  target: SessionTarget;
  /** Pour l'estimation de durée (`estimateSessionMinutes`). */
  targetSets: number | null;
  restSeconds: number | null;
};

/** Le nom de la séance de programme (en-tête de l'aperçu). Paramètre : `[sessionId]`. */
export const SELECT_SESSION_TITLE = `
  SELECT s.name FROM sessions s WHERE s.id = ? AND s.deleted_at IS NULL
`;

export function useSessionName(sessionId: string): string | null {
  const { data } = useQuery<{ name: string | null }>(SELECT_SESSION_TITLE, [sessionId]);
  return data[0]?.name ?? null;
}

export function useSessionPreview(sessionId: string): {
  exercises: SessionPreviewExercise[];
  isLoading: boolean;
} {
  const lang = getAppLanguage() === 'en' ? 'en' : 'fr';
  const { data, isLoading } = useQuery<PreviewRow>(SELECT_SESSION_PREVIEW, [lang, sessionId]);
  return {
    exercises: data.map((row) => ({
      exerciseId: row.exercise_id,
      name: row.exercise_name,
      equipment: row.equipment,
      target: resolveSessionTarget({
        targetSets: row.target_sets,
        targetReps: row.target_reps,
        targetWeightKg: row.target_weight_kg,
      }),
      targetSets: row.target_sets,
      restSeconds: row.rest_seconds,
    })),
    isLoading,
  };
}
