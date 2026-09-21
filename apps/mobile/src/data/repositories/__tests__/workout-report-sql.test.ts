/**
 * US MUSCU-UX02 — les huit requêtes du **bilan de séance**, exécutées sur du vrai SQLite.
 *
 * Ce fichier était à **0 %**. Il porte pourtant quatre pièges que ses propres commentaires
 * signalent en 🔴, et qu'aucune recette sur device ne peut produire — parce qu'un téléphone n'a
 * qu'un historique, qu'une langue, et qu'on n'y ouvre presque jamais le bilan d'une séance de mars :
 *
 * - **Le doublon de plan** : un exercice présent deux fois dans la séance du programme produit deux
 *   lignes d'`exercise_plans`, donc des séries dupliquées dans le bilan. Le `GROUP BY s.id` referme
 *   le cas — sans lui, le tonnage affiché est faux, en silence.
 * - **La borne haute du tonnage de la semaine** : sans elle, le bilan d'une séance ancienne annonce
 *   « 3ᵉ séance de la semaine » à côté du tonnage cumulé **jusqu'à aujourd'hui**. Les deux chiffres
 *   de la même ligne se contredisent, et l'écart grandit avec l'ancienneté.
 * - **Le record qu'on vient de poser** ne doit pas servir de référence à lui-même, sinon la
 *   progression affichée est toujours nulle.
 * - **Le repli de langue** : un exercice sans traduction anglaise doit sortir en français, pas
 *   disparaître du bilan. C'est le défaut qui avait vidé le hub muscu (voir `strength-hub-sql`).
 *
 * Les requêtes sont exportées uniquement pour ces tests (§3.3 de strategie-tests.md).
 */

import {
  SELECT_BEST_PREVIOUS_VOLUME,
  SELECT_HEADER,
  SELECT_ONE_RM,
  SELECT_PREVIOUS_BESTS,
  SELECT_RECORDS,
  SELECT_REFERENCES,
  SELECT_SETS,
  SELECT_WEIGHT,
  localWeekBounds,
} from '../workout-report-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

const USER = 'user-1';
const WORKOUT = 'w-now';

/** Une séance terminée, avec ses bornes. */
const workout = (over: Record<string, unknown> = {}) => ({
  id: WORKOUT,
  user_id: USER,
  session_id: null,
  status: 'completed',
  started_at: '2026-09-16T18:00:00.000Z',
  finished_at: '2026-09-16T19:00:00.000Z',
  duration_seconds: 3600,
  rpe: 7,
  notes: null,
  ...over,
});

const set = (over: Record<string, unknown>) => ({
  workout_id: WORKOUT,
  user_id: USER,
  exercise_id: 'ex-1',
  order_index: 0,
  set_type: 'normal',
  reps: 10,
  weight_kg: 60,
  duration_seconds: null,
  done: 1,
  rpe: null,
  planned_weight_kg: null,
  ...over,
});

beforeEach(() => resetTestDb());

// ---------------------------------------------------------------------------
// SELECT_HEADER
// ---------------------------------------------------------------------------

describe('SELECT_HEADER', () => {
  it('rend l’entête et le titre de séance du programme', async () => {
    seed('sessions', [{ id: 'sess-1', owner_id: USER, name: 'Haut du corps', order_index: 0 }]);
    seed('workouts', [workout({ session_id: 'sess-1' })]);

    const rows = await testPowerSync.getAll<{ session_name: string | null; rpe: number }>(
      SELECT_HEADER,
      [WORKOUT],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ session_name: 'Haut du corps', rpe: 7 });
  });

  it('rend une séance libre avec un titre nul, sans la faire disparaître (jointure LEFT)', async () => {
    seed('workouts', [workout()]);

    const rows = await testPowerSync.getAll<{ session_name: string | null }>(SELECT_HEADER, [WORKOUT]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.session_name).toBeNull();
  });

  it('ne rend rien pour une séance en cours : le bilan n’existe qu’une fois terminée', async () => {
    seed('workouts', [workout({ status: 'in_progress' })]);

    expect(await testPowerSync.getAll(SELECT_HEADER, [WORKOUT])).toHaveLength(0);
  });

  it('ne rend rien pour une séance supprimée', async () => {
    seed('workouts', [{ ...workout(), deleted_at: '2026-09-17T00:00:00.000Z' }]);

    expect(await testPowerSync.getAll(SELECT_HEADER, [WORKOUT])).toHaveLength(0);
  });

  it('ignore le titre d’une séance de programme supprimée depuis', async () => {
    seed('sessions', [
      { id: 'sess-1', owner_id: USER, name: 'Haut du corps', order_index: 0, deleted_at: '2026-09-17T00:00:00.000Z' },
    ]);
    seed('workouts', [workout({ session_id: 'sess-1' })]);

    const rows = await testPowerSync.getAll<{ session_name: string | null }>(SELECT_HEADER, [WORKOUT]);

    expect(rows[0]!.session_name).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SELECT_SETS
// ---------------------------------------------------------------------------

describe('SELECT_SETS', () => {
  beforeEach(() => {
    seed('exercises', [{ id: 'ex-1', source: 'library', muscle_primary: 'chest' }]);
    seed('exercise_translations', [
      { id: 't-fr', exercise_id: 'ex-1', lang: 'fr', name: 'Développé couché' },
      { id: 't-en', exercise_id: 'ex-1', lang: 'en', name: 'Bench press' },
    ]);
    seed('workouts', [workout()]);
  });

  it('rend le nom dans la langue demandée et le groupe musculaire', async () => {
    seed('workout_sets', [set({ id: 's-1' })]);

    const rows = await testPowerSync.getAll<{ exercise_name: string; muscle_primary: string }>(
      SELECT_SETS,
      ['en', WORKOUT],
    );

    expect(rows[0]).toMatchObject({ exercise_name: 'Bench press', muscle_primary: 'chest' });
  });

  it('retombe sur le français quand la traduction manque, au lieu de perdre la série', async () => {
    seed('workout_sets', [set({ id: 's-1' })]);

    const rows = await testPowerSync.getAll<{ exercise_name: string }>(SELECT_SETS, ['es', WORKOUT]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.exercise_name).toBe('Développé couché');
  });

  it('garde une série dont l’exercice n’a aucune traduction (nom nul, ligne présente)', async () => {
    seed('exercises', [{ id: 'ex-orphelin', source: 'custom', muscle_primary: 'back' }]);
    seed('workout_sets', [set({ id: 's-1', exercise_id: 'ex-orphelin' })]);

    const rows = await testPowerSync.getAll<{ exercise_name: string | null }>(SELECT_SETS, ['fr', WORKOUT]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.exercise_name).toBeNull();
  });

  it('🔴 ne duplique pas une série quand l’exercice apparaît deux fois dans le plan', async () => {
    seed('sessions', [{ id: 'sess-1', owner_id: USER, name: 'Push', order_index: 0 }]);
    // La séance du `beforeEach` est déjà en base : on la rattache au programme plutôt que de la
    // réinsérer (la contrainte d'unicité de `workouts.id` est réelle dans le harness).
    await testPowerSync.execute('UPDATE workouts SET session_id = ? WHERE id = ?', ['sess-1', WORKOUT]);
    seed('exercise_plans', [
      { id: 'ep-1', session_id: 'sess-1', exercise_id: 'ex-1', order_index: 0, target_reps: '8-10' },
      { id: 'ep-2', session_id: 'sess-1', exercise_id: 'ex-1', order_index: 3, target_reps: '12' },
    ]);
    seed('workout_sets', [set({ id: 's-1' })]);

    const rows = await testPowerSync.getAll<{ id: string; target_reps: string }>(SELECT_SETS, ['fr', WORKOUT]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.target_reps).toBe('12'); // MIN lexicographique — arbitraire mais unique
  });

  it('rend les séries dans l’ordre du plan, pas dans celui de l’insertion', async () => {
    seed('workout_sets', [
      set({ id: 's-3', order_index: 2 }),
      set({ id: 's-1', order_index: 0 }),
      set({ id: 's-2', order_index: 1 }),
    ]);

    const rows = await testPowerSync.getAll<{ id: string }>(SELECT_SETS, ['fr', WORKOUT]);

    expect(rows.map((r) => r.id)).toEqual(['s-1', 's-2', 's-3']);
  });

  it('exclut les séries supprimées', async () => {
    seed('workout_sets', [
      set({ id: 's-1' }),
      { ...set({ id: 's-2' }), deleted_at: '2026-09-17T00:00:00.000Z' },
    ]);

    expect(await testPowerSync.getAll(SELECT_SETS, ['fr', WORKOUT])).toHaveLength(1);
  });

  it('garde les séries non faites et les échauffements : le bilan les distingue, il ne les cache pas', async () => {
    seed('workout_sets', [
      set({ id: 's-1', set_type: 'warmup' }),
      set({ id: 's-2', done: 0, order_index: 1 }),
    ]);

    const rows = await testPowerSync.getAll<{ id: string }>(SELECT_SETS, ['fr', WORKOUT]);

    expect(rows.map((r) => r.id)).toEqual(['s-1', 's-2']);
  });

  it('ne rend que les séries de la séance demandée', async () => {
    seed('workouts', [workout({ id: 'w-autre' })]);
    seed('workout_sets', [set({ id: 's-1' }), set({ id: 's-autre', workout_id: 'w-autre' })]);

    const rows = await testPowerSync.getAll<{ id: string }>(SELECT_SETS, ['fr', WORKOUT]);

    expect(rows.map((r) => r.id)).toEqual(['s-1']);
  });
});

// ---------------------------------------------------------------------------
// SELECT_RECORDS / SELECT_PREVIOUS_BESTS / SELECT_ONE_RM
// ---------------------------------------------------------------------------

describe('records de la séance', () => {
  beforeEach(() => {
    seed('workouts', [workout()]);
    seed('exercise_translations', [
      { id: 't-fr', exercise_id: 'ex-1', lang: 'fr', name: 'Développé couché' },
    ]);
  });

  it('rend les records posés pendant cette séance, nommés', async () => {
    seed('personal_records', [
      { id: 'r-1', user_id: USER, workout_id: WORKOUT, exercise_id: 'ex-1', type: 'max_weight', value: 82.5, achieved_at: '2026-09-16T18:30:00.000Z' },
    ]);

    const rows = await testPowerSync.getAll<{ value: number; exercise_name: string }>(
      SELECT_RECORDS,
      ['fr', WORKOUT],
    );

    expect(rows[0]).toMatchObject({ value: 82.5, exercise_name: 'Développé couché' });
  });

  it('ignore les records d’une autre séance', async () => {
    seed('personal_records', [
      { id: 'r-2', user_id: USER, workout_id: 'w-autre', exercise_id: 'ex-1', type: 'max_weight', value: 90, achieved_at: '2026-09-10T18:00:00.000Z' },
    ]);

    expect(await testPowerSync.getAll(SELECT_RECORDS, ['fr', WORKOUT])).toHaveLength(0);
  });

  it('🔴 la meilleure valeur antérieure exclut le record que la séance vient de poser', async () => {
    seed('personal_records', [
      { id: 'r-ancien', user_id: USER, workout_id: 'w-vieux', exercise_id: 'ex-1', type: 'max_weight', value: 80, achieved_at: '2026-09-01T18:00:00.000Z' },
      { id: 'r-neuf', user_id: USER, workout_id: WORKOUT, exercise_id: 'ex-1', type: 'max_weight', value: 82.5, achieved_at: '2026-09-16T18:30:00.000Z' },
    ]);

    const rows = await testPowerSync.getAll<{ value: number }>(SELECT_PREVIOUS_BESTS, [WORKOUT]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(80);
  });

  it('ne rend aucune référence quand le record est le premier de l’exercice', async () => {
    seed('personal_records', [
      { id: 'r-neuf', user_id: USER, workout_id: WORKOUT, exercise_id: 'ex-1', type: 'max_weight', value: 82.5, achieved_at: '2026-09-16T18:30:00.000Z' },
    ]);

    expect(await testPowerSync.getAll(SELECT_PREVIOUS_BESTS, [WORKOUT])).toHaveLength(0);
  });

  it('le 1RM de référence est le plus ÉLEVÉ, pas le plus récent (R1)', async () => {
    seed('personal_records', [
      { id: 'r-haut', user_id: USER, exercise_id: 'ex-1', type: 'estimated_1rm', value: 110, achieved_at: '2026-08-01T18:00:00.000Z' },
      { id: 'r-recent', user_id: USER, exercise_id: 'ex-1', type: 'estimated_1rm', value: 95, achieved_at: '2026-09-15T18:00:00.000Z' },
    ]);

    const rows = await testPowerSync.getAll<{ value: number }>(SELECT_ONE_RM, []);

    expect(rows[0]!.value).toBe(110);
  });

  it('le 1RM ignore les autres types de record', async () => {
    seed('personal_records', [
      { id: 'r-poids', user_id: USER, exercise_id: 'ex-1', type: 'max_weight', value: 200, achieved_at: '2026-08-01T18:00:00.000Z' },
    ]);

    expect(await testPowerSync.getAll(SELECT_ONE_RM, [])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SELECT_REFERENCES / SELECT_BEST_PREVIOUS_VOLUME
// ---------------------------------------------------------------------------

describe('séances de comparaison', () => {
  /** Une séance passée de titre `name`, avec une série de `reps × kg`. */
  const past = (id: string, startedAt: string, name: string | null, reps: number, kg: number) => {
    const sessionId = name === null ? null : `sess-${id}`;
    if (name !== null) seed('sessions', [{ id: sessionId, owner_id: USER, name, order_index: 0 }]);
    seed('workouts', [workout({ id, started_at: startedAt, session_id: sessionId })]);
    seed('workout_sets', [set({ id: `s-${id}`, workout_id: id, reps, weight_kg: kg })]);
  };

  beforeEach(() => {
    seed('sessions', [{ id: 'sess-now', owner_id: USER, name: 'Haut du corps', order_index: 0 }]);
    seed('workouts', [workout({ session_id: 'sess-now' })]);
  });

  it('ne compare qu’aux séances de MÊME titre, de la plus récente à la plus ancienne', async () => {
    past('w-1', '2026-09-09T18:00:00.000Z', 'Haut du corps', 10, 50);
    past('w-2', '2026-09-02T18:00:00.000Z', 'Haut du corps', 10, 40);
    past('w-jambes', '2026-09-05T18:00:00.000Z', 'Jambes', 10, 100);

    const rows = await testPowerSync.getAll<{ volume: number }>(SELECT_REFERENCES, [WORKOUT, 'Haut du corps']);

    expect(rows.map((r) => r.volume)).toEqual([500, 400]);
  });

  it('fait correspondre les séances libres entre elles, via COALESCE(name, \'\')', async () => {
    seed('workouts', [workout({ id: 'w-libre-1', started_at: '2026-09-09T18:00:00.000Z', session_id: null })]);
    seed('workout_sets', [set({ id: 's-libre', workout_id: 'w-libre-1', reps: 5, weight_kg: 100 })]);

    const rows = await testPowerSync.getAll<{ volume: number }>(SELECT_REFERENCES, [WORKOUT, '']);

    expect(rows.map((r) => r.volume)).toEqual([500]);
  });

  it('ignore les séances postérieures : on ne se compare pas à son futur', async () => {
    past('w-apres', '2026-09-20T18:00:00.000Z', 'Haut du corps', 10, 50);

    expect(await testPowerSync.getAll(SELECT_REFERENCES, [WORKOUT, 'Haut du corps'])).toHaveLength(0);
  });

  it('s’arrête à cinq séances de référence', async () => {
    for (let i = 1; i <= 7; i += 1) {
      past(`w-${i}`, `2026-09-0${i}T18:00:00.000Z`, 'Haut du corps', 10, 10 * i);
    }

    expect(await testPowerSync.getAll(SELECT_REFERENCES, [WORKOUT, 'Haut du corps'])).toHaveLength(5);
  });

  it('exclut échauffements et séries non faites du tonnage comparé', async () => {
    seed('sessions', [{ id: 'sess-w1', owner_id: USER, name: 'Haut du corps', order_index: 0 }]);
    seed('workouts', [workout({ id: 'w-1', started_at: '2026-09-09T18:00:00.000Z', session_id: 'sess-w1' })]);
    seed('workout_sets', [
      set({ id: 's-ok', workout_id: 'w-1', reps: 10, weight_kg: 50 }),
      set({ id: 's-warm', workout_id: 'w-1', set_type: 'warmup', reps: 10, weight_kg: 20 }),
      set({ id: 's-nondone', workout_id: 'w-1', done: 0, reps: 10, weight_kg: 90 }),
    ]);

    const rows = await testPowerSync.getAll<{ volume: number }>(SELECT_REFERENCES, [WORKOUT, 'Haut du corps']);

    expect(rows[0]!.volume).toBe(500);
  });

  it('le meilleur tonnage historique regarde au-delà des cinq dernières séances', async () => {
    past('w-tresvieux', '2026-01-05T18:00:00.000Z', 'Haut du corps', 10, 100); // 1 000
    for (let i = 1; i <= 6; i += 1) {
      past(`w-${i}`, `2026-09-0${i}T18:00:00.000Z`, 'Haut du corps', 10, 10);
    }

    const rows = await testPowerSync.getAll<{ best: number | null }>(SELECT_BEST_PREVIOUS_VOLUME, [
      WORKOUT,
      'Haut du corps',
    ]);

    expect(rows[0]!.best).toBe(1000);
  });

  it('rend null comme meilleur tonnage quand il n’y a aucune séance antérieure', async () => {
    const rows = await testPowerSync.getAll<{ best: number | null }>(SELECT_BEST_PREVIOUS_VOLUME, [
      WORKOUT,
      'Haut du corps',
    ]);

    expect(rows[0]!.best).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SELECT_WEIGHT — les deux bornes
// ---------------------------------------------------------------------------

describe('SELECT_WEIGHT', () => {
  const bounds = localWeekBounds('2026-09-16T18:00:00.000Z');

  it('compte les séances et le tonnage de la semaine de la séance', async () => {
    seed('workouts', [
      workout({ id: 'w-lun', started_at: new Date('2026-09-14T10:00:00').toISOString() }),
      workout({ id: 'w-mer', started_at: new Date('2026-09-16T18:00:00').toISOString() }),
    ]);
    seed('workout_sets', [
      set({ id: 's-1', workout_id: 'w-lun', reps: 10, weight_kg: 50 }),
      set({ id: 's-2', workout_id: 'w-mer', reps: 10, weight_kg: 60 }),
    ]);

    const rows = await testPowerSync.getAll<{ week_sessions: number; week_volume: number }>(
      SELECT_WEIGHT,
      [bounds.start, bounds.end, bounds.start, bounds.end],
    );

    expect(rows[0]).toMatchObject({ week_sessions: 2, week_volume: 1100 });
  });

  it('🔴 le tonnage de la semaine s’arrête au dimanche soir, il ne court pas jusqu’à aujourd’hui', async () => {
    seed('workouts', [
      workout({ id: 'w-mer', started_at: new Date('2026-09-16T18:00:00').toISOString() }),
      workout({ id: 'w-plus-tard', started_at: new Date('2026-09-30T18:00:00').toISOString() }),
    ]);
    seed('workout_sets', [
      set({ id: 's-1', workout_id: 'w-mer', reps: 10, weight_kg: 60 }),
      set({ id: 's-2', workout_id: 'w-plus-tard', reps: 10, weight_kg: 100 }),
    ]);

    const rows = await testPowerSync.getAll<{
      week_sessions: number;
      week_volume: number;
      lifetime_volume: number;
    }>(SELECT_WEIGHT, [bounds.start, bounds.end, bounds.start, bounds.end]);

    expect(rows[0]).toMatchObject({ week_sessions: 1, week_volume: 600, lifetime_volume: 1600 });
  });

  it('rend des zéros, jamais null, sur un historique vide', async () => {
    const rows = await testPowerSync.getAll<{
      week_sessions: number;
      week_volume: number;
      lifetime_volume: number;
    }>(SELECT_WEIGHT, [bounds.start, bounds.end, bounds.start, bounds.end]);

    expect(rows[0]).toEqual({ week_sessions: 0, week_volume: 0, lifetime_volume: 0 });
  });

  it('ignore les séances non terminées dans les trois chiffres', async () => {
    seed('workouts', [
      workout({ id: 'w-encours', status: 'in_progress', started_at: new Date('2026-09-16T18:00:00').toISOString() }),
    ]);
    seed('workout_sets', [set({ id: 's-1', workout_id: 'w-encours', reps: 10, weight_kg: 60 })]);

    const rows = await testPowerSync.getAll<{ week_sessions: number; lifetime_volume: number }>(
      SELECT_WEIGHT,
      [bounds.start, bounds.end, bounds.start, bounds.end],
    );

    expect(rows[0]).toMatchObject({ week_sessions: 0, lifetime_volume: 0 });
  });
});

describe('localWeekBounds', () => {
  it('ouvre la semaine au lundi 00 h 00 local', () => {
    const { start } = localWeekBounds('2026-09-16T18:00:00.000Z'); // mercredi

    expect(new Date(start).getDay()).toBe(1);
    expect(new Date(start).getHours()).toBe(0);
  });

  it('rattache le dimanche à la semaine qui vient de s’écouler, pas à la suivante', () => {
    const sunday = new Date(2026, 8, 20, 18, 0, 0); // dimanche 20/09
    const { start, end } = localWeekBounds(sunday.toISOString());

    expect(new Date(start).getDate()).toBe(14); // lundi 14/09
    expect(new Date(end).getDate()).toBe(21);
  });

  it('ferme la semaine exactement sept jours après son ouverture', () => {
    const { start, end } = localWeekBounds('2026-09-16T18:00:00.000Z');

    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(7 * 86_400_000);
  });

  it('franchit un changement de mois sans casser les bornes', () => {
    const { start, end } = localWeekBounds(new Date(2026, 9, 1, 12, 0, 0).toISOString()); // jeudi 01/10

    expect(new Date(start).getMonth()).toBe(8); // septembre
    expect(new Date(end).getMonth()).toBe(9);
  });
});
