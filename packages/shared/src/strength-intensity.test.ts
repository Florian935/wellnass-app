import { describe, expect, it } from 'vitest';
import {
  bestKnownOneRm,
  percentOfMax,
  sessionRelativeIntensity,
  type IntensitySet,
  type OneRmRecord,
} from './strength-intensity';

const set = (over: Partial<IntensitySet> = {}): IntensitySet => ({
  weightKg: 100,
  reps: 5,
  setType: 'normal',
  ...over,
});

const record = (over: Partial<OneRmRecord> = {}): OneRmRecord => ({
  exerciseId: 'bench',
  type: 'estimated_1rm',
  value: 125,
  ...over,
});

describe('percentOfMax (R2, R3)', () => {
  it('exprime la charge en % du 1RM', () => {
    expect(percentOfMax(100, 125)).toBe(80);
  });

  it('dépasse 100 % au-dessus du max connu — jamais rabattu', () => {
    // R3 : une série au-dessus du 1RM connu EST un nouveau record. Plafonner à 100 % masquerait
    // exactement ce qu'on veut voir.
    expect(percentOfMax(130, 125)).toBeCloseTo(104, 5);
  });

  it('rend null sans 1RM connu — pas d’estimation de secours (R2)', () => {
    expect(percentOfMax(100, null)).toBeNull();
    expect(percentOfMax(100, undefined)).toBeNull();
  });

  it('rend null sur un 1RM nul ou négatif, jamais Infinity', () => {
    expect(percentOfMax(100, 0)).toBeNull();
    expect(percentOfMax(100, -50)).toBeNull();
  });

  it('rend null sur une charge absente', () => {
    // Cas réel : une série au poids du corps n'a pas de charge.
    expect(percentOfMax(null, 125)).toBeNull();
    expect(percentOfMax(undefined, 125)).toBeNull();
  });

  it('rend null sur des valeurs non finies plutôt que NaN', () => {
    expect(percentOfMax(Number.NaN, 125)).toBeNull();
    expect(percentOfMax(100, Number.NaN)).toBeNull();
    expect(percentOfMax(100, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('accepte une charge à 0 (barre à vide) et rend 0 %', () => {
    // 0 est une donnée, pas une absence : la distinction compte (spec R8 d'IMPORT-01, même esprit).
    expect(percentOfMax(0, 125)).toBe(0);
  });
});

describe('bestKnownOneRm (R1)', () => {
  it('retient le 1RM le plus ÉLEVÉ, pas le plus récent', () => {
    // R1 : c'est tout l'enjeu. Avec le plus récent, une séance légère ferait bondir les
    // pourcentages de la semaine suivante.
    const records = [record({ value: 125 }), record({ value: 110 })];
    expect(bestKnownOneRm(records, 'bench')).toBe(125);
    expect(bestKnownOneRm([...records].reverse(), 'bench')).toBe(125);
  });

  it('ignore les records d’un autre exercice', () => {
    const records = [record({ exerciseId: 'squat', value: 200 }), record({ value: 125 })];
    expect(bestKnownOneRm(records, 'bench')).toBe(125);
  });

  it('ignore les autres types de record', () => {
    // `max_weight` et `best_volume` ne sont pas des 1RM estimés (D6).
    const records = [
      record({ type: 'max_weight', value: 999 }),
      record({ type: 'best_volume', value: 5000 }),
      record({ value: 125 }),
    ];
    expect(bestKnownOneRm(records, 'bench')).toBe(125);
  });

  it('rend null sans aucun record exploitable', () => {
    expect(bestKnownOneRm([], 'bench')).toBeNull();
    expect(bestKnownOneRm([record({ exerciseId: 'squat' })], 'bench')).toBeNull();
  });

  it('écarte les valeurs aberrantes non finies ou négatives', () => {
    const records = [
      record({ value: Number.NaN }),
      record({ value: -10 }),
      record({ value: 0 }),
      record({ value: 120 }),
    ];
    expect(bestKnownOneRm(records, 'bench')).toBe(120);
  });
});

describe('sessionRelativeIntensity (R4, R5)', () => {
  it('pondère par les répétitions, pas par le nombre de séries', () => {
    // 1 rep à 100 % + 10 reps à 50 % → (100×1 + 50×10) / 11 ≈ 54,5 %.
    // Une moyenne simple donnerait 75 % : trois fois plus faux que la charge réelle.
    const result = sessionRelativeIntensity(
      [set({ weightKg: 125, reps: 1 }), set({ weightKg: 62.5, reps: 10 })],
      125,
    );
    expect(result).toBeCloseTo((100 * 1 + 50 * 10) / 11, 5);
  });

  it('exclut les séries d’échauffement (R5)', () => {
    // Sans l'exclusion, l'échauffement à 40 % ferait passer une séance lourde pour modérée.
    const withWarmup = sessionRelativeIntensity(
      [set({ weightKg: 50, reps: 5, setType: 'warmup' }), set({ weightKg: 100, reps: 5 })],
      125,
    );
    expect(withWarmup).toBeCloseTo(80, 5);
  });

  it('rend null si la séance ne contient que des échauffements — jamais 0 %', () => {
    const result = sessionRelativeIntensity(
      [set({ setType: 'warmup' }), set({ setType: 'warmup' })],
      125,
    );
    expect(result).toBeNull();
  });

  it('rend null sans 1RM connu', () => {
    expect(sessionRelativeIntensity([set()], null)).toBeNull();
    expect(sessionRelativeIntensity([set()], 0)).toBeNull();
  });

  it('rend null sur une séance vide', () => {
    expect(sessionRelativeIntensity([], 125)).toBeNull();
  });

  it('ignore les séries sans charge ou sans répétitions', () => {
    // Séries au poids du corps, ou en durée (gainage) : elles n'ont pas d'intensité relative.
    const result = sessionRelativeIntensity(
      [
        set({ weightKg: null }),
        set({ reps: null }),
        set({ reps: 0 }),
        set({ weightKg: 100, reps: 5 }),
      ],
      125,
    );
    expect(result).toBeCloseTo(80, 5);
  });

  it('ignore les valeurs non finies', () => {
    const result = sessionRelativeIntensity(
      [set({ weightKg: Number.NaN }), set({ reps: Number.NaN }), set({ weightKg: 100, reps: 5 })],
      125,
    );
    expect(result).toBeCloseTo(80, 5);
  });

  it('rend null si un 1RM non fini est passé', () => {
    expect(sessionRelativeIntensity([set()], Number.NaN)).toBeNull();
  });

  it('compte une série au-dessus du max dans la moyenne, sans plafonner', () => {
    const result = sessionRelativeIntensity([set({ weightKg: 130, reps: 1 })], 125);
    expect(result).toBeCloseTo(104, 5);
  });
});
