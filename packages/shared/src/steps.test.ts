import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STEP_GOAL,
  MAX_PLAUSIBLE_STEPS,
  averageSteps,
  bestSteps,
  dayKeyOfBucket,
  isGoalReached,
  mergeDailySteps,
  normalizeStepGoal,
  shouldImportSteps,
  stepsActiveDays,
  toDailySteps,
} from './steps';

/** Bucket tel que le natif le produit : `LocalDateTime.toString()`, donc sans fuseau. */
const bucket = (startTime: string | null | undefined, count: number | null | undefined) => ({
  startTime,
  endTime: null,
  result: { COUNT_TOTAL: count },
});

describe('dayKeyOfBucket', () => {
  it('lit la date littéralement quand il n’y a pas de fuseau (cas réel du natif)', () => {
    // `LocalDateTime.toString()` omet les secondes nulles : la forme courte doit passer.
    expect(dayKeyOfBucket('2026-07-27T00:00')).toBe('2026-07-27');
    expect(dayKeyOfBucket('2026-07-27T00:00:00')).toBe('2026-07-27');
  });

  it('ne décale JAMAIS le jour, quel que soit le fuseau de la machine', () => {
    // Le cœur du sujet : un calcul via Date() daterait ce bucket au 26 dans un fuseau positif.
    expect(dayKeyOfBucket('2026-07-27T00:00')).toBe('2026-07-27');
    // Et même en fin de journée civile.
    expect(dayKeyOfBucket('2026-12-31T00:00')).toBe('2026-12-31');
  });

  it('retombe sur un calcul de fuseau si un instant est fourni (défense)', () => {
    // 2026-07-26T22:00Z avec un décalage de +02:00 → 2026-07-27 en heure locale.
    expect(dayKeyOfBucket('2026-07-26T22:00:00Z', 7200)).toBe('2026-07-27');
    expect(dayKeyOfBucket('2026-07-27T01:00:00Z', -7200)).toBe('2026-07-26');
  });

  it('renvoie null sur une entrée inexploitable', () => {
    expect(dayKeyOfBucket(null)).toBeNull();
    expect(dayKeyOfBucket(undefined)).toBeNull();
    expect(dayKeyOfBucket('')).toBeNull();
    expect(dayKeyOfBucket('pas une date')).toBeNull();
  });
});

describe('toDailySteps', () => {
  it('convertit les buckets en lignes journalières, triées par date', () => {
    expect(
      toDailySteps([bucket('2026-07-27T00:00', 8432), bucket('2026-07-26T00:00', 5120)]),
    ).toEqual([
      { logDate: '2026-07-26', steps: 5120 },
      { logDate: '2026-07-27', steps: 8432 },
    ]);
  });

  it('ignore les journées à zéro (indistinguables d’une journée sans donnée)', () => {
    expect(toDailySteps([bucket('2026-07-27T00:00', 0)])).toEqual([]);
  });

  it('arrondit un total non entier', () => {
    expect(toDailySteps([bucket('2026-07-27T00:00', 8432.6)])).toEqual([
      { logDate: '2026-07-27', steps: 8433 },
    ]);
  });

  it('écarte les valeurs aberrantes et non finies', () => {
    expect(toDailySteps([bucket('2026-07-27T00:00', MAX_PLAUSIBLE_STEPS + 1)])).toEqual([]);
    expect(toDailySteps([bucket('2026-07-27T00:00', -50)])).toEqual([]);
    expect(toDailySteps([bucket('2026-07-27T00:00', Number.NaN)])).toEqual([]);
    expect(toDailySteps([bucket('2026-07-27T00:00', Number.POSITIVE_INFINITY)])).toEqual([]);
    expect(toDailySteps([bucket('2026-07-27T00:00', null)])).toEqual([]);
  });

  it('ignore un bucket sans date lisible sans faire échouer les autres', () => {
    expect(toDailySteps([bucket(null, 900), bucket('2026-07-27T00:00', 1200)])).toEqual([
      { logDate: '2026-07-27', steps: 1200 },
    ]);
  });

  it('garde le plus grand total si une date apparaît deux fois', () => {
    expect(
      toDailySteps([bucket('2026-07-27T00:00', 3000), bucket('2026-07-27T00:00', 7000)]),
    ).toEqual([{ logDate: '2026-07-27', steps: 7000 }]);
  });

  it('tolère un résultat absent', () => {
    expect(toDailySteps([{ startTime: '2026-07-27T00:00' }])).toEqual([]);
    expect(toDailySteps([{ startTime: '2026-07-27T00:00', result: null }])).toEqual([]);
  });
});

describe('mergeDailySteps', () => {
  it('crée les jours absents localement', () => {
    expect(mergeDailySteps([{ logDate: '2026-07-27', steps: 8000 }], [])).toEqual({
      toCreate: [{ logDate: '2026-07-27', steps: 8000 }],
      toUpdate: [],
    });
  });

  it('met à jour un jour dont le total stocké est plus faible', () => {
    expect(
      mergeDailySteps(
        [{ logDate: '2026-07-27', steps: 8000 }],
        [{ logDate: '2026-07-27', steps: 6000 }],
      ),
    ).toEqual({ toCreate: [], toUpdate: [{ logDate: '2026-07-27', steps: 8000 }] });
  });

  it('n’écrase pas un total stocké plus élevé (règle du max, cas 2 appareils)', () => {
    expect(
      mergeDailySteps(
        [{ logDate: '2026-07-27', steps: 300 }],
        [{ logDate: '2026-07-27', steps: 9000 }],
      ),
    ).toEqual({ toCreate: [], toUpdate: [] });
  });

  it('ne fait rien à valeur égale (import idempotent)', () => {
    expect(
      mergeDailySteps(
        [{ logDate: '2026-07-27', steps: 9000 }],
        [{ logDate: '2026-07-27', steps: 9000 }],
      ),
    ).toEqual({ toCreate: [], toUpdate: [] });
  });

  it('traite une ligne locale supprimée comme absente', () => {
    expect(
      mergeDailySteps(
        [{ logDate: '2026-07-27', steps: 8000 }],
        [{ logDate: '2026-07-27', steps: 9000, deletedAt: '2026-07-27T10:00:00Z' }],
      ),
    ).toEqual({ toCreate: [{ logDate: '2026-07-27', steps: 8000 }], toUpdate: [] });
  });
});

describe('normalizeStepGoal', () => {
  it('borne, arrondit et retombe sur le défaut', () => {
    expect(normalizeStepGoal(10000)).toBe(10000);
    expect(normalizeStepGoal(null)).toBe(DEFAULT_STEP_GOAL);
    expect(normalizeStepGoal(undefined)).toBe(DEFAULT_STEP_GOAL);
    expect(normalizeStepGoal(0)).toBe(DEFAULT_STEP_GOAL);
    expect(normalizeStepGoal(-5)).toBe(DEFAULT_STEP_GOAL);
    expect(normalizeStepGoal(Number.NaN)).toBe(DEFAULT_STEP_GOAL);
    expect(normalizeStepGoal(10)).toBe(1000);
    expect(normalizeStepGoal(999999)).toBe(50000);
    expect(normalizeStepGoal(8000.4)).toBe(8000);
  });
});

describe('isGoalReached', () => {
  it('est inclusif', () => {
    expect(isGoalReached(8000, 8000)).toBe(true);
    expect(isGoalReached(7999, 8000)).toBe(false);
  });

  it('un objectif invalide retombe sur le défaut au lieu de tout valider', () => {
    // Sans ce garde-fou, la série deviendrait inbrisable dès qu'un objectif est nul.
    expect(isGoalReached(500, 0)).toBe(false);
    expect(isGoalReached(500, null)).toBe(false);
    expect(isGoalReached(DEFAULT_STEP_GOAL, null)).toBe(true);
  });

  it('aucun pas → jamais atteint', () => {
    expect(isGoalReached(0, 8000)).toBe(false);
    expect(isGoalReached(null, 8000)).toBe(false);
    expect(isGoalReached(Number.NaN, 8000)).toBe(false);
  });
});

describe('stepsActiveDays', () => {
  it('ne retient que les jours où l’objectif est atteint', () => {
    const rows = [
      { logDate: '2026-07-25', steps: 9000 },
      { logDate: '2026-07-26', steps: 4000 },
      { logDate: '2026-07-27', steps: 8000 },
    ];
    expect(stepsActiveDays(rows, 8000)).toEqual(new Set(['2026-07-25', '2026-07-27']));
  });

  it('un objectif plus bas rallume des jours passés (conséquence assumée de la spec)', () => {
    const rows = [{ logDate: '2026-07-26', steps: 4000 }];
    expect(stepsActiveDays(rows, 8000)).toEqual(new Set());
    expect(stepsActiveDays(rows, 3000)).toEqual(new Set(['2026-07-26']));
  });
});

describe('shouldImportSteps', () => {
  const now = Date.parse('2026-07-27T12:00:00Z');

  it('autorise sans curseur', () => {
    expect(shouldImportSteps(null, now, 1)).toBe(true);
    expect(shouldImportSteps(undefined, now, 1)).toBe(true);
  });

  it('refuse dans la fenêtre, autorise au-delà', () => {
    expect(shouldImportSteps('2026-07-27T11:30:00Z', now, 1)).toBe(false);
    expect(shouldImportSteps('2026-07-27T11:00:00Z', now, 1)).toBe(true);
    expect(shouldImportSteps('2026-07-27T10:59:00Z', now, 1)).toBe(true);
  });

  it('autorise en cas de doute (curseur illisible, horloge dans le futur)', () => {
    expect(shouldImportSteps('pas une date', now, 1)).toBe(true);
    expect(shouldImportSteps('2026-07-28T00:00:00Z', now, 1)).toBe(true);
  });

  it('accepte la forme à espace de la base locale', () => {
    expect(shouldImportSteps('2026-07-27 11:30:00Z', now, 1)).toBe(false);
  });
});

describe('averageSteps / bestSteps', () => {
  it('calculent moyenne et meilleur jour', () => {
    const rows = [{ steps: 6000 }, { steps: 9000 }, { steps: 3000 }];
    expect(averageSteps(rows)).toBe(6000);
    expect(bestSteps(rows)).toBe(9000);
  });

  it('renvoient 0 sur une liste vide', () => {
    expect(averageSteps([])).toBe(0);
    expect(bestSteps([])).toBe(0);
  });
});
