import { describe, expect, it } from 'vitest';
import { compareToTarget } from './run-target';

describe('compareToTarget', () => {
  it('distance dépassée : 5,2 km sur 5 km visés', () => {
    const result = compareToTarget(
      { distanceM: 5200, durationS: null },
      { targetDistanceM: 5000, targetDurationS: null },
    );
    expect(result.distance).toEqual({ doneValue: 5200, targetValue: 5000, diff: 200, status: 'over' });
    expect(result.duration).toBeUndefined();
  });

  it('distance en deçà : 4,1 km sur 5 km visés — statut neutre "under", pas un échec (R4)', () => {
    const result = compareToTarget(
      { distanceM: 4100, durationS: null },
      { targetDistanceM: 5000, targetDurationS: null },
    );
    expect(result.distance?.status).toBe('under');
    expect(result.distance?.diff).toBe(-900);
  });

  it('4,95 km sur 5 km visés → "reached" grâce à la tolérance de 2 % (R5)', () => {
    const result = compareToTarget(
      { distanceM: 4950, durationS: null },
      { targetDistanceM: 5000, targetDurationS: null },
    );
    expect(result.distance?.status).toBe('reached');
  });

  it('5,10 km sur 5 km visés → "reached" aussi (la tolérance joue dans les deux sens)', () => {
    const result = compareToTarget(
      { distanceM: 5100, durationS: null },
      { targetDistanceM: 5000, targetDurationS: null },
    );
    expect(result.distance?.status).toBe('reached');
  });

  it('juste en dehors de la tolérance (4,89 km) → "under", pas "reached"', () => {
    const result = compareToTarget(
      { distanceM: 4890, durationS: null },
      { targetDistanceM: 5000, targetDurationS: null },
    );
    expect(result.distance?.status).toBe('under');
  });

  it('cible partielle (durée seule) : la clé distance est ABSENTE, pas à zéro (R3)', () => {
    const result = compareToTarget(
      { distanceM: 5200, durationS: 1500 },
      { targetDistanceM: null, targetDurationS: 1500 },
    );
    expect(result.distance).toBeUndefined();
    expect(result.duration?.status).toBe('reached');
  });

  it('aucune cible → objet vide, l’UI n’affiche rien (R1)', () => {
    const result = compareToTarget(
      { distanceM: 5200, durationS: 1500 },
      { targetDistanceM: null, targetDurationS: null },
    );
    expect(result).toEqual({});
  });

  it('course sans distance exploitable malgré une cible → clé absente', () => {
    const result = compareToTarget(
      { distanceM: null, durationS: 1500 },
      { targetDistanceM: 5000, targetDurationS: null },
    );
    expect(result.distance).toBeUndefined();
  });

  it('tolérance relative : même verdict quelle que soit l’unité de mesure sous-jacente (R6)', () => {
    // 1 mile ≈ 1609 m — même ratio d'écart que le cas "reached" en mètres ci-dessus.
    const km = compareToTarget({ distanceM: 4950, durationS: null }, { targetDistanceM: 5000, targetDurationS: null });
    const miles = compareToTarget(
      { distanceM: 1609 * 0.99, durationS: null },
      { targetDistanceM: 1609, targetDurationS: null },
    );
    expect(km.distance?.status).toBe(miles.distance?.status);
  });

  it('durée dépassée (course plus longue que prévu)', () => {
    const result = compareToTarget(
      { distanceM: null, durationS: 1800 },
      { targetDistanceM: null, targetDurationS: 1500 },
    );
    expect(result.duration).toEqual({ doneValue: 1800, targetValue: 1500, diff: 300, status: 'over' });
  });
});
