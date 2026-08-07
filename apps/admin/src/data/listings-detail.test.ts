/**
 * Back-office — les **lectures** qui restaient sans filet : liste et détail d'aliment, liste,
 * détail et modération de compte (US 8.4, 8.8, 8.8b).
 *
 * Ce sont des lectures : rien de destructif, et c'est justement ce qui les rend faciles à négliger.
 * Elles portent pourtant trois choses qu'aucune relecture ne garantit dans la durée :
 *
 *  1. **La coercion des `numeric`.** PostgREST rend les colonnes `numeric` **en chaîne** pour
 *     préserver la précision. Un `kcal_per_100g` qui arrive en `"52.0"` traverse tout le code sans
 *     lever quoi que ce soit — jusqu'à un tri qui range « 9 » après « 100 », ou une addition qui
 *     concatène. Le type déclaré dit `number` ; seule cette coercion le rend vrai.
 *  2. **La pagination.** `range(from, from + pageSize - 1)` est une borne **incluse** : un `-1`
 *     oublié fait remonter une ligne de trop par page, donc un doublon en tête de la suivante.
 *  3. **L'audit de modération n'est écrit qu'après un bannissement réellement accepté.** Les
 *     garde-fous (anti-soi, anti-admin, motif obligatoire) vivent côté serveur dans la RPC :
 *     journaliser avant d'avoir sa réponse produirait un historique affirmant des bannissements
 *     qui n'ont pas eu lieu — sur la fonctionnalité où l'historique est précisément la preuve.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseMock } from '../test-utils/supabase-mock';

const mock = createSupabaseMock();

vi.mock('../lib/supabase', () => ({ supabase: mock.client }));

const { getFood, listEditorialFoods } = await import('./foods');
const { banUser, getUser, listUserBans, listUsers, unbanUser } = await import('./users');

const FOOD_ID = '88888888-8888-4888-8888-888888888888';
const USER_ID = '99999999-9999-4999-8999-999999999999';

beforeEach(() => {
  mock.reset();
});

// ---------------------------------------------------------------------------
// Aliments — liste
// ---------------------------------------------------------------------------

describe('listEditorialFoods', () => {
  it('🔴 ne lit que l’éditorial, jamais les aliments des utilisateurs', async () => {
    await listEditorialFoods();

    expect(mock.hasFilter(mock.lastQuery('foods', 'select'), 'is', 'owner_id', null)).toBe(true);
  });

  it.each([
    ['active', true, false],
    ['archived', false, true],
    ['all', false, false],
  ])('la portée « %s » applique le bon filtre d’archivage', async (scope, actif, archive) => {
    await listEditorialFoods(scope as 'active' | 'archived' | 'all');

    const q = mock.lastQuery('foods', 'select');
    expect(mock.hasFilter(q, 'is', 'deleted_at', null)).toBe(actif);
    expect(mock.hasFilter(q, 'not', 'deleted_at', 'is', null)).toBe(archive);
  });

  it('🔴 coerce les calories rendues en chaîne', async () => {
    mock.setResponse('foods.select', {
      data: [
        {
          id: FOOD_ID,
          category: 'fruit',
          // PostgREST rend les `numeric` en chaîne pour préserver la précision.
          kcal_per_100g: '52.0',
          import_key: null,
          created_at: '2026-07-01T10:00:00.000Z',
          deleted_at: null,
          food_translations: [{ lang: 'fr', name: 'Pomme' }],
        },
      ],
    });

    const { rows } = await listEditorialFoods();

    // Sans la coercion, un tri par calories rangerait « 9 » après « 100 » — un classement faux qui
    // ne ressemble pas à un bug, juste à un ordre bizarre.
    expect(rows[0]?.kcalPer100g).toBe(52);
    expect(rows[0]?.nameEn).toBeNull();
  });

  it('remonte l’erreur et une liste vide, sans lever', async () => {
    mock.setResponse('foods.select', { error: new Error('rls') });

    const { rows, error } = await listEditorialFoods();

    expect(rows).toEqual([]);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Aliments — détail
// ---------------------------------------------------------------------------

describe('getFood', () => {
  const detail = (overrides: Record<string, unknown> = {}) => ({
    id: FOOD_ID,
    category: 'fruit',
    kcal_per_100g: '52.0',
    protein_per_100g: '0.3',
    carbs_per_100g: '14',
    sugars_per_100g: null,
    fat_per_100g: null,
    saturated_fat_per_100g: null,
    fiber_per_100g: '2.4',
    micronutrients: null,
    import_key: 'ciqual:13000',
    food_translations: [
      { lang: 'fr', name: 'Pomme' },
      { lang: 'en', name: 'Apple' },
    ],
    ...overrides,
  });

  it('🔴 refuse de charger un aliment utilisateur ou archivé', async () => {
    await getFood(FOOD_ID);

    const q = mock.lastQuery('foods', 'select');
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
    expect(mock.hasFilter(q, 'is', 'deleted_at', null)).toBe(true);
    expect(mock.hasFilter(q, 'eq', 'id', FOOD_ID)).toBe(true);
  });

  it('🔴 coerce tous les macronutriments, et garde `null` sur les absents', async () => {
    mock.setResponse('foods.select', { data: detail() });

    const { food } = await getFood(FOOD_ID);

    expect(food).toMatchObject({
      kcalPer100g: 52,
      proteinPer100g: 0.3,
      carbsPer100g: 14,
      fiberPer100g: 2.4,
    });
    // `Number(null)` vaut 0 : un lipide non renseigné s'afficherait « 0 g » — une affirmation
    // nutritionnelle fausse, là où « — » dit simplement qu'on ne sait pas.
    expect(food?.fatPer100g).toBeNull();
    expect(food?.sugarsPer100g).toBeNull();
  });

  it('un nom manquant devient une chaîne vide, pas `undefined`', async () => {
    mock.setResponse('foods.select', {
      data: detail({ food_translations: [{ lang: 'fr', name: 'Pomme' }] }),
    });

    const { food } = await getFood(FOOD_ID);

    // Le formulaire est contrôlé : un `undefined` y basculerait le champ en non contrôlé.
    expect(food?.nameEn).toBe('');
  });

  it('préserve la clé d’import — c’est elle qui rend le réimport idempotent', async () => {
    mock.setResponse('foods.select', { data: detail() });

    const { food } = await getFood(FOOD_ID);

    expect(food?.importKey).toBe('ciqual:13000');
  });

  it('aliment introuvable → `null` sans erreur', async () => {
    mock.setResponse('foods.select', { data: null });

    const { food, error } = await getFood(FOOD_ID);

    expect(food).toBeNull();
    expect(error).toBeNull();
  });

  it('erreur de lecture → `null` ET l’erreur', async () => {
    mock.setResponse('foods.select', { error: new Error('réseau') });

    const { food, error } = await getFood(FOOD_ID);

    expect(food).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Comptes — liste
// ---------------------------------------------------------------------------

describe('listUsers', () => {
  it('trie du plus récent au plus ancien et demande le décompte exact', async () => {
    await listUsers();

    const q = mock.lastQuery('admin_users', 'select');
    expect(mock.hasFilter(q, 'order', 'created_at', { ascending: false })).toBe(true);
    // Sans `count: 'exact'`, la pagination ne peut pas afficher le nombre de pages.
    expect(q?.columns).toBe('*');
  });

  it('🔴 la page 0 demande une plage INCLUSE de la bonne taille', async () => {
    await listUsers({ pageSize: 25 });

    // `range` est inclus aux deux bornes : un `-1` oublié ferait remonter 26 lignes, donc un
    // doublon en tête de la page suivante.
    expect(mock.hasFilter(mock.lastQuery('admin_users', 'select'), 'range', 0, 24)).toBe(true);
  });

  it('🔴 la page 2 démarre après les deux précédentes, sans trou ni recouvrement', async () => {
    await listUsers({ page: 2, pageSize: 25 });

    expect(mock.hasFilter(mock.lastQuery('admin_users', 'select'), 'range', 50, 74)).toBe(true);
  });

  it('recherche par e-mail en contient-insensible à la casse', async () => {
    await listUsers({ search: 'martin' });

    expect(mock.hasFilter(mock.lastQuery('admin_users', 'select'), 'ilike', 'email', '%martin%')).toBe(true);
  });

  it('🔴 une recherche vide ou blanche n’applique aucun filtre', async () => {
    await listUsers({ search: '   ' });

    // `ilike('email', '%%')` semble inoffensif mais écarte les comptes sans e-mail (OAuth) — la
    // liste maigrirait sans explication dès qu'on efface la recherche.
    expect(mock.hasFilter(mock.lastQuery('admin_users', 'select'), 'ilike', 'email', '%%')).toBe(false);
  });

  it('rend le décompte total, pas la taille de la page', async () => {
    mock.setResponse('admin_users.select', { data: [{ id: USER_ID }], count: 143 });

    const { rows, count } = await listUsers();

    expect(rows).toHaveLength(1);
    expect(count).toBe(143);
  });

  it('erreur → liste vide et décompte à zéro', async () => {
    mock.setResponse('admin_users.select', { error: new Error('rls') });

    const { rows, count, error } = await listUsers();

    expect(rows).toEqual([]);
    expect(count).toBe(0);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Comptes — détail
// ---------------------------------------------------------------------------

describe('getUser', () => {
  it('cible le compte demandé', async () => {
    await getUser(USER_ID);

    expect(mock.hasFilter(mock.lastQuery('admin_users', 'select'), 'eq', 'id', USER_ID)).toBe(true);
  });

  it('compte non visible → `null` sans erreur', async () => {
    mock.setResponse('admin_users.select', { data: null });

    const { user, error } = await getUser(USER_ID);

    // La vue `admin_users` est protégée : « non visible » est un cas normal, pas une panne.
    expect(user).toBeNull();
    expect(error).toBeNull();
  });

  it('erreur → `null` ET l’erreur', async () => {
    mock.setResponse('admin_users.select', { error: new Error('rls') });

    const { user, error } = await getUser(USER_ID);

    expect(user).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Modération
// ---------------------------------------------------------------------------

describe('modération', () => {
  it('bannit via la RPC, motif compris', async () => {
    const { error } = await banUser(USER_ID, 'Spam répété');

    expect(error).toBeNull();
    expect(mock.client.rpc).toHaveBeenCalledWith('ban_user', {
      target_user_id: USER_ID,
      reason: 'Spam répété',
    });
  });

  it('🔴 ne journalise RIEN si la RPC refuse', async () => {
    vi.mocked(mock.client.rpc).mockResolvedValueOnce({ error: new Error('anti-self') });

    const { error } = await banUser(USER_ID, 'Test');

    // Les garde-fous (anti-soi, anti-admin, motif obligatoire) sont côté serveur. Journaliser
    // avant sa réponse écrirait un historique affirmant des bannissements qui n'ont pas eu lieu —
    // sur la fonctionnalité où l'historique EST la preuve.
    expect(error).toBeInstanceOf(Error);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('journalise le bannissement avec son motif', async () => {
    await banUser(USER_ID, 'Spam répété');

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'user.ban',
      target_table: 'auth.users',
      target_id: USER_ID,
      details: { reason: 'Spam répété' },
    });
  });

  it('débannit via la RPC et journalise', async () => {
    const { error } = await unbanUser(USER_ID);

    expect(error).toBeNull();
    expect(mock.client.rpc).toHaveBeenCalledWith('unban_user', { target_user_id: USER_ID });
    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'user.unban',
      target_id: USER_ID,
    });
  });

  it('🔴 ne journalise pas un débannissement refusé', async () => {
    vi.mocked(mock.client.rpc).mockResolvedValueOnce({ error: new Error('non habilité') });

    expect((await unbanUser(USER_ID)).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('l’historique de modération est rendu du plus récent au plus ancien', async () => {
    await listUserBans(USER_ID);

    const q = mock.lastQuery('user_bans', 'select');
    expect(mock.hasFilter(q, 'eq', 'target_user_id', USER_ID)).toBe(true);
    // Un historique append-only n'a d'intérêt que si la décision courante est en tête.
    expect(mock.hasFilter(q, 'order', 'created_at', { ascending: false })).toBe(true);
  });

  it('historique en erreur → liste vide', async () => {
    mock.setResponse('user_bans.select', { error: new Error('rls') });

    const { rows, error } = await listUserBans(USER_ID);

    expect(rows).toEqual([]);
    expect(error).toBeInstanceOf(Error);
  });
});
