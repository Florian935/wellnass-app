/**
 * Banc « vues PowerSync » : la base locale **telle que PowerSync la construit sur le téléphone**,
 * pour juger le **plan** d'une requête — pas son résultat (le harnais `sqlite-harness` s'en charge).
 *
 * ── Pourquoi un second banc ──────────────────────────────────────────────────────────────────────
 * Le harnais crée de vraies tables : SQLite y utilise n'importe quel index, et une requête lente y
 * passe en quelques millisecondes. Sur le téléphone, chaque table est une **vue** sur une table
 * `ps_data__<table>(id, data)` dont les colonnes vivent dans du JSON
 * (`CAST(json_extract(data, '$.col') AS TEXT)`), et les index déclarés dans `schema.ts` sont des
 * index d'**expression**. Or SQLite n'utilise jamais ces index pour la table de droite d'un
 * `LEFT JOIN` sur une vue : chaque ligne relit la table entière.
 *  - MUSCU-FIX02 (23/09/2026) : 185 ms pour 350 exercices, 0,6 ms en sous-requêtes ;
 *  - recette PRISME-01 (08/10/2026) : le catalogue d'aliments, 3 244 aliments et 6 488 traductions,
 *    **29 s sur PC** — plusieurs minutes sur un téléphone, et les 5 connexions de lecture occupées :
 *    la recherche ne rendait jamais rien, et toute autre lecture de l'app attendait derrière.
 *
 * Ce banc reproduit ce stockage à partir de `AppSchema` (colonnes **et** index déclarés), et
 * `perRowRereads` nomme les tables relues en entier pour chaque ligne d'une requête.
 */

import { DatabaseSync } from 'node:sqlite';

import { AppSchema } from '@/powersync/schema';

type ColumnType = 'TEXT' | 'INTEGER' | 'REAL';
type TableShape = { columns: Record<string, ColumnType>; indexes: Record<string, string[]> };

function columnType(declared: unknown): ColumnType {
  const raw = typeof declared === 'string' ? declared : (declared as { type?: unknown } | null)?.type;
  const upper = String(raw ?? 'TEXT').toUpperCase();
  return upper === 'INTEGER' || upper === 'REAL' ? upper : 'TEXT';
}

/** Les tables de `AppSchema`, colonnes et index (le mock de `jest.setup.ts` garde les options). */
function readTables(): Record<string, TableShape> {
  const tables = (AppSchema as unknown as { tables?: Record<string, unknown> }).tables ?? {};
  const out: Record<string, TableShape> = {};
  for (const [name, table] of Object.entries(tables)) {
    const holder = table as { columns?: Record<string, unknown>; options?: { indexes?: Record<string, string[]> } };
    if (!holder?.columns) continue;
    const columns: Record<string, ColumnType> = {};
    for (const [col, declared] of Object.entries(holder.columns)) columns[col] = columnType(declared);
    out[name] = { columns, indexes: holder.options?.indexes ?? {} };
  }
  if (Object.keys(out).length === 0) {
    throw new Error('powersync-views : AppSchema illisible (aucune table). Le mock de jest.setup.ts a changé de forme.');
  }
  return out;
}

const extract = (column: string, type: ColumnType) => `CAST(json_extract(data, '$.${column}') AS ${type})`;

/** Une base vierge, construite comme PowerSync construit la sienne. */
export function createPowerSyncViewsDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const [name, { columns, indexes }] of Object.entries(readTables())) {
    const cols = Object.entries(columns);
    db.exec(`CREATE TABLE "ps_data__${name}" (id TEXT PRIMARY KEY NOT NULL, data TEXT)`);
    db.exec(
      `CREATE VIEW "${name}"("id"${cols.map(([c]) => `, "${c}"`).join('')}) AS ` +
        `SELECT id${cols.map(([c, t]) => `, ${extract(c, t)}`).join('')} FROM "ps_data__${name}"`,
    );
    for (const [indexName, indexColumns] of Object.entries(indexes)) {
      const expressions = indexColumns.map((c) => extract(c, columns[c] ?? 'TEXT')).join(', ');
      db.exec(`CREATE INDEX "ps_data__${name}__${indexName}" ON "ps_data__${name}" (${expressions})`);
    }
  }
  return db;
}

type PlanRow = { id: number; parent: number; detail: string };

/** Le plan d'exécution de `sql`, ligne à ligne. Les `?` restent non liés (NULL) : seul le plan compte. */
export function queryPlan(db: DatabaseSync, sql: string): PlanRow[] {
  return db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as PlanRow[];
}

/**
 * Les tables (parmi `tables`) **relues en entier pour chaque ligne** de la requête : un `SCAN` qui
 * est la table intérieure d'une jointure (pas la première de son niveau), ou qui vit sous une
 * sous-requête **corrélée**. Un `SCAN` unique de la table pilote, ou d'une liste `IN (…)` non
 * corrélée, n'en est pas un : il ne coûte qu'un passage.
 */
export function perRowRereads(plan: PlanRow[], tables: readonly string[]): string[] {
  const byId = new Map(plan.map((row) => [row.id, row]));
  const underCorrelated = (row: PlanRow): boolean => {
    for (let parent = byId.get(row.parent); parent; parent = byId.get(parent.parent)) {
      if (parent.detail.startsWith('CORRELATED')) return true;
    }
    return false;
  };
  const isTableStep = (detail: string) => /^(SCAN|SEARCH) /.test(detail);
  const watched = new RegExp(`^SCAN (${tables.map((t) => `ps_data__${t}`).join('|')})\\b`);

  return plan
    .filter((row) => watched.test(row.detail))
    .filter((row) => {
      const siblings = plan.filter((other) => other.parent === row.parent && isTableStep(other.detail));
      const innerLoop = siblings.findIndex((other) => other.id === row.id) > 0;
      return innerLoop || underCorrelated(row);
    })
    .map((row) => row.detail);
}
