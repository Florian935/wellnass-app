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
 * Modes d'affichage de la séance (US MUSCU-UX03) — **orthogonaux aux niveaux** ci-dessus.
 *
 * `classic` est l'écran d'origine, inchangé ; `immersive` est la séance vivante (fond sombre, barre
 * chargée, effort au tempo, repos qui respire, fantôme, coach). Le **niveau** d'affichage continue
 * de valoir pour les deux : c'est la densité d'information, pas la mise en scène.
 *
 * Défaut `classic`, y compris pour un compte existant : personne ne doit voir son écran de séance
 * changer sans l'avoir demandé (décision D1 de la spec).
 */
export const WORKOUT_DISPLAY_MODES = ['classic', 'immersive'] as const;
export const workoutDisplayModeSchema = z.enum(WORKOUT_DISPLAY_MODES);
export type WorkoutDisplayMode = z.infer<typeof workoutDisplayModeSchema>;

/** Défaut applicatif : toute valeur absente / illisible retombe sur le mode classique. */
export function coerceWorkoutDisplayMode(value: string | null | undefined): WorkoutDisplayMode {
  return value === 'immersive' ? 'immersive' : 'classic';
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
