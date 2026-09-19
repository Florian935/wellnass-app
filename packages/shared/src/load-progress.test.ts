import { describe, expect, it } from 'vitest';
import {
  computeLoadProgress,
  median,
  practisesBigThree,
  resolveLoadCardMode,
  type LoadSet,
} from './load-progress';

/** Une série, avec des valeurs par défaut qui passent les filtres. */
const serie = (over: Partial<LoadSet> & Pick<LoadSet, 'exerciseId' | 'day'>): LoadSet => ({
  exerciseName: over.exerciseId,
  reps: 5,
  weightKg: 100,
  ...over,
});

/** Plusieurs jours de pratique du même exercice, à charge constante ou croissante. */
const serieSur = (
  exerciseId: string,
  jours: string[],
  charges: number[],
  extra: Partial<LoadSet> = {},
): LoadSet[] => jours.map((day, i) => serie({ exerciseId, day, weightKg: charges[i]!, ...extra }));

const AUJOURD_HUI = '2026-09-19';

describe('median', () => {
  it('nombre impair : la valeur du milieu', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('nombre pair : la moyenne des deux du milieu', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('🔴 ne se laisse pas déplacer par une valeur aberrante — c’est TOUT l’intérêt', () => {
    // Une moyenne rendrait 27,5 : le titre de la carte annoncerait une progression que quatre
    // exercices sur cinq ne connaissent pas.
    expect(median([1, 2, 3, 4, 130])).toBe(3);
  });
});

describe('computeLoadProgress — filtrage des séries', () => {
  it('🔴 ignore les séries hors des bornes où Epley tient (3-10 reps)', () => {
    // Un 1RM « estimé » sur une série de 15 n'est pas une mesure. Le filtre vit dans la brique
    // pour qu'aucun appelant ne puisse l'oublier.
    const progres = computeLoadProgress({
      sets: [
        serie({ exerciseId: 'squat', day: '2026-09-18', reps: 15, weightKg: 60 }),
        serie({ exerciseId: 'squat', day: '2026-09-18', reps: 2, weightKg: 160 }),
      ],
      todayKey: AUJOURD_HUI,
    });
    expect(progres.kind).toBe('empty');
  });

  it('ignore les séries sans charge ou au poids du corps', () => {
    const progres = computeLoadProgress({
      sets: [
        serie({ exerciseId: 'traction', day: '2026-09-18', weightKg: null }),
        serie({ exerciseId: 'traction', day: '2026-09-18', weightKg: 0 }),
      ],
      todayKey: AUJOURD_HUI,
    });
    expect(progres.kind).toBe('empty');
  });

  it('sans aucune série, rend « empty » plutôt qu’un zéro trompeur', () => {
    expect(computeLoadProgress({ sets: [], todayKey: AUJOURD_HUI }).kind).toBe('empty');
  });
});

describe('computeLoadProgress — historique court', () => {
  it('🔴 moins de 8 semaines : les GAINS BRUTS, pas une tendance', () => {
    const progres = computeLoadProgress({
      sets: [
        ...serieSur('bench', ['2026-08-20', '2026-09-05', '2026-09-17'], [60, 67.5, 72.5]),
        ...serieSur('squat', ['2026-08-20', '2026-09-05', '2026-09-17'], [80, 87.5, 95]),
      ],
      todayKey: AUJOURD_HUI,
    });

    expect(progres.kind).toBe('onboarding');
    if (progres.kind !== 'onboarding') return;
    // Le squat gagne le plus : c'est lui qu'on met en avant.
    expect(progres.best.exerciseId).toBe('squat');
    expect(progres.best.gainKg).toBeGreaterThan(0);
    expect(progres.gains).toHaveLength(2);
    expect(progres.weeks).toBeGreaterThanOrEqual(4);
  });

  it('🔴 un exercice qui n’a PAS progressé n’apparaît pas dans les gains', () => {
    const progres = computeLoadProgress({
      sets: [
        ...serieSur('bench', ['2026-08-20', '2026-09-17'], [60, 72.5]),
        ...serieSur('curl', ['2026-08-20', '2026-09-17'], [14, 14]),
      ],
      todayKey: AUJOURD_HUI,
    });
    if (progres.kind !== 'onboarding') throw new Error('attendu onboarding');
    expect(progres.gains.map((g) => g.exerciseId)).toEqual(['bench']);
  });

  it('aucun gain nulle part : « empty », et surtout pas « +0 kg »', () => {
    const progres = computeLoadProgress({
      sets: serieSur('curl', ['2026-08-20', '2026-09-17'], [14, 14]),
      todayKey: AUJOURD_HUI,
    });
    expect(progres.kind).toBe('empty');
  });
});

describe('computeLoadProgress — régime établi', () => {
  /** Un an de pratique : assez long pour sortir de l'état « onboarding ». */
  const ancien = (exerciseId: string, charge: number) =>
    serieSur(exerciseId, ['2026-01-10', '2026-02-10', '2026-06-10'], [charge, charge, charge]);
  const recent = (exerciseId: string, charge: number) =>
    serieSur(exerciseId, ['2026-09-05', '2026-09-12', '2026-09-17'], [charge, charge, charge]);

  it('calcule l’écart de 1RM estimé sur la fenêtre, par exercice', () => {
    const progres = computeLoadProgress({
      sets: [...ancien('bench', 80), ...recent('bench', 88)],
      todayKey: AUJOURD_HUI,
    });

    expect(progres.kind).toBe('established');
    if (progres.kind !== 'established') return;
    expect(progres.items).toHaveLength(1);
    expect(progres.items[0]!.deltaPct).toBeCloseTo(10, 0);
    expect(progres.items[0]!.trend).toBe('up');
    expect(progres.up).toBe(1);
    expect(progres.total).toBe(1);
  });

  it('🔴 un exercice sans référence AVANT la fenêtre est exclu — pas de progression inventée', () => {
    // Un exercice commencé il y a dix jours n'a pas d'écart à 30 jours. Prendre sa première série
    // de la fenêtre comme référence fabriquerait une progression qui n'est que le rodage.
    const progres = computeLoadProgress({
      sets: [...ancien('bench', 80), ...recent('bench', 88), ...recent('nouveau', 50)],
      todayKey: AUJOURD_HUI,
    });
    if (progres.kind !== 'established') throw new Error('attendu established');
    expect(progres.items.map((i) => i.exerciseId)).toEqual(['bench']);
  });

  it('🔴 un exercice pratiqué moins de 3 jours distincts n’est pas « régulier »', () => {
    const progres = computeLoadProgress({
      sets: [
        ...ancien('bench', 80),
        ...recent('bench', 88),
        serie({ exerciseId: 'ponctuel', day: '2026-01-10', weightKg: 40 }),
        serie({ exerciseId: 'ponctuel', day: '2026-09-17', weightKg: 60 }),
      ],
      todayKey: AUJOURD_HUI,
    });
    if (progres.kind !== 'established') throw new Error('attendu established');
    expect(progres.items.map((i) => i.exerciseId)).toEqual(['bench']);
  });

  it('un écart sous 1 % se dit « stagne » plutôt que d’afficher une fausse précision', () => {
    const progres = computeLoadProgress({
      sets: [...ancien('curl', 14), ...recent('curl', 14.1)],
      todayKey: AUJOURD_HUI,
    });
    if (progres.kind !== 'established') throw new Error('attendu established');
    expect(progres.items[0]!.trend).toBe('flat');
    expect(progres.up).toBe(0);
  });

  it('un recul est rendu tel quel — la carte ne ment pas par omission', () => {
    const progres = computeLoadProgress({
      sets: [...ancien('bench', 90), ...recent('bench', 80)],
      todayKey: AUJOURD_HUI,
    });
    if (progres.kind !== 'established') throw new Error('attendu established');
    expect(progres.items[0]!.trend).toBe('down');
    expect(progres.items[0]!.deltaPct).toBeLessThan(0);
  });

  it('🔴 le titre est la MÉDIANE : un exercice aberrant ne l’emporte pas', () => {
    const progres = computeLoadProgress({
      sets: [
        ...ancien('a', 100), ...recent('a', 102),
        ...ancien('b', 100), ...recent('b', 103),
        ...ancien('c', 100), ...recent('c', 104),
        ...ancien('d', 10), ...recent('d', 40), // +300 %, une reprise après blessure
      ],
      todayKey: AUJOURD_HUI,
    });
    if (progres.kind !== 'established') throw new Error('attendu established');
    // La moyenne dépasserait 77 % ; la médiane reste dans le réel.
    expect(progres.medianPct).toBeLessThan(10);
    expect(progres.total).toBe(4);
  });

  it('plafonne le détail à 4 exercices, les plus progressants d’abord', () => {
    const sets = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((id, i) => [
      ...ancien(id, 100),
      ...recent(id, 100 + i),
    ]);
    const progres = computeLoadProgress({ sets, todayKey: AUJOURD_HUI });
    if (progres.kind !== 'established') throw new Error('attendu established');
    expect(progres.items).toHaveLength(4);
    expect(progres.items[0]!.exerciseId).toBe('f');
    // `total` compte TOUS les exercices suivis, pas seulement ceux qu'on montre.
    expect(progres.total).toBe(6);
  });

  it('l’ordre d’arrivée des séries n’a aucune influence', () => {
    const sets = [...ancien('bench', 80), ...recent('bench', 88)];
    const a = computeLoadProgress({ sets, todayKey: AUJOURD_HUI });
    const b = computeLoadProgress({ sets: [...sets].reverse(), todayKey: AUJOURD_HUI });
    expect(a).toEqual(b);
  });
});

/** Les trois mouvements DÉSIGNÉS dans les réglages (MUSCPWR-01), pas devinés depuis un nom. */
const DESIGNES = { squat: 's', bench: 'b', deadlift: 'd' };

const troisMouvements = [
  ...serieSur('s', ['2026-09-01', '2026-09-08', '2026-09-15'], [150, 150, 155]),
  ...serieSur('b', ['2026-09-02', '2026-09-09', '2026-09-16'], [100, 100, 102]),
  ...serieSur('d', ['2026-09-03', '2026-09-10', '2026-09-17'], [140, 145, 150]),
];

describe('practisesBigThree', () => {
  it('vrai quand les trois mouvements désignés sont pratiqués régulièrement', () => {
    expect(practisesBigThree(troisMouvements, DESIGNES)).toBe(true);
  });

  it('🔴 deux mouvements sur trois ne suffisent PAS — un total sur deux barres est faux', () => {
    expect(practisesBigThree(troisMouvements.filter((s) => s.exerciseId !== 'd'), DESIGNES)).toBe(false);
  });

  it('faux quand un mouvement n’a été fait qu’une fois', () => {
    const rare = troisMouvements.filter((s) => s.exerciseId !== 'd');
    rare.push(serie({ exerciseId: 'd', day: '2026-09-17', weightKg: 140 }));
    expect(practisesBigThree(rare, DESIGNES)).toBe(false);
  });

  it('🔴 faux si un mouvement n’est pas DÉSIGNÉ, même s’il est pratiqué', () => {
    // Le total ne se devine pas : sans désignation, on ne sait pas quel « squat » compte.
    expect(practisesBigThree(troisMouvements, { squat: 's', bench: 'b', deadlift: null })).toBe(false);
  });
});

describe('resolveLoadCardMode', () => {
  const muscu = serieSur('curl', ['2026-09-01', '2026-09-08', '2026-09-15'], [14, 14, 16]);

  it('auto : la force n’apparaît QUE si elle est méritée par la pratique', () => {
    expect(resolveLoadCardMode({ mode: 'auto', sets: troisMouvements, designated: DESIGNES })).toBe('strength');
    expect(resolveLoadCardMode({ mode: 'auto', sets: muscu, designated: DESIGNES })).toBe('loads');
  });

  it('« mes charges » forcé gagne toujours, même chez un powerlifter', () => {
    expect(resolveLoadCardMode({ mode: 'loads', sets: troisMouvements, designated: DESIGNES })).toBe('loads');
  });

  it('🔴 « force » forcé RETOMBE sur les charges si les trois mouvements manquent', () => {
    // Un réglage ne rend pas une donnée vraie : afficher un total SBD à qui ne soulève jamais de
    // terre serait exactement le défaut que cette US corrige.
    expect(resolveLoadCardMode({ mode: 'strength', sets: muscu, designated: DESIGNES })).toBe('loads');
  });
});
