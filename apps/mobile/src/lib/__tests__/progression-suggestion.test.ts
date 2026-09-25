/**
 * US MUSCU-UX07 (R11) — la suggestion sortie de `app/workout.tsx`.
 *
 * Le calcul est vérifié contre l'appel **tel que la séance le faisait** avant l'extraction : si le
 * module dérive, ce test le dit avant la recette.
 */

import { computeProgressionSuggestion, type ProgressionSuggestion } from '@wellness/shared';
import i18n from '@/i18n';
import {
  formatProgressionSuggestion,
  formatSetDuration,
  makeLoadProposer,
  progressionSuggestionFor,
  type LastPerfEntry,
} from '../progression-suggestion';

const set = (over: Partial<LastPerfEntry> = {}): LastPerfEntry => ({
  weightKg: 80,
  reps: 8,
  setType: 'normal',
  rpe: null,
  durationSeconds: null,
  ...over,
});

/** L'appel inline de `workout.tsx` avant MUSCU-UX07, recopié ici comme référence. */
function inlineReference(
  lastPerf: LastPerfEntry[],
  rang: number,
  previousStruggled: boolean,
  priorWeekAdherenceOk: boolean | null,
): ProgressionSuggestion {
  return computeProgressionSuggestion(
    lastPerf.map((p) => ({ setType: p.setType, rpe: p.rpe, done: true })),
    lastPerf[rang],
    {
      weightIncrementKg: 2.5,
      durationIncrementSeconds: 10,
      previousStruggled,
      priorWeekAdherenceOk: priorWeekAdherenceOk ?? undefined,
    },
  );
}

describe('progressionSuggestionFor — identique au calcul de la séance', () => {
  const cas: [string, LastPerfEntry[], number, boolean, boolean | null][] = [
    ['séance réussie', [set(), set(), set({ reps: 7 })], 0, false, null],
    ['rang 2', [set(), set(), set({ reps: 7 })], 2, false, true],
    ['séance difficile, deload', [set({ rpe: 9 }), set({ rpe: 9 })], 0, true, null],
    ['séance difficile sans deload', [set({ rpe: 9 })], 0, false, null],
    ['assiduité insuffisante', [set(), set()], 0, false, false],
    ['durée', [set({ setType: 'duration', weightKg: null, reps: null, durationSeconds: 45 })], 0, false, null],
    ['poids du corps', [set({ setType: 'bodyweight', weightKg: null, reps: 12 })], 0, false, null],
    ['jamais fait', [], 0, false, null],
  ];

  it.each(cas)('%s', (_label, lastPerf, rang, struggled, adherence) => {
    expect(
      progressionSuggestionFor(lastPerf, rang, { previousStruggled: struggled, priorWeekAdherenceOk: adherence }),
    ).toEqual(inlineReference(lastPerf, rang, struggled, adherence));
  });

  it('jamais fait : aucune suggestion', () => {
    expect(progressionSuggestionFor([], 0, { previousStruggled: false, priorWeekAdherenceOk: null })).toBeNull();
  });
});

describe('makeLoadProposer', () => {
  it('à la barre : ramène à une charge chargeable', () => {
    const propose = makeLoadProposer({ isBarbell: true, barKg: 20, imperial: false });
    // 20 kg de barre + disques : 82,5 est chargeable, 83 ne l'est pas.
    expect(propose(82.5)).toBe(82.5);
    expect(propose(83)).not.toBe(83);
  });

  it('hors barre : la charge telle quelle', () => {
    const propose = makeLoadProposer({ isBarbell: false, barKg: 20, imperial: false });
    expect(propose(83)).toBe(83);
    expect(propose(null)).toBeNull();
  });
});

describe('formatProgressionSuggestion — libellés long et court', () => {
  const t = i18n.t.bind(i18n);
  const deps = { t, formatWeight: (kg: number | null) => `${kg} kg`, propose: (kg: number | null) => kg };

  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });

  it('rien à proposer : null', () => {
    expect(formatProgressionSuggestion(null, deps)).toBeNull();
  });

  it('charge ou répétitions', () => {
    const s: ProgressionSuggestion = { kind: 'weightOrReps', weightKg: 82.5, reps: 9 };
    expect(formatProgressionSuggestion(s, deps)).toBe('Essaie 82.5 kg ou 9 reps');
    expect(formatProgressionSuggestion(s, { ...deps, short: true })).toBe('82.5 kg ou 9 reps');
  });

  it('répétitions seules', () => {
    const s: ProgressionSuggestion = { kind: 'reps', reps: 11 };
    expect(formatProgressionSuggestion(s, deps)).toBe('Essaie 11 reps');
    expect(formatProgressionSuggestion(s, { ...deps, short: true })).toBe('vise 11 reps');
  });

  it('poids gelé', () => {
    const s: ProgressionSuggestion = { kind: 'weightHold', weightKg: 50, reps: 9 };
    expect(formatProgressionSuggestion(s, deps)).toMatch(/^Reste à 50 kg, essaie 9 reps/);
    expect(formatProgressionSuggestion(s, { ...deps, short: true })).toBe('reste à 50 kg');
  });

  it('deload', () => {
    const s: ProgressionSuggestion = { kind: 'deload', weightKg: 72.5 };
    expect(formatProgressionSuggestion(s, deps)).toMatch(/alléger à 72\.5 kg$/);
    expect(formatProgressionSuggestion(s, { ...deps, short: true })).toBe('allège à 72.5 kg');
  });

  it('durée, en m:ss', () => {
    const s: ProgressionSuggestion = { kind: 'duration', durationSeconds: 50 };
    expect(formatProgressionSuggestion(s, deps)).toBe('Essaie 0:50');
    expect(formatProgressionSuggestion(s, { ...deps, short: true })).toBe('vise 0:50');
  });

  it('la charge passe par l’arrondi chargeable', () => {
    const s: ProgressionSuggestion = { kind: 'weightOrReps', weightKg: 83, reps: 9 };
    expect(formatProgressionSuggestion(s, { ...deps, short: true, propose: () => 82.5 })).toBe('82.5 kg ou 9 reps');
  });
});

describe('formatSetDuration', () => {
  it('tronque à la seconde, comme la séance', () => {
    expect(formatSetDuration(90)).toBe('1:30');
    expect(formatSetDuration(44.9)).toBe('0:44');
    expect(formatSetDuration(-3)).toBe('0:00');
  });
});
