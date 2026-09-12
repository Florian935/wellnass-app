/** Lecture locale des exercices affiches dans l'explorateur anatomique CORPS-01. */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@powersync/react';
import {
  findBodyExercises,
  muscleGroupSchema,
  normalizeFineMuscles,
  normalizeSecondaryMuscles,
  parseJsonColumn,
  type BodyExercise,
  type BodyExerciseMatch,
  type FineMuscle,
} from '@wellness/shared';

type BodyExerciseDbRow = {
  id: string;
  muscle_primary: string;
  muscles_secondary: string | null;
  muscles_fine: string | null;
  equipment: string | null;
  name: string | null;
  is_favorite: number;
};

/**
 * Catalogue local affichable : traduction courante puis francaise, favoris locaux et soft deletes.
 * Le bucket PowerSync utilisateur ne contient que les favoris du compte connecte.
 */
export const SELECT_BODY_EXERCISES = `
  SELECT e.id, e.muscle_primary, e.muscles_secondary, e.muscles_fine, e.equipment,
         COALESCE(tl.name, tfr.name) AS name,
         EXISTS (
           SELECT 1
           FROM exercise_favorites f
           WHERE f.exercise_id = e.id AND f.deleted_at IS NULL
         ) AS is_favorite
  FROM exercises e
  LEFT JOIN exercise_translations tl
    ON tl.exercise_id = e.id AND tl.lang = ? AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr
    ON tfr.exercise_id = e.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE e.deleted_at IS NULL
  ORDER BY e.id
`;

function rowToBodyExercise(row: BodyExerciseDbRow): BodyExercise | null {
  const muscle = muscleGroupSchema.safeParse(row.muscle_primary);
  if (!muscle.success || row.name === null) return null;

  return {
    id: row.id,
    name: row.name,
    muscle: muscle.data,
    musclesSecondary: normalizeSecondaryMuscles(
      parseJsonColumn<unknown>(row.muscles_secondary, []),
      muscle.data,
    ),
    musclesFine: normalizeFineMuscles(parseJsonColumn<unknown>(row.muscles_fine, [])),
    equipment: row.equipment,
    isFavorite: row.is_favorite === 1,
  };
}

export function useBodyExercises(
  muscle: FineMuscle | null,
  query?: string,
): { exercises: BodyExerciseMatch[]; isLoading: boolean; error: unknown } {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const { data, isLoading, error } = useQuery<BodyExerciseDbRow>(SELECT_BODY_EXERCISES, [lang]);

  const exercises = useMemo(() => {
    if (muscle === null) return [];
    const catalog = data.flatMap((row) => {
      const parsed = rowToBodyExercise(row);
      return parsed === null ? [] : [parsed];
    });
    return findBodyExercises(catalog, muscle, query);
  }, [data, muscle, query]);

  return { exercises, isLoading, error };
}
