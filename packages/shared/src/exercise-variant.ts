import { z } from 'zod';
import { contentOwnerSyncFieldsSchema, uuidSchema } from './sync';

/**
 * Ordonne canoniquement une paire d'exercices (a < b) pour un stockage symétrique
 * sans doublon. L'appelant garantit `a !== b` (self exclu du sélecteur).
 */
export function canonicalPair(a: string, b: string): { a: string; b: string } {
  return a < b ? { a, b } : { a: b, b: a };
}

/**
 * Schéma d'une ligne de liaison variante (symétrique, canonique).
 * Hérite de `contentOwnerSyncFieldsSchema` (id, ownerId, createdAt, updatedAt, deletedAt).
 */
export const exerciseVariantRowSchema = contentOwnerSyncFieldsSchema.extend({
  exerciseIdA: uuidSchema,
  exerciseIdB: uuidSchema,
});
export type ExerciseVariantRow = z.infer<typeof exerciseVariantRowSchema>;
