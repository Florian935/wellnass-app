import { describe, expect, it } from 'vitest';
import {
  MIN_KCAL_FOR_PARTIAL,
  bestStreak,
  buildHeatmap,
  currentStreak,
  dayFill,
  emptyDays,
  filledPct,
  type HeatmapCell,
} from './journal-regularity';

/** Fabrique une suite de clés de jour factices, la dernière valant « aujourd'hui ». */
const keys = (n: number) => Array.from({ length: n }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);

const cells = (fills: readonly ('complete' | 'partial' | 'empty')[]): HeatmapCell[] =>
  fills.map((fill, i) => ({ logDate: `d${i}`, fill, kcal: fill === 'empty' ? 0 : 1000 }));

describe('dayFill', () => {
  it('compte une journée vide sous le plancher, même avec une ligne', () => {
    expect(dayFill(0, 2000)).toBe('empty');
    expect(dayFill(MIN_KCAL_FOR_PARTIAL - 1, 2000)).toBe('empty');
  });

  it('qualifie de partielle une journée manifestement incomplète', () => {
    expect(dayFill(300, 2000)).toBe('partial');
  });

  it('qualifie de complète au-delà du tiers de l’objectif', () => {
    expect(dayFill(700, 2000)).toBe('complete');
    expect(dayFill(2100, 2000)).toBe('complete');
  });

  it('suit l’objectif : le même total ne vaut pas pareil à 1 500 et à 3 000 kcal', () => {
    expect(dayFill(600, 1500)).toBe('complete'); // seuil 500
    expect(dayFill(600, 3000)).toBe('partial'); // seuil 1000
  });

  it('utilise un repli absolu sans objectif — sinon rien ne serait jamais complet', () => {
    expect(dayFill(700, null)).toBe('complete');
    expect(dayFill(300, null)).toBe('partial');
  });
});

describe('buildHeatmap', () => {
  it('ajoute les jours absents des totaux comme vides — les trous sont l’information', () => {
    const map = buildHeatmap(keys(5), [{ logDate: '2026-09-02', kcal: 1800 }], 2000);
    expect(map.map((c) => c.fill)).toEqual(['empty', 'complete', 'empty', 'empty', 'empty']);
  });

  it('respecte l’ordre fourni, aujourd’hui en dernier', () => {
    const map = buildHeatmap(keys(3), [], 2000);
    expect(map.map((c) => c.logDate)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });

  it('additionne plusieurs totaux pour un même jour', () => {
    const map = buildHeatmap(['2026-09-01'], [
      { logDate: '2026-09-01', kcal: 400 },
      { logDate: '2026-09-01', kcal: 500 },
    ], 2000);
    expect(map[0]!.kcal).toBe(900);
    expect(map[0]!.fill).toBe('complete');
  });

  it('ignore un total non numérique plutôt que de propager un NaN', () => {
    const map = buildHeatmap(['2026-09-01'], [{ logDate: '2026-09-01', kcal: Number.NaN }], 2000);
    expect(map[0]!.kcal).toBe(0);
    expect(map[0]!.fill).toBe('empty');
  });

  it('rend une fenêtre vide sans clé', () => {
    expect(buildHeatmap([], [], 2000)).toEqual([]);
  });
});

describe('currentStreak', () => {
  it('compte les jours consécutifs en terminant par aujourd’hui', () => {
    expect(currentStreak(cells(['empty', 'complete', 'complete', 'complete']))).toBe(3);
  });

  it('vaut 0 si aujourd’hui est vide', () => {
    expect(currentStreak(cells(['complete', 'complete', 'empty']))).toBe(0);
  });

  it('accepte une journée partielle dans la série — elle prouve la saisie', () => {
    expect(currentStreak(cells(['empty', 'partial', 'complete']))).toBe(2);
  });

  it('vaut 0 sur une fenêtre vide', () => {
    expect(currentStreak([])).toBe(0);
  });
});

describe('bestStreak', () => {
  it('retient la plus longue suite de la fenêtre', () => {
    expect(bestStreak(cells(['complete', 'complete', 'empty', 'complete', 'complete', 'complete'])))
      .toBe(3);
  });

  it('vaut la longueur totale si rien n’est vide', () => {
    expect(bestStreak(cells(['complete', 'partial', 'complete']))).toBe(3);
  });

  it('vaut 0 quand tout est vide', () => {
    expect(bestStreak(cells(['empty', 'empty']))).toBe(0);
  });
});

describe('emptyDays / filledPct', () => {
  it('compte les jours vides', () => {
    expect(emptyDays(cells(['complete', 'empty', 'partial', 'empty']))).toBe(2);
  });

  it('rend le taux de jours renseignés, arrondi', () => {
    expect(filledPct(cells(['complete', 'empty', 'complete', 'complete']))).toBe(75);
    expect(filledPct(cells(Array.from({ length: 30 }, (_, i) => (i < 25 ? 'complete' : 'empty')))))
      .toBe(83);
  });

  it('vaut 0 sur une fenêtre vide plutôt que NaN', () => {
    expect(filledPct([])).toBe(0);
  });
});
