import { z } from 'zod';

/**
 * Champs de synchronisation transverses imposés par l'offline-first + PowerSync.
 * Voir docs/specs/technical/modele-donnees.md §1 et offline-sync.md §6.
 *
 * Règles structurantes :
 *  - `id` est un UUID **généré côté client** (aucune attente serveur en offline).
 *  - Les timestamps sont en **UTC** (ISO 8601) ; la conversion locale se fait
 *    uniquement à l'affichage.
 *  - La suppression est un **soft delete** (`deletedAt` non nul) pour se propager
 *    proprement entre appareils ; jamais de suppression dure.
 */

/** UUID généré côté client, clé de réconciliation local ↔ serveur. */
export const uuidSchema = z.string().uuid();
export type Uuid = z.infer<typeof uuidSchema>;

/** Horodatage ISO 8601 en UTC. */
export const utcTimestampSchema = z.string().datetime({ offset: false });
export type UtcTimestamp = z.infer<typeof utcTimestampSchema>;

/**
 * Colonnes de synchro portées par toute entité utilisateur synchronisée.
 * `userId` est absent des tables de contenu global (voir `contentSyncFieldsSchema`).
 */
export const syncFieldsSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
  deletedAt: utcTimestampSchema.nullable(),
});
export type SyncFields = z.infer<typeof syncFieldsSchema>;

/**
 * Variante pour le contenu global (exercices, programmes publiés, aliments) :
 * répliqué en **lecture seule** vers l'app, sans `userId`.
 */
export const contentSyncFieldsSchema = syncFieldsSchema.omit({ userId: true });
export type ContentSyncFields = z.infer<typeof contentSyncFieldsSchema>;

/**
 * Contenu partageable : `owner_id` nullable (null = bibliothèque globale,
 * UUID = contenu personnalisé créé par l'utilisateur).
 * Sans `userId` (remplacé par `ownerId` pour distinguer les deux cas).
 */
export const contentOwnerSyncFieldsSchema = syncFieldsSchema
  .omit({ userId: true })
  .extend({ ownerId: uuidSchema.nullable() });
export type ContentOwnerSyncFields = z.infer<typeof contentOwnerSyncFieldsSchema>;
