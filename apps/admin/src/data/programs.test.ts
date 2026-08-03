/**
 * Back-office — couche data des programmes éditoriaux (le plus gros fichier de l'admin, 1 140 l.).
 *
 * Lot 4 de [strategie-tests.md](../../../../docs/specs/technical/strategie-tests.md).
 *
 * Ce qui se joue ici, et qui n'existe nulle part ailleurs dans le projet : **l'archivage et la
 * restauration sont des cascades séquentielles sur 5 tables, sans transaction**. supabase-js
 * n'offre pas de transaction côté client — chaque étape est un aller-retour réseau indépendant, et
 * n'importe laquelle peut échouer.
 *
 * Trois propriétés compensent cette absence, et ce sont elles qu'on teste :
 *
 *  1. **L'ordre.** L'archivage descend (plans → séances → traductions → entête), la restauration
 *     remonte (entête → traductions → séances → plans). Ce n'est pas un détail de style : un arrêt
 *     en cours de route ne doit jamais laisser un enfant vivant sous un parent mort, ni l'inverse.
 *     Inverser une étape produit un état incohérent que rien ne signale.
 *  2. **L'idempotence.** `.is('deleted_at', null)` à l'archivage, `.not('deleted_at','is',null)` à
 *     la restauration : l'UI doit pouvoir **retenter** après une erreur réseau sans réécrire les
 *     lignes déjà traitées ni ressusciter ce qui ne doit pas l'être.
 *  3. **L'arrêt net.** À la première erreur on s'arrête, et surtout **on ne journalise pas** — un
 *     `program.archive` dans l'audit alors que la moitié des lignes sont vivantes est pire que pas
 *     d'entrée du tout.
 *
 * Aucune de ces trois propriétés ne se voit dans le navigateur : l'écran affiche « archivé » dès
 * que l'entête l'est.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseMock } from '../test-utils/supabase-mock';

const mock = createSupabaseMock();

vi.mock('../lib/supabase', () => ({ supabase: mock.client }));

const {
  addExercisePlan,
  addSession,
  archiveProgram,
  createEditorialProgram,
  removeSession,
  reorderSessions,
  restoreProgram,
  setStatus,
  updateProgramMeta,
} = await import('./programs');

/** UUID valides — `auditEntrySchema` valide `targetId` en `z.string().uuid()` (cf. `foods.test.ts`). */
const PROGRAM_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_A = '44444444-4444-4444-8444-444444444444';
const SESSION_B = '55555555-5555-4555-8555-555555555555';

/** Ordre des tables écrites, dans la séquence réelle des appels. */
const writeOrder = () =>
  mock.queries.filter((q) => q.operation === 'update').map((q) => q.table);

beforeEach(() => {
  mock.reset();
});

// ---------------------------------------------------------------------------
// Archivage
// ---------------------------------------------------------------------------

describe('archiveProgram', () => {
  /** Programme à deux séances. */
  const withSessions = () =>
    mock.setResponse('sessions.select', { data: [{ id: SESSION_A }, { id: SESSION_B }] });

  it('descend du plus fin vers l’entête — jamais d’enfant vivant sous un parent mort', async () => {
    withSessions();

    const { error } = await archiveProgram(PROGRAM_ID);

    expect(error).toBeNull();
    expect(writeOrder()).toEqual([
      'exercise_plans',
      'session_intervals',
      'sessions',
      'program_translations',
      'programs',
    ]);
  });

  it('horodate chaque niveau et reste cantonné à l’éditorial', async () => {
    withSessions();

    await archiveProgram(PROGRAM_ID);

    for (const table of ['exercise_plans', 'sessions', 'program_translations', 'programs']) {
      const query = mock.lastQuery(table, 'update');
      expect(query?.rows?.[0]?.deleted_at).toEqual(expect.any(String));
      expect(mock.hasFilter(query, 'is', 'owner_id', null)).toBe(true);
    }
  });

  it('ne cible que les lignes vivantes — un retry ne réécrit rien', async () => {
    withSessions();

    await archiveProgram(PROGRAM_ID);

    for (const table of ['exercise_plans', 'sessions', 'program_translations', 'programs']) {
      expect(mock.hasFilter(mock.lastQuery(table, 'update'), 'is', 'deleted_at', null)).toBe(true);
    }
  });

  it('borne les enfants aux séances du programme', async () => {
    withSessions();

    await archiveProgram(PROGRAM_ID);

    const plans = mock.lastQuery('exercise_plans', 'update');
    expect(plans?.filters).toContainEqual(['in', 'session_id', [SESSION_A, SESSION_B]]);
  });

  it('archive aussi les blocs fractionné (US RUN-F2c)', async () => {
    withSessions();

    await archiveProgram(PROGRAM_ID);

    const intervals = mock.lastQuery('session_intervals', 'update');
    expect(intervals?.rows?.[0]?.deleted_at).toEqual(expect.any(String));
    expect(intervals?.filters).toContainEqual(['in', 'session_id', [SESSION_A, SESSION_B]]);
  });

  it('saute les enfants quand le programme n’a aucune séance', async () => {
    mock.setResponse('sessions.select', { data: [] });

    await archiveProgram(PROGRAM_ID);

    expect(writeOrder()).toEqual(['sessions', 'program_translations', 'programs']);
  });

  it('ne touche à RIEN si la lecture des séances échoue', async () => {
    mock.setResponse('sessions.select', { error: new Error('réseau') });

    expect((await archiveProgram(PROGRAM_ID)).error).toBeInstanceOf(Error);
    expect(writeOrder()).toEqual([]);
  });

  it('s’arrête à la première erreur, sans remonter la cascade', async () => {
    withSessions();
    mock.setResponse('sessions.update', { error: new Error('rls') });

    expect((await archiveProgram(PROGRAM_ID)).error).toBeInstanceOf(Error);
    // Les plans sont partis, l'entête ne doit PAS l'être : l'UI retentera.
    expect(writeOrder()).toEqual(['exercise_plans', 'session_intervals', 'sessions']);
    expect(mock.queriesOn('programs', 'update')).toHaveLength(0);
  });

  it('ne journalise pas un archivage à moitié fait', async () => {
    withSessions();
    mock.setResponse('program_translations.update', { error: new Error('rls') });

    await archiveProgram(PROGRAM_ID);

    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('journalise en succès complet', async () => {
    withSessions();

    await archiveProgram(PROGRAM_ID, { label: 'Full body 3j' });

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'program.archive',
      target_id: PROGRAM_ID,
      target_label: 'Full body 3j',
    });
  });
});

// ---------------------------------------------------------------------------
// Restauration
// ---------------------------------------------------------------------------

describe('restoreProgram', () => {
  const withSessions = () =>
    mock.setResponse('sessions.select', { data: [{ id: SESSION_A }] });

  it('remonte de l’entête vers le plus fin — miroir exact de l’archivage', async () => {
    withSessions();

    const { error } = await restoreProgram(PROGRAM_ID);

    expect(error).toBeNull();
    expect(writeOrder()).toEqual([
      'programs',
      'program_translations',
      'sessions',
      'exercise_plans',
      'session_intervals',
    ]);
  });

  it('ne ressuscite QUE ce qui est archivé', async () => {
    withSessions();

    await restoreProgram(PROGRAM_ID);

    for (const table of [
      'programs',
      'program_translations',
      'sessions',
      'exercise_plans',
      'session_intervals',
    ]) {
      const query = mock.lastQuery(table, 'update');
      expect(query?.rows?.[0]).toMatchObject({ deleted_at: null });
      expect(mock.hasFilter(query, 'not', 'deleted_at', 'is', null)).toBe(true);
    }
  });

  it('ne touche JAMAIS au statut — un programme restauré retrouve son état d’avant', async () => {
    withSessions();

    await restoreProgram(PROGRAM_ID);

    // Mélanger `deleted_at` et `status` republierait un brouillon par accident, pour tout le monde.
    expect(mock.lastQuery('programs', 'update')?.rows?.[0]).not.toHaveProperty('status');
  });

  it('relit les séances SANS filtre sur `deleted_at`', async () => {
    withSessions();

    await restoreProgram(PROGRAM_ID);

    // Volontaire : on veut les séances du programme quel que soit leur état, pour ressusciter
    // celles qui étaient archivées et laisser les autres tranquilles.
    const read = mock.lastQuery('sessions', 'select');
    expect(mock.hasFilter(read, 'is', 'deleted_at', null)).toBe(false);
    expect(mock.hasFilter(read, 'eq', 'program_id', PROGRAM_ID)).toBe(true);
  });

  it('s’arrête à la première erreur sans descendre plus bas', async () => {
    mock.setResponse('programs.update', { error: new Error('rls') });

    expect((await restoreProgram(PROGRAM_ID)).error).toBeInstanceOf(Error);
    expect(writeOrder()).toEqual(['programs']);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('journalise en succès complet', async () => {
    withSessions();

    await restoreProgram(PROGRAM_ID, { label: 'Full body 3j' });

    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'program.restore',
      target_id: PROGRAM_ID,
    });
  });
});

// ---------------------------------------------------------------------------
// Création et métadonnées
// ---------------------------------------------------------------------------

describe('createEditorialProgram', () => {
  const input = {
    pillar: 'strength' as const,
    nameFr: 'Full body 3j',
    nameEn: 'Full body 3d',
    level: 'beginner' as const,
    goal: 'hypertrophy',
    durationWeeks: 8,
  };

  it('crée un programme éditorial en BROUILLON, jamais publié d’emblée', async () => {
    const { id, error } = await createEditorialProgram(input);

    expect(error).toBeNull();
    expect(mock.lastQuery('programs', 'insert')?.rows?.[0]).toMatchObject({
      id,
      owner_id: null,
      status: 'draft',
      pillar: 'strength',
      duration_weeks: 8,
    });
  });

  it('crée les deux traductions', async () => {
    await createEditorialProgram(input);

    const inserts = mock.queriesOn('program_translations', 'insert');
    expect(inserts.map((q) => q.rows?.[0]?.lang)).toEqual(['fr', 'en']);
    expect(inserts[0]?.rows?.[0]).toMatchObject({ name: 'Full body 3j', owner_id: null });
  });

  it('n’écrit aucune traduction si la ligne programme a échoué', async () => {
    mock.setResponse('programs.insert', { error: new Error('rls') });

    const { id, error } = await createEditorialProgram(input);

    expect(id).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(mock.queriesOn('program_translations')).toHaveLength(0);
  });

  it('renvoie l’id malgré un échec de traduction, pour permettre un ré-essai', async () => {
    mock.setResponse('program_translations.insert', { error: new Error('rls') });

    const { id, error } = await createEditorialProgram(input);

    expect(id).toBeTruthy();
    expect(error).toBeInstanceOf(Error);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });
});

describe('updateProgramMeta', () => {
  const input = {
    nameFr: 'Full body 3j',
    nameEn: 'Full body 3d',
    summaryFr: null,
    summaryEn: null,
    descriptionFr: null,
    descriptionEn: null,
    level: 'intermediate' as const,
    goal: 'strength',
    durationWeeks: 12,
  };

  it('met à jour l’entête en éditorial uniquement', async () => {
    await updateProgramMeta(PROGRAM_ID, input);

    const update = mock.lastQuery('programs', 'update');
    expect(update?.rows?.[0]).toMatchObject({ level: 'intermediate', duration_weeks: 12 });
    expect(mock.hasFilter(update, 'eq', 'id', PROGRAM_ID)).toBe(true);
    expect(mock.hasFilter(update, 'is', 'owner_id', null)).toBe(true);
  });

  it('upsert les traductions sur (program_id, lang) — pas de doublon au ré-enregistrement', async () => {
    await updateProgramMeta(PROGRAM_ID, input);

    const upserts = mock.queriesOn('program_translations', 'upsert');
    expect(upserts).toHaveLength(2);
    expect(upserts[0]?.options).toEqual({ onConflict: 'program_id,lang' });
  });

  it('n’écrit pas les traductions si l’entête a échoué', async () => {
    mock.setResponse('programs.update', { error: new Error('rls') });

    expect((await updateProgramMeta(PROGRAM_ID, input)).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('program_translations')).toHaveLength(0);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });
});

describe('setStatus', () => {
  it('journalise la publication, pas la dépublication', async () => {
    await setStatus(PROGRAM_ID, 'published', { label: 'Full body 3j' });
    expect(mock.lastQuery('audit_log', 'insert')?.rows?.[0]).toMatchObject({
      action: 'program.publish',
      details: { status: 'published' },
    });

    mock.reset();
    await setStatus(PROGRAM_ID, 'draft');
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });

  it('ne journalise pas si l’écriture a échoué', async () => {
    mock.setResponse('programs.update', { error: new Error('rls') });

    expect((await setStatus(PROGRAM_ID, 'published')).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('audit_log')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Séances et plans
// ---------------------------------------------------------------------------

describe('addSession / addExercisePlan', () => {
  it('place la séance à la suite des existantes', async () => {
    mock.setResponse('sessions.select', { data: { order_index: 4 } });

    await addSession(PROGRAM_ID, {
      name: 'Séance C',
      sessionType: null,
      targetDistanceM: null,
      targetDurationSeconds: null,
    });

    expect(mock.lastQuery('sessions', 'insert')?.rows?.[0]).toMatchObject({
      program_id: PROGRAM_ID,
      owner_id: null,
      order_index: 5,
      name: 'Séance C',
    });
  });

  it('démarre à 0 sur un programme vide', async () => {
    mock.setResponse('sessions.select', { data: null });

    await addSession(PROGRAM_ID);

    expect(mock.lastQuery('sessions', 'insert')?.rows?.[0]).toMatchObject({ order_index: 0 });
  });

  it('n’insère rien si le calcul de position échoue', async () => {
    mock.setResponse('sessions.select', { error: new Error('réseau') });

    const { id, error } = await addSession(PROGRAM_ID);

    expect(id).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(mock.queriesOn('sessions', 'insert')).toHaveLength(0);
  });

  it('ne compte que les séances vivantes de CE programme pour la position', async () => {
    mock.setResponse('sessions.select', { data: { order_index: 0 } });

    await addSession(PROGRAM_ID);

    const read = mock.lastQuery('sessions', 'select');
    expect(mock.hasFilter(read, 'eq', 'program_id', PROGRAM_ID)).toBe(true);
    expect(mock.hasFilter(read, 'is', 'deleted_at', null)).toBe(true);
    expect(mock.hasFilter(read, 'is', 'owner_id', null)).toBe(true);
  });

  it('place le plan d’exercice à la suite dans SA séance', async () => {
    mock.setResponse('exercise_plans.select', { data: { order_index: 2 } });

    await addExercisePlan(SESSION_A, {
      exerciseId: 'squat',
      setType: 'normal',
      targetSets: 4,
      targetReps: '8-12',
      targetWeightKg: null,
      restSeconds: 120,
    });

    expect(mock.lastQuery('exercise_plans', 'insert')?.rows?.[0]).toMatchObject({
      session_id: SESSION_A,
      owner_id: null,
      order_index: 3,
      exercise_id: 'squat',
      target_reps: '8-12',
    });
  });
});

describe('removeSession', () => {
  it('supprime les enfants avant la séance', async () => {
    const { error } = await removeSession(SESSION_A);

    expect(error).toBeNull();
    expect(writeOrder()).toEqual(['exercise_plans', 'session_intervals', 'sessions']);
  });

  it('ne supprime pas la séance si ses plans ont échoué', async () => {
    mock.setResponse('exercise_plans.update', { error: new Error('rls') });

    expect((await removeSession(SESSION_A)).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('sessions', 'update')).toHaveLength(0);
  });

  it('reste idempotent et cantonné à l’éditorial', async () => {
    await removeSession(SESSION_A);

    for (const table of ['exercise_plans', 'session_intervals', 'sessions']) {
      const query = mock.lastQuery(table, 'update');
      expect(mock.hasFilter(query, 'is', 'deleted_at', null)).toBe(true);
      expect(mock.hasFilter(query, 'is', 'owner_id', null)).toBe(true);
    }
  });
});

describe('reorderSessions', () => {
  it('pose l’index de chaque séance selon sa position dans la liste', async () => {
    await reorderSessions(PROGRAM_ID, [SESSION_B, SESSION_A]);

    const updates = mock.queriesOn('sessions', 'update');
    expect(updates).toHaveLength(2);
    expect(updates[0]?.rows?.[0]).toMatchObject({ order_index: 0 });
    expect(mock.hasFilter(updates[0], 'eq', 'id', SESSION_B)).toBe(true);
    expect(updates[1]?.rows?.[0]).toMatchObject({ order_index: 1 });
    expect(mock.hasFilter(updates[1], 'eq', 'id', SESSION_A)).toBe(true);
  });

  it('borne chaque écriture au programme — défense contre une liste mal formée', async () => {
    await reorderSessions(PROGRAM_ID, [SESSION_A]);

    // Sans ce filtre, un `orderedIds` contenant l'id d'une séance d'un AUTRE programme
    // réécrirait son ordre au passage.
    expect(mock.hasFilter(mock.lastQuery('sessions', 'update'), 'eq', 'program_id', PROGRAM_ID))
      .toBe(true);
  });

  it('s’arrête à la première erreur', async () => {
    mock.setResponse('sessions.update', { error: new Error('rls') });

    expect((await reorderSessions(PROGRAM_ID, [SESSION_A, SESSION_B])).error).toBeInstanceOf(
      Error,
    );
    expect(mock.queriesOn('sessions', 'update')).toHaveLength(1);
  });

  it('ne fait rien sur une liste vide', async () => {
    expect((await reorderSessions(PROGRAM_ID, [])).error).toBeNull();
    expect(mock.queriesOn('sessions')).toHaveLength(0);
  });
});
