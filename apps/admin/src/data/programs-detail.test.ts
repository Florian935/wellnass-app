/**
 * Back-office — **détail d'un programme et édition de son contenu** (US 8.3, RUN-F2c).
 *
 * `programs.test.ts` couvre la liste, la création, le statut, l'archivage et la restauration.
 * Ce fichier prend ce qui restait : `getProgram` (l'assemblage en quatre requêtes) et les
 * quinze écritures de séances, d'exercices planifiés et de blocs fractionné.
 *
 * Deux choses valent d'être verrouillées ici, et aucune ne se voit à l'écran :
 *
 *  1. **`owner_id IS NULL` sur les quinze écritures.** Le back-office parle à Supabase avec la clé
 *     anon. Ces fonctions prennent un `id` en paramètre : sans ce filtre, un identifiant erroné —
 *     copié depuis un support, ou issu d'une URL — laisserait un admin réordonner ou supprimer les
 *     séances du **programme personnel d'un utilisateur**. La RLS est la vraie frontière, mais elle
 *     n'est pas testable d'ici ; ce filtre-là l'est.
 *  2. **Le bornage au parent des trois réordonnancements** (`.eq('program_id', …)` /
 *     `.eq('session_id', …)`). C'est de la défense en profondeur contre une liste d'identifiants
 *     mal formée : sans lui, un glisser-déposer bogué réécrirait les positions de séances
 *     appartenant à un autre programme, et le désordre serait invisible jusqu'à l'ouverture de
 *     l'autre fiche.
 *
 * Ce que `getProgram` ajoute par-dessus : il **ignore les traductions soft-deletées** (une
 * traduction archivée réapparaîtrait sinon dans le formulaire d'édition) et **coerce les
 * `numeric`** que PostgREST peut rendre en chaîne — un poids cible qui arrive en `"80.0"`
 * casserait toute arithmétique côté UI sans lever la moindre erreur.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseMock } from '../test-utils/supabase-mock';

const mock = createSupabaseMock();

vi.mock('../lib/supabase', () => ({ supabase: mock.client }));

const {
  addExercisePlan,
  addIntervalBlock,
  addSession,
  getProgram,
  removeExercisePlan,
  removeIntervalBlock,
  removeSession,
  reorderExercisePlans,
  reorderIntervalBlocks,
  reorderSessions,
  updateExercisePlan,
  updateIntervalBlock,
  updateSession,
} = await import('./programs');

const PROGRAM_ID = '44444444-4444-4444-8444-444444444444';
const SESSION_ID = '55555555-5555-4555-8555-555555555555';
const PLAN_ID = '66666666-6666-4666-8666-666666666666';
const BLOCK_ID = '77777777-7777-4777-8777-777777777777';

beforeEach(() => {
  mock.reset();
});

// ---------------------------------------------------------------------------
// Détail
// ---------------------------------------------------------------------------

describe('getProgram', () => {
  const entete = (overrides: Record<string, unknown> = {}) => ({
    id: PROGRAM_ID,
    pillar: 'strength',
    status: 'published',
    level: 'beginner',
    goal: 'hypertrophy',
    duration_weeks: 8,
    program_translations: [
      { lang: 'fr', name: 'Prise de masse', summary: 'Résumé', description: 'Description', deleted_at: null },
      { lang: 'en', name: 'Mass gain', summary: null, description: null, deleted_at: null },
    ],
    ...overrides,
  });

  it('🔴 ne charge que l’éditorial non archivé', async () => {
    mock.setResponse('programs.select', { data: entete() });

    await getProgram(PROGRAM_ID);

    const q = mock.queriesOn('programs', 'select').at(0);
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
    expect(mock.hasFilter(q, 'is', 'deleted_at', null)).toBe(true);
  });

  it('programme introuvable → `null` sans erreur, et aucune requête de suite', async () => {
    mock.setResponse('programs.select', { data: null });

    const { program, error } = await getProgram(PROGRAM_ID);

    expect(program).toBeNull();
    expect(error).toBeNull();
    // Interroger les séances d'un programme qui n'existe pas serait trois allers-retours réseau
    // pour rien, à chaque ouverture d'une URL périmée.
    expect(mock.queriesOn('sessions')).toHaveLength(0);
  });

  it('🔴 ignore les traductions archivées', async () => {
    mock.setResponse('programs.select', {
      data: entete({
        program_translations: [
          { lang: 'fr', name: 'Ancien nom', summary: null, description: null, deleted_at: '2026-01-01T00:00:00Z' },
          { lang: 'fr', name: 'Nom courant', summary: null, description: null, deleted_at: null },
        ],
      }),
    });

    const { program } = await getProgram(PROGRAM_ID);

    // Sans ce filtre, une traduction archivée peut gagner le `find` et réapparaître dans le
    // formulaire d'édition — l'admin enregistrerait alors l'ancien nom en croyant confirmer.
    expect(program?.nameFr).toBe('Nom courant');
  });

  it('une langue absente donne `null`, sans faire tomber le détail', async () => {
    mock.setResponse('programs.select', {
      data: entete({
        program_translations: [
          { lang: 'fr', name: 'Prise de masse', summary: null, description: null, deleted_at: null },
        ],
      }),
    });

    const { program } = await getProgram(PROGRAM_ID);

    expect(program?.nameFr).toBe('Prise de masse');
    expect(program?.nameEn).toBeNull();
  });

  it('trie les séances par position', async () => {
    mock.setResponse('programs.select', { data: entete() });

    await getProgram(PROGRAM_ID);

    expect(
      mock.hasFilter(mock.lastQuery('sessions', 'select'), 'order', 'order_index', {
        ascending: true,
      }),
    ).toBe(true);
  });

  it('🔴 sans séance, ne va chercher ni plans ni blocs', async () => {
    mock.setResponse('programs.select', { data: entete() });
    mock.setResponse('sessions.select', { data: [] });

    const { program } = await getProgram(PROGRAM_ID);

    expect(program?.sessions).toEqual([]);
    // Un `in('session_id', [])` est une requête réseau qui ne peut rien rendre. Un programme
    // fraîchement créé en émettrait deux à chaque ouverture.
    expect(mock.queriesOn('exercise_plans')).toHaveLength(0);
    expect(mock.queriesOn('session_intervals')).toHaveLength(0);
  });

  it('rattache chaque plan à sa séance, avec le nom FR de l’exercice', async () => {
    mock.setResponse('programs.select', { data: entete() });
    mock.setResponse('sessions.select', {
      data: [
        { id: SESSION_ID, order_index: 0, name: 'Jour A', session_type: null, target_distance_m: null, target_duration_seconds: null },
      ],
    });
    mock.setResponse('exercise_plans.select', {
      data: [
        {
          id: PLAN_ID,
          session_id: SESSION_ID,
          order_index: 0,
          exercise_id: 'ex-1',
          set_type: 'normal',
          target_sets: 4,
          target_reps: 8,
          target_weight_kg: 80,
          rest_seconds: 120,
          exercises: {
            exercise_translations: [
              { lang: 'en', name: 'Barbell squat', deleted_at: null },
              { lang: 'fr', name: 'Squat barre', deleted_at: null },
            ],
          },
        },
      ],
    });

    const { program } = await getProgram(PROGRAM_ID);

    expect(program?.sessions[0]?.plans[0]).toMatchObject({
      exerciseNameFr: 'Squat barre',
      targetSets: 4,
    });
  });

  it('🔴 coerce un poids cible rendu en chaîne', async () => {
    mock.setResponse('programs.select', { data: entete() });
    mock.setResponse('sessions.select', {
      data: [{ id: SESSION_ID, order_index: 0, name: null, session_type: null, target_distance_m: null, target_duration_seconds: null }],
    });
    mock.setResponse('exercise_plans.select', {
      data: [
        {
          id: PLAN_ID,
          session_id: SESSION_ID,
          order_index: 0,
          exercise_id: 'ex-1',
          set_type: 'normal',
          target_sets: 3,
          target_reps: 10,
          // PostgREST préserve la précision des `numeric` en les rendant en chaîne.
          target_weight_kg: '82.5',
          rest_seconds: 90,
          exercises: null,
        },
      ],
    });

    const { program } = await getProgram(PROGRAM_ID);

    // Sans la coercion, le type déclaré ment : « 82.5 » + 2.5 donnerait « 82.52.5 » dans l'UI,
    // sans la moindre erreur.
    expect(program?.sessions[0]?.plans[0]?.targetWeightKg).toBe(82.5);
    expect(program?.sessions[0]?.plans[0]?.exerciseNameFr).toBeNull();
  });

  it('un poids cible absent reste `null` et ne devient pas 0', async () => {
    mock.setResponse('programs.select', { data: entete() });
    mock.setResponse('sessions.select', {
      data: [{ id: SESSION_ID, order_index: 0, name: null, session_type: null, target_distance_m: null, target_duration_seconds: null }],
    });
    mock.setResponse('exercise_plans.select', {
      data: [
        {
          id: PLAN_ID,
          session_id: SESSION_ID,
          order_index: 0,
          exercise_id: 'ex-1',
          set_type: 'normal',
          target_sets: 3,
          target_reps: 10,
          target_weight_kg: null,
          rest_seconds: 90,
          exercises: null,
        },
      ],
    });

    const { program } = await getProgram(PROGRAM_ID);

    // `Number(null)` vaut 0 : un exercice au poids du corps afficherait « 0 kg » comme consigne.
    expect(program?.sessions[0]?.plans[0]?.targetWeightKg).toBeNull();
  });

  it('rattache les blocs fractionné à leur séance', async () => {
    mock.setResponse('programs.select', { data: entete({ pillar: 'running' }) });
    mock.setResponse('sessions.select', {
      data: [{ id: SESSION_ID, order_index: 0, name: 'Fractionné', session_type: 'fractionne', target_distance_m: null, target_duration_seconds: null }],
    });
    mock.setResponse('session_intervals.select', {
      data: [
        {
          id: BLOCK_ID,
          session_id: SESSION_ID,
          order_index: 0,
          reps: 8,
          fast_distance_m: 400,
          fast_duration_seconds: null,
          fast_pace_pct_vma: 100,
          recovery_distance_m: null,
          recovery_duration_seconds: 90,
        },
      ],
    });

    const { program } = await getProgram(PROGRAM_ID);

    expect(program?.sessions[0]?.intervals[0]).toMatchObject({ reps: 8, fastDistanceM: 400 });
  });

  it('un plan orphelin est ignoré, sans faire tomber le détail', async () => {
    mock.setResponse('programs.select', { data: entete() });
    mock.setResponse('sessions.select', {
      data: [{ id: SESSION_ID, order_index: 0, name: null, session_type: null, target_distance_m: null, target_duration_seconds: null }],
    });
    mock.setResponse('exercise_plans.select', {
      data: [
        {
          id: PLAN_ID,
          session_id: 'seance-inconnue',
          order_index: 0,
          exercise_id: 'ex-1',
          set_type: 'normal',
          target_sets: 3,
          target_reps: 10,
          target_weight_kg: null,
          rest_seconds: 90,
          exercises: null,
        },
      ],
    });

    const { program, error } = await getProgram(PROGRAM_ID);

    expect(error).toBeNull();
    expect(program?.sessions[0]?.plans).toEqual([]);
  });

  it.each([
    ['programs.select', 'l’entête'],
    ['sessions.select', 'les séances'],
    ['exercise_plans.select', 'les plans'],
    ['session_intervals.select', 'les blocs'],
  ])('une erreur sur %s (%s) rend `null` ET l’erreur', async (cle) => {
    mock.setResponse('programs.select', { data: entete() });
    mock.setResponse('sessions.select', {
      data: [{ id: SESSION_ID, order_index: 0, name: null, session_type: null, target_distance_m: null, target_duration_seconds: null }],
    });
    mock.setResponse(cle, { error: new Error('rls') });

    const { program, error } = await getProgram(PROGRAM_ID);

    // Un détail partiel serait pire qu'une erreur : l'admin enregistrerait un programme amputé
    // des séances qui n'ont pas pu être lues.
    expect(program).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Séances
// ---------------------------------------------------------------------------

describe('séances', () => {
  it('ajoute à la position suivante, en éditorial', async () => {
    // maybeSingle() : la réponse est un objet, pas un tableau.
    mock.setResponse('sessions.select', { data: { order_index: 2 } });

    const { id, error } = await addSession(PROGRAM_ID, { name: 'Jour B', sessionType: null, targetDistanceM: null, targetDurationSeconds: null });

    expect(error).toBeNull();
    expect(mock.lastQuery('sessions', 'insert')?.rows?.[0]).toMatchObject({
      id,
      program_id: PROGRAM_ID,
      owner_id: null,
      order_index: 3,
      name: 'Jour B',
    });
  });

  it('la première séance prend la position 0', async () => {
    mock.setResponse('sessions.select', { data: [] });

    await addSession(PROGRAM_ID);

    expect(mock.lastQuery('sessions', 'insert')?.rows?.[0]?.order_index).toBe(0);
  });

  it('🔴 n’insère rien si le calcul de position échoue', async () => {
    mock.setResponse('sessions.select', { error: new Error('rls') });

    const { id, error } = await addSession(PROGRAM_ID);

    // Insérer avec une position devinée créerait deux séances au même rang, et l'ordre
    // deviendrait celui, arbitraire, que Postgres rend.
    expect(id).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(mock.queriesOn('sessions', 'insert')).toHaveLength(0);
  });

  it('la mise à jour est bornée à l’éditorial', async () => {
    await updateSession(SESSION_ID, {
      name: 'Sortie longue',
      sessionType: 'endurance',
      targetDistanceM: 12000,
      targetDurationSeconds: null,
    });

    const q = mock.lastQuery('sessions', 'update');
    expect(mock.hasFilter(q, 'eq', 'id', SESSION_ID)).toBe(true);
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
    expect(q?.rows?.[0]).toMatchObject({ session_type: 'endurance', target_distance_m: 12000 });
  });

  it('🔴 le retrait emporte les plans ET les blocs, avant la séance', async () => {
    await removeSession(SESSION_ID);

    // Supprimer la séance seule laisserait des plans et des blocs orphelins, invisibles dans
    // l'admin et toujours synchronisés vers les téléphones.
    const ordre = mock.queries.map((q) => q.table);
    expect(ordre).toEqual(['exercise_plans', 'session_intervals', 'sessions']);
    for (const q of mock.queries) {
      expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
      expect(q.rows?.[0]?.deleted_at).toEqual(expect.any(String));
    }
  });

  it('le retrait est idempotent — il ne réécrit pas ce qui est déjà archivé', async () => {
    await removeSession(SESSION_ID);

    // Sans `is('deleted_at', null)`, rejouer l'action réécrirait la date d'archivage et
    // fausserait l'historique.
    expect(mock.queries.every((q) => mock.hasFilter(q, 'is', 'deleted_at', null))).toBe(true);
  });

  it('🔴 le retrait s’arrête à la première erreur', async () => {
    mock.setResponse('exercise_plans.update', { error: new Error('rls') });

    const { error } = await removeSession(SESSION_ID);

    // Archiver la séance alors que ses plans sont restés vivants produirait exactement les
    // orphelins que la séquence cherche à éviter.
    expect(error).toBeInstanceOf(Error);
    expect(mock.queriesOn('sessions')).toHaveLength(0);
  });

  it('le réordonnancement pose la position de chaque identifiant', async () => {
    await reorderSessions(PROGRAM_ID, ['s-a', 's-b', 's-c']);

    const updates = mock.queriesOn('sessions', 'update');
    expect(updates.map((q) => q.rows?.[0]?.order_index)).toEqual([0, 1, 2]);
  });

  it('🔴 le réordonnancement est borné au programme', async () => {
    await reorderSessions(PROGRAM_ID, ['s-a']);

    // Défense en profondeur : un `orderedIds` mal formé réécrirait sinon les positions de séances
    // appartenant à un autre programme, et le désordre resterait invisible.
    const q = mock.lastQuery('sessions', 'update');
    expect(mock.hasFilter(q, 'eq', 'program_id', PROGRAM_ID)).toBe(true);
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
  });

  it('le réordonnancement s’arrête à la première erreur', async () => {
    mock.setResponse('sessions.update', { error: new Error('rls') });

    const { error } = await reorderSessions(PROGRAM_ID, ['s-a', 's-b', 's-c']);

    expect(error).toBeInstanceOf(Error);
    expect(mock.queriesOn('sessions', 'update')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Exercices planifiés
// ---------------------------------------------------------------------------

describe('exercices planifiés', () => {
  // `targetReps` est une **chaîne** : l'admin saisit des fourchettes (« 8-12 »), pas un entier.
  const plan = {
    exerciseId: 'ex-1',
    setType: 'normal' as const,
    targetSets: 4,
    targetReps: '8-12',
    targetWeightKg: 80,
    restSeconds: 120,
  };

  it('ajoute à la position suivante de la séance', async () => {
    mock.setResponse('exercise_plans.select', { data: { order_index: 1 } });

    const { id, error } = await addExercisePlan(SESSION_ID, plan);

    expect(error).toBeNull();
    expect(mock.lastQuery('exercise_plans', 'insert')?.rows?.[0]).toMatchObject({
      id,
      session_id: SESSION_ID,
      owner_id: null,
      order_index: 2,
      target_sets: 4,
    });
  });

  it('n’insère rien si le calcul de position échoue', async () => {
    mock.setResponse('exercise_plans.select', { error: new Error('rls') });

    const { id } = await addExercisePlan(SESSION_ID, plan);

    expect(id).toBeNull();
    expect(mock.queriesOn('exercise_plans', 'insert')).toHaveLength(0);
  });

  it('remonte l’erreur d’insertion sans identifiant', async () => {
    mock.setResponse('exercise_plans.insert', { error: new Error('fk') });

    const { id, error } = await addExercisePlan(SESSION_ID, plan);

    expect(id).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });

  it('la mise à jour est bornée à l’éditorial', async () => {
    await updateExercisePlan(PLAN_ID, plan);

    const q = mock.lastQuery('exercise_plans', 'update');
    expect(mock.hasFilter(q, 'eq', 'id', PLAN_ID)).toBe(true);
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
    // La fourchette est transportée telle quelle : la convertir en nombre écraserait « 8-12 » en 8.
    expect(q?.rows?.[0]).toMatchObject({ target_reps: '8-12', rest_seconds: 120 });
  });

  it('🔴 la mise à jour ne touche pas à la position', async () => {
    await updateExercisePlan(PLAN_ID, plan);

    // Éditer les cibles d'un exercice ne doit pas le faire sauter en tête de séance.
    expect(mock.lastQuery('exercise_plans', 'update')?.rows?.[0]).not.toHaveProperty('order_index');
  });

  it('le retrait horodate en éditorial', async () => {
    await removeExercisePlan(PLAN_ID);

    const q = mock.lastQuery('exercise_plans', 'update');
    expect(q?.rows?.[0]?.deleted_at).toEqual(expect.any(String));
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
  });

  it('🔴 le réordonnancement est borné à la séance', async () => {
    await reorderExercisePlans(SESSION_ID, ['p-a', 'p-b']);

    const updates = mock.queriesOn('exercise_plans', 'update');
    expect(updates.map((q) => q.rows?.[0]?.order_index)).toEqual([0, 1]);
    expect(updates.every((q) => mock.hasFilter(q, 'eq', 'session_id', SESSION_ID))).toBe(true);
  });

  it('le réordonnancement s’arrête à la première erreur', async () => {
    mock.setResponse('exercise_plans.update', { error: new Error('rls') });

    expect((await reorderExercisePlans(SESSION_ID, ['p-a', 'p-b'])).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('exercise_plans', 'update')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Blocs fractionné (US RUN-F2c)
// ---------------------------------------------------------------------------

describe('blocs fractionné', () => {
  const bloc = {
    reps: 8,
    fastDistanceM: 400,
    fastDurationSeconds: null,
    fastPacePctVma: 100,
    recoveryDistanceM: null,
    recoveryDurationSeconds: 90,
  };

  it('ajoute à la position suivante de la séance', async () => {
    mock.setResponse('session_intervals.select', { data: { order_index: 0 } });

    const { id, error } = await addIntervalBlock(SESSION_ID, bloc);

    expect(error).toBeNull();
    expect(mock.lastQuery('session_intervals', 'insert')?.rows?.[0]).toMatchObject({
      id,
      session_id: SESSION_ID,
      owner_id: null,
      order_index: 1,
      reps: 8,
    });
  });

  it('🔴 conserve une phase définie en durée plutôt qu’en distance', async () => {
    mock.setResponse('session_intervals.select', { data: [] });

    await addIntervalBlock(SESSION_ID, {
      ...bloc,
      fastDistanceM: null,
      fastDurationSeconds: 60,
    });

    // Les deux formes coexistent (spec RUN-F2c) : écraser l'une par l'autre transformerait
    // « 8 × 1 min » en « 8 × 0 m », donc en séance vide.
    expect(mock.lastQuery('session_intervals', 'insert')?.rows?.[0]).toMatchObject({
      fast_distance_m: null,
      fast_duration_seconds: 60,
    });
  });

  it('n’insère rien si le calcul de position échoue', async () => {
    mock.setResponse('session_intervals.select', { error: new Error('rls') });

    const { id } = await addIntervalBlock(SESSION_ID, bloc);

    expect(id).toBeNull();
    expect(mock.queriesOn('session_intervals', 'insert')).toHaveLength(0);
  });

  it('remonte l’erreur d’insertion sans identifiant', async () => {
    mock.setResponse('session_intervals.insert', { error: new Error('check') });

    const { id, error } = await addIntervalBlock(SESSION_ID, bloc);

    expect(id).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });

  it('la mise à jour est bornée à l’éditorial', async () => {
    await updateIntervalBlock(BLOCK_ID, bloc);

    const q = mock.lastQuery('session_intervals', 'update');
    expect(mock.hasFilter(q, 'eq', 'id', BLOCK_ID)).toBe(true);
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
    expect(q?.rows?.[0]).toMatchObject({ reps: 8, recovery_duration_seconds: 90 });
  });

  it('le retrait horodate en éditorial', async () => {
    await removeIntervalBlock(BLOCK_ID);

    const q = mock.lastQuery('session_intervals', 'update');
    expect(q?.rows?.[0]?.deleted_at).toEqual(expect.any(String));
    expect(mock.hasFilter(q, 'is', 'owner_id', null)).toBe(true);
  });

  it('🔴 le réordonnancement est borné à la séance', async () => {
    await reorderIntervalBlocks(SESSION_ID, ['b-a', 'b-b', 'b-c']);

    const updates = mock.queriesOn('session_intervals', 'update');
    expect(updates.map((q) => q.rows?.[0]?.order_index)).toEqual([0, 1, 2]);
    expect(updates.every((q) => mock.hasFilter(q, 'eq', 'session_id', SESSION_ID))).toBe(true);
  });

  it('le réordonnancement s’arrête à la première erreur', async () => {
    mock.setResponse('session_intervals.update', { error: new Error('rls') });

    expect((await reorderIntervalBlocks(SESSION_ID, ['b-a', 'b-b'])).error).toBeInstanceOf(Error);
    expect(mock.queriesOn('session_intervals', 'update')).toHaveLength(1);
  });
});
