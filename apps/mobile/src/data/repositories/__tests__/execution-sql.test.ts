/**
 * US EXEC-01 — les 4 requêtes du lot « prévu vs réalisé », exécutées sur **du vrai SQLite**.
 *
 * Les moteurs sont testés à 100 % dans `@wellness/shared` ; ce qu'ils ne peuvent pas prouver, c'est
 * **ce qu'on leur donne à manger**. Or tout le risque du lot est là : chaque filtre de ces requêtes
 * porte une règle métier, et un filtre oublié produit un pourcentage faux — pas une erreur.
 *
 * Ce que ces tests figent, et pourquoi chacun compte :
 *  - **`session_id IS NOT NULL`** (R4) — sans lui, les séances **libres** entrent au dénominateur et
 *    font chuter le taux d'exécution de quelqu'un qui s'entraîne beaucoup hors programme : l'inverse
 *    exact du signal recherché, et invisible en recette sans construire le cas exprès ;
 *  - **le `LEFT JOIN` sur `exercise_plans`** — un `JOIN` strict ferait disparaître du taux de
 *    **charge** un exercice ajouté en cours de séance, alors que sa prescription est exploitable ;
 *  - **la duplication de jointure** — un exercice présent deux fois dans une séance de programme
 *    rend deux lignes de plan, donc gonflerait un dénominateur qui est **affiché** ;
 *  - **l'exclusion des échauffements** côté conformité, et leur **conservation** côté répartition :
 *    la contradiction entre les deux requêtes est voulue, donc elle se teste ;
 *  - **l'exercice archivé** — exclu des favoris délaissés (on ne propose pas de reprendre un
 *    exercice retiré), là où COLLIS-01 les garde volontairement. Deux règles opposées sur la même
 *    colonne : le genre de chose qu'une relecture inverse par réflexe.
 */

import {
  SELECT_EXECUTION_COMPLIANCE,
  SELECT_FAVORITE_PRACTICE,
  SELECT_SESSION_DURATIONS,
  SELECT_SET_TYPE_MIX,
} from '../records-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

const ME = 'user-1';
/** Borne basse de fenêtre : tout ce qui est semé après est dedans. */
const WINDOW_START = '2026-05-01T00:00:00Z';
const IN_WINDOW = '2026-07-01T10:00:00Z';
const BEFORE_WINDOW = '2026-01-15T10:00:00Z';

type ComplianceRow = {
  workout_id: string;
  planned_weight_kg: number | null;
  weight_kg: number | null;
  reps: number | null;
  target_reps: string | null;
};

/**
 * Une séance terminée, de programme par défaut.
 *
 * `sessionId: null` fabrique une séance **libre** — c'est le cas qui doit être exclu.
 */
function seedWorkout(opts: {
  id: string;
  sessionId?: string | null;
  finishedAt?: string;
  startedAt?: string;
  durationSeconds?: number | null;
  status?: string;
}) {
  seed('workouts', [
    {
      id: opts.id,
      user_id: ME,
      session_id: opts.sessionId === undefined ? `sess-${opts.id}` : opts.sessionId,
      status: opts.status ?? 'completed',
      started_at: opts.startedAt ?? opts.finishedAt ?? IN_WINDOW,
      finished_at: opts.finishedAt ?? IN_WINDOW,
      duration_seconds: opts.durationSeconds === undefined ? 3000 : opts.durationSeconds,
    },
  ]);
}

function seedSet(opts: {
  id: string;
  workoutId: string;
  exerciseId?: string;
  plannedWeightKg?: number | null;
  weightKg?: number | null;
  reps?: number | null;
  setType?: string;
  done?: boolean;
}) {
  seed('workout_sets', [
    {
      id: opts.id,
      user_id: ME,
      workout_id: opts.workoutId,
      exercise_id: opts.exerciseId ?? 'ex-1',
      planned_weight_kg: opts.plannedWeightKg === undefined ? 100 : opts.plannedWeightKg,
      weight_kg: opts.weightKg === undefined ? 100 : opts.weightKg,
      reps: opts.reps === undefined ? 10 : opts.reps,
      set_type: opts.setType ?? 'normal',
      done: opts.done === false ? 0 : 1,
      order_index: 0,
    },
  ]);
}

function seedPlan(opts: {
  id: string;
  sessionId: string;
  exerciseId?: string;
  targetReps?: string | null;
  targetWeightKg?: number | null;
}) {
  seed('exercise_plans', [
    {
      id: opts.id,
      session_id: opts.sessionId,
      exercise_id: opts.exerciseId ?? 'ex-1',
      target_reps: opts.targetReps === undefined ? '10' : opts.targetReps,
      target_weight_kg: opts.targetWeightKg ?? null,
      order_index: 0,
      set_type: 'normal',
    },
  ]);
}

const compliance = () =>
  testPowerSync.getAll<ComplianceRow>(SELECT_EXECUTION_COMPLIANCE, [WINDOW_START]);
const durations = () =>
  testPowerSync.getAll<{ duration_seconds: number | null }>(SELECT_SESSION_DURATIONS, [
    WINDOW_START,
  ]);
const setTypes = () =>
  testPowerSync.getAll<{ set_type: string }>(SELECT_SET_TYPE_MIX, [WINDOW_START]);
const favorites = (lang = 'fr') =>
  testPowerSync.getAll<{
    exercise_id: string;
    exercise_name: string | null;
    favorited_at: string;
    last_practiced_at: string | null;
  }>(SELECT_FAVORITE_PRACTICE, [lang]);

beforeEach(() => {
  resetTestDb();
});

describe('SELECT_EXECUTION_COMPLIANCE — MUSC-33', () => {
  it('remonte une série de séance de programme avec sa prescription', async () => {
    seedWorkout({ id: 'w1', sessionId: 'sess-1' });
    seedPlan({ id: 'p1', sessionId: 'sess-1', targetReps: '8-12' });
    seedSet({ id: 's1', workoutId: 'w1' });

    const rows = await compliance();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ workout_id: 'w1', planned_weight_kg: 100, target_reps: '8-12' });
  });

  it('🔴 EXCLUT une séance libre — sinon le taux d’exécution s’effondre (R4)', async () => {
    seedWorkout({ id: 'libre', sessionId: null });
    seedSet({ id: 's1', workoutId: 'libre', weightKg: 40 });

    expect(await compliance()).toEqual([]);
  });

  it('exclut une séance hors fenêtre', async () => {
    seedWorkout({ id: 'vieille', sessionId: 'sess-1', finishedAt: BEFORE_WINDOW });
    seedSet({ id: 's1', workoutId: 'vieille' });

    expect(await compliance()).toEqual([]);
  });

  it('exclut une séance non terminée', async () => {
    seedWorkout({ id: 'encours', sessionId: 'sess-1', status: 'in_progress' });
    seedSet({ id: 's1', workoutId: 'encours' });

    expect(await compliance()).toEqual([]);
  });

  it('exclut une série non validée (R5)', async () => {
    seedWorkout({ id: 'w1', sessionId: 'sess-1' });
    seedSet({ id: 's1', workoutId: 'w1', done: false });

    expect(await compliance()).toEqual([]);
  });

  it('exclut les échauffements — improvisés, donc hors mesure', async () => {
    seedWorkout({ id: 'w1', sessionId: 'sess-1' });
    seedSet({ id: 'chauffe', workoutId: 'w1', setType: 'warmup' });
    seedSet({ id: 'travail', workoutId: 'w1', setType: 'normal' });

    const rows = await compliance();
    expect(rows).toHaveLength(1);
  });

  it('exclut une série supprimée', async () => {
    seedWorkout({ id: 'w1', sessionId: 'sess-1' });
    seedSet({ id: 's1', workoutId: 'w1' });
    await testPowerSync.execute(
      `UPDATE workout_sets SET deleted_at = '2026-07-02T00:00:00Z' WHERE id = 's1'`,
    );

    expect(await compliance()).toEqual([]);
  });

  it('🔴 garde la série même SANS plan — le LEFT JOIN n’est pas décoratif', async () => {
    // Un exercice ajouté en cours de séance n'a pas de plan. Un JOIN strict le ferait disparaître du
    // taux de CHARGE aussi, alors que sa `planned_weight_kg` est parfaitement exploitable.
    seedWorkout({ id: 'w1', sessionId: 'sess-1' });
    seedSet({ id: 'improvise', workoutId: 'w1', exerciseId: 'ex-hors-plan' });

    const rows = await compliance();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.planned_weight_kg).toBe(100);
    expect(rows[0]!.target_reps).toBeNull();
  });

  it('ignore un plan supprimé sans perdre la série', async () => {
    seedWorkout({ id: 'w1', sessionId: 'sess-1' });
    seedPlan({ id: 'p1', sessionId: 'sess-1' });
    seedSet({ id: 's1', workoutId: 'w1' });
    await testPowerSync.execute(
      `UPDATE exercise_plans SET deleted_at = '2026-06-01T00:00:00Z' WHERE id = 'p1'`,
    );

    const rows = await compliance();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.target_reps).toBeNull();
  });

  it('🔴 lit la charge prescrite sur la SÉRIE, jamais sur le plan (R7)', async () => {
    // Le plan dit 999 kg, la série en a gardé 100 : c'est 100 qui doit sortir.
    //
    // Ce test protège contre une « correction » qui paraîtrait naturelle en relisant la requête —
    // joindre `ep.target_weight_kg` puisqu'on joint déjà `ep.target_reps`. Ce serait comparer une
    // séance d'il y a trois semaines à une prescription modifiée hier, donc **afficher un écart qui
    // n'a jamais existé**. C'est aussi ce qui rend l'analyse calculable sans dépendre du plan.
    seedWorkout({ id: 'w1', sessionId: 'sess-1' });
    seedPlan({ id: 'p1', sessionId: 'sess-1', targetReps: '10', targetWeightKg: 999 });
    seedSet({ id: 's1', workoutId: 'w1', plannedWeightKg: 100, weightKg: 95 });

    const rows = await compliance();
    expect(rows[0]!.planned_weight_kg).toBe(100);
    // Et la valeur du plan n'est même pas rapatriée : la requête ne la sélectionne pas.
    expect(Object.keys(rows[0]!)).not.toContain('target_weight_kg');
  });

  it('garde la charge prescrite de la série même quand le plan n’en a aucune', async () => {
    seedWorkout({ id: 'w1', sessionId: 'sess-1' });
    seedPlan({ id: 'p1', sessionId: 'sess-1', targetWeightKg: null });
    seedSet({ id: 's1', workoutId: 'w1', plannedWeightKg: 80 });

    expect((await compliance())[0]!.planned_weight_kg).toBe(80);
  });

  it('🔴 duplique bien la série quand l’exercice a DEUX plans — le hook doit dédupliquer', async () => {
    // Ce test ne corrige pas la duplication : il la CONSTATE. C'est le contrat qui justifie le
    // `seen` du hook — sans lui, un dénominateur affiché serait deux fois trop grand.
    seedWorkout({ id: 'w1', sessionId: 'sess-1' });
    seedPlan({ id: 'p1', sessionId: 'sess-1', targetReps: '10' });
    seedPlan({ id: 'p2', sessionId: 'sess-1', targetReps: '10' });
    seedSet({ id: 's1', workoutId: 'w1' });

    expect(await compliance()).toHaveLength(2);
  });
});

describe('SELECT_SESSION_DURATIONS — MUSC-26', () => {
  it('remonte les durées des séances terminées de la fenêtre', async () => {
    seedWorkout({ id: 'w1', durationSeconds: 1800 });
    seedWorkout({ id: 'w2', durationSeconds: 3600 });

    expect((await durations()).map((r) => r.duration_seconds).sort()).toEqual([1800, 3600]);
  });

  it('🔴 rend les séances du plus ANCIEN au plus récent — la tendance en dépend', async () => {
    // L'ordre n'est pas cosmétique : il définit les deux moitiés de la tendance dans
    // `computeSessionDuration`. Semé volontairement dans le désordre.
    seedWorkout({ id: 'milieu', startedAt: '2026-06-15T10:00:00Z', durationSeconds: 2000 });
    seedWorkout({ id: 'recent', startedAt: '2026-07-20T10:00:00Z', durationSeconds: 3000 });
    seedWorkout({ id: 'ancien', startedAt: '2026-05-10T10:00:00Z', durationSeconds: 1000 });

    expect((await durations()).map((r) => r.duration_seconds)).toEqual([1000, 2000, 3000]);
  });

  it('garde une durée nulle — c’est au moteur de l’écarter, pas à la requête', async () => {
    // La requête ne juge pas la plausibilité : elle rapporte. Filtrer ici priverait le moteur du
    // comptage des séances écartées, que la carte affiche (R10).
    seedWorkout({ id: 'w1', durationSeconds: null });

    expect(await durations()).toEqual([{ duration_seconds: null }]);
  });

  it('inclut une séance libre — la durée ne dépend d’aucune prescription', async () => {
    seedWorkout({ id: 'libre', sessionId: null, durationSeconds: 2400 });

    expect(await durations()).toHaveLength(1);
  });

  it('exclut une séance hors fenêtre et une séance non terminée', async () => {
    seedWorkout({ id: 'vieille', finishedAt: BEFORE_WINDOW });
    seedWorkout({ id: 'encours', status: 'in_progress' });

    expect(await durations()).toEqual([]);
  });
});

describe('SELECT_SET_TYPE_MIX — MUSC-13', () => {
  it('🔴 GARDE les échauffements — c’est précisément ce que l’analyse montre', async () => {
    // Contradiction volontaire avec SELECT_EXECUTION_COMPLIANCE : « 21 % d'échauffement » est
    // l'information, pas du bruit à filtrer.
    seedWorkout({ id: 'w1' });
    seedSet({ id: 's1', workoutId: 'w1', setType: 'warmup' });
    seedSet({ id: 's2', workoutId: 'w1', setType: 'normal' });

    expect((await setTypes()).map((r) => r.set_type).sort()).toEqual(['normal', 'warmup']);
  });

  it('inclut les séances libres — le style d’entraînement ne dépend pas d’un programme', async () => {
    seedWorkout({ id: 'libre', sessionId: null });
    seedSet({ id: 's1', workoutId: 'libre' });

    expect(await setTypes()).toHaveLength(1);
  });

  it('exclut les séries non validées et les séances hors fenêtre', async () => {
    seedWorkout({ id: 'w1' });
    seedSet({ id: 'pasfaite', workoutId: 'w1', done: false });
    seedWorkout({ id: 'vieille', finishedAt: BEFORE_WINDOW });
    seedSet({ id: 's2', workoutId: 'vieille' });

    expect(await setTypes()).toEqual([]);
  });
});

describe('SELECT_FAVORITE_PRACTICE — MUSC-21', () => {
  function seedFavorite(exerciseId: string, favoritedAt = '2026-01-01T00:00:00Z') {
    // Pas de `status` : la colonne existe côté Postgres mais **pas dans le schéma PowerSync local**,
    // et le harness génère son DDL depuis ce schéma. Un rappel utile que la base embarquée est un
    // sous-ensemble du cloud, pas sa copie.
    seed('exercises', [{ id: exerciseId, muscle_primary: 'back', source: 'library' }]);
    seed('exercise_translations', [
      { id: `tr-fr-${exerciseId}`, exercise_id: exerciseId, lang: 'fr', name: `FR ${exerciseId}` },
    ]);
    seed('exercise_favorites', [
      { id: `fav-${exerciseId}`, user_id: ME, exercise_id: exerciseId, created_at: favoritedAt },
    ]);
  }

  it('remonte un favori jamais pratiqué, avec sa date d’ajout', async () => {
    seedFavorite('ex-1', '2026-02-03T00:00:00Z');

    const rows = await favorites();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.last_practiced_at).toBeNull();
    expect(rows[0]!.favorited_at).toBe('2026-02-03T00:00:00Z');
    expect(rows[0]!.exercise_name).toBe('FR ex-1');
  });

  it('rend la DERNIÈRE pratique validée, pas la première', async () => {
    seedFavorite('ex-1');
    seedWorkout({ id: 'ancienne', finishedAt: '2026-05-10T10:00:00Z' });
    seedWorkout({ id: 'recente', finishedAt: '2026-07-20T10:00:00Z' });
    seedSet({ id: 's1', workoutId: 'ancienne', exerciseId: 'ex-1' });
    seedSet({ id: 's2', workoutId: 'recente', exerciseId: 'ex-1' });

    expect((await favorites())[0]!.last_practiced_at).toBe('2026-07-20T10:00:00Z');
  });

  it('🔴 ne compte PAS une série non validée comme une pratique', async () => {
    seedFavorite('ex-1');
    seedWorkout({ id: 'w1' });
    seedSet({ id: 's1', workoutId: 'w1', exerciseId: 'ex-1', done: false });

    expect((await favorites())[0]!.last_practiced_at).toBeNull();
  });

  it('🔴 EXCLUT un favori dont l’exercice est archivé', async () => {
    // Règle **opposée** à celle de COLLIS-01, qui garde volontairement les exercices archivés : là
    // une séance planifiée sera quand même faite ; ici on ne propose pas de reprendre un exercice
    // que l'utilisateur a retiré de sa bibliothèque.
    seedFavorite('ex-archive');
    await testPowerSync.execute(
      `UPDATE exercises SET deleted_at = '2026-06-01T00:00:00Z' WHERE id = 'ex-archive'`,
    );

    expect(await favorites()).toEqual([]);
  });

  it('exclut un favori retiré (soft delete)', async () => {
    seedFavorite('ex-1');
    await testPowerSync.execute(
      `UPDATE exercise_favorites SET deleted_at = '2026-06-01T00:00:00Z' WHERE id = 'fav-ex-1'`,
    );

    expect(await favorites()).toEqual([]);
  });

  it('🔴 n’est PAS borné par la fenêtre de 12 semaines', async () => {
    // Un favori délaissé depuis 8 mois est exactement celui qu'on cherche : le borner le ferait
    // disparaître de la liste des délaissés.
    seedFavorite('ex-1');
    seedWorkout({ id: 'tres-vieille', finishedAt: '2025-11-01T10:00:00Z' });
    seedSet({ id: 's1', workoutId: 'tres-vieille', exerciseId: 'ex-1' });

    expect((await favorites())[0]!.last_practiced_at).toBe('2025-11-01T10:00:00Z');
  });

  it('replie sur le français quand la langue demandée n’a pas de traduction', async () => {
    seedFavorite('ex-1');

    expect((await favorites('en'))[0]!.exercise_name).toBe('FR ex-1');
  });

  it('rend une ligne par favori, sans doublon malgré plusieurs séries', async () => {
    seedFavorite('ex-1');
    seedWorkout({ id: 'w1' });
    seedSet({ id: 's1', workoutId: 'w1', exerciseId: 'ex-1' });
    seedSet({ id: 's2', workoutId: 'w1', exerciseId: 'ex-1' });
    seedSet({ id: 's3', workoutId: 'w1', exerciseId: 'ex-1' });

    expect(await favorites()).toHaveLength(1);
  });
});
