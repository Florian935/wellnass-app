/**
 * Back-office — liens éditoriaux « variantes / alternatives » entre exercices
 * (US MUSC-F10c-2). Fichier de 172 lignes qui n'avait **aucun test** : 0 % de couverture,
 * le plus gros trou de `apps/admin/src/data` au 04/08/2026.
 *
 * Ce que ces liens ont de particulier, et qui justifie de les tester plutôt que de s'en remettre
 * à une recette navigateur : ils vivent dans le **contenu partagé par tous les utilisateurs**, et
 * la table est indexée sur une **paire canonique** (`exercise_id_a < exercise_id_b`) avec un unique
 * `(owner_id, a, b) nulls not distinct`. Trois défauts y sont invisibles à l'écran :
 *
 *  1. **oublier `owner_id IS NULL`** → l'admin lirait ou écraserait les liens **personnels** des
 *     utilisateurs, créés depuis le mobile. Une fuite de données privées dans un écran d'admin.
 *  2. **oublier la canonisation de la paire** → un second lien A↔B inséré à l'envers viole l'unique,
 *     ou pire passe et crée un doublon que la lecture montrera deux fois.
 *  3. **insérer au lieu de réactiver** une ligne soft-deletée → violation de l'unique, donc un lien
 *     qu'on ne peut plus jamais recréer après l'avoir retiré une fois.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseMock } from '../test-utils/supabase-mock';

const mock = createSupabaseMock();

vi.mock('../lib/supabase', () => ({ supabase: mock.client }));

// `./audit` n'est **pas** mocké, volontairement : comme `admin-users.test.ts`, on observe la ligne
// réellement insérée dans `audit_log` via le double Supabase. Ça vérifie non seulement qu'on
// journalise, mais qu'on journalise la bonne action sur la bonne cible.
const {
  listVariants,
  listLinkableExercises,
  addEditorialVariant,
  removeEditorialVariant,
} = await import('./exercise-variants');

// UUID v4 valides et ORDONNÉS : 'aaaa…' < 'bbbb…' < 'cccc…' en comparaison lexicographique, ce
// qui rend les attentes sur la paire canonique lisibles.
const A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const LINK = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';

beforeEach(() => {
  mock.reset();
});

// ---------------------------------------------------------------------------
// listVariants — lecture d'une paire, quel que soit le côté
// ---------------------------------------------------------------------------

describe('listVariants', () => {
  it('résout « l’autre » exercice de la paire, que l’exercice courant soit en a ou en b', async () => {
    // C'est tout l'enjeu d'une table à paire canonique : l'exercice consulté peut se trouver
    // indifféremment dans la colonne a ou b, et l'écran doit toujours afficher l'AUTRE.
    mock.setResponse('exercise_variants.select', {
      data: [
        { id: LINK, exercise_id_a: A, exercise_id_b: B },
        { id: 'link-2', exercise_id_a: C, exercise_id_b: A },
      ],
      error: null,
    });
    mock.setResponse('exercise_translations.select', {
      data: [
        { exercise_id: B, name: 'Développé incliné' },
        { exercise_id: C, name: 'Aération' },
      ],
      error: null,
    });

    const { variants, error } = await listVariants(A);

    expect(error).toBeNull();
    // Tri par nom FR : « Aération » avant « Développé incliné ».
    expect(variants).toEqual([
      { linkId: 'link-2', otherId: C, nameFr: 'Aération' },
      { linkId: LINK, otherId: B, nameFr: 'Développé incliné' },
    ]);
  });

  it('ne lit que les liens ÉDITORIAUX et vivants', async () => {
    await listVariants(A);

    const q = mock.lastQuery('exercise_variants', 'select');
    // `owner_id IS NULL` : sans ce filtre, l'écran d'admin afficherait les liens PERSONNELS
    // des utilisateurs, créés depuis le mobile.
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
    expect(mock.hasFilter(q, 'is', 'deleted_at', null)).toBe(true);
  });

  it('interroge les deux colonnes de la paire', async () => {
    await listVariants(A);
    const q = mock.lastQuery('exercise_variants', 'select');
    expect(mock.hasFilter(q, 'or', `exercise_id_a.eq.${A},exercise_id_b.eq.${A}`)).toBe(true);
  });

  it('rend un nom null plutôt que de masquer un lien sans traduction FR', async () => {
    // Un lien vers un exercice sans libellé français doit rester visible : le masquer donnerait
    // un décompte faux et rendrait le lien impossible à retirer depuis l'écran.
    mock.setResponse('exercise_variants.select', {
      data: [{ id: LINK, exercise_id_a: A, exercise_id_b: B }],
      error: null,
    });
    mock.setResponse('exercise_translations.select', { data: [], error: null });

    const { variants } = await listVariants(A);
    expect(variants).toEqual([{ linkId: LINK, otherId: B, nameFr: null }]);
  });

  it('n’interroge pas les traductions quand il n’y a aucun lien', async () => {
    mock.setResponse('exercise_variants.select', { data: [], error: null });

    const { variants, error } = await listVariants(A);

    expect(variants).toEqual([]);
    expect(error).toBeNull();
    expect(mock.queriesOn('exercise_translations')).toHaveLength(0);
  });

  it('remonte l’erreur de lecture des liens sans lister quoi que ce soit', async () => {
    mock.setResponse('exercise_variants.select', { data: null, error: { message: 'rls' } });

    const { variants, error } = await listVariants(A);

    expect(variants).toEqual([]);
    expect(error).toEqual({ message: 'rls' });
  });

  it('remonte l’erreur de lecture des traductions', async () => {
    mock.setResponse('exercise_variants.select', {
      data: [{ id: LINK, exercise_id_a: A, exercise_id_b: B }],
      error: null,
    });
    mock.setResponse('exercise_translations.select', { data: null, error: { message: 'boom' } });

    const { variants, error } = await listVariants(A);

    // Une liste partielle serait pire qu'une erreur : l'admin croirait le lien absent.
    expect(variants).toEqual([]);
    expect(error).toEqual({ message: 'boom' });
  });
});

// ---------------------------------------------------------------------------
// listLinkableExercises — le vivier proposé à la liaison
// ---------------------------------------------------------------------------

describe('listLinkableExercises', () => {
  const row = (id: string, nameFr: string | null) => ({
    id,
    exercise_translations: nameFr === null ? [] : [{ lang: 'fr', name: nameFr }],
  });

  it('exclut l’exercice courant et les liens déjà posés', async () => {
    mock.setResponse('exercises.select', {
      data: [row(B, 'Bravo'), row(C, 'Charlie')],
      error: null,
    });

    const { rows, error } = await listLinkableExercises(A, [C]);

    expect(error).toBeNull();
    expect(rows).toEqual([{ id: B, nameFr: 'Bravo' }]);
    // L'exercice courant est exclu côté requête (`neq`), les déjà-liés côté client.
    expect(mock.hasFilter(mock.lastQuery('exercises', 'select'), 'neq', 'id', A)).toBe(true);
  });

  it('ne propose que la bibliothèque publiée et vivante', async () => {
    await listLinkableExercises(A, []);

    const q = mock.lastQuery('exercises', 'select');
    // Un brouillon éditorial ne doit jamais être proposé : il n'est pas synchronisé au mobile,
    // le lien pointerait donc dans le vide pour les utilisateurs.
    expect(mock.hasFilter(q, 'eq', 'status', 'published')).toBe(true);
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
    expect(mock.hasFilter(q, 'is', 'deleted_at', null)).toBe(true);
  });

  it('trie par nom FR et tolère un exercice sans traduction', async () => {
    mock.setResponse('exercises.select', {
      data: [row(C, 'Zèbre'), row(B, null), row(A, 'Alpha')],
      error: null,
    });

    const { rows } = await listLinkableExercises('autre-id', []);

    // Les sans-nom (`''` à la comparaison) remontent en tête plutôt que de disparaître.
    expect(rows).toEqual([
      { id: B, nameFr: null },
      { id: A, nameFr: 'Alpha' },
      { id: C, nameFr: 'Zèbre' },
    ]);
  });

  it('ignore les traductions non françaises', async () => {
    mock.setResponse('exercises.select', {
      data: [{ id: B, exercise_translations: [{ lang: 'en', name: 'Incline press' }] }],
      error: null,
    });

    const { rows } = await listLinkableExercises(A, []);
    expect(rows).toEqual([{ id: B, nameFr: null }]);
  });

  it('tolère une relation absente de la réponse', async () => {
    mock.setResponse('exercises.select', { data: [{ id: B }], error: null });
    const { rows } = await listLinkableExercises(A, []);
    expect(rows).toEqual([{ id: B, nameFr: null }]);
  });

  it('remonte l’erreur sans vivier', async () => {
    mock.setResponse('exercises.select', { data: null, error: { message: 'nope' } });

    const { rows, error } = await listLinkableExercises(A, []);

    expect(rows).toEqual([]);
    expect(error).toEqual({ message: 'nope' });
  });
});

// ---------------------------------------------------------------------------
// addEditorialVariant — canonisation + réactivation
// ---------------------------------------------------------------------------

describe('addEditorialVariant', () => {
  it('canonise la paire : lier B↔A écrit exactement comme lier A↔B', async () => {
    // Sans canonisation, la seconde liaison violerait l'unique `(owner_id, a, b)` — ou créerait
    // un doublon que la lecture afficherait deux fois.
    mock.setResponse('exercise_variants.select', { data: null, error: null });
    mock.setResponse('exercise_variants.insert', { data: { id: LINK }, error: null });

    await addEditorialVariant(B, A);

    const inserted = mock.lastQuery('exercise_variants', 'insert');
    expect(inserted?.rows).toEqual([{ owner_id: null, exercise_id_a: A, exercise_id_b: B }]);
  });

  it('réactive une ligne soft-deletée au lieu d’insérer un doublon', async () => {
    // Le cas qui casse durablement : après un retrait, la ligne existe encore (soft delete).
    // Insérer violerait l'unique, et le lien serait alors impossible à recréer — jamais.
    mock.setResponse('exercise_variants.select', {
      data: { id: LINK, deleted_at: '2026-08-01T10:00:00Z' },
      error: null,
    });

    const { error } = await addEditorialVariant(A, B);

    expect(error).toBeNull();
    expect(mock.queriesOn('exercise_variants', 'insert')).toHaveLength(0);
    const updated = mock.lastQuery('exercise_variants', 'update');
    expect(updated?.rows).toEqual([{ deleted_at: null }]);
    expect(mock.hasFilter(updated, 'eq', 'id', LINK)).toBe(true);
  });

  it('cherche la ligne existante sur la paire canonique ET owner_id null', async () => {
    mock.setResponse('exercise_variants.select', { data: null, error: null });
    mock.setResponse('exercise_variants.insert', { data: { id: LINK }, error: null });

    await addEditorialVariant(B, A);

    const q = mock.queriesOn('exercise_variants', 'select').at(0);
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
    expect(mock.hasFilter(q, 'eq', 'exercise_id_a', A)).toBe(true);
    expect(mock.hasFilter(q, 'eq', 'exercise_id_b', B)).toBe(true);
  });

  it('journalise le lien créé', async () => {
    mock.setResponse('exercise_variants.select', { data: null, error: null });
    mock.setResponse('exercise_variants.insert', { data: { id: LINK }, error: null });

    await addEditorialVariant(A, B);

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'exercise_variant.link',
      target_table: 'exercise_variants',
      target_id: LINK,
    });
  });

  it('journalise la réactivation avec l’identifiant du lien réactivé', async () => {
    mock.setResponse('exercise_variants.select', { data: { id: LINK, deleted_at: null }, error: null });

    await addEditorialVariant(A, B);

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'exercise_variant.link',
      target_table: 'exercise_variants',
      target_id: LINK,
    });
  });

  it('n’écrit rien et ne journalise pas si la recherche échoue', async () => {
    mock.setResponse('exercise_variants.select', { data: null, error: { message: 'rls' } });

    const { error } = await addEditorialVariant(A, B);

    expect(error).toEqual({ message: 'rls' });
    expect(mock.queriesOn('exercise_variants', 'insert')).toHaveLength(0);
    expect(mock.queriesOn('exercise_variants', 'update')).toHaveLength(0);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('ne journalise pas une insertion en échec', async () => {
    mock.setResponse('exercise_variants.select', { data: null, error: null });
    mock.setResponse('exercise_variants.insert', { data: null, error: { message: 'unique' } });

    const { error } = await addEditorialVariant(A, B);

    expect(error).toEqual({ message: 'unique' });
    // Un audit sans écriture réelle est un faux témoignage dans le journal d'admin.
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('ne journalise pas une réactivation en échec', async () => {
    mock.setResponse('exercise_variants.select', {
      data: { id: LINK, deleted_at: '2026-08-01T10:00:00Z' },
      error: null,
    });
    mock.setResponse('exercise_variants.update', { data: null, error: { message: 'rls' } });

    const { error } = await addEditorialVariant(A, B);

    expect(error).toEqual({ message: 'rls' });
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// removeEditorialVariant — soft delete borné à l'éditorial
// ---------------------------------------------------------------------------

describe('removeEditorialVariant', () => {
  it('soft-delete le lien, sans jamais toucher un lien personnel', async () => {
    const { error } = await removeEditorialVariant(LINK);

    expect(error).toBeNull();
    const q = mock.lastQuery('exercise_variants', 'update');
    expect(mock.hasFilter(q, 'eq', 'id', LINK)).toBe(true);
    // `owner_id IS NULL` sur un UPDATE d'admin : la garde qui empêche de supprimer le lien
    // personnel d'un utilisateur si un identifiant se trompait de portée.
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
    expect(q?.rows?.[0]).toMatchObject({ deleted_at: expect.any(String) });
  });

  it('journalise le retrait', async () => {
    await removeEditorialVariant(LINK);

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'exercise_variant.unlink',
      target_table: 'exercise_variants',
      target_id: LINK,
    });
  });

  it('ne journalise pas un retrait en échec', async () => {
    mock.setResponse('exercise_variants.update', { data: null, error: { message: 'rls' } });

    const { error } = await removeEditorialVariant(LINK);

    expect(error).toEqual({ message: 'rls' });
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });
});
