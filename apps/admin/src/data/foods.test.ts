/**
 * Back-office — couche data des aliments éditoriaux.
 *
 * Lot 4 de [strategie-tests.md](../../../../docs/specs/technical/strategie-tests.md), et **premier
 * test de `apps/admin`** : jusqu'ici, 9 716 lignes sans le moindre filet.
 *
 * Pourquoi commencer ici : l'admin écrit dans le **contenu partagé par tous les utilisateurs**.
 * Une erreur ne casse pas un compte, elle en casse des milliers — et l'import d'aliments est
 * l'opération qui écrit le plus de lignes d'un coup. Deux garde-fous s'y jouent :
 *
 *  1. **le filtre éditorial** (`owner_id IS NULL`) sur chaque écriture. Sans lui, une mise à jour
 *     ou un archivage déborderait sur les aliments **créés par les utilisateurs** ;
 *  2. **le décompte réactivé** (US ADMIN-01, D7). `import_key` étant unique, l'upsert mettait à
 *     jour une ligne archivée sans remettre `deleted_at` à null : l'aliment restait invisible
 *     partout et le rapport annonçait un succès. L'admin croyait avoir réimporté — il n'en était
 *     rien. Le bug est corrigé ; rien ne l'empêchait de revenir.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseMock } from '../test-utils/supabase-mock';

const mock = createSupabaseMock();

vi.mock('../lib/supabase', () => ({ supabase: mock.client }));

const { archiveFood, buildCsvTemplate, importFoods, restoreFood, saveFood } = await import(
  './foods'
);

/**
 * Identifiant d'aliment utilisé par les scénarios d'édition.
 *
 * ⚠️ Doit être un **UUID valide** : `auditEntrySchema` (`@wellness/shared`) valide `targetId` en
 * `z.string().uuid()`, et `logAudit` est best-effort — un id non conforme n'échoue pas, il fait
 * simplement disparaître l'entrée d'audit. Un identifiant fantaisiste ici rendrait donc les
 * assertions d'audit vertes pour la mauvaise raison.
 */
const FOOD_ID = '11111111-1111-4111-8111-111111111111';

/** Un enregistrement d'import valide (déjà passé par `parseFoodCsv`). */
const record = (importKey: string, nameFr = 'Pomme crue') => ({
  importKey,
  nameFr,
  nameEn: 'Raw apple',
  category: 'fruits' as const,
  kcalPer100g: 52,
  proteinPer100g: 0.3,
  carbsPer100g: 14,
  sugarsPer100g: 10,
  fatPer100g: 0.2,
  saturatedFatPer100g: 0,
  fiberPer100g: 2.4,
  micronutrients: { sodium_mg: 1 },
});

/** Formulaire d'aliment valide. */
const form = (overrides?: Record<string, unknown>) => ({
  nameFr: 'Pomme crue',
  nameEn: 'Raw apple',
  category: 'fruits' as const,
  kcalPer100g: 52,
  proteinPer100g: 0.3,
  carbsPer100g: 14,
  sugarsPer100g: 10,
  fatPer100g: 0.2,
  saturatedFatPer100g: 0,
  fiberPer100g: 2.4,
  micronutrients: {},
  ...overrides,
});

beforeEach(() => {
  mock.reset();
});

// ---------------------------------------------------------------------------
// Modèle CSV
// ---------------------------------------------------------------------------

describe('buildCsvTemplate', () => {
  it('produit un en-tête et une ligne d’exemple de même largeur', () => {
    const [header, example] = buildCsvTemplate().trim().split('\n');

    expect(header!.split(',').length).toBe(example!.split(',').length);
  });

  it('commence par les colonnes obligatoires, dans l’ordre attendu', () => {
    const header = buildCsvTemplate().split('\n')[0]!.split(',');

    expect(header.slice(0, 5)).toEqual([
      'import_key',
      'name_fr',
      'name_en',
      'category',
      'kcal_per_100g',
    ]);
  });

  it('inclut les colonnes de micronutriments', () => {
    const header = buildCsvTemplate().split('\n')[0]!;

    expect(header).toContain('sodium_mg');
    expect(header).toContain('vitamin_c_mg');
  });
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

describe('importFoods', () => {
  /** Programme la lecture des clés existantes puis le retour de l'upsert. */
  function programImport(
    existing: { import_key: string; deleted_at: string | null }[],
    keys: string[],
  ): void {
    mock.setResponse('foods.select', { data: existing });
    mock.setResponse('foods.upsert', {
      data: keys.map((k, i) => ({ id: `id-${i}`, import_key: k })),
    });
  }

  it('compte comme créés les aliments dont la clé est inconnue', async () => {
    programImport([], ['A', 'B']);

    const result = await importFoods([record('A'), record('B')]);

    expect(result).toEqual({ created: 2, updated: 0, reactivated: 0 });
  });

  it('compte comme mis à jour ceux dont la clé existe et n’est pas archivée', async () => {
    programImport([{ import_key: 'A', deleted_at: null }], ['A']);

    expect(await importFoods([record('A')])).toEqual({
      created: 0,
      updated: 1,
      reactivated: 0,
    });
  });

  it('compte à part les aliments ARCHIVÉS remis en service (US ADMIN-01, D7)', async () => {
    programImport(
      [
        { import_key: 'A', deleted_at: '2026-01-01T00:00:00Z' },
        { import_key: 'B', deleted_at: null },
      ],
      ['A', 'B', 'C'],
    );

    const result = await importFoods([record('A'), record('B'), record('C')]);

    // Sans ce troisième compteur, « A » était rapporté comme mis à jour alors qu'il restait
    // invisible partout : l'admin croyait avoir réimporté.
    expect(result).toEqual({ created: 1, updated: 1, reactivated: 1 });
  });

  it('remet `deleted_at` à null — un aliment importé est vivant par définition', async () => {
    programImport([{ import_key: 'A', deleted_at: '2026-01-01T00:00:00Z' }], ['A']);

    await importFoods([record('A')]);

    const upsert = mock.lastQuery('foods', 'upsert');
    expect(upsert?.rows?.[0]).toMatchObject({ deleted_at: null });
  });

  it('n’écrit que de l’éditorial (`owner_id: null`, `source: "library"`)', async () => {
    programImport([], ['A']);

    await importFoods([record('A')]);

    expect(mock.lastQuery('foods', 'upsert')?.rows?.[0]).toMatchObject({
      owner_id: null,
      source: 'library',
      import_key: 'A',
    });
  });

  it('dédoublonne le rapport quand une clé apparaît deux fois dans le CSV', async () => {
    programImport([], ['A', 'A']);

    expect(await importFoods([record('A'), record('A', 'Pomme')])).toEqual({
      created: 1,
      updated: 0,
      reactivated: 0,
    });
  });

  it('upsert sur `import_key` — c’est ce qui rend l’import rejouable', async () => {
    programImport([], ['A']);

    await importFoods([record('A')]);

    expect(mock.lastQuery('foods', 'upsert')?.options).toEqual({ onConflict: 'import_key' });
  });

  it('écrit les deux traductions par aliment, sur la clé (food_id, lang)', async () => {
    programImport([], ['A']);

    await importFoods([record('A')]);

    const upsert = mock.lastQuery('food_translations', 'upsert');
    expect(upsert?.options).toEqual({ onConflict: 'food_id,lang' });
    expect(upsert?.rows).toEqual([
      expect.objectContaining({ food_id: 'id-0', lang: 'fr', name: 'Pomme crue', owner_id: null }),
      expect.objectContaining({ food_id: 'id-0', lang: 'en', name: 'Raw apple', owner_id: null }),
    ]);
  });

  it('n’écrit aucune traduction orpheline si l’upsert n’a pas renvoyé l’aliment', async () => {
    mock.setResponse('foods.select', { data: [] });
    mock.setResponse('foods.upsert', { data: [] }); // aucun id remonté

    await importFoods([record('A')]);

    expect(mock.lastQuery('food_translations', 'upsert')?.rows).toEqual([]);
  });

  it('journalise un import vide sans toucher à la base', async () => {
    expect(await importFoods([])).toEqual({ created: 0, updated: 0, reactivated: 0 });

    expect(mock.queriesOn('foods')).toHaveLength(0);
    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'food.import',
    });
  });

  it('lève si la lecture des clés existantes échoue — pas d’import à l’aveugle', async () => {
    mock.setResponse('foods.select', { error: new Error('réseau') });

    await expect(importFoods([record('A')])).rejects.toThrow('réseau');
    expect(mock.queriesOn('foods', 'upsert')).toHaveLength(0);
  });

  it('lève si l’upsert des aliments échoue', async () => {
    mock.setResponse('foods.select', { data: [] });
    mock.setResponse('foods.upsert', { error: new Error('rls') });

    await expect(importFoods([record('A')])).rejects.toThrow('rls');
  });

  it('lève si l’upsert des traductions échoue, sans journaliser un faux succès', async () => {
    programImport([], ['A']);
    mock.setResponse('food_translations.upsert', { error: new Error('rls') });

    await expect(importFoods([record('A')])).rejects.toThrow('rls');
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('journalise le rapport détaillé en cas de succès', async () => {
    programImport([{ import_key: 'A', deleted_at: '2026-01-01T00:00:00Z' }], ['A', 'B']);

    await importFoods([record('A'), record('B')]);

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'food.import',
      details: { count: 2, created: 1, updated: 0, reactivated: 1 },
    });
  });
});

// ---------------------------------------------------------------------------
// Écriture unitaire
// ---------------------------------------------------------------------------

describe('saveFood', () => {
  it('crée un aliment éditorial et ses deux traductions', async () => {
    const { id, error } = await saveFood(form());

    expect(error).toBeNull();
    expect(id).toBeTruthy();
    expect(mock.lastQuery('foods', 'insert')?.rows?.[0]).toMatchObject({
      owner_id: null,
      source: 'library',
      category: 'fruits',
      kcal_per_100g: 52,
    });
    expect(mock.queriesOn('food_translations', 'upsert')).toHaveLength(2);
  });

  it('met à jour en ciblant l’id ET l’éditorial — jamais l’aliment d’un utilisateur', async () => {
    await saveFood({ ...form(), id: FOOD_ID });

    const update = mock.lastQuery('foods', 'update');
    expect(mock.hasFilter(update, 'eq', 'id', FOOD_ID)).toBe(true);
    expect(mock.hasFilter(update, 'is', 'owner_id', null)).toBe(true);
  });

  it('n’écrit pas les traductions si la ligne aliment a échoué', async () => {
    mock.setResponse('foods.insert', { error: new Error('rls') });

    const { id, error } = await saveFood(form());

    expect(id).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(mock.queriesOn('food_translations')).toHaveLength(0);
  });

  it('renvoie l’id malgré un échec de traduction, pour permettre un ré-essai', async () => {
    mock.setResponse('food_translations.upsert', { error: new Error('rls') });

    const { id, error } = await saveFood(form());

    expect(id).toBeTruthy();
    expect(error).toBeInstanceOf(Error);
  });

  it('ne journalise qu’en succès complet', async () => {
    mock.setResponse('food_translations.upsert', { error: new Error('rls') });

    await saveFood(form());

    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('journalise `food.create` ou `food.update` selon le cas', async () => {
    await saveFood(form());
    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'food.create',
      target_label: 'Pomme crue',
    });

    mock.reset();
    await saveFood({ ...form(), id: FOOD_ID });
    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'food.update',
    });
  });
});

// ---------------------------------------------------------------------------
// Archivage / restauration
// ---------------------------------------------------------------------------

describe('archiveFood', () => {
  it('horodate l’aliment ET ses traductions, en éditorial seulement', async () => {
    await archiveFood(FOOD_ID);

    const food = mock.lastQuery('foods', 'update');
    expect(food?.rows?.[0]?.deleted_at).toEqual(expect.any(String));
    expect(mock.hasFilter(food, 'eq', 'id', FOOD_ID)).toBe(true);
    expect(mock.hasFilter(food, 'is', 'owner_id', null)).toBe(true);

    const translations = mock.lastQuery('food_translations', 'update');
    expect(mock.hasFilter(translations, 'eq', 'food_id', FOOD_ID)).toBe(true);
    expect(mock.hasFilter(translations, 'is', 'owner_id', null)).toBe(true);
  });

  it('n’archive pas les traductions si l’aliment a échoué', async () => {
    mock.setResponse('foods.update', { error: new Error('rls') });

    const { error } = await archiveFood(FOOD_ID);

    expect(error).toBeInstanceOf(Error);
    expect(mock.queriesOn('food_translations')).toHaveLength(0);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('journalise avec le libellé fourni', async () => {
    await archiveFood(FOOD_ID, { label: 'Pomme crue' });

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'food.archive',
      target_id: FOOD_ID,
      target_label: 'Pomme crue',
    });
  });
});

describe('restoreFood', () => {
  it('ne restaure QUE ce qui est archivé — la garde rend l’opération idempotente', async () => {
    await restoreFood(FOOD_ID);

    const food = mock.lastQuery('foods', 'update');
    expect(food?.rows?.[0]).toMatchObject({ deleted_at: null });
    expect(mock.hasFilter(food, 'not', 'deleted_at', 'is', null)).toBe(true);
    expect(mock.hasFilter(food, 'is', 'owner_id', null)).toBe(true);
  });

  it('restaure aussi les traductions', async () => {
    await restoreFood(FOOD_ID);

    const translations = mock.lastQuery('food_translations', 'update');
    expect(translations?.rows?.[0]).toMatchObject({ deleted_at: null });
    expect(mock.hasFilter(translations, 'not', 'deleted_at', 'is', null)).toBe(true);
  });

  it('s’arrête et ne journalise pas si la restauration de l’aliment échoue', async () => {
    mock.setResponse('foods.update', { error: new Error('rls') });

    expect((await restoreFood(FOOD_ID)).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('food_translations')).toHaveLength(0);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });
});
