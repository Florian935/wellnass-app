/**
 * US COLLIS-01 — la requête d'enrichissement du planning, exécutée pour de vrai.
 *
 * Le plan promettait ce fichier et il manquait : sans lui, `SELECT_PLANNED_MUSCLE_SETS` était un
 * export mort, et trois décisions du cadrage n'étaient tenues par rien.
 *
 * Ce que ces tests figent, et pourquoi chacun compte :
 *  - **l'owner-scoping** — le harness sème plusieurs utilisateurs ; sans `owner_id` la requête
 *    remonterait les séances des autres, et le test serait quand même vert sur un seul compte ;
 *  - **`target_sets` NULL** — un exercice planifié sans nombre de séries ne doit pas rapprocher du
 *    seuil, et si tous le sont, `SUM` renvoie `NULL` et non 0 ;
 *  - **l'exercice archivé** — ses séries **comptent** : l'utilisateur fera la séance quand même,
 *    et les exclure sous-compterait ses jambes donc masquerait un conflit réel ;
 *  - **`muscle_primary` NULL** — exclu, sinon la clé `"null"` entrerait dans le test de dominance
 *    comme un groupe concurrent.
 */
import { SELECT_PLANNED_MUSCLE_SETS } from '@/data/repositories/planned-session-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';
import { updateSettings } from '../settings-repository';

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-me' } } }) },
}));

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

const ME = 'user-me';
const OTHER = 'user-other';
const WEEK_START = '2026-08-10';
const WEEK_END = '2026-08-16';

type Row = { planned_session_id: string; muscle: string; sets: number | null };

/** Un exercice, sa place dans une séance, et la séance planifiée qui la porte. */
function seedSession(opts: {
  plannedId: string;
  ownerId?: string;
  date?: string;
  plans: { exerciseId: string; muscle: string | null; sets: number | null; archived?: boolean }[];
}) {
  const sessionId = `session-${opts.plannedId}`;
  seed('planned_sessions', [
    {
      id: opts.plannedId,
      owner_id: opts.ownerId ?? ME,
      session_id: sessionId,
      scheduled_date: opts.date ?? '2026-08-10',
      status: 'planned',
    },
  ]);
  for (const [i, plan] of opts.plans.entries()) {
    seed('exercises', [
      {
        id: plan.exerciseId,
        muscle_primary: plan.muscle,
        deleted_at: plan.archived === true ? '2026-07-01T00:00:00Z' : null,
      },
    ]);
    seed('exercise_plans', [
      {
        id: `${opts.plannedId}-plan-${i}`,
        session_id: sessionId,
        exercise_id: plan.exerciseId,
        target_sets: plan.sets,
        order_index: i,
      },
    ]);
  }
}

const run = (ownerId = ME) =>
  testPowerSync.getAll<Row>(SELECT_PLANNED_MUSCLE_SETS, [ownerId, WEEK_START, WEEK_END]);

beforeEach(() => {
  resetTestDb();
});

describe('SELECT_PLANNED_MUSCLE_SETS', () => {
  it('agrège les séries par groupe musculaire', async () => {
    seedSession({
      plannedId: 'p1',
      plans: [
        { exerciseId: 'e1', muscle: 'legs', sets: 5 },
        { exerciseId: 'e2', muscle: 'legs', sets: 7 },
        { exerciseId: 'e3', muscle: 'chest', sets: 3 },
      ],
    });
    const rows = await run();
    const byMuscle = Object.fromEntries(rows.map((r) => [r.muscle, r.sets]));
    expect(byMuscle).toEqual({ legs: 12, chest: 3 });
  });

  it('ne remonte que les séances de l’utilisateur courant', async () => {
    seedSession({ plannedId: 'mine', plans: [{ exerciseId: 'e1', muscle: 'legs', sets: 10 }] });
    seedSession({
      plannedId: 'theirs',
      ownerId: OTHER,
      plans: [{ exerciseId: 'e2', muscle: 'legs', sets: 99 }],
    });
    const rows = await run();
    expect(rows.map((r) => r.planned_session_id)).toEqual(['mine']);
  });

  it('ignore une série non chiffrée sans perdre les autres', async () => {
    seedSession({
      plannedId: 'p1',
      plans: [
        { exerciseId: 'e1', muscle: 'legs', sets: 6 },
        { exerciseId: 'e2', muscle: 'legs', sets: null },
      ],
    });
    expect((await run())[0]!.sets).toBe(6);
  });

  it('renvoie NULL — et non 0 — quand toutes les séries d’un muscle sont non chiffrées', async () => {
    // C'est la raison du type `sets: number | null` côté TS : un groupe entièrement non chiffré
    // n'est pas un groupe à zéro série.
    seedSession({ plannedId: 'p1', plans: [{ exerciseId: 'e1', muscle: 'legs', sets: null }] });
    expect((await run())[0]!.sets).toBeNull();
  });

  it('compte les séries d’un exercice ARCHIVÉ — l’utilisateur fera la séance quand même', async () => {
    seedSession({
      plannedId: 'p1',
      plans: [
        { exerciseId: 'e1', muscle: 'legs', sets: 6 },
        { exerciseId: 'e2', muscle: 'legs', sets: 6, archived: true },
      ],
    });
    // 12 et non 6 : les exclure sous-compterait les jambes et masquerait un conflit réel.
    expect((await run())[0]!.sets).toBe(12);
  });

  it('exclut un exercice sans groupe musculaire — la clé « null » fausserait la dominance', async () => {
    seedSession({
      plannedId: 'p1',
      plans: [
        { exerciseId: 'e1', muscle: 'legs', sets: 9 },
        { exerciseId: 'e2', muscle: null, sets: 20 },
      ],
    });
    const rows = await run();
    expect(rows.map((r) => r.muscle)).toEqual(['legs']);
  });

  it('borne la fenêtre aux dates demandées', async () => {
    seedSession({
      plannedId: 'dedans',
      date: '2026-08-12',
      plans: [{ exerciseId: 'e1', muscle: 'legs', sets: 8 }],
    });
    seedSession({
      plannedId: 'dehors',
      date: '2026-08-20',
      plans: [{ exerciseId: 'e2', muscle: 'legs', sets: 8 }],
    });
    expect((await run()).map((r) => r.planned_session_id)).toEqual(['dedans']);
  });

  it('ignore une séance planifiée supprimée', async () => {
    seedSession({ plannedId: 'p1', plans: [{ exerciseId: 'e1', muscle: 'legs', sets: 8 }] });
    await testPowerSync.execute(
      `UPDATE planned_sessions SET deleted_at = '2026-08-01T00:00:00Z' WHERE id = 'p1'`,
    );
    expect(await run()).toEqual([]);
  });

  it('ne ramène rien quand l’owner est vide — c’est le gate du réglage opt-in (spec R2)', async () => {
    seedSession({ plannedId: 'p1', plans: [{ exerciseId: 'e1', muscle: 'legs', sets: 12 }] });
    expect(await run('')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Le réglage opt-in — le garde-fou qui manquait à CYCLE-01
// ---------------------------------------------------------------------------

/**
 * `session_conflicts_enabled` est la **4ᵉ colonne** ajoutée à `user_settings` dans ce cas de figure.
 * Les deux premières — `cycle_tracking_enabled` (31/07) et `daily_step_goal` (03/08) — ont causé des
 * pannes **silencieuses** : la colonne manquait au schéma PowerSync local, l'écriture échouait, et
 * `void updateSettings()` avalait l'erreur. L'interrupteur restait éteint sans le moindre message.
 *
 * Ce test écrit puis relit pour de vrai, sur un SQLite dont le DDL est généré depuis `AppSchema` :
 * si la colonne manque au schéma local, il échoue **ici**, pas en recette device.
 */
describe('réglage session_conflicts_enabled (opt-in)', () => {
  type SettingsRow = { user_id: string; session_conflicts_enabled: number | null };

  it('s’écrit et se relit — la colonne existe bien dans le schéma local', async () => {
    seed('user_settings', [{ user_id: ME, theme: 'system', units: 'metric', language: 'fr' }]);

    await updateSettings({ sessionConflictsEnabled: true });

    const [row] = await testPowerSync.getAll<SettingsRow>('SELECT * FROM user_settings');
    expect(row!.session_conflicts_enabled).toBe(1);
  });

  it('se désactive aussi — un opt-in qui ne se retire pas n’en est pas un', async () => {
    seed('user_settings', [
      { user_id: ME, theme: 'system', units: 'metric', language: 'fr', session_conflicts_enabled: 1 },
    ]);

    await updateSettings({ sessionConflictsEnabled: false });

    const [row] = await testPowerSync.getAll<SettingsRow>('SELECT * FROM user_settings');
    expect(row!.session_conflicts_enabled).toBe(0);
  });

  it('crée la ligne de réglages si elle n’existe pas encore', async () => {
    await updateSettings({ sessionConflictsEnabled: true });

    const rows = await testPowerSync.getAll<SettingsRow>('SELECT * FROM user_settings');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.session_conflicts_enabled).toBe(1);
  });
});
