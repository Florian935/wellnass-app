/**
 * US RUN-F2d / RUN-F4 / CARDIO-UX01 — le guidage de séance fractionnée. Fichier à **0 %**.
 *
 * Ce hook porte un **défaut déjà corrigé une fois**, et c'est la meilleure raison de le tester :
 * le suivi de phase était gaté par `enabled`, qui incluait le réglage de guidage vocal — **éteint
 * par défaut**. Conséquence pour la majorité des utilisateurs : `interval_phase_index` restait
 * `null`, le bandeau de segment ne bougeait jamais, et `run_intervals` restait vide, donc le
 * tableau « fraction par fraction » du résumé n'avait rien à afficher. Tout cela **sans erreur**,
 * sans rien à l'écran qui suggère un problème. La séparation des deux responsabilités (la donnée
 * toujours, le confort derrière son réglage) est ce que ces tests verrouillent en premier.
 *
 * Les trois autres règles, toutes invisibles :
 *
 * - **Le rattrapage est silencieux** (R8 bis). Au remontage de l'écran, la persistance se réaligne
 *   mais on ne rejoue pas les transitions manquées — sinon le coureur entend d'un coup les quatre
 *   annonces des fractions courues écran éteint.
 * - **Toutes les phases franchies sont enregistrées**, pas seulement la dernière : une évaluation
 *   peut en franchir plusieurs d'un coup, et le tableau du résumé aurait des trous là où le coureur
 *   a le plus besoin de voir ce qui s'est passé.
 * - **Ce qui n'est pas attribuable est écrit `null`.** Plusieurs phases d'un coup : on connaît le
 *   total, pas la répartition. Une allure fausse dans le tableau serait pire qu'une case vide.
 */

import { renderHook } from '@testing-library/react-native';
import { Vibration } from 'react-native';
import * as Speech from 'expo-speech';

import { toPhaseBlockInput, useIntervalGuidance } from '../interval-guidance';
import { advanceIntervalPhase, recordIntervalResult } from '@/data/repositories/run-repository';

jest.mock('@/data/repositories/run-repository', () => ({
  advanceIntervalPhase: jest.fn(async () => undefined),
  recordIntervalResult: jest.fn(async () => undefined),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // La clé ET ses variables : c'est ce qui permet d'affirmer *ce qui est dit*, pas seulement
    // qu'on a parlé. Le repli `defaultValue` est rendu explicite pour le vérifier aussi.
    t: (key: string, vars?: Record<string, unknown>) =>
      `${key}|${JSON.stringify(vars ?? {})}`,
  }),
}));

const advance = advanceIntervalPhase as jest.Mock;
const record = recordIntervalResult as jest.Mock;
const speak = Speech.speak as unknown as jest.Mock;
const vibrate = Vibration.vibrate as unknown as jest.Mock;

/** Un bloc de fractionné : `reps` × `fast` / `recovery`, en distance par défaut. */
const block = (over: Record<string, unknown> = {}) => ({
  id: 'blk-1',
  reps: 2,
  fastDistanceM: 400,
  fastDurationSeconds: null,
  fastPacePctVma: null,
  recoveryDistanceM: 200,
  recoveryDurationSeconds: null,
  kind: 'work',
  label: null,
  fastPaceMinSPerKm: null,
  fastPaceMaxSPerKm: null,
  fastTargetTimeMinSeconds: null,
  fastTargetTimeMaxSeconds: null,
  recoveryKind: null,
  recoveryPaceMinSPerKm: null,
  recoveryPaceMaxSPerKm: null,
  groupKey: null,
  groupReps: null,
  fastPaceProgressive: null,
  ...over,
}) as never;

type Input = Parameters<typeof useIntervalGuidance>[0];

const input = (over: Partial<Input> = {}): Input => ({
  voiceEnabled: true,
  runId: 'run-1',
  blocks: [block()],
  distanceM: 0,
  durationSeconds: 0,
  persistedPhaseIndex: null,
  persistedPhaseStartDistanceM: null,
  persistedPhaseStartDurationS: null,
  vmaPaceSPerKm: null,
  ...over,
});

/** Monte le hook, puis le refait tourner avec de nouvelles entrées (progression de la course). */
async function run(first: Partial<Input>, ...next: Partial<Input>[]) {
  const { result, rerender } = await renderHook((props: Input) => useIntervalGuidance(props), {
    initialProps: input(first),
  });
  for (const step of next) await rerender(input(step));
  return result;
}

/** Tout ce qui a été dit, clés seules. */
const spokenKeys = () => speak.mock.calls.map((c) => String(c[0]).split('|')[0]);

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// La séparation des deux responsabilités — le défaut de CARDIO-UX01 R5
// ---------------------------------------------------------------------------

describe('suivi de phase et guidage vocal sont deux choses', () => {
  it('🔴 suit la phase même quand le guidage vocal est ÉTEINT (le défaut corrigé)', async () => {
    await run({ voiceEnabled: false });

    expect(advance).toHaveBeenCalledWith('run-1', {
      phaseIndex: 0,
      phaseStartDistanceM: 0,
      phaseStartDurationS: 0,
    });
    expect(speak).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('annonce et vibre au premier départ quand le guidage est allumé', async () => {
    await run({ voiceEnabled: true });

    expect(advance).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('ne suit rien sans course en cours', async () => {
    await run({ runId: null });

    expect(advance).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('ne suit rien quand la séance n’a aucune structure', async () => {
    await run({ blocks: [] });

    expect(advance).not.toHaveBeenCalled();
  });

  it('démarre la phase 0 avant même le premier mètre (R1)', async () => {
    await run({ distanceM: 0, durationSeconds: 0 });

    expect(advance.mock.calls[0]![1]).toMatchObject({ phaseIndex: 0 });
  });

  it('prend la distance courante comme origine d’un départ en cours de route', async () => {
    await run({ distanceM: 1200, durationSeconds: 360 });

    expect(advance.mock.calls[0]![1]).toMatchObject({
      phaseStartDistanceM: 1200,
      phaseStartDurationS: 360,
    });
  });
});

// ---------------------------------------------------------------------------
// Le rattrapage silencieux — R8 bis
// ---------------------------------------------------------------------------

describe('rattrapage au remontage (R8 bis)', () => {
  it('🔴 réaligne la persistance sans rejouer les annonces manquées', async () => {
    // L'écran remonte alors que le coureur a déjà bouclé la première fraction.
    await run({ persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 500 });

    expect(advance).toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('annonce normalement les transitions SUIVANTES', async () => {
    await run(
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 400 },
      { persistedPhaseIndex: 1, persistedPhaseStartDistanceM: 400, distanceM: 700 },
    );

    expect(speak).toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalled();
  });

  it('ne fait rien tant qu’aucun seuil n’est franchi', async () => {
    await run(
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 100 },
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 200 },
    );

    expect(advance).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Le réalisé figé — RUN-F4 lot F
// ---------------------------------------------------------------------------

describe('enregistrement du réalisé', () => {
  it('🔴 enregistre TOUTES les phases franchies d’un coup, pas seulement la dernière', async () => {
    await run(
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 0 },
      // 1 400 m : rapide 400 + récup 200 + rapide 400 franchis d'un bloc.
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 1400 },
    );

    expect(record.mock.calls.length).toBeGreaterThan(1);
    // 1 400 m franchissent rapide 400 + récup 200 + rapide 400 + récup 200 : quatre phases.
    expect(record.mock.calls.map((c) => c[1].phaseIndex)).toEqual([0, 1, 2, 3]);
  });

  it('🔴 n’attribue pas le temps à une phase quand plusieurs sont franchies d’un coup', async () => {
    await run(
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, durationSeconds: 0, distanceM: 0 },
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, durationSeconds: 400, distanceM: 1400 },
    );

    // La distance est bornée par la phase (400 m), le temps ne l'est pas : il reste inconnu.
    for (const call of record.mock.calls) {
      expect(call[1].actualDurationSeconds).toBeNull();
    }
  });

  it('mesure le temps réel quand une SEULE phase est franchie', async () => {
    await run(
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, durationSeconds: 0, distanceM: 0 },
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, durationSeconds: 95, distanceM: 400 },
    );

    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0]![1].actualDurationSeconds).toBe(95);
  });

  it('rattache chaque phase enregistrée à son bloc d’origine', async () => {
    await run(
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 0 },
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 400 },
    );

    expect(record.mock.calls[0]![1].blockId).toBe('blk-1');
  });

  it('n’enregistre rien tant qu’aucune phase n’est terminée', async () => {
    await run(
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 0 },
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 399 },
    );

    expect(record).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Ce qui est dit — spec §6, R6/R7
// ---------------------------------------------------------------------------

describe('l’annonce', () => {
  /** Ce qui est dit au tout premier départ, avec les blocs fournis. */
  const firstAnnouncement = async (blocks: unknown[], vmaPaceSPerKm: number | null = null) => {
    await run({ blocks: blocks as never, vmaPaceSPerKm });
    // Le fragment de quantité est une traduction imbriquée dans une autre : son JSON ressort
    // échappé. On retire les échappements pour pouvoir affirmer sur le nombre réellement lu.
    return String(speak.mock.calls[0]![0]).split('\\').join('');
  };

  it('dit les kilomètres entiers en kilomètres', async () => {
    const said = await firstAnnouncement([block({ fastDistanceM: 2000 })]);

    expect(said).toContain('running.guidance.distanceKm');
    expect(said).toContain('"count":2');
  });

  it('dit une distance non ronde en mètres', async () => {
    const said = await firstAnnouncement([block({ fastDistanceM: 400 })]);

    expect(said).toContain('running.guidance.distanceM');
    expect(said).toContain('"count":400');
  });

  it('dit une durée courte en secondes', async () => {
    const said = await firstAnnouncement([
      block({ fastDistanceM: null, fastDurationSeconds: 45 }),
    ]);

    expect(said).toContain('running.guidance.durationSeconds');
    expect(said).toContain('"count":45');
  });

  it('dit une durée longue en minutes ARRONDIES — jamais un décimal lu', async () => {
    const said = await firstAnnouncement([
      block({ fastDistanceM: null, fastDurationSeconds: 200 }),
    ]);

    expect(said).toContain('running.guidance.durationMinutes');
    expect(said).toContain('"count":3'); // 200 s = 3,33 min → 3
  });

  it('bascule en minutes à partir de 90 secondes, pas avant', async () => {
    const court = await firstAnnouncement([block({ fastDistanceM: null, fastDurationSeconds: 89 })]);
    jest.clearAllMocks();
    const long = await firstAnnouncement([block({ fastDistanceM: null, fastDurationSeconds: 90 })]);

    expect(court).toContain('durationSeconds');
    expect(long).toContain('durationMinutes');
  });

  it('annonce l’allure cible quand la séance en porte une', async () => {
    const said = await firstAnnouncement([
      block({ fastPaceMinSPerKm: 245, fastPaceMaxSPerKm: 250 }),
    ]);

    expect(said).toContain('running.guidance.fastStartWithTargetPace');
    expect(said).toContain('4:05');
  });

  it('retombe sur le %VMA quand aucune allure absolue n’est donnée', async () => {
    const said = await firstAnnouncement([block({ fastPacePctVma: 105 })], null);

    expect(said).toContain('running.guidance.fastStartWithPace');
    expect(said).toContain('"pct":105');
  });

  it('ne dit aucune allure quand la séance n’en porte pas — on n’en invente pas', async () => {
    const said = await firstAnnouncement([block()]);

    expect(said).toContain('running.guidance.fastStart');
    expect(said).not.toContain('Pace');
  });

  it('annonce la nature du segment pour un échauffement', async () => {
    const said = await firstAnnouncement([
      block({ kind: 'warmup', fastDistanceM: null, fastDurationSeconds: 720, reps: 1, recoveryDistanceM: null }),
    ]);

    expect(said).toContain('running.guidance.segmentStart.warmup');
  });

  it('annonce le début d’une récupération', async () => {
    await run(
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 0 },
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 400 },
    );

    expect(spokenKeys()).toContain('running.guidance.recoveryStart');
  });

  it('annonce la fin de séance une fois la dernière phase passée', async () => {
    await run(
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 0 },
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 10_000 },
    );

    expect(spokenKeys()).toContain('running.guidance.sessionComplete');
  });

  it('ne vibre pas à la fin de séance : il n’y a plus de phase à attaquer', async () => {
    await run(
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 0 },
      { persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 10_000 },
    );

    expect(vibrate).not.toHaveBeenCalled();
  });

  it('reste muet sur une transition quand le guidage est éteint, mais persiste', async () => {
    await run(
      { voiceEnabled: false, persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 0 },
      { voiceEnabled: false, persistedPhaseIndex: 0, persistedPhaseStartDistanceM: 0, distanceM: 400 },
    );

    expect(advance).toHaveBeenCalled();
    expect(record).toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// La conversion de bloc
// ---------------------------------------------------------------------------

describe('toPhaseBlockInput', () => {
  it('fait descendre jusqu’au moteur tout ce dont il a besoin', () => {
    const converted = toPhaseBlockInput(
      block({
        reps: 3,
        fastPaceMinSPerKm: 240,
        fastTargetTimeMinSeconds: 90,
        recoveryKind: 'jog',
        groupKey: 'g1',
        groupReps: 2,
        fastPaceProgressive: true,
      }),
    );

    expect(converted).toMatchObject({
      reps: 3,
      fastDistanceM: 400,
      fastPaceMinSPerKm: 240,
      fastTargetTimeMinSeconds: 90,
      recoveryKind: 'jog',
      groupKey: 'g1',
      groupReps: 2,
      fastPaceProgressive: true,
    });
  });

  it('ne laisse pas passer l’identifiant du bloc : le moteur ne le connaît pas', () => {
    expect(toPhaseBlockInput(block())).not.toHaveProperty('id');
  });
});
