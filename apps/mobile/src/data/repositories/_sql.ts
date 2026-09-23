/**
 * Helpers SQL partagés pour tous les repositories.
 *
 * ⚠️  Sécurité : les noms de table et de colonnes sont interpolés directement dans
 * la requête SQL. Ces noms proviennent UNIQUEMENT de notre code (strings littérales),
 * jamais de saisies utilisateur — risque d'injection nul. Les valeurs sont toujours
 * passées en paramètres liés (?).
 */

import { generateId } from '@/lib/id';
import { powerSync } from '@/powersync/system';

// ---------------------------------------------------------------------------
// Utilitaires de base
// ---------------------------------------------------------------------------

/** Retourne l'instant courant en ISO 8601 UTC. */
export const nowUtc = (): string => new Date().toISOString();

// ---------------------------------------------------------------------------
// Traduction d'un exercice (lecture)
// ---------------------------------------------------------------------------

/**
 * Un champ traduit d'un exercice (`name`, `instructions`) dans la langue courante, avec repli sur
 * le français — écrit en **sous-requêtes scalaires**, jamais en `LEFT JOIN`.
 *
 * ⚠️ MUSCU-FIX02 (23/09/2026) : ne pas le réécrire en `LEFT JOIN exercise_translations`. Les tables
 * PowerSync sont des **vues** sur du JSON (`CAST(json_extract(data, …))`), et SQLite n'utilise
 * jamais un index d'expression pour la table de droite d'un `LEFT JOIN` sur une vue : chaque ligne
 * relisait toute la table des traductions. Mesuré sur 350 exercices : 185 ms en `LEFT JOIN`,
 * 0,6 ms ainsi (PC ; compter ×5 à ×10 sur un téléphone). Les sous-requêtes, elles, passent par
 * l'index `(exercise_id, lang)` déclaré dans `schema.ts`. Et elles ne dupliquent jamais une ligne
 * quand un exercice a deux traductions dans la même langue, ce que faisait le `LEFT JOIN`.
 *
 * Consomme **un** paramètre `?` : la langue courante.
 *
 * @param exerciseId expression SQL de l'id (`s.exercise_id`, `e.id`…) — jamais une saisie.
 * @param liveOnly   `true` pour les listes de sélection : une traduction archivée n'y nomme plus
 *   rien. Par défaut, elle reste lisible (ADMIN-01 : une séance passée garde le nom du mouvement
 *   réellement soulevé), la traduction vivante primant quand les deux existent.
 */
export function exerciseTranslationSql(
  field: 'name' | 'instructions',
  exerciseId: string,
  liveOnly = false,
): string {
  const pick = (lang: string) =>
    liveOnly
      ? `(SELECT xt.${field} FROM exercise_translations xt
          WHERE xt.exercise_id = ${exerciseId} AND xt.lang = ${lang} AND xt.deleted_at IS NULL
          LIMIT 1)`
      : `(SELECT xt.${field} FROM exercise_translations xt
          WHERE xt.exercise_id = ${exerciseId} AND xt.lang = ${lang}
          ORDER BY xt.deleted_at IS NOT NULL LIMIT 1)`;
  return `COALESCE(${pick('?')}, ${pick("'fr'")})`;
}

/** Le nom d'un exercice — voir `exerciseTranslationSql`. Consomme un `?` (la langue). */
export const exerciseNameSql = (exerciseId: string, liveOnly = false): string =>
  exerciseTranslationSql('name', exerciseId, liveOnly);

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

/**
 * Soft delete : positionne `deleted_at` et `updated_at` sur la ligne.
 * Jamais de hard delete côté client (contrainte PowerSync / connector).
 */
export async function softDelete(table: string, id: string): Promise<void> {
  await powerSync.execute(
    `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [nowUtc(), nowUtc(), id],
  );
}

// ---------------------------------------------------------------------------
// Insertion avec champs de synchronisation
// ---------------------------------------------------------------------------

/**
 * Insère une ligne en injectant automatiquement les champs de synchro :
 *  - `id`         : UUID généré par `generateId()` si absent de `values`
 *  - `created_at` : nowUtc()
 *  - `updated_at` : nowUtc()
 *  - `deleted_at` : null
 *
 * Les clés de `values` sont les noms de colonnes snake_case exacts
 * (aucune conversion camelCase ↔ snake_case effectuée ici).
 *
 * Retourne l'`id` utilisé.
 */
export async function insertWithSyncFields(
  table: string,
  values: Record<string, unknown>,
): Promise<string> {
  const id = typeof values['id'] === 'string' ? values['id'] : generateId();
  const now = nowUtc();

  const merged: Record<string, unknown> = {
    ...values,
    id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  const columns = Object.keys(merged);
  const placeholders = columns.map(() => '?').join(', ');
  const params = columns.map((col) => merged[col]);

  await powerSync.execute(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    params,
  );

  return id;
}

// ---------------------------------------------------------------------------
// Insertion dans une transaction
// ---------------------------------------------------------------------------

/**
 * Insère une ligne DANS une transaction (`writeTransaction`) en injectant les champs
 * de synchro, à la manière de `insertWithSyncFields` mais via l'objet `tx` fourni :
 *  - `id`         : UUID généré par `generateId()` si absent de `values`
 *  - `created_at` : nowUtc()
 *  - `updated_at` : nowUtc()
 *  - `deleted_at` : null
 *
 * À utiliser à la place de `insertWithSyncFields` dans une transaction : cette dernière
 * passe par le `powerSync.execute` GLOBAL (hors transaction), ce qui casserait
 * l'atomicité. Les clés de `values` sont les noms de colonnes snake_case exacts.
 *
 * Retourne l'`id` utilisé.
 */
export async function txInsert(
  tx: { execute: (sql: string, params?: unknown[]) => Promise<unknown> },
  table: string,
  values: Record<string, unknown>,
): Promise<string> {
  const id = typeof values['id'] === 'string' ? (values['id'] as string) : generateId();
  const now = nowUtc();
  const merged: Record<string, unknown> = {
    ...values,
    id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  const columns = Object.keys(merged);
  const placeholders = columns.map(() => '?').join(', ');
  const params = columns.map((col) => merged[col]);
  await tx.execute(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    params,
  );
  return id;
}

// ---------------------------------------------------------------------------
// Mise à jour partielle (PATCH)
// ---------------------------------------------------------------------------

/**
 * Met à jour les colonnes spécifiées dans `values` et force `updated_at = nowUtc()`.
 *
 * Les clés de `values` sont les noms de colonnes snake_case exacts.
 */
export async function patch(
  table: string,
  id: string,
  values: Record<string, unknown>,
): Promise<void> {
  const now = nowUtc();
  const columns = Object.keys(values);

  if (columns.length === 0) {
    // Rien à mettre à jour — on pose quand même updated_at pour rester cohérent.
    await powerSync.execute(
      `UPDATE ${table} SET updated_at = ? WHERE id = ?`,
      [now, id],
    );
    return;
  }

  const setClauses = [...columns.map((col) => `${col} = ?`), 'updated_at = ?'].join(', ');
  const params = [...columns.map((col) => values[col]), now, id];

  await powerSync.execute(
    `UPDATE ${table} SET ${setClauses} WHERE id = ?`,
    params,
  );
}
