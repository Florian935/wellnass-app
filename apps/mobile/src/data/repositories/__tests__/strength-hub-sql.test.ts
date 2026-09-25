/**
 * Hub muscu (US MUSCU-UX01) — les requêtes de la **zone Agir**, sur du vrai SQLite.
 *
 * ── Le défaut que ces tests verrouillent (recette §57.3, 11/09/2026) ─────────────────────────────
 * `SELECT_TODAY_PLAN` résolvait le nom d'exercice par `COALESCE(etl.name, etfr.name, e.name)`.
 * `exercises` **n'a pas de colonne `name`** : les noms vivent uniquement dans
 * `exercise_translations`. La requête levait donc à chaque rendu, `useQuery` avalait l'erreur,
 * `planRows` restait vide, et `resolveHubState` retombait sur l'état C — « Repos aujourd'hui ».
 *
 * Conséquence en recette : un vendredi avec une séance prévue à 22 h, le hub annonçait un jour de
 * repos et « aucune séance à venir ». L'état B, le plus important des quatre, était **inatteignable
 * pour tout le monde depuis le premier jour** — et aucun test ne pouvait le voir, puisque le hub
 * était testé avec le repository mocké.
 *
 * `strength-hub-repository` n'avait aucun test SQL alors que sa docstring annonce ses `SELECT_*`
 * comme « exportées pour être testables contre le harness SQLite ». C'est réparé ici.
 */

import {
  rowsOfFirstOccurrence,
  SELECT_NEXT_STRENGTH,
  SELECT_PROGRAM_PROGRESS,
  SELECT_SESSION_NAME,
  SELECT_TODAY_DONE,
  SELECT_TODAY_PLAN,
} from '../strength-hub-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

const USER = 'user-1';
const OTHER = 'user-2';
const TODAY = '2026-09-11';
const TOMORROW = '2026-09-12';

type PlanRow = {
  planned_session_id: string;
  session_id: string;
  session_name: string | null;
  program_name: string | null;
  exercise_name: string | null;
  exercise_order: number;
  target_sets: number | null;
  rest_seconds: number | null;
};

beforeEach(() => {
  resetTestDb();

  seed('programs', [
    { id: 'prog-1', owner_id: USER, pillar: 'strength', is_active: 1, duration_weeks: 4 },
    { id: 'prog-run', owner_id: USER, pillar: 'running', is_active: 1, duration_weeks: 4 },
  ]);
  // Un programme personnel n'a pas de traduction dans la langue courante : le `COALESCE` doit
  // retomber sur le français, jamais faire disparaître la ligne (jointures LEFT).
  seed('program_translations', [
    { id: 'pt-1', program_id: 'prog-1', owner_id: USER, lang: 'fr', name: 'Pdm' },
  ]);

  seed('sessions', [
    { id: 'sess-1', program_id: 'prog-1', owner_id: USER, name: 'Séance A', order_index: 0 },
    { id: 'sess-run', program_id: 'prog-run', owner_id: USER, name: 'Endurance', order_index: 0 },
  ]);

  seed('exercises', [
    { id: 'ex-1', source: 'library' },
    { id: 'ex-2', source: 'library' },
  ]);
  seed('exercise_translations', [
    { id: 'et-1', exercise_id: 'ex-1', lang: 'fr', name: 'Développé couché' },
    { id: 'et-2', exercise_id: 'ex-2', lang: 'fr', name: 'Développé militaire' },
  ]);

  seed('exercise_plans', [
    {
      id: 'ep-1', session_id: 'sess-1', owner_id: USER, exercise_id: 'ex-1',
      order_index: 0, target_sets: 4, rest_seconds: 90,
    },
    {
      id: 'ep-2', session_id: 'sess-1', owner_id: USER, exercise_id: 'ex-2',
      order_index: 1, target_sets: 3, rest_seconds: 120,
    },
  ]);
});

/** L'occurrence muscu du jour, encore à faire — le cas de la recette. */
function seedTodayPlanned() {
  seed('planned_sessions', [
    {
      id: 'ps-1', program_id: 'prog-1', session_id: 'sess-1', owner_id: USER,
      scheduled_date: TODAY, scheduled_time: '22:00:00', status: 'planned', week_index: 0,
    },
  ]);
}

const todayPlan = () => testPowerSync.getAll<PlanRow>(SELECT_TODAY_PLAN, ['fr', 'fr', USER, TODAY]);

// ---------------------------------------------------------------------------
// État B — la séance du jour
// ---------------------------------------------------------------------------

describe('SELECT_TODAY_PLAN', () => {
  it('ramène une ligne par exercice planifié, avec le nom résolu par traduction', async () => {
    seedTodayPlanned();

    const rows = await todayPlan();

    expect(rows.map((r) => r.exercise_name)).toEqual([
      'Développé couché',
      'Développé militaire',
    ]);
    expect(rows[0]!.session_name).toBe('Séance A');
    expect(rows[0]!.program_name).toBe('Pdm');
    expect(rows[0]!.planned_session_id).toBe('ps-1');
    expect(rows[0]!.target_sets).toBe(4);
    expect(rows[0]!.rest_seconds).toBe(90);
  });

  it('ordonne les exercices par leur rang dans la séance', async () => {
    seedTodayPlanned();

    const rows = await todayPlan();

    expect(rows.map((r) => r.exercise_order)).toEqual([0, 1]);
  });

  it('retombe sur le français quand la langue courante n’a pas de traduction', async () => {
    seedTodayPlanned();

    const rows = await testPowerSync.getAll<PlanRow>(SELECT_TODAY_PLAN, ['en', 'en', USER, TODAY]);

    expect(rows.map((r) => r.exercise_name)).toEqual([
      'Développé couché',
      'Développé militaire',
    ]);
  });

  it('ignore une occurrence déjà faite', async () => {
    seed('planned_sessions', [
      {
        id: 'ps-1', program_id: 'prog-1', session_id: 'sess-1', owner_id: USER,
        scheduled_date: TODAY, status: 'done', week_index: 0,
      },
    ]);

    expect(await todayPlan()).toEqual([]);
  });

  it('ignore une occurrence de course', async () => {
    seed('planned_sessions', [
      {
        id: 'ps-run', program_id: 'prog-run', session_id: 'sess-run', owner_id: USER,
        scheduled_date: TODAY, status: 'planned', week_index: 0,
      },
    ]);

    expect(await todayPlan()).toEqual([]);
  });

  it('ignore l’occurrence d’un autre utilisateur', async () => {
    seed('planned_sessions', [
      {
        id: 'ps-1', program_id: 'prog-1', session_id: 'sess-1', owner_id: OTHER,
        scheduled_date: TODAY, status: 'planned', week_index: 0,
      },
    ]);

    expect(await todayPlan()).toEqual([]);
  });

  it('ignore une occurrence supprimée', async () => {
    seed('planned_sessions', [
      {
        id: 'ps-1', program_id: 'prog-1', session_id: 'sess-1', owner_id: USER,
        scheduled_date: TODAY, status: 'planned', week_index: 0,
        deleted_at: '2026-09-10T10:00:00Z',
      },
    ]);

    expect(await todayPlan()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// États C — repos, séance déjà faite, prochaine échéance
// ---------------------------------------------------------------------------

describe('SELECT_TODAY_DONE et SELECT_NEXT_STRENGTH', () => {
  it('reconnaît la séance du jour déjà terminée', async () => {
    seed('planned_sessions', [
      {
        id: 'ps-1', program_id: 'prog-1', session_id: 'sess-1', owner_id: USER,
        scheduled_date: TODAY, status: 'done', week_index: 0,
      },
    ]);

    const rows = await testPowerSync.getAll<{ session_name: string }>(SELECT_TODAY_DONE, [
      USER,
      TODAY,
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.session_name).toBe('Séance A');
  });

  it('ne compte pas la séance d’aujourd’hui comme « prochaine » (borne stricte)', async () => {
    seedTodayPlanned();

    expect(await testPowerSync.getAll(SELECT_NEXT_STRENGTH, [USER, TODAY])).toEqual([]);
  });

  it('trouve la prochaine occurrence à venir', async () => {
    seed('planned_sessions', [
      {
        id: 'ps-2', program_id: 'prog-1', session_id: 'sess-1', owner_id: USER,
        scheduled_date: TOMORROW, status: 'planned', week_index: 0,
      },
    ]);

    const rows = await testPowerSync.getAll<{ scheduled_date: string; session_name: string }>(
      SELECT_NEXT_STRENGTH,
      [USER, TODAY],
    );

    expect(rows[0]!.scheduled_date).toBe(TOMORROW);
  });
});

// ---------------------------------------------------------------------------
// La barre « semaine X sur Y »
// ---------------------------------------------------------------------------

describe('SELECT_PROGRAM_PROGRESS', () => {
  it('compte les séances faites et situe la semaine sur la prochaine à faire', async () => {
    seed('planned_sessions', [
      {
        id: 'ps-a', program_id: 'prog-1', session_id: 'sess-1', owner_id: USER,
        scheduled_date: '2026-09-04', status: 'done', week_index: 0,
      },
      {
        id: 'ps-b', program_id: 'prog-1', session_id: 'sess-1', owner_id: USER,
        scheduled_date: TODAY, status: 'planned', week_index: 1,
      },
    ]);

    const [row] = await testPowerSync.getAll<{
      done_count: number;
      total_count: number;
      current_week: number;
    }>(SELECT_PROGRAM_PROGRESS, [USER, 'prog-1']);

    expect(row!.done_count).toBe(1);
    expect(row!.total_count).toBe(2);
    expect(row!.current_week).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// US MUSCU-UX07 — « la dernière fois » dans la carte du jour, et une seule séance par jour (R9)
// ---------------------------------------------------------------------------

describe('MUSCU-UX07 — la séance du jour', () => {
  it('ramène l’exercice et le programme de chaque ligne (la dernière fois, R11)', async () => {
    seedTodayPlanned();

    const rows = await testPowerSync.getAll<{ exercise_id: string; program_id: string }>(
      SELECT_TODAY_PLAN,
      ['fr', 'fr', USER, TODAY],
    );

    expect(rows.map((r) => r.exercise_id)).toEqual(['ex-1', 'ex-2']);
    expect(rows[0]!.program_id).toBe('prog-1');
  });

  it('deux séances prévues le même jour : seule la première est gardée (R9)', async () => {
    seed('sessions', [
      { id: 'sess-2', program_id: 'prog-1', owner_id: USER, name: 'Séance B', order_index: 1 },
    ]);
    seed('exercise_plans', [
      {
        id: 'ep-3', session_id: 'sess-2', owner_id: USER, exercise_id: 'ex-1',
        order_index: 0, target_sets: 5, rest_seconds: 90,
      },
    ]);
    seed('planned_sessions', [
      {
        id: 'ps-2', program_id: 'prog-1', session_id: 'sess-2', owner_id: USER,
        scheduled_date: TODAY, status: 'planned', week_index: 0,
      },
    ]);
    seedTodayPlanned();

    const rows = await todayPlan();
    // Avant MUSCU-UX07, les trois lignes étaient additionnées : « 3 exercices » pour une séance de 2.
    expect(rows).toHaveLength(3);

    const first = rowsOfFirstOccurrence(rows);
    expect(first.map((r) => r.session_name)).toEqual(['Séance A', 'Séance A']);
    expect(first).toHaveLength(2);
  });

  it('sans occurrence : aucune ligne', () => {
    expect(rowsOfFirstOccurrence([])).toEqual([]);
  });

  it('SELECT_SESSION_NAME nomme la séance en cours', async () => {
    const rows = await testPowerSync.getAll<{ name: string | null }>(SELECT_SESSION_NAME, ['sess-1']);
    expect(rows[0]!.name).toBe('Séance A');
  });

  it('SELECT_SESSION_NAME ne renvoie rien pour une séance libre (pas de séance d’origine)', async () => {
    const rows = await testPowerSync.getAll<{ name: string | null }>(SELECT_SESSION_NAME, ['']);
    expect(rows).toEqual([]);
  });
});
