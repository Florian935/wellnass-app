import {
  FINE_MUSCLE_VIEWS,
  fineMuscleSchema,
  resolveFineMuscles,
  type FineMuscle,
  type MuscleGroup,
} from './exercise';
import { matchesSearch } from './search';

export type BodyExercise = {
  id: string;
  name: string;
  muscle: MuscleGroup;
  musclesSecondary: MuscleGroup[];
  musclesFine: FineMuscle[];
  equipment: string | null;
  isFavorite: boolean;
};

export type BodyExerciseMatch = BodyExercise & {
  inferred: boolean;
};

/** Associe un muscle fin aux exercices locaux, avec repli large seulement en l'absence de tag fin. */
export function findBodyExercises(
  exercises: BodyExercise[],
  muscle: FineMuscle,
  query?: string,
): BodyExerciseMatch[] {
  return exercises
    .flatMap((exercise): BodyExerciseMatch[] => {
      const hasFineTags = exercise.musclesFine.length > 0;
      const matches = hasFineTags
        ? exercise.musclesFine.includes(muscle)
        : (() => {
            const resolved = resolveFineMuscles({
              musclePrimary: exercise.muscle,
              musclesSecondary: exercise.musclesSecondary,
              musclesFine: exercise.musclesFine,
            });
            return resolved.full.includes(muscle) || resolved.reduced.includes(muscle);
          })();

      return matches && matchesSearch(exercise.name, query ?? '')
        ? [{ ...exercise, inferred: !hasFineTags }]
        : [];
    })
    .sort(
      (a, b) =>
        Number(a.inferred) - Number(b.inferred) ||
        Number(b.isFavorite) - Number(a.isFavorite) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
}

/** Valide un parametre externe avant de l'utiliser comme identifiant anatomique. */
export function parseBodyMuscle(value: unknown): FineMuscle | null {
  const parsed = fineMuscleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Garde la vue courante si possible, sinon ouvre la vue qui contient le muscle. */
export function bodySideForMuscle(
  muscle: FineMuscle,
  currentSide: 'front' | 'back',
): 'front' | 'back' {
  const views = FINE_MUSCLE_VIEWS[muscle];
  return views.includes(currentSide) ? currentSide : views[0]!;
}
