/**
 * La séance en direct — les lectures de `/workout`, exécutées sur **du vrai SQLite** (MUSCU-FIX02).
 *
 * La recette du 23/09/2026 décrivait une séance « impossible à utiliser » : écrans noirs au
 * lancement, décalages après chaque validation, barre chargée jamais affichée en immersif. Trois
 * causes étaient dans le SQL de cet écran, et ce fichier en est le garde-fou :
 *
 *  1. `SELECT_SESSION_REFERENCES` rejouait une sous-requête corrélée **pour chaque série de
 *     l'historique** : 3,1 s sur PC pour 200 séances (×5 à ×10 sur téléphone), relancée à chaque
 *     série validée. Réécrite en fonction de fenêtre, elle doit rendre **exactement** les mêmes
 *     lignes — c'est ce que vérifient les tests ci-dessous.
 *  2. `SELECT_SESSION_CARDS` lisait `exercises.instructions`, colonne qui **n'existe pas** dans la
 *     base locale : la requête échouait à chaque fois, en silence. D'où une barre chargée jamais
 *     dessinée et un coach sans consigne.
 *  3. Les noms d'exercice passaient par `LEFT JOIN exercise_translations`, que SQLite ne sait pas
 *     indexer sur une vue PowerSync (voir `exerciseNameSql`).
 *
 * Ce harnais crée des tables ordinaires, pas les vues JSON de PowerSync : il vérifie la
 * **sémantique** des requêtes, pas leur vitesse. La vitesse est mesurée dans la spec (§2).
 */

import {
  SELECT_ACTIVE_SETS,
  SELECT_LAST_PERFORMANCE,
  SELECT_SECOND_LAST_PERFORMANCE,
} from '../workout-repository';
import {
  SELECT_SESSION_BRIEF,
  SELECT_SESSION_CARDS,
  SELECT_SESSION_REFERENCES,
} from '../immersive-repository';
import { exerciseNameSql } from '../_sql';
import { exercisesQuery, SELECT_FAVORITE_EXERCISES } from '../exercise-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// Semis
// ---------------------------------------------------------------------------

/** Une séance terminée le jour donné, avec ses séries (toutes validées sauf mention contraire). */
function completedWorkout(
  id: string,
  finishedAt: string,
  sets: { exercise: string; reps: number; weight: number; type?: string; done?: 0 | 1; deleted?: boolean }[],
) {
  seed('workouts', [
    { id, user_id: 'u1', status: 'completed', started_at: finishedAt, finished_at: finishedAt },
  ]);
  seed(
    'workout_sets',
    sets.map((set, index) => ({
      workout_id: id,
      user_id: 'u1',
      exercise_id: set.exercise,
      order_index: index,
      set_type: set.type ?? 'normal',
      reps: set.reps,
      weight_kg: set.weight,
      done: set.done ?? 1,
      deleted_at: set.deleted ? '2026-09-01T00:00:00.000Z' : null,
    })),
  );
}

type ReferenceRow = {
  exercise_id: string;
  set_type: string;
  reps: number;
  weight_kg: number;
  finished_at: string;
};

const references = (ids: string[]) =>
  testPowerSync.getAll<ReferenceRow>(SELECT_SESSION_REFERENCES(ids.length), ids);

// ---------------------------------------------------------------------------
// Séries de référence — « la dernière fois »
// ---------------------------------------------------------------------------

describe('SELECT_SESSION_REFERENCES', () => {
  it('rend, pour chaque exercice, les séries de SA dernière séance terminée', async () => {
    completedWorkout('w-old', '2026-09-01T10:00:00.000Z', [
      { exercise: 'squat', reps: 5, weight: 100 },
      { exercise: 'bench', reps: 8, weight: 60 },
    ]);
    completedWorkout('w-new', '2026-09-10T10:00:00.000Z', [
      { exercise: 'squat', reps: 5, weight: 110 },
      { exercise: 'squat', reps: 4, weight: 110 },
    ]);

    const rows = await references(['squat', 'bench']);

    // Le squat a été fait le 10 : c'est sa référence. Le développé couché, absent le 10, garde
    // celle du 1er — chaque exercice a SA dernière fois, pas celle de la séance.
    expect(rows.map((r) => [r.exercise_id, r.weight_kg, r.reps, r.finished_at])).toEqual([
      ['bench', 60, 8, '2026-09-01T10:00:00.000Z'],
      ['squat', 110, 5, '2026-09-10T10:00:00.000Z'],
      ['squat', 110, 4, '2026-09-10T10:00:00.000Z'],
    ]);
  });

  it('ignore la séance en cours, les échauffements, les séries non validées ou supprimées', async () => {
    completedWorkout('w-ref', '2026-09-05T10:00:00.000Z', [
      { exercise: 'squat', reps: 10, weight: 40, type: 'warmup' },
      { exercise: 'squat', reps: 5, weight: 100 },
      { exercise: 'squat', reps: 5, weight: 100, done: 0 },
      { exercise: 'squat', reps: 5, weight: 100, deleted: true },
    ]);
    seed('workouts', [{ id: 'w-live', user_id: 'u1', status: 'active', started_at: '2026-09-20T10:00:00.000Z' }]);
    seed('workout_sets', [
      { workout_id: 'w-live', user_id: 'u1', exercise_id: 'squat', order_index: 0, set_type: 'normal', reps: 3, weight_kg: 120, done: 1 },
    ]);

    const rows = await references(['squat']);

    expect(rows.map((r) => [r.weight_kg, r.reps])).toEqual([[100, 5]]);
  });

  it('une séance faite uniquement d’échauffements ne sert pas de référence', async () => {
    completedWorkout('w-real', '2026-09-01T10:00:00.000Z', [{ exercise: 'squat', reps: 5, weight: 100 }]);
    completedWorkout('w-warmup', '2026-09-08T10:00:00.000Z', [
      { exercise: 'squat', reps: 10, weight: 40, type: 'warmup' },
    ]);

    const rows = await references(['squat']);

    expect(rows.map((r) => r.finished_at)).toEqual(['2026-09-01T10:00:00.000Z']);
  });

  it('un exercice jamais fait n’a aucune ligne, et une liste vide ne casse pas le SQL', async () => {
    completedWorkout('w', '2026-09-01T10:00:00.000Z', [{ exercise: 'squat', reps: 5, weight: 100 }]);

    expect(await references(['curl'])).toEqual([]);
    expect(await references([])).toEqual([]);
  });

  it('une séance supprimée n’est jamais la référence', async () => {
    completedWorkout('w-ok', '2026-09-01T10:00:00.000Z', [{ exercise: 'squat', reps: 5, weight: 100 }]);
    seed('workouts', [
      {
        id: 'w-gone',
        user_id: 'u1',
        status: 'completed',
        started_at: '2026-09-09T10:00:00.000Z',
        finished_at: '2026-09-09T10:00:00.000Z',
        deleted_at: '2026-09-10T10:00:00.000Z',
      },
    ]);
    seed('workout_sets', [
      { workout_id: 'w-gone', user_id: 'u1', exercise_id: 'squat', order_index: 0, set_type: 'normal', reps: 5, weight_kg: 140, done: 1 },
    ]);

    const rows = await references(['squat']);

    expect(rows.map((r) => r.weight_kg)).toEqual([100]);
  });
});

// ---------------------------------------------------------------------------
// Matériel et consigne — la barre chargée et la voix du coach
// ---------------------------------------------------------------------------

describe('SELECT_SESSION_CARDS', () => {
  beforeEach(() => {
    seed('exercises', [
      { id: 'squat', source: 'library', muscle_primary: 'quads', equipment: 'barbell' },
      { id: 'curl', source: 'library', muscle_primary: 'biceps', equipment: 'dumbbell' },
    ]);
    seed('exercise_translations', [
      { exercise_id: 'squat', lang: 'fr', name: 'Squat', instructions: 'Pousse dans le sol.' },
      { exercise_id: 'squat', lang: 'en', name: 'Squat', instructions: 'Drive through the floor.' },
      { exercise_id: 'curl', lang: 'fr', name: 'Curl', instructions: 'Coudes fixes.' },
    ]);
  });

  it('🔴 s’exécute — la consigne vient des traductions, pas de `exercises`', async () => {
    // La colonne `exercises.instructions` n'existe pas : l'ancienne requête échouait à chaque
    // appel, `useQuery` rendait une liste vide, et la barre chargée ne s'affichait JAMAIS.
    const rows = await testPowerSync.getAll<{ id: string; equipment: string; instructions: string }>(
      SELECT_SESSION_CARDS(2),
      ['en', 'squat', 'curl'],
    );

    expect(rows.map((r) => [r.id, r.equipment, r.instructions]).sort()).toEqual([
      ['curl', 'dumbbell', 'Coudes fixes.'],
      ['squat', 'barbell', 'Drive through the floor.'],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Brief d'entrée en séance
// ---------------------------------------------------------------------------

describe('SELECT_SESSION_BRIEF', () => {
  it('nomme les exercices dans la langue courante, avec repli sur le français', async () => {
    seed('sessions', [{ id: 's1', program_id: 'p1', order_index: 0, name: 'Push' }]);
    seed('exercises', [
      { id: 'bench', source: 'library', muscle_primary: 'chest' },
      { id: 'dips', source: 'library', muscle_primary: 'triceps' },
    ]);
    seed('exercise_plans', [
      { session_id: 's1', exercise_id: 'bench', order_index: 0, set_type: 'normal', target_sets: 4 },
      { session_id: 's1', exercise_id: 'dips', order_index: 1, set_type: 'normal', target_sets: 3 },
    ]);
    seed('exercise_translations', [
      { exercise_id: 'bench', lang: 'fr', name: 'Développé couché' },
      { exercise_id: 'bench', lang: 'en', name: 'Bench press' },
      { exercise_id: 'dips', lang: 'fr', name: 'Dips' },
      // Une traduction archivée ne nomme plus rien dans une liste de sélection.
      { exercise_id: 'dips', lang: 'en', name: 'Old dips', deleted_at: '2026-09-01T00:00:00.000Z' },
    ]);

    const rows = await testPowerSync.getAll<{ exercise_name: string; target_sets: number }>(
      SELECT_SESSION_BRIEF,
      ['en', 's1'],
    );

    expect(rows.map((r) => [r.exercise_name, r.target_sets])).toEqual([
      ['Bench press', 4],
      ['Dips', 3],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Séries de la séance active
// ---------------------------------------------------------------------------

describe('SELECT_ACTIVE_SETS', () => {
  beforeEach(() => {
    seed('workouts', [
      { id: 'w-live', user_id: 'u1', status: 'active', started_at: '2026-09-23T10:00:00.000Z' },
      {
        id: 'w-done',
        user_id: 'u1',
        status: 'completed',
        started_at: '2026-09-20T10:00:00.000Z',
        finished_at: '2026-09-20T11:00:00.000Z',
      },
    ]);
    seed('workout_sets', [
      { workout_id: 'w-live', user_id: 'u1', exercise_id: 'squat', order_index: 1, set_type: 'normal', done: 0 },
      { workout_id: 'w-live', user_id: 'u1', exercise_id: 'squat', order_index: 0, set_type: 'normal', done: 1 },
      { workout_id: 'w-live', user_id: 'u1', exercise_id: 'curl', order_index: 2, set_type: 'normal', done: 0,
        deleted_at: '2026-09-23T10:05:00.000Z' },
      { workout_id: 'w-done', user_id: 'u1', exercise_id: 'squat', order_index: 0, set_type: 'normal', done: 1 },
    ]);
    seed('exercise_translations', [{ exercise_id: 'squat', lang: 'fr', name: 'Squat' }]);
  });

  it('lit les séries de la séance active SANS connaître son id — plus de requête en cascade', async () => {
    const rows = await testPowerSync.getAll<{ workout_id: string; order_index: number; exercise_name: string }>(
      SELECT_ACTIVE_SETS,
      ['en'],
    );

    // Triées, sans la série supprimée ni celles de la séance terminée, nommées avec repli `fr`.
    expect(rows.map((r) => [r.workout_id, r.order_index, r.exercise_name])).toEqual([
      ['w-live', 0, 'Squat'],
      ['w-live', 1, 'Squat'],
    ]);
  });

  it('aucune séance active → aucune série', async () => {
    await testPowerSync.execute(`UPDATE workouts SET status = 'completed' WHERE id = 'w-live'`);

    expect(await testPowerSync.getAll(SELECT_ACTIVE_SETS, ['fr'])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Nom d'exercice résolu
// ---------------------------------------------------------------------------

describe('exerciseNameSql', () => {
  const nameOf = (lang: string, liveOnly = false) =>
    testPowerSync
      .getAll<{ id: string; name: string | null }>(
        `SELECT e.id, ${exerciseNameSql('e.id', liveOnly)} AS name FROM exercises e ORDER BY e.id`,
        [lang],
      )
      .then((rows) => rows.map((r) => [r.id, r.name]));

  beforeEach(() => {
    seed('exercises', [
      { id: 'a', source: 'library', muscle_primary: 'chest' },
      { id: 'b', source: 'library', muscle_primary: 'back' },
      { id: 'c', source: 'library', muscle_primary: 'legs' },
    ]);
  });

  it('préfère la langue courante, retombe sur le français, sinon null', async () => {
    seed('exercise_translations', [
      { exercise_id: 'a', lang: 'fr', name: 'Pompes' },
      { exercise_id: 'a', lang: 'en', name: 'Push-ups' },
      { exercise_id: 'b', lang: 'fr', name: 'Tractions' },
    ]);

    expect(await nameOf('en')).toEqual([
      ['a', 'Push-ups'],
      ['b', 'Tractions'],
      ['c', null],
    ]);
  });

  it('une traduction archivée nomme encore un fait passé — mais la vivante prime', async () => {
    // ADMIN-01 : archiver un exercice ne doit pas effacer le nom d'une séance déjà faite.
    seed('exercise_translations', [
      { exercise_id: 'a', lang: 'fr', name: 'Ancien nom', deleted_at: '2026-09-01T00:00:00.000Z' },
      { exercise_id: 'a', lang: 'fr', name: 'Nouveau nom' },
      { exercise_id: 'b', lang: 'fr', name: 'Archivé', deleted_at: '2026-09-01T00:00:00.000Z' },
    ]);

    expect(await nameOf('fr')).toEqual([
      ['a', 'Nouveau nom'],
      ['b', 'Archivé'],
      ['c', null],
    ]);
    // En `liveOnly` (listes de sélection), l'archivé ne nomme plus rien.
    expect((await nameOf('fr', true))[1]).toEqual(['b', null]);
  });

  it('ne duplique jamais une ligne, même avec deux traductions dans la même langue', async () => {
    // Un `LEFT JOIN` rendait une ligne PAR traduction : une série apparaissait deux fois.
    seed('exercise_translations', [
      { exercise_id: 'a', lang: 'fr', name: 'Un' },
      { exercise_id: 'a', lang: 'fr', name: 'Deux' },
    ]);

    expect(await nameOf('fr')).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Bibliothèque d'exercices — ouverte en pleine séance (« Ajouter », « Remplacer »)
// ---------------------------------------------------------------------------

describe('exercisesQuery / SELECT_FAVORITE_EXERCISES', () => {
  beforeEach(() => {
    seed('exercises', [
      { id: 'bench', source: 'library', muscle_primary: 'chest', equipment: 'barbell' },
      { id: 'fly', source: 'library', muscle_primary: 'chest', equipment: 'dumbbell' },
      { id: 'row', source: 'library', muscle_primary: 'back', equipment: 'barbell' },
      { id: 'gone', source: 'library', muscle_primary: 'chest', equipment: 'barbell',
        deleted_at: '2026-09-01T00:00:00.000Z' },
    ]);
    seed('exercise_translations', [
      { exercise_id: 'bench', lang: 'fr', name: 'Développé couché' },
      { exercise_id: 'bench', lang: 'en', name: 'Bench press' },
      { exercise_id: 'fly', lang: 'fr', name: 'Écarté' },
      { exercise_id: 'row', lang: 'fr', name: 'Rowing barre' },
      { exercise_id: 'gone', lang: 'fr', name: 'Supprimé' },
    ]);
    seed('exercise_favorites', [{ user_id: 'u1', exercise_id: 'row' }]);
  });

  const run = async (...args: Parameters<typeof exercisesQuery>) => {
    const { sql, params } = exercisesQuery(...args);
    return testPowerSync.getAll<{ id: string; name: string; is_favorite: number }>(sql, params);
  };

  it('liste le catalogue vivant, trié par nom résolu, avec le drapeau favori', async () => {
    const rows = await run('en');

    expect(rows.map((r) => [r.id, r.name, r.is_favorite])).toEqual([
      ['bench', 'Bench press', 0],
      ['row', 'Rowing barre', 1],
      ['fly', 'Écarté', 0],
    ]);
  });

  it('cherche sur le nom résolu — y compris celui venu du repli français', async () => {
    expect((await run('en', 'bench')).map((r) => r.id)).toEqual(['bench']);
    expect((await run('en', 'rowing')).map((r) => r.id)).toEqual(['row']);
    // Le nom français d'un exercice traduit n'est pas son nom affiché en anglais.
    expect(await run('en', 'couché')).toEqual([]);
  });

  it('combine recherche et facettes, paramètres dans le bon ordre', async () => {
    const rows = await run('fr', 'é', ['chest'], ['dumbbell']);

    expect(rows.map((r) => r.id)).toEqual(['fly']);
  });

  it('ne garde que les favoris', async () => {
    const rows = await testPowerSync.getAll<{ id: string }>(SELECT_FAVORITE_EXERCISES, ['fr']);

    expect(rows.map((r) => r.id)).toEqual(['row']);
  });
});

// ---------------------------------------------------------------------------
// Avant-dernière séance — le signal « deux séances difficiles de suite » (MUSC-F7)
// ---------------------------------------------------------------------------

describe('SELECT_SECOND_LAST_PERFORMANCE', () => {
  const secondLast = () =>
    testPowerSync.getAll<{ exercise_id: string; rpe: number }>(SELECT_SECOND_LAST_PERFORMANCE, [
      'squat',
      'squat',
    ]);

  /** Trois séries de squat au RPE donné — la forme ordinaire d'un exercice dans une séance. */
  const threeSets = (rpe: number) =>
    [0, 1, 2].map(() => ({ exercise: 'squat', reps: 5, weight: 100, rpe }));

  function workoutWithRpe(id: string, finishedAt: string, rpe: number) {
    completedWorkout(id, finishedAt, threeSets(rpe));
    return testPowerSync.execute(`UPDATE workout_sets SET rpe = ? WHERE workout_id = ?`, [rpe, id]);
  }

  it('🔴 désigne la séance d’AVANT, même quand la dernière compte plusieurs séries', async () => {
    // `OFFSET 1` s'appliquait aux lignes (une par série), pas aux séances : avec trois séries de
    // squat la dernière fois, « l'avant-dernière séance » était… la dernière. Le deload de MUSC-F7
    // se déclenchait donc après UNE séance difficile, pas deux.
    await workoutWithRpe('w-before', '2026-09-01T10:00:00.000Z', 7);
    await workoutWithRpe('w-last', '2026-09-08T10:00:00.000Z', 9);

    const rows = await secondLast();

    expect(rows.map((r) => r.rpe)).toEqual([7, 7, 7]);
  });

  it('une seule séance en historique → aucune avant-dernière', async () => {
    await workoutWithRpe('w-only', '2026-09-08T10:00:00.000Z', 9);

    expect(await secondLast()).toEqual([]);
  });

  it('porte l’exercice de chaque ligne', async () => {
    await workoutWithRpe('w-before', '2026-09-01T10:00:00.000Z', 8);
    await workoutWithRpe('w-last', '2026-09-08T10:00:00.000Z', 7);

    expect((await secondLast()).every((r) => r.exercise_id === 'squat')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dernière performance
// ---------------------------------------------------------------------------

describe('SELECT_LAST_PERFORMANCE', () => {
  it('porte l’exercice de chaque ligne — de quoi écarter une réponse périmée', async () => {
    // Entre deux exercices, `useQuery` rend un instant les lignes de l'exercice PRÉCÉDENT : sans
    // `exercise_id`, le pré-remplissage affichait la charge du squat sur un curl.
    completedWorkout('w', '2026-09-01T10:00:00.000Z', [
      { exercise: 'squat', reps: 5, weight: 100 },
      { exercise: 'curl', reps: 12, weight: 14 },
    ]);

    const rows = await testPowerSync.getAll<{ exercise_id: string; weight_kg: number }>(
      SELECT_LAST_PERFORMANCE,
      ['curl', 'curl'],
    );

    expect(rows).toEqual([expect.objectContaining({ exercise_id: 'curl', weight_kg: 14 })]);
  });
});
