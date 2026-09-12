import { describe, expect, it } from 'vitest';

import {
  computeSessionComparison,
  MIN_SESSIONS_FOR_COMPARISON,
  type ReferenceSession,
} from './session-comparison';

function session(over: Partial<ReferenceSession> = {}): ReferenceSession {
  return { volumeKg: 5000, durationSeconds: 3600, rpe: 7, ...over };
}

/** N références identiques. */
function refs(count: number, over: Partial<ReferenceSession> = {}): ReferenceSession[] {
  return Array.from({ length: count }, () => session(over));
}

describe('computeSessionComparison', () => {
  it('rend null sous le seuil de références — deux séances ne font pas une habitude', () => {
    const out = computeSessionComparison({
      current: session(),
      references: refs(MIN_SESSIONS_FOR_COMPARISON - 1),
    });
    expect(out).toBeNull();
  });

  it('compare le tonnage à la médiane des références', () => {
    const out = computeSessionComparison({
      current: session({ volumeKg: 5600 }),
      references: [
        session({ volumeKg: 4000 }),
        session({ volumeKg: 5000 }),
        session({ volumeKg: 9000 }),
      ],
    });
    expect(out?.volume).toEqual({ current: 5600, median: 5000, deltaPercent: 12 });
  });

  it('utilise la MÉDIANE et non la moyenne — une séance aberrante ne doit pas peser', () => {
    // Moyenne = 6000 (à cause du 14000), médiane = 4000.
    const out = computeSessionComparison({
      current: session({ volumeKg: 4000 }),
      references: [
        session({ volumeKg: 2000 }),
        session({ volumeKg: 4000 }),
        session({ volumeKg: 14000 }),
      ],
    });
    expect(out?.volume.median).toBe(4000);
    expect(out?.volume.deltaPercent).toBe(0);
  });

  it('ne lit que la fenêtre des 5 dernières références', () => {
    const out = computeSessionComparison({
      current: session({ volumeKg: 1000 }),
      // Les 5 premières valent 1000 ; les suivantes, très hautes, doivent être ignorées.
      references: [...refs(5, { volumeKg: 1000 }), ...refs(5, { volumeKg: 90000 })],
    });
    expect(out?.volume.median).toBe(1000);
    expect(out?.referenceCount).toBe(5);
  });

  it('rend un écart négatif quand la séance est sous l’habitude', () => {
    const out = computeSessionComparison({
      current: session({ volumeKg: 4000 }),
      references: refs(3, { volumeKg: 5000 }),
    });
    expect(out?.volume.deltaPercent).toBe(-20);
  });

  it('calcule la densité en kg par minute', () => {
    const out = computeSessionComparison({
      current: session({ volumeKg: 6000, durationSeconds: 3600 }), // 100 kg/min
      references: refs(3, { volumeKg: 3000, durationSeconds: 3600 }), // 50 kg/min
    });
    expect(out?.density).toMatchObject({ current: 100, median: 50, deltaPercent: 100 });
  });

  it('calcule la charge sRPE = minutes × RPE (R7)', () => {
    const out = computeSessionComparison({
      current: session({ durationSeconds: 3600, rpe: 8 }), // 60 × 8 = 480
      references: refs(3, { durationSeconds: 3600, rpe: 6 }), // 360
    });
    expect(out?.load).toMatchObject({ current: 480, median: 360 });
  });

  it('rend une charge null quand le ressenti n’a pas été saisi', () => {
    const out = computeSessionComparison({
      current: session({ rpe: null }),
      references: refs(3),
    });
    expect(out?.load).toBeNull();
    // …sans pour autant faire disparaître le bloc : le tonnage, lui, est comparable.
    expect(out?.volume).not.toBeNull();
  });

  it('se tait sur une métrique dont les références manquent, pas sur tout le bloc', () => {
    const out = computeSessionComparison({
      current: session(),
      references: [
        session({ durationSeconds: null }),
        session({ durationSeconds: null }),
        session({ durationSeconds: null }),
      ],
    });
    expect(out?.volume).not.toBeNull();
    expect(out?.durationSeconds).toBeNull();
    expect(out?.density).toBeNull();
  });

  it('rend null plutôt qu’un pourcentage infini quand la médiane est nulle', () => {
    const out = computeSessionComparison({
      current: session({ volumeKg: 5000 }),
      references: refs(3, { volumeKg: 0 }),
    });
    expect(out).toBeNull();
  });
});
