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
