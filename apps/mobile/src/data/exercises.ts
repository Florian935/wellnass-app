/**
 * Jeu d'exercices de démarrage (seed local, bilingue). Import par script de seed en attendant
 * l'admin (V0.7) et la synchro du contenu — voir roadmap 3.13. Les exercices persos créés par
 * l'utilisateur ne sont **jamais traduits** (langue de saisie).
 */
export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export type SeedExercise = {
  id: string;
  name: { fr: string; en: string };
  muscle: MuscleGroup;
};

export const SEED_EXERCISES: readonly SeedExercise[] = [
  { id: 'ex-bench-press', name: { fr: 'Développé couché', en: 'Bench press' }, muscle: 'chest' },
  { id: 'ex-incline-press', name: { fr: 'Développé incliné', en: 'Incline press' }, muscle: 'chest' },
  { id: 'ex-push-up', name: { fr: 'Pompes', en: 'Push-up' }, muscle: 'chest' },
  { id: 'ex-pull-up', name: { fr: 'Traction', en: 'Pull-up' }, muscle: 'back' },
  { id: 'ex-barbell-row', name: { fr: 'Rowing barre', en: 'Barbell row' }, muscle: 'back' },
  { id: 'ex-lat-pulldown', name: { fr: 'Tirage vertical', en: 'Lat pulldown' }, muscle: 'back' },
  { id: 'ex-squat', name: { fr: 'Squat', en: 'Squat' }, muscle: 'legs' },
  { id: 'ex-deadlift', name: { fr: 'Soulevé de terre', en: 'Deadlift' }, muscle: 'legs' },
  { id: 'ex-leg-press', name: { fr: 'Presse à cuisses', en: 'Leg press' }, muscle: 'legs' },
  { id: 'ex-lunge', name: { fr: 'Fente', en: 'Lunge' }, muscle: 'legs' },
  { id: 'ex-overhead-press', name: { fr: 'Développé militaire', en: 'Overhead press' }, muscle: 'shoulders' },
  { id: 'ex-lateral-raise', name: { fr: 'Élévations latérales', en: 'Lateral raise' }, muscle: 'shoulders' },
  { id: 'ex-biceps-curl', name: { fr: 'Curl biceps', en: 'Biceps curl' }, muscle: 'arms' },
  { id: 'ex-triceps-ext', name: { fr: 'Extension triceps', en: 'Triceps extension' }, muscle: 'arms' },
  { id: 'ex-plank', name: { fr: 'Gainage', en: 'Plank' }, muscle: 'core' },
  { id: 'ex-crunch', name: { fr: 'Crunch', en: 'Crunch' }, muscle: 'core' },
];
