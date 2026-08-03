/**
 * Harness SQLite en mémoire pour tester les repositories **avec du vrai SQL**.
 *
 * Pourquoi : les repositories (12 000 lignes, 34 fichiers) sont majoritairement des requêtes SQL.
 * En les testant avec `powerSync` entièrement mocké (`getAll` → `[]`), on vérifie qu'on a appelé
 * une fonction — pas que la requête est juste. Un `WHERE deleted_at IS NULL` oublié, une jointure
 * fausse, un `ORDER BY` inversé passent au vert. Ici, on exécute la requête pour de bon sur une
 * base SQLite créée à partir du **schéma PowerSync de l'app** (`@/powersync/schema`), donc toute
 * colonne absente du schéma local fait échouer le test — exactement le bug de la recette du
 * 31/07/2026 (`cycle_tracking_enabled` manquant, écriture silencieusement avalée).
 *
 * Moteur : `node:sqlite` (intégré à Node ≥ 22, aucune dépendance à installer). Le vrai moteur de
 * l'app est op-sqlite, mais les deux exécutent du SQLite : le dialecte testé est le bon.
 *
 * Usage type dans un test de repository :
 *
 * ```ts
 * import { testPowerSync, resetTestDb, seed } from '@/test-utils/sqlite-harness';
 *
 * jest.mock('@/powersync/system', () => ({
 *   powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
 *   connector: {},
 * }));
 *
 * beforeEach(() => { resetTestDb(); seed('user_settings', [{ user_id: 'u1' }]); });
 * ```
 *
 * ⚠️ `jest.setup.ts` mocke déjà `@/powersync/system` globalement ; le `jest.mock` du fichier de
 * test le remplace. Sans ce `jest.mock` local, le harness n'est pas branché.
 */

import { DatabaseSync } from 'node:sqlite';

import { AppSchema } from '@/powersync/schema';
import { generateId } from '@/lib/id';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valeur acceptée par le binding `node:sqlite`. */
type Bindable = null | number | bigint | string | Uint8Array;

/** Sous-ensemble de l'API PowerSync réellement utilisé par les repositories. */
export interface TestPowerSync {
  execute(sql: string, params?: unknown[]): Promise<{ rows: { _array: unknown[] } }>;
  getAll<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  getOptional<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  get<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
  writeTransaction<T>(fn: (tx: TestTransaction) => Promise<T>): Promise<T>;
  readTransaction<T>(fn: (tx: TestTransaction) => Promise<T>): Promise<T>;
}

/** Objet `tx` passé aux callbacks de transaction (même surface que PowerSync). */
export type TestTransaction = Pick<
  TestPowerSync,
  'execute' | 'getAll' | 'getOptional' | 'get'
>;

// ---------------------------------------------------------------------------
// Génération du DDL depuis le schéma PowerSync
// ---------------------------------------------------------------------------

/**
 * Traduit une déclaration de colonne PowerSync en type SQLite.
 *
 * Tolère les deux formes rencontrées : la valeur mockée dans `jest.setup.ts` (`'TEXT'`) et
 * l'objet de la vraie lib (`{ type: 'TEXT' }`), pour que le harness survive au retrait du mock.
 */
function sqliteType(declared: unknown): string {
  const raw =
    typeof declared === 'string'
      ? declared
      : ((declared as { type?: unknown } | null)?.type ?? 'TEXT');
  const upper = String(raw).toUpperCase();
  return upper === 'INTEGER' || upper === 'REAL' ? upper : 'TEXT';
}

/**
 * Extrait `{ table: { colonne: type } }` du `AppSchema` de l'app.
 *
 * Le `Schema`/`Table` de PowerSync n'expose pas la même forme selon les versions (et selon qu'il
 * est mocké ou non) : on sonde les emplacements connus plutôt que d'en supposer un seul, et on
 * échoue bruyamment si aucun ne répond — un schéma vide produirait des tests verts sans table.
 */
function readSchema(): Record<string, Record<string, string>> {
  const schema = AppSchema as unknown as Record<string, unknown>;
  const tables = (schema.tables ?? schema.props ?? schema) as Record<string, unknown>;

  const out: Record<string, Record<string, string>> = {};
  for (const [tableName, table] of Object.entries(tables)) {
    if (!table || typeof table !== 'object') continue;
    const holder = table as Record<string, unknown>;
    const columns = (holder.columns ?? holder.props ?? holder) as Record<string, unknown>;
    if (!columns || typeof columns !== 'object') continue;

    const cols: Record<string, string> = {};
    for (const [colName, declared] of Object.entries(columns)) {
      if (typeof declared === 'function') continue;
      cols[colName] = sqliteType(declared);
    }
    if (Object.keys(cols).length > 0) out[tableName] = cols;
  }

  if (Object.keys(out).length === 0) {
    throw new Error(
      'sqlite-harness : impossible de lire AppSchema (aucune table). ' +
        'Le mock de @powersync/react-native dans jest.setup.ts a probablement changé de forme.',
    );
  }
  return out;
}

/**
 * DDL de la base de test : une table par table PowerSync, plus la colonne `id` que PowerSync
 * déclare implicitement (elle n'apparaît jamais dans `new Table({...})`).
 */
function createStatements(): string[] {
  return Object.entries(readSchema()).map(([table, columns]) => {
    const cols = Object.entries(columns).map(([name, type]) => `  ${name} ${type}`);
    return `CREATE TABLE ${table} (\n  id TEXT PRIMARY KEY,\n${cols.join(',\n')}\n)`;
  });
}

// ---------------------------------------------------------------------------
// Base de test
// ---------------------------------------------------------------------------

let db: DatabaseSync | null = null;

/** (Re)crée une base vierge. À appeler dans un `beforeEach` — l'isolation entre tests en dépend. */
export function resetTestDb(): DatabaseSync {
  db?.close();
  db = new DatabaseSync(':memory:');
  for (const sql of createStatements()) db.exec(sql);
  return db;
}

/** Base courante, créée à la volée si le test a oublié `resetTestDb()`. */
export function getTestDb(): DatabaseSync {
  return db ?? resetTestDb();
}

/** Ferme la base (facultatif : `resetTestDb` ferme déjà la précédente). */
export function closeTestDb(): void {
  db?.close();
  db = null;
}

// ---------------------------------------------------------------------------
// Adaptation des valeurs
// ---------------------------------------------------------------------------

/**
 * Convertit une valeur applicative en valeur liable par `node:sqlite`.
 *
 * op-sqlite est plus permissif (il accepte un booléen) : sans cette conversion, un test échouerait
 * sur une différence de binding et non sur la logique testée.
 */
function bind(value: unknown): Bindable {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string') {
    return value;
  }
  if (value instanceof Uint8Array) return value;
  return JSON.stringify(value);
}

const bindAll = (params?: unknown[]): Bindable[] => (params ?? []).map(bind);

/** `true` si la requête renvoie des lignes (`.all()`) plutôt qu'un simple `.run()`. */
function isSelect(sql: string): boolean {
  return /^\s*(select|with|pragma)\b/i.test(sql);
}

// ---------------------------------------------------------------------------
// Fausse instance PowerSync
// ---------------------------------------------------------------------------

function runSql(sql: string, params?: unknown[]): unknown[] {
  const statement = getTestDb().prepare(sql);
  return isSelect(sql)
    ? (statement.all(...bindAll(params)) as unknown[])
    : (statement.run(...bindAll(params)), []);
}

const tx: TestTransaction = {
  async execute(sql, params) {
    return { rows: { _array: runSql(sql, params) } };
  },
  async getAll<T>(sql: string, params?: unknown[]) {
    return runSql(sql, params) as T[];
  },
  async getOptional<T>(sql: string, params?: unknown[]) {
    return (runSql(sql, params)[0] as T) ?? null;
  },
  async get<T>(sql: string, params?: unknown[]) {
    const row = runSql(sql, params)[0];
    if (row === undefined) throw new Error(`Aucune ligne pour : ${sql}`);
    return row as T;
  },
};

/**
 * Fausse instance PowerSync branchée sur la base en mémoire.
 *
 * Les transactions sont réelles (`BEGIN` / `COMMIT` / `ROLLBACK`) : un test peut donc vérifier
 * qu'une écriture multi-tables est bien atomique, ce qu'un mock ne permet pas.
 */
export const testPowerSync: TestPowerSync = {
  ...tx,
  async writeTransaction(fn) {
    const database = getTestDb();
    database.exec('BEGIN');
    try {
      const result = await fn(tx);
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  },
  async readTransaction(fn) {
    return fn(tx);
  },
};

// ---------------------------------------------------------------------------
// Semis
// ---------------------------------------------------------------------------

/**
 * Insère des lignes en complétant les champs de synchro absents (`id`, `created_at`,
 * `updated_at`, `deleted_at`) — pour que les `WHERE deleted_at IS NULL` des repositories voient
 * bien la ligne sans que chaque test ait à les répéter.
 *
 * Renvoie les `id` insérés, dans l'ordre.
 */
export function seed(table: string, rows: Record<string, unknown>[]): string[] {
  const now = new Date().toISOString();
  return rows.map((row) => {
    const id = typeof row.id === 'string' ? row.id : generateId();
    const merged: Record<string, unknown> = {
      created_at: now,
      updated_at: now,
      deleted_at: null,
      ...row,
      id,
    };
    const columns = Object.keys(merged);
    const placeholders = columns.map(() => '?').join(', ');
    getTestDb()
      .prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
      .run(...columns.map((c) => bind(merged[c])));
    return id;
  });
}

/** Lit une table entière (hors lignes supprimées si `includeDeleted` est faux). Aide d'assertion. */
export function rowsOf<T = Record<string, unknown>>(
  table: string,
  includeDeleted = false,
): T[] {
  const where = includeDeleted ? '' : ' WHERE deleted_at IS NULL';
  return getTestDb().prepare(`SELECT * FROM ${table}${where}`).all() as T[];
}
