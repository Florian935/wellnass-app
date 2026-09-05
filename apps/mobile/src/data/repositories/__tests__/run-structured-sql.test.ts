/**
 * US RUN-F4 — écritures des séances structurées, sur **du vrai SQLite**.
 *
 * Ce fichier existe pour une raison précise, écrite au registre des migrations : **une colonne
 * non déclarée dans `powersync/schema.ts` fait échouer l'écriture SANS AUCUN MESSAGE** — la
 * panne exacte de CYCLE-01 (recette du 31/07/2026), répétée par HORAIRE-01. Le réglage reste
 * éteint, la consigne ne se pose jamais, et rien ne le dit.
 *
 * RUN-F4 ajoute **19 colonnes** (8 sur `sessions`, 11 sur `session_intervals`), **3 sur
 * `programs`** et **2 tables neuves**. Chaque écriture est donc suivie d'une relecture : si une
 * colonne manque au schéma local, le test tombe ici plutôt qu'en recette sur device.
 */

import {
  addIntervalBlock,
  updateIntervalBlock,
  updateProgramTarget,
  updateRunningSession,
} from '../program-repository';
import { recordIntervalResult } from '../run-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

jest.mock('@/i18n', () => ({ getAppLanguage: () => 'fr', default: { language: 'fr' } }));

type SessionRow = Record<string, unknown> & { id: string };

const SESSION_ID = 'session-1';
const PROGRAM_ID = 'program-1';
const RUN_ID = 'run-1';

beforeEach(() => {
  resetTestDb();
  seed('programs', [{ id: PROGRAM_ID, owner_id: 'user-1', pillar: 'running', status: 'draft' }]);
  seed('sessions', [
    { id: SESSION_ID, program_id: PROGRAM_ID, owner_id: 'user-1', order_index: 0, session_type: 'fractionne' },
  ]);
  seed('runs', [{ id: RUN_ID, user_id: 'user-1', status: 'active', started_at: '2026-09-05T06:00:00Z' }]);
});

const session = () => rowsOf<SessionRow>('sessions').find((s) => s.id === SESSION_ID)!;
const blocks = () => rowsOf<SessionRow>('session_intervals');
const runIntervals = () => rowsOf<SessionRow>('run_intervals');

describe('sessions — la consigne (lots A, G, I)', () => {
  it('écrit ET relit les 8 colonnes de consigne', async () => {
    await updateRunningSession(SESSION_ID, {
      targetPaceMinSPerKm: 245,
      targetPaceMaxSPerKm: 250,
      targetRpe: 8,
      targetTimeSeconds: 1200,
      pacingPlan: [{ km: 1, paceMinSPerKm: 242, paceMaxSPerKm: 242 }],
      description: 'Accumuler du volume',
      instructions: 'Ne pas accélérer le premier 1 000 m',
      adaptationCriterion: 'Réduire à 4 répétitions si la foulée se dégrade',
    });

    const row = session();
    expect(row['target_pace_min_s_per_km']).toBe(245);
    expect(row['target_pace_max_s_per_km']).toBe(250);
    expect(row['target_rpe']).toBe(8);
    expect(row['target_time_seconds']).toBe(1200);
    expect(row['description']).toBe('Accumuler du volume');
    expect(row['instructions']).toBe('Ne pas accélérer le premier 1 000 m');
    expect(row['adaptation_criterion']).toBe('Réduire à 4 répétitions si la foulée se dégrade');
  });

  it('sérialise le plan de passage en JSON relisible', async () => {
    const plan = [
      { km: 1, paceMinSPerKm: 242, paceMaxSPerKm: 242 },
      { km: 2, paceMinSPerKm: 240, paceMaxSPerKm: 240 },
    ];
    await updateRunningSession(SESSION_ID, { pacingPlan: plan });

    expect(JSON.parse(String(session()['pacing_plan']))).toEqual(plan);
  });

  it('efface la consigne quand on repasse à null — sans toucher aux autres colonnes', async () => {
    await updateRunningSession(SESSION_ID, { targetPaceMinSPerKm: 245, targetRpe: 8 });
    await updateRunningSession(SESSION_ID, { targetPaceMinSPerKm: null });

    expect(session()['target_pace_min_s_per_km']).toBeNull();
    // Une clé absente du patch ne doit jamais être réécrite : c'est le contrat de `updateX`.
    expect(session()['target_rpe']).toBe(8);
  });
});

describe('session_intervals — les segments (lots A, B, C, D)', () => {
  it('crée un segment avec la nature « work » par défaut', async () => {
    await addIntervalBlock(SESSION_ID, { reps: 8, fastDistanceM: 400 });

    // Défaut aligné sur la base (`default 'work'`) : une ligne sans nature EST du corps de séance.
    expect(blocks()[0]!['kind']).toBe('work');
  });

  it('écrit ET relit les 11 colonnes de segment', async () => {
    await addIntervalBlock(SESSION_ID, {
      reps: 3,
      fastDistanceM: 800,
      kind: 'warmup',
      label: 'Lignes droites',
      fastPaceMinSPerKm: 245,
      fastPaceMaxSPerKm: 250,
      fastTargetTimeMinSeconds: 98,
      fastTargetTimeMaxSeconds: 100,
      recoveryKind: 'walk',
      recoveryPaceMinSPerKm: 390,
      recoveryPaceMaxSPerKm: 420,
      groupKey: 'g1',
      groupReps: 3,
    });

    const row = blocks()[0]!;
    expect(row['kind']).toBe('warmup');
    expect(row['label']).toBe('Lignes droites');
    expect(row['fast_pace_min_s_per_km']).toBe(245);
    expect(row['fast_pace_max_s_per_km']).toBe(250);
    expect(row['fast_target_time_min_seconds']).toBe(98);
    expect(row['fast_target_time_max_seconds']).toBe(100);
    expect(row['recovery_kind']).toBe('walk');
    expect(row['recovery_pace_min_s_per_km']).toBe(390);
    expect(row['recovery_pace_max_s_per_km']).toBe(420);
    expect(row['group_key']).toBe('g1');
    expect(row['group_reps']).toBe(3);
  });

  it('met à jour un segment sans écraser ce qui n’est pas dans le patch', async () => {
    await addIntervalBlock(SESSION_ID, { reps: 8, fastDistanceM: 400, kind: 'work' });
    const id = String(blocks()[0]!.id);

    await updateIntervalBlock(id, { fastPaceMinSPerKm: 245 });

    expect(blocks()[0]!['fast_pace_min_s_per_km']).toBe(245);
    expect(blocks()[0]!['fast_distance_m']).toBe(400);
    expect(blocks()[0]!['reps']).toBe(8);
  });

  it('porte distance ET chrono cible sur la même fraction (lot C)', async () => {
    // « 400 m en 1:38 » : la distance borne la phase, le chrono est la cible à tenir dedans.
    // Le modèle RUN-F2c imposait l'un OU l'autre, et c'est la forme de 12 séances sur 24.
    await addIntervalBlock(SESSION_ID, {
      fastDistanceM: 400,
      fastTargetTimeMinSeconds: 98,
    });

    const row = blocks()[0]!;
    expect(row['fast_distance_m']).toBe(400);
    expect(row['fast_duration_seconds']).toBeNull();
    expect(row['fast_target_time_min_seconds']).toBe(98);
  });
});

describe('programs — l’échéance (lot H)', () => {
  it('écrit ET relit la date de course, le chrono visé et l’événement', async () => {
    await updateProgramTarget(PROGRAM_ID, {
      targetDate: '2026-10-25',
      targetTimeSeconds: 1200,
      eventName: 'Course caritative',
    });

    const row = rowsOf<SessionRow>('programs').find((p) => p.id === PROGRAM_ID)!;
    expect(row['target_date']).toBe('2026-10-25');
    expect(row['target_time_seconds']).toBe(1200);
    expect(row['event_name']).toBe('Course caritative');
  });
});

describe('run_intervals — le réalisé par répétition (lot F)', () => {
  const draft = (phaseIndex: number) => ({
    phaseIndex,
    phaseKind: 'fast' as const,
    segmentKind: 'work' as const,
    rep: 1,
    totalReps: 8,
    plannedDistanceM: 400,
    plannedDurationSeconds: null,
    plannedPaceMinSPerKm: 245,
    plannedPaceMaxSPerKm: 250,
    actualDistanceM: 402,
    actualDurationSeconds: 100,
    actualPaceSPerKm: 248.7,
  });

  it('enregistre une phase franchie', async () => {
    await recordIntervalResult(RUN_ID, draft(0));

    const row = runIntervals()[0]!;
    expect(row['run_id']).toBe(RUN_ID);
    expect(row['phase_index']).toBe(0);
    expect(row['planned_distance_m']).toBe(400);
    expect(row['actual_distance_m']).toBe(402);
    expect(row['finished_at']).toBeTruthy();
  });

  it('🔴 est idempotent : le rattrapage silencieux ne duplique pas une phase', async () => {
    // RUN-F2d (R8 bis) rejoue la progression au remontage de l'écran. Sans cette garde, une
    // même fraction produirait plusieurs lignes — et côté cloud, la violation de l'index unique
    // **bloquerait toute la file d'upload PowerSync**, pas seulement la ligne fautive.
    await recordIntervalResult(RUN_ID, draft(0));
    await recordIntervalResult(RUN_ID, draft(0));

    expect(runIntervals()).toHaveLength(1);
  });

  it('accepte un réalisé partiel — un rattrapage ne connaît pas la durée par fraction', async () => {
    // Écrire une allure inventée serait pire qu'une case vide.
    await recordIntervalResult(RUN_ID, {
      ...draft(1),
      actualDurationSeconds: null,
      actualPaceSPerKm: null,
    });

    const row = runIntervals()[0]!;
    expect(row['actual_duration_seconds']).toBeNull();
    expect(row['actual_pace_s_per_km']).toBeNull();
    expect(row['actual_distance_m']).toBe(402);
  });

  it('distingue les phases par leur index', async () => {
    await recordIntervalResult(RUN_ID, draft(0));
    await recordIntervalResult(RUN_ID, draft(1));

    expect(runIntervals().map((r) => r['phase_index'])).toEqual([0, 1]);
  });
});
