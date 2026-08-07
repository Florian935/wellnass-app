/**
 * Double de test du client Supabase du back-office.
 *
 * Pourquoi un double et pas une vraie base : `apps/admin` parle à Supabase **par le réseau**
 * (supabase-js + RLS), pas à une base locale comme le mobile. Il n'y a donc pas d'équivalent au
 * harness SQLite : ce qu'on peut tester sans réseau, c'est **la requête qu'on émet** et **ce qu'on
 * fait de la réponse**. C'est justement là que vivent les défauts qui coûtent cher ici — l'admin
 * écrit dans le contenu **partagé par tous les utilisateurs**, un filtre oublié ne casse pas un
 * compte, il en casse des milliers.
 *
 * Ce que le double capture, et qu'aucune relecture ne garantit dans la durée :
 *  - la **table** visée et l'**opération** (`select` / `insert` / `update` / `upsert` / `delete`) ;
 *  - **tous les filtres** appliqués (`eq`, `is`, `in`, `not`…), dans l'ordre ;
 *  - les **lignes** envoyées à l'écriture et les **options** (`onConflict`).
 *
 * Le builder est *thenable* : il se comporte comme la promesse que renvoie supabase-js en fin de
 * chaîne, quel que soit le nombre de maillons.
 */

import { vi } from 'vitest';

/**
 * Réponse simulée d'une requête.
 *
 * `count` accompagne un `select('*', { count: 'exact' })` : c'est le total **hors pagination**, et
 * c'est ce qui permet à l'UI d'afficher un nombre de pages. Sans lui dans le double, une
 * pagination pouvait être testée sur ses bornes mais jamais sur ce qu'elle rend.
 */
export type MockResponse = { data?: unknown; error?: unknown; count?: number | null };

/** Un filtre appliqué à une requête : `is('owner_id', null)` → `['is', 'owner_id', null]`. */
export type RecordedFilter = [method: string, ...args: unknown[]];

/** Trace d'une requête émise, telle qu'un test peut l'inspecter. */
export type RecordedQuery = {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  /** Colonnes demandées (`select`), ou colonnes du `.select()` final d'une écriture. */
  columns?: string;
  /** Lignes envoyées (`insert` / `update` / `upsert`). Toujours un tableau, même pour une ligne. */
  rows?: Record<string, unknown>[];
  /** Options de l'écriture, p. ex. `{ onConflict: 'import_key' }`. */
  options?: Record<string, unknown>;
  filters: RecordedFilter[];
};

/** Clé de programmation d'une réponse : `'foods.select'`, `'foods.upsert'`… */
type ResponseKey = string;

/** Égalité structurelle, suffisante pour des arguments de filtre (scalaires, tableaux, objets plats). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;

  return ka.every(
    (k) =>
      Object.hasOwn(b as Record<string, unknown>, k) &&
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

const FILTER_METHODS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'not',
  'or',
  'contains',
  'filter',
  'match',
  'order',
  'limit',
  'range',
  'single',
  'maybeSingle',
  'returns',
  'throwOnError',
  'abortSignal',
  'csv',
] as const;

/**
 * Crée un client Supabase simulé.
 *
 * Par défaut toute requête résout `{ data: [], error: null }` — un test n'a à programmer que ce
 * qui l'intéresse. `setResponse` accepte soit une réponse fixe, soit une file : le 1ᵉʳ appel
 * consomme la 1ʳᵉ réponse, etc. (utile quand une fonction interroge deux fois la même table).
 */
export function createSupabaseMock(options?: { user?: { id: string; email?: string } | null }) {
  const queries: RecordedQuery[] = [];
  const responses = new Map<ResponseKey, MockResponse[]>();

  /** Programme la ou les réponses d'une `table.operation`. */
  function setResponse(key: ResponseKey, ...values: MockResponse[]): void {
    responses.set(key, values);
  }

  function nextResponse(key: ResponseKey): MockResponse {
    const queue = responses.get(key);
    if (!queue || queue.length === 0) return { data: [], error: null };
    // Une file d'un seul élément est « collante » : elle sert toutes les requêtes suivantes.
    return queue.length === 1 ? queue[0]! : queue.shift()!;
  }

  function makeBuilder(record: RecordedQuery) {
    const builder: Record<string, unknown> = {};

    for (const method of FILTER_METHODS) {
      builder[method] = (...args: unknown[]) => {
        record.filters.push([method, ...args]);
        return builder;
      };
    }

    // `.select()` en fin d'écriture (`insert(...).select('id')`) : on note les colonnes sans
    // changer l'opération enregistrée — c'est bien une écriture qui a eu lieu.
    builder.select = (columns?: string) => {
      record.columns = columns ?? '*';
      return builder;
    };

    builder.then = (
      onFulfilled?: (value: MockResponse) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      const response = nextResponse(`${record.table}.${record.operation}`);
      const resolved: MockResponse = {
        data: response.data ?? null,
        error: response.error ?? null,
        // `null` et non `undefined` : c'est ce que supabase-js rend quand `count` n'a pas été
        // demandé, et un appelant peut légitimement faire la différence.
        count: response.count ?? null,
      };
      return Promise.resolve(resolved).then(onFulfilled, onRejected);
    };

    return builder;
  }

  /** Normalise l'argument d'écriture en tableau de lignes. */
  const toRows = (payload: unknown): Record<string, unknown>[] =>
    Array.isArray(payload)
      ? (payload as Record<string, unknown>[])
      : [payload as Record<string, unknown>];

  const from = vi.fn((table: string) => {
    const start = (
      operation: RecordedQuery['operation'],
      payload?: unknown,
      opts?: Record<string, unknown>,
    ) => {
      const record: RecordedQuery = { table, operation, filters: [] };
      if (payload !== undefined) record.rows = toRows(payload);
      if (opts !== undefined) record.options = opts;
      queries.push(record);
      return makeBuilder(record);
    };

    return {
      select: (columns?: string) => {
        const builder = start('select');
        (builder as { select: (c?: string) => unknown }).select(columns);
        return builder;
      },
      insert: (payload: unknown) => start('insert', payload),
      update: (payload: unknown) => start('update', payload),
      upsert: (payload: unknown, opts?: Record<string, unknown>) => start('upsert', payload, opts),
      delete: () => start('delete'),
    };
  });

  const client = {
    from,
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options?.user === undefined ? { id: 'admin-1' } : options.user },
        error: null,
      })),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    },
    // Typé large : les tests programment la réponse par `mockResolvedValueOnce`, avec la forme
    // qu'attend l'appelant (`fetchUsageSummary` lit un Record de décomptes).
    rpc: vi.fn(
      async (...args: [fn: string, params?: Record<string, unknown>]): Promise<MockResponse> => {
        void args;
        return { data: null, error: null };
      },
    ),
  };

  // ── Aides d'assertion ──────────────────────────────────────────────────────

  /** Toutes les requêtes émises sur une table, optionnellement filtrées par opération. */
  const queriesOn = (table: string, operation?: RecordedQuery['operation']) =>
    queries.filter((q) => q.table === table && (operation ? q.operation === operation : true));

  /** La dernière requête émise sur `table.operation`, ou `undefined`. */
  const lastQuery = (table: string, operation?: RecordedQuery['operation']) =>
    queriesOn(table, operation).at(-1);

  /**
   * `true` si la requête porte ce filtre exact (méthode + arguments).
   *
   * Comparaison **structurelle** et non par identité : plusieurs filtres de supabase-js prennent
   * un objet d'options (`order('created_at', { ascending: false })`, `in(col, [a, b])`). Comparer
   * par référence rendrait ces assertions impossibles à écrire — et surtout, elles échoueraient en
   * silence en donnant l'impression que le filtre est absent.
   */
  const hasFilter = (query: RecordedQuery | undefined, ...expected: RecordedFilter) =>
    (query?.filters ?? []).some(
      (f) => f.length === expected.length && f.every((v, i) => deepEqual(v, expected[i])),
    );

  /** Vide la trace entre deux scénarios sans recréer le client. */
  const reset = () => {
    queries.length = 0;
    responses.clear();
    from.mockClear();
  };

  return { client, queries, queriesOn, lastQuery, hasFilter, setResponse, reset };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
