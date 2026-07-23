import { z } from 'zod';

/** Niveaux d'affichage de l'écran de séance muscu (MUSC-F13). */
export const WORKOUT_DISPLAY_LEVELS = ['simplified', 'normal', 'detailed'] as const;
export const workoutDisplayLevelSchema = z.enum(WORKOUT_DISPLAY_LEVELS);
export type WorkoutDisplayLevel = z.infer<typeof workoutDisplayLevelSchema>;

/** Défaut applicatif : toute valeur NULL / inconnue est traitée comme « normal ». */
export function coerceWorkoutDisplayLevel(value: string | null | undefined): WorkoutDisplayLevel {
  return value === 'simplified' || value === 'normal' || value === 'detailed' ? value : 'normal';
}

/**
 * Visibilité des éléments *supplémentaires* de la carte de séance selon le niveau.
 * Les champs cœur (nom, série, reps/durée, charge, lest, consigne du plan,
 * « dernière fois », repos, valider) sont TOUJOURS visibles → hors de cet objet.
 */
export type WorkoutFieldVisibility = {
  delta: boolean; // écart planifié/réalisé (badge ▲/▼/=)
  suggestion: boolean; // suggestion de progression 💡
  warmupShortcut: boolean; // raccourci échauffement 🔥
  typeSelector: boolean; // sélecteur de types (dropset/échec/durée/poids de corps)
  rpe: boolean; // RPE par série
  note: boolean; // note par exercice 📝
  superset: boolean; // liaison superset
};

export function workoutFieldVisibility(level: WorkoutDisplayLevel): WorkoutFieldVisibility {
  const normalPlus = level === 'normal' || level === 'detailed';
  const detailed = level === 'detailed';
  return {
    delta: normalPlus,
    suggestion: normalPlus,
    warmupShortcut: normalPlus,
    typeSelector: detailed,
    rpe: detailed,
    note: detailed,
    superset: detailed,
  };
}
