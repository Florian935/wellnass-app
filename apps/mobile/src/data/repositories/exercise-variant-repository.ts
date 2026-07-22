/**
 * Repository des variantes d'exercice (liens « exercice alternatif »).
 *
 * Responsabilité unique : lire/écrire la table locale PowerSync `exercise_variants`
 * et exposer une vue « liste » prête pour l'UI (nom résolu selon la langue, drapeau
 * de suppression autorisée).
 *
 * Modèle de données (voir docs/specs/functional/musculation.md et
 * docs/specs/technical/modele-donnees.md) :
 *  - `exercise_variants` : `owner_id` null = lien éditorial global, non-null = perso ;
 *                          `exercise_id_a` / `exercise_id_b` = paire canonique (a < b,
 *                          voir `canonicalPair`). Symétrique : peu importe l'ordre de
 *                          saisie, la paire est stockée triée.
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields`).
 *  - Timestamps en UTC ; suppression = soft delete.
 *  - `owner_id` = utilisateur de la session courante à l'écriture.
 */

import { useQuery } from '@powersync/react';
import { canonicalPair } from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, nowUtc, softDelete } from './_sql';

/** Une variante telle qu'affichée sur la fiche (l'« autre » exercice de la paire). */
export type VariantItem = {
  linkId: string;
  otherId: string;
  name: string;
  source: 'library' | 'custom';
  isEditorial: boolean;
  canRemove: boolean;
};

type VariantDbRow = {
  link_id: string;
  owner_id: string | null;
  other_id: string;
  source: string;
  name: string | null;
};

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error("Aucune session active : impossible d'écrire une variante.");
  return userId;
}

/** Garde pure : lève si l'utilisateur ne possède pas le lien (perso only). */
export function assertOwnsVariant(ownerId: string | null, userId: string): void {
  if (ownerId === null || ownerId !== userId) {
    throw new Error('Suppression interdite : lien non possédé.');
  }
}

// L'« autre » exo = celui de la paire différent de self. Params (ordre) :
//   1 self (SELECT CASE) · 2 self (JOIN CASE) · 3 lang · 4 self · 5 self (WHERE)
const SELECT_VARIANTS = `
  SELECT v.id AS link_id,
         v.owner_id AS owner_id,
         CASE WHEN v.exercise_id_a = ? THEN v.exercise_id_b ELSE v.exercise_id_a END AS other_id,
         oe.source AS source,
         COALESCE(tl.name, tfr.name) AS name
  FROM exercise_variants v
  JOIN exercises oe
    ON oe.id = (CASE WHEN v.exercise_id_a = ? THEN v.exercise_id_b ELSE v.exercise_id_a END)
   AND oe.deleted_at IS NULL
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = oe.id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = oe.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE v.deleted_at IS NULL
    AND (v.exercise_id_a = ? OR v.exercise_id_b = ?)
  ORDER BY name COLLATE NOCASE
`;

/**
 * Variantes d'un exercice (éditoriales + personnelles), réactives. Dédup par exercice
 * cible : si une paire porte un lien éditorial ET un lien perso, garde l'éditorial
 * (pas de suppression possible). `canRemove` = lien perso de l'utilisateur courant.
 */
export function useExerciseVariants(exerciseId: string): {
  variants: VariantItem[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const userId = useAuthStore.getState().session?.user.id ?? null;

  const { data, isLoading } = useQuery<VariantDbRow>(SELECT_VARIANTS, [
    exerciseId, exerciseId, lang, exerciseId, exerciseId,
  ]);

  const byOther = new Map<string, VariantItem>();
  for (const row of data) {
    const isEditorial = row.owner_id === null;
    const existing = byOther.get(row.other_id);
    if (existing && existing.isEditorial) continue; // priorité éditoriale
    byOther.set(row.other_id, {
      linkId: row.link_id,
      otherId: row.other_id,
      name: row.name ?? '',
      source: (row.source as 'library' | 'custom') ?? 'library',
      isEditorial,
      canRemove: !isEditorial && row.owner_id === userId,
    });
  }
  return { variants: [...byOther.values()], isLoading };
}

/** Ids déjà liés à `exerciseId` (pour exclure du sélecteur). Réactif. */
export function useLinkedExerciseIds(exerciseId: string): { ids: Set<string>; isLoading: boolean } {
  const { variants, isLoading } = useExerciseVariants(exerciseId);
  return { ids: new Set(variants.map((v) => v.otherId)), isLoading };
}

/**
 * Crée un lien personnel entre `selfId` et `otherId` (upsert par clé naturelle :
 * réactive une ligne perso soft-deletée pour la paire canonique, sinon insert).
 */
export async function addExerciseVariant(selfId: string, otherId: string): Promise<void> {
  const userId = currentUserId();
  const { a, b } = canonicalPair(selfId, otherId);
  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM exercise_variants
     WHERE owner_id = ? AND exercise_id_a = ? AND exercise_id_b = ? LIMIT 1`,
    [userId, a, b],
  );
  if (existing) {
    await powerSync.execute(
      `UPDATE exercise_variants SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
      [nowUtc(), existing.id],
    );
    return;
  }
  await insertWithSyncFields('exercise_variants', {
    owner_id: userId,
    exercise_id_a: a,
    exercise_id_b: b,
  });
}

/** Supprime (soft) un lien perso possédé par l'utilisateur courant. */
export async function removeExerciseVariant(linkId: string): Promise<void> {
  const userId = currentUserId();
  const row = await powerSync.getOptional<{ owner_id: string | null }>(
    `SELECT owner_id FROM exercise_variants WHERE id = ? LIMIT 1`,
    [linkId],
  );
  assertOwnsVariant(row?.owner_id ?? null, userId);
  await softDelete('exercise_variants', linkId);
}
