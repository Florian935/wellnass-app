import { describe, expect, it } from 'vitest';

import {
  MAX_PLAUSIBLE_SESSION_SECONDS,
  MIN_PLAUSIBLE_SESSION_SECONDS,
  MIN_SESSIONS_FOR_DURATION,
  computeSessionDuration,
} from './session-duration';

const MIN = 60;
const compute = (sessions: (number | null)[]) => computeSessionDuration({ sessions });
/** Cinq séances plausibles, la longueur minimale qui produit un résultat. */
const five = [30 * MIN, 40 * MIN, 50 * MIN, 60 * MIN, 70 * MIN];

describe('constantes', () => {
  it('expose des bornes nommées et calibrables', () => {
    expect(MIN_SESSIONS_FOR_DURATION).toBe(5);
    expect(MIN_PLAUSIBLE_SESSION_SECONDS).toBe(300);
    expect(MAX_PLAUSIBLE_SESSION_SECONDS).toBe(14400);
  });
});

describe('computeSessionDuration — le seuil de données (R3)', () => {
  it('rend null sans séance', () => {
    expect(compute([])).toBeNull();
  });

  it('rend null sous le seuil', () => {
    expect(compute(five.slice(0, 4))).toBeNull();
  });

  it('calcule au seuil pile — borne inclusive', () => {
    expect(compute(five)!.sessionCount).toBe(5);
  });

  it('🔴 applique le seuil APRÈS le filtre, pas avant', () => {
    // Cinq séances dont quatre aberrantes ne font pas une médiane. Compter les entrées plutôt que
    // les survivantes rendrait une « médiane » calculée sur un seul point.
    expect(compute([10 * MIN, 6 * 3600, 6 * 3600, 6 * 3600, 6 * 3600])).toBeNull();
  });
});

describe('computeSessionDuration — la médiane (R9)', () => {
  it('rend la valeur centrale sur un nombre impair', () => {
    expect(compute(five)!.medianSeconds).toBe(50 * MIN);
  });

  it('rend la moyenne des deux centrales sur un nombre pair', () => {
    expect(compute([...five, 80 * MIN])!.medianSeconds).toBe(55 * MIN);
  });

  it('n’est pas tirée par une séance très longue — c’est tout l’intérêt de la médiane', () => {
    // La même liste avec une séance de 3 h 30 (plausible, donc retenue) : la moyenne passerait de
    // 50 à 75 min ; la médiane, elle, tient.
    const out = compute([...five, 3.5 * 3600]);
    expect(out!.medianSeconds).toBe(55 * MIN);
  });

  it('ne modifie pas le tableau passé en entrée', () => {
    const input = [70 * MIN, 30 * MIN, 50 * MIN, 60 * MIN, 40 * MIN];
    const copy = [...input];
    compute(input);
    expect(input).toEqual(copy);
  });
});

describe('computeSessionDuration — les aberrantes (R10)', () => {
  it('écarte une séance oubliée ouverte et le DIT', () => {
    const out = compute([...five, 6 * 3600]);
    expect(out!.excludedCount).toBe(1);
    expect(out!.sessionCount).toBe(5);
    expect(out!.medianSeconds).toBe(50 * MIN);
  });

  it('écarte une durée trop courte', () => {
    const out = compute([...five, 2 * MIN]);
    expect(out!.excludedCount).toBe(1);
  });

  it('écarte une durée absente', () => {
    const out = compute([...five, null]);
    expect(out!.excludedCount).toBe(1);
  });

  it('garde les bornes elles-mêmes — elles sont inclusives', () => {
    const out = compute([
      MIN_PLAUSIBLE_SESSION_SECONDS,
      MAX_PLAUSIBLE_SESSION_SECONDS,
      ...five.slice(0, 3),
    ]);
    expect(out!.excludedCount).toBe(0);
    expect(out!.sessionCount).toBe(5);
  });

  it('rend 0 écartée quand tout est plausible', () => {
    expect(compute(five)!.excludedCount).toBe(0);
  });
});

describe('computeSessionDuration — la tendance', () => {
  it('rend un écart positif quand les séances s’allongent', () => {
    // Anciennes : 30, 30 (médiane 30). Récentes : 60, 60, 60 (médiane 60).
    const out = compute([30 * MIN, 30 * MIN, 60 * MIN, 60 * MIN, 60 * MIN]);
    expect(out!.trendSeconds).toBe(30 * MIN);
  });

  it('rend un écart négatif quand elles raccourcissent', () => {
    const out = compute([60 * MIN, 60 * MIN, 30 * MIN, 30 * MIN, 30 * MIN]);
    expect(out!.trendSeconds).toBe(-30 * MIN);
  });

  it('rend 0 quand rien ne bouge', () => {
    expect(compute(Array.from({ length: 6 }, () => 45 * MIN))!.trendSeconds).toBe(0);
  });

  it('rend toujours un nombre — jamais null, jamais NaN', () => {
    // Le seuil de 5 séances plausibles garantit deux moitiés non vides : la tendance est donc
    // toujours calculable. C'est ce qui permet à `trendSeconds` de ne pas être nullable.
    const out = compute(five)!;
    expect(typeof out.trendSeconds).toBe('number');
    expect(Number.isFinite(out.trendSeconds)).toBe(true);
  });

  it('lit l’entrée du plus ancien au plus récent', () => {
    // La même liste inversée doit produire la tendance opposée — c'est ce qui prouve que l'ordre
    // porte du sens et n'est pas ignoré.
    const rising = [30 * MIN, 30 * MIN, 60 * MIN, 60 * MIN, 60 * MIN];
    expect(compute(rising)!.trendSeconds).toBe(-compute([...rising].reverse())!.trendSeconds);
  });

  it('ignore les aberrantes dans la tendance aussi', () => {
    const out = compute([30 * MIN, 30 * MIN, 6 * 3600, 60 * MIN, 60 * MIN, 60 * MIN]);
    expect(out!.trendSeconds).toBe(30 * MIN);
    expect(out!.excludedCount).toBe(1);
  });
});
