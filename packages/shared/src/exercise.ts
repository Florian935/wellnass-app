import { z } from 'zod';
import { contentOwnerSyncFieldsSchema, uuidSchema } from './sync';
import { localeSchema } from './pillar';

/**
 * Groupes musculaires canoniques. Valeurs utilisées dans les exercices de la
 * bibliothèque et dans les exercices personnalisés. L'app mobile importe
 * `MUSCLE_GROUPS` / `MuscleGroup` depuis `@wellness/shared`.
 */
export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
export const muscleGroupSchema = z.enum(MUSCLE_GROUPS);
export type MuscleGroup = z.infer<typeof muscleGroupSchema>;

/**
 * Équipements disponibles en salle ou à domicile.
 * `equipment` est nullable sur la ligne exercice (exercice sans matériel).
 */
export const EQUIPMENTS = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
] as const;
export const equipmentSchema = z.enum(EQUIPMENTS);
export type Equipment = z.infer<typeof equipmentSchema>;

/**
 * Origine de l'exercice : bibliothèque globale ou créé par l'utilisateur.
 */
export const SOURCES = ['library', 'custom'] as const;
export const sourceSchema = z.enum(SOURCES);
export type Source = z.infer<typeof sourceSchema>;

/**
 * Schéma d'une ligne exercice.
 * Hérite de `contentOwnerSyncFieldsSchema` (id, ownerId, createdAt, updatedAt, deletedAt).
 */
export const exerciseRowSchema = contentOwnerSyncFieldsSchema.extend({
  source: sourceSchema,
  musclePrimary: muscleGroupSchema,
  equipment: equipmentSchema.nullable(),
  mediaUrl: z.string().url().nullable(),
});
export type ExerciseRow = z.infer<typeof exerciseRowSchema>;

/**
 * Schéma d'une traduction d'exercice.
 * Hérite de `contentOwnerSyncFieldsSchema` + référence à l'exercice parent.
 */
export const exerciseTranslationRowSchema = contentOwnerSyncFieldsSchema.extend({
  exerciseId: uuidSchema,
  lang: localeSchema,
  name: z.string(),
  instructions: z.string().nullable(),
});
export type ExerciseTranslationRow = z.infer<typeof exerciseTranslationRowSchema>;

/**
 * Résout le nom d'un exercice à partir de ses traductions selon la langue demandée.
 *
 * Stratégie de repli (fallback) :
 *  1. Traduction dans `lang` demandée.
 *  2. Traduction en `fr`.
 *  3. Premier élément du tableau (quelle que soit sa langue).
 *  4. `undefined` si le tableau est vide.
 */
export function resolveExerciseName(
  translations: ReadonlyArray<{ lang: string; name: string }>,
  lang: string,
): string | undefined {
  if (translations.length === 0) return undefined;
  const found = translations.find((t) => t.lang === lang);
  if (found) return found.name;
  const fr = translations.find((t) => t.lang === 'fr');
  if (fr) return fr.name;
  // Le tableau est non-vide (guard ci-dessus) — l'assertion est sûre.
  return translations[0]!.name;
}
