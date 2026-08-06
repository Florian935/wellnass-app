/**
 * Résumé de séance — ce qui est compté, et surtout ce qui ne l'est pas.
 *
 * Lot 5 de [strategie-tests.md](../../../../../docs/specs/technical/strategie-tests.md). On teste
 * `buildSummary` directement plutôt que de monter tout l'écran : la règle qui compte est une
 * fonction pure au-dessus des séries, et l'écran n'y ajoute que de la mise en forme.
 *
 * **La règle des échauffements (spec Refonte-C2 §2.5) est invisible en recette.** Pour constater
 * qu'un exercice composé *uniquement* de séries d'échauffement ne doit pas compter, il faudrait
 * délibérément en faire un et recompter le résumé à la main. Personne ne le fait — et si le filtre
 * sautait, le résumé annoncerait simplement un exercice de plus, sans que rien ne cloche à l'œil.
 *
 * Les briques de calcul (`computeVolume`, `computeTrainingDensity`) sont testées dans
 * `@wellness/shared` : ce qui est vérifié ici, c'est **ce qu'on leur donne à manger**.
 */

import { buildSummary } from '../workout-summary';
import { getWorkoutSets } from '@/data/repositories/workout-repository';

jest.mock('@/data/repositories/workout-repository', () => ({
  getWorkoutSets: jest.fn(),
  setWorkoutFeedback: jest.fn(),
  useWorkoutHistory: jest.fn(() => ({ workouts: [], isLoading: false })),
}));

jest.mock('@/data/repositories/records-repository', () => ({
  useWorkoutRecords: jest.fn(() => ({ records: [], isLoading: false })),
}));

jest.mock('@/data/repositories/workout-template-repository', () => ({
  createTemplateFromWorkout: jest.fn(),
}));

const mockGetWorkoutSets = getWorkoutSets as jest.Mock;

/** Une série telle que la remonte `getWorkoutSets`. */
function set(over: {
  exerciseId?: string;
  setType?: string;
  reps?: number | null;
  weightKg?: number | null;
  done?: boolean;
}) {
  return {
    id: `s-${Math.random()}`,
    exerciseId: over.exerciseId ?? 'squat',
    setType: over.setType ?? 'normal',
    reps: over.reps ?? 10,
    weightKg: over.weightKg ?? 100,
    durationSeconds: null,
    done: over.done !== false,
    orderIndex: 0,
    rpe: null,
    plannedWeightKg: null,
  };
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Comptage nominal
// ---------------------------------------------------------------------------

describe('comptage', () => {
  it('compte les séries validées, les exercices distincts et le tonnage', async () => {
    mockGetWorkoutSets.mockResolvedValue([
      set({ exerciseId: 'squat', reps: 10, weightKg: 100 }),
      set({ exerciseId: 'squat', reps: 8, weightKg: 110 }),
      set({ exerciseId: 'bench', reps: 5, weightKg: 80 }),
    ]);

    const summary = await buildSummary('w1', 3600);

    expect(summary).toMatchObject({
      exercises: 2,
      doneSets: 3,
      warmupSets: 0,
      volume: 10 * 100 + 8 * 110 + 5 * 80,
      durationMin: 60,
    });
  });

  it('ignore les séries NON validées', async () => {
    mockGetWorkoutSets.mockResolvedValue([
      set({ reps: 10, weightKg: 100 }),
      set({ reps: 10, weightKg: 100, done: false }),
    ]);

    expect(await buildSummary('w1', 600)).toMatchObject({ doneSets: 1 });
  });

  it('renvoie un résumé nul sur une séance sans aucune série', async () => {
    mockGetWorkoutSets.mockResolvedValue([]);

    expect(await buildSummary('w1', 600)).toMatchObject({
      exercises: 0,
      doneSets: 0,
      warmupSets: 0,
      volume: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Échauffements — la règle invisible en recette
// ---------------------------------------------------------------------------

describe('échauffements (Refonte-C2 §2.5)', () => {
  it('les compte à part, jamais dans les séries validées', async () => {
    mockGetWorkoutSets.mockResolvedValue([
      set({ setType: 'warmup', reps: 15, weightKg: 40 }),
      set({ setType: 'warmup', reps: 12, weightKg: 60 }),
      set({ reps: 5, weightKg: 100 }),
    ]);

    const summary = await buildSummary('w1', 600);

    expect(summary).toMatchObject({ doneSets: 1, warmupSets: 2 });
  });

  it('ne les compte PAS dans le tonnage', async () => {
    mockGetWorkoutSets.mockResolvedValue([
      set({ setType: 'warmup', reps: 15, weightKg: 40 }),
      set({ reps: 5, weightKg: 100 }),
    ]);

    expect((await buildSummary('w1', 600)).volume).toBe(500);
  });

  it('🔴 un exercice composé UNIQUEMENT d’échauffements ne compte pas comme exercice', async () => {
    mockGetWorkoutSets.mockResolvedValue([
      set({ exerciseId: 'squat', reps: 5, weightKg: 100 }),
      set({ exerciseId: 'rotator-cuff', setType: 'warmup', reps: 20, weightKg: 5 }),
      set({ exerciseId: 'rotator-cuff', setType: 'warmup', reps: 20, weightKg: 5 }),
    ]);

    const summary = await buildSummary('w1', 600);

    // Le cas le plus contre-intuitif de la règle, et le seul qu'on ne verrait pas à l'œil : le
    // résumé annoncerait « 2 exercices » et personne ne s'en étonnerait.
    expect(summary.exercises).toBe(1);
    expect(summary.warmupSets).toBe(2);
  });

  it('un échauffement NON validé ne compte nulle part', async () => {
    mockGetWorkoutSets.mockResolvedValue([
      set({ setType: 'warmup', done: false }),
      set({ reps: 5, weightKg: 100 }),
    ]);

    expect(await buildSummary('w1', 600)).toMatchObject({ warmupSets: 0, doneSets: 1 });
  });
});

// ---------------------------------------------------------------------------
// Durée et densité
// ---------------------------------------------------------------------------

describe('durée et densité', () => {
  it('arrondit la durée à la minute', async () => {
    mockGetWorkoutSets.mockResolvedValue([set({ reps: 10, weightKg: 100 })]);

    expect((await buildSummary('w1', 3630)).durationMin).toBe(61);
  });

  it('plancher d’UNE minute — une densité ne se divise jamais par zéro', async () => {
    mockGetWorkoutSets.mockResolvedValue([set({ reps: 10, weightKg: 100 })]);

    const summary = await buildSummary('w1', 0);

    expect(summary.durationMin).toBe(1);
    expect(summary.density).toBe(1000);
  });

  it('traite une durée absente comme nulle, sans planter', async () => {
    mockGetWorkoutSets.mockResolvedValue([set({ reps: 10, weightKg: 100 })]);

    expect((await buildSummary('w1', null)).durationMin).toBe(1);
  });

  it('rapporte le tonnage à la durée', async () => {
    mockGetWorkoutSets.mockResolvedValue([
      set({ reps: 10, weightKg: 100 }),
      set({ reps: 10, weightKg: 100 }),
    ]);

    // 2 000 kg sur 20 min = 100 kg/min.
    expect((await buildSummary('w1', 1200)).density).toBe(100);
  });
});
