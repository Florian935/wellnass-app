/**
 * Back-office — archivage, restauration et publication des exercices éditoriaux (US ADMIN-01).
 *
 * Lot 4 de [strategie-tests.md](../../../../docs/specs/technical/strategie-tests.md).
 *
 * Trois invariants portent tout le garde-fou, et aucun ne se voit à l'écran :
 *
 *  1. **`owner_id IS NULL` sur chaque écriture.** Le back-office parle à Supabase avec la clé anon,
 *     comme un utilisateur normal. Ce filtre est ce qui empêche une action d'administration de
 *     déborder sur les exercices **créés par les utilisateurs**.
 *  2. **`status` n'est jamais touché par un archivage ni une restauration.** Archivé (`deleted_at`)
 *     et publié (`status`) sont deux notions distinctes : les mélanger republierait un brouillon
 *     par accident, silencieusement, pour tout le monde.
 *  3. **La restauration ne cible que ce qui est archivé** (`.not('deleted_at', 'is', null)`), ce
 *     qui la rend rejouable sans réécrire des lignes vivantes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseMock } from '../test-utils/supabase-mock';

const mock = createSupabaseMock();

vi.mock('../lib/supabase', () => ({ supabase: mock.client }));

const { archiveExercise, restoreExercise, setStatus } = await import('./exercises');
const { fetchUsageSummary } = await import('./usage-counts');

/** UUID valide — requis par `auditEntrySchema` (voir `foods.test.ts`). */
const EXERCISE_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  mock.reset();
});

// ---------------------------------------------------------------------------
// Archivage
// ---------------------------------------------------------------------------

describe('archiveExercise', () => {
  it('horodate l’exercice et ses traductions, en éditorial uniquement', async () => {
    const { error } = await archiveExercise(EXERCISE_ID);

    expect(error).toBeNull();

    const exercise = mock.lastQuery('exercises', 'update');
    expect(exercise?.rows?.[0]?.deleted_at).toEqual(expect.any(String));
    expect(mock.hasFilter(exercise, 'eq', 'id', EXERCISE_ID)).toBe(true);
    expect(mock.hasFilter(exercise, 'is', 'owner_id', null)).toBe(true);

    const translations = mock.lastQuery('exercise_translations', 'update');
    expect(mock.hasFilter(translations, 'eq', 'exercise_id', EXERCISE_ID)).toBe(true);
    expect(mock.hasFilter(translations, 'is', 'owner_id', null)).toBe(true);
  });

  it('ne touche PAS au statut — archiver n’est pas dépublier', async () => {
    await archiveExercise(EXERCISE_ID);

    expect(mock.lastQuery('exercises', 'update')?.rows?.[0]).not.toHaveProperty('status');
  });

  it('s’arrête avant les traductions si l’exercice échoue', async () => {
    mock.setResponse('exercises.update', { error: new Error('rls') });

    const { error } = await archiveExercise(EXERCISE_ID);

    expect(error).toBeInstanceOf(Error);
    expect(mock.queriesOn('exercise_translations')).toHaveLength(0);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('ne journalise pas si les traductions échouent', async () => {
    mock.setResponse('exercise_translations.update', { error: new Error('rls') });

    expect((await archiveExercise(EXERCISE_ID)).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('journalise l’archivage avec son libellé', async () => {
    await archiveExercise(EXERCISE_ID, { label: 'Squat barre' });

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'exercise.archive',
      target_id: EXERCISE_ID,
      target_label: 'Squat barre',
    });
  });
});

// ---------------------------------------------------------------------------
// Restauration
// ---------------------------------------------------------------------------

describe('restoreExercise', () => {
  it('remet `deleted_at` à null sans toucher au statut', async () => {
    await restoreExercise(EXERCISE_ID);

    const exercise = mock.lastQuery('exercises', 'update');
    expect(exercise?.rows?.[0]).toEqual({ deleted_at: null });
  });

  it('ne cible que les lignes archivées — la restauration est rejouable', async () => {
    await restoreExercise(EXERCISE_ID);

    expect(mock.hasFilter(mock.lastQuery('exercises', 'update'), 'not', 'deleted_at', 'is', null))
      .toBe(true);
    expect(
      mock.hasFilter(
        mock.lastQuery('exercise_translations', 'update'),
        'not',
        'deleted_at',
        'is',
        null,
      ),
    ).toBe(true);
  });

  it('reste cantonnée à l’éditorial', async () => {
    await restoreExercise(EXERCISE_ID);

    expect(mock.hasFilter(mock.lastQuery('exercises', 'update'), 'is', 'owner_id', null)).toBe(
      true,
    );
    expect(
      mock.hasFilter(mock.lastQuery('exercise_translations', 'update'), 'is', 'owner_id', null),
    ).toBe(true);
  });

  it('s’arrête et ne journalise pas en cas d’échec', async () => {
    mock.setResponse('exercises.update', { error: new Error('rls') });

    expect((await restoreExercise(EXERCISE_ID)).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('exercise_translations')).toHaveLength(0);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('journalise la restauration', async () => {
    await restoreExercise(EXERCISE_ID, { label: 'Squat barre' });

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'exercise.restore',
      target_id: EXERCISE_ID,
    });
  });
});

// ---------------------------------------------------------------------------
// Publication
// ---------------------------------------------------------------------------

describe('setStatus', () => {
  it('écrit le statut sur l’exercice éditorial visé', async () => {
    await setStatus(EXERCISE_ID, 'published');

    const update = mock.lastQuery('exercises', 'update');
    expect(update?.rows?.[0]).toEqual({ status: 'published' });
    expect(mock.hasFilter(update, 'eq', 'id', EXERCISE_ID)).toBe(true);
    expect(mock.hasFilter(update, 'is', 'owner_id', null)).toBe(true);
  });

  it('journalise la publication', async () => {
    await setStatus(EXERCISE_ID, 'published', { label: 'Squat barre' });

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'exercise.publish',
      target_label: 'Squat barre',
      details: { status: 'published' },
    });
  });

  it('ne journalise PAS une dépublication — hors périmètre assumé', async () => {
    await setStatus(EXERCISE_ID, 'draft');

    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('ne journalise pas si l’écriture a échoué', async () => {
    mock.setResponse('exercises.update', { error: new Error('rls') });

    expect((await setStatus(EXERCISE_ID, 'published')).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Décompte des usages
// ---------------------------------------------------------------------------

describe('fetchUsageSummary', () => {
  it('passe par la fonction SQL, avec le type et l’id du contenu', async () => {
    mock.client.rpc.mockResolvedValueOnce({ data: { workout_sets: 3 }, error: null });

    await fetchUsageSummary('exercise', EXERCISE_ID);

    expect(mock.client.rpc).toHaveBeenCalledWith('editorial_usage_counts', {
      p_kind: 'exercise',
      p_id: EXERCISE_ID,
    });
  });

  it('renvoie « indisponible » en cas d’erreur — jamais un zéro rassurant', async () => {
    mock.client.rpc.mockResolvedValueOnce({ data: null, error: new Error('droits') });

    const summary = await fetchUsageSummary('exercise', EXERCISE_ID);

    // Un décompte faux serait plus dangereux que pas de décompte : il donnerait confiance.
    expect(summary.unavailable).toBe(true);
    expect(summary.isUnused).toBe(false);
  });

  it('renvoie aussi « indisponible » quand la fonction ne renvoie rien', async () => {
    mock.client.rpc.mockResolvedValueOnce({ data: null, error: null });

    expect((await fetchUsageSummary('exercise', EXERCISE_ID)).unavailable).toBe(true);
  });

  it('résume les décomptes réels', async () => {
    mock.client.rpc.mockResolvedValueOnce({
      data: { workout_sets: 12, exercise_plans: 3, personal_records: 0 },
      error: null,
    });

    const summary = await fetchUsageSummary('exercise', EXERCISE_ID);

    expect(summary.unavailable).toBe(false);
    expect(summary.isUnused).toBe(false);
    expect(summary.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'workout_sets', count: 12 }),
        expect.objectContaining({ key: 'exercise_plans', count: 3 }),
      ]),
    );
  });

  it('distingue « aucun usage » de « indisponible »', async () => {
    mock.client.rpc.mockResolvedValueOnce({
      data: { workout_sets: 0, exercise_plans: 0, personal_records: 0, exercise_variants: 0 },
      error: null,
    });

    const summary = await fetchUsageSummary('exercise', EXERCISE_ID);

    expect(summary).toMatchObject({ unavailable: false, isUnused: true });
  });
});
