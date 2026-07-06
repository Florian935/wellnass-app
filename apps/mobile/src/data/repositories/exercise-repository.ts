/**
 * Repository des exercices (bibliothèque globale + exercices personnalisés + favoris).
 *
 * Responsabilité unique : lire/écrire les tables locales PowerSync `exercises`,
 * `exercise_translations` et `exercise_favorites`, et exposer une vue « liste »
 * prête pour l'UI (nom résolu selon la langue, drapeau favori).
 *
 * Modèle de données (voir docs/specs/functional/musculation.md §3.5 et
 * docs/specs/technical/modele-donnees.md) :
 *  - `exercises`             : `owner_id` null = bibliothèque globale, non-null = custom ;
 *                              `source` ('library' | 'custom'), `muscle_primary`, `equipment`, `media_url`.
 *  - `exercise_translations` : une ligne par (exercice, langue) ; `name`, `instructions`.
 *  - `exercise_favorites`    : (user_id, exercise_id) — favoris de l'utilisateur courant.
 *
 * Résolution du nom : faite directement en SQL avec repli langue courante → `fr`
 * (voir `resolveExerciseName` côté domaine pour la stratégie équivalente hors SQL).
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields`).
 *  - Timestamps en UTC ; suppression = soft delete.
 *  - `owner_id` / `user_id` = utilisateur de la session courante à l'écriture.
 */

import { useQuery } from '@powersync/react';
import type { MuscleGroup, Source } from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { resolveDeviceLocale } from '@/i18n';
import { insertWithSyncFields, softDelete } from './_sql';

/** Élément d'exercice tel qu'affiché dans les listes (biblio, favoris, recherche). */
export type ExerciseListItem = {
  id: string;
  name: string;
  muscle: MuscleGroup;
  source: Source;
  equipment: string | null;
  mediaUrl: string | null;
  isFavorite: boolean;
};

/** Ligne brute renvoyée par SQLite pour la vue liste (colonnes résolues en SQL). */
type ExerciseListDbRow = {
  id: string;
  source: string;
  muscle_primary: string;
  equipment: string | null;
  media_url: string | null;
  /** Nom résolu par COALESCE(langue courante, fr) — peut être null si aucune traduction. */
  name: string | null;
  /** Drapeau favori renvoyé en 0/1 par SQLite. */
  is_favorite: number;
};

// ---------------------------------------------------------------------------
// Requêtes SQL (noms de tables/colonnes statiques ; valeurs toujours liées via ?)
// ---------------------------------------------------------------------------

/**
 * Sélection de base des exercices avec nom résolu (langue courante → fr) et
 * drapeau favori. Premier `?` = langue courante.
 */
const SELECT_EXERCISES = `
  SELECT e.id, e.source, e.muscle_primary, e.equipment, e.media_url,
         COALESCE(tl.name, tfr.name) AS name,
         (f.id IS NOT NULL) AS is_favorite
  FROM exercises e
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = e.id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = e.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  LEFT JOIN exercise_favorites f      ON f.exercise_id = e.id AND f.deleted_at IS NULL
  WHERE e.deleted_at IS NULL
`;

const ORDER_BY_NAME = 'ORDER BY name COLLATE NOCASE';

/** Clause de recherche insensible à la casse sur le nom résolu (param = `%term%`). */
const SEARCH_CLAUSE = 'AND COALESCE(tl.name, tfr.name) LIKE ?';

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne SQLite (vue liste) → élément de domaine (camelCase). */
function rowToListItem(row: ExerciseListDbRow): ExerciseListItem {
  return {
    id: row.id,
    // Repli ultime : chaîne vide si aucune traduction (ne devrait pas arriver en pratique).
    name: row.name ?? '',
    muscle: row.muscle_primary as MuscleGroup,
    source: row.source as Source,
    equipment: row.equipment,
    mediaUrl: row.media_url,
    isFavorite: row.is_favorite === 1,
  };
}

// ---------------------------------------------------------------------------
// Lecture réactive (hooks)
// ---------------------------------------------------------------------------

/**
 * Exercices de la bibliothèque + personnalisés, réactifs aux changements locaux.
 * Optionnellement filtrés par `search` (recherche insensible à la casse sur le
 * nom résolu dans la langue courante).
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (voir
 * profile/settings-repository) : le contenu ne doit pas se bloquer sur une
 * synchro réseau (offline-first, ADR-001 / décision B).
 */
export function useExercises(search?: string): {
  exercises: ExerciseListItem[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const term = search?.trim() ?? '';
  const hasSearch = term.length > 0;

  const sql = hasSearch
    ? `${SELECT_EXERCISES} ${SEARCH_CLAUSE} ${ORDER_BY_NAME}`
    : `${SELECT_EXERCISES} ${ORDER_BY_NAME}`;
  const params = hasSearch ? [lang, `%${term}%`] : [lang];

  const { data, isLoading: queryLoading } = useQuery<ExerciseListDbRow>(sql, params);

  const isLoading = queryLoading;
  const exercises = data.map(rowToListItem);

  return { exercises, isLoading };
}

/**
 * Uniquement les exercices marqués comme favoris par l'utilisateur courant.
 * Même forme que `useExercises` (nom résolu, drapeau favori toujours `true`).
 */
export function useFavorites(): { exercises: ExerciseListItem[]; isLoading: boolean } {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  // Réutilise la sélection de base et ne garde que les lignes favorisées.
  const sql = `${SELECT_EXERCISES} AND f.id IS NOT NULL ${ORDER_BY_NAME}`;

  const { data, isLoading: queryLoading } = useQuery<ExerciseListDbRow>(sql, [lang]);

  const isLoading = queryLoading;
  const exercises = data.map(rowToListItem);

  return { exercises, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible d'écrire un exercice.");
  }
  return userId;
}

/**
 * Crée un exercice personnalisé de l'utilisateur courant.
 *
 * Écriture en deux temps :
 *  1. une ligne `exercises` (`owner_id`=user, `source='custom'`, `muscle_primary`=muscle,
 *     `equipment`=null, `media_url`=null) ;
 *  2. une unique ligne `exercise_translations` dans la langue courante de l'appareil.
 *
 * Les exercices personnalisés ne sont jamais traduits (une seule ligne dans la
 * langue de saisie, voir spec musculation §3.5).
 *
 * Retourne l'`id` de l'exercice créé.
 */
export async function addCustomExercise(
  name: string,
  muscle: MuscleGroup,
): Promise<string> {
  const ownerId = currentUserId();

  const exerciseId = await insertWithSyncFields('exercises', {
    owner_id: ownerId,
    source: 'custom',
    muscle_primary: muscle,
    equipment: null,
    media_url: null,
  });

  await insertWithSyncFields('exercise_translations', {
    exercise_id: exerciseId,
    owner_id: ownerId,
    lang: resolveDeviceLocale(),
    name: name.trim(),
    instructions: null,
  });

  return exerciseId;
}

/**
 * Ajoute ou retire l'exercice des favoris de l'utilisateur courant (idempotent).
 * S'il existe une ligne favori non supprimée → soft delete ; sinon → insertion.
 */
export async function toggleFavorite(exerciseId: string): Promise<void> {
  const userId = currentUserId();

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM exercise_favorites
     WHERE user_id = ? AND exercise_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [userId, exerciseId],
  );

  if (existing) {
    await softDelete('exercise_favorites', existing.id);
    return;
  }

  await insertWithSyncFields('exercise_favorites', {
    user_id: userId,
    exercise_id: exerciseId,
  });
}
