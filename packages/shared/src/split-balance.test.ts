import { describe, expect, it } from 'vitest';

import {
  EVEN_SPLIT_TOLERANCE_PCT,
  MIN_KM_FOR_SPLIT_BALANCE,
  computeSplitBalance,
} from './split-balance';
import type { KmSplit } from './running';

/** Construit des splits depuis une liste de durées en secondes. */
const splitsOf = (...seconds: number[]): KmSplit[] =>
  seconds.map((s, i) => ({ km: i + 1, seconds: s }));

describe('constantes', () => {
  it('expose des seuils nommés et calibrables', () => {
    expect(EVEN_SPLIT_TOLERANCE_PCT).toBe(2);
    expect(MIN_KM_FOR_SPLIT_BALANCE).toBe(2);
  });
});

describe('computeSplitBalance — le seuil de données (R3)', () => {
  it('rend null sans split', () => {
    expect(computeSplitBalance([])).toBeNull();
  });

  it('rend null sur un seul km — il n’y a pas deux moitiés', () => {
    expect(computeSplitBalance(splitsOf(300))).toBeNull();
  });

  it('calcule à 2 km pile — borne inclusive', () => {
    expect(computeSplitBalance(splitsOf(300, 300))).not.toBeNull();
  });
});

describe('computeSplitBalance — 🔴 le signe se lit à l’envers', () => {
  it('rend « negative » quand la 2ᵉ moitié est plus RAPIDE (nombre plus petit)', () => {
    const out = computeSplitBalance(splitsOf(300, 270))!;
    expect(out.verdict).toBe('negative');
    expect(out.deltaPct).toBeCloseTo(-10, 5);
    expect(out.secondHalfPaceSPerKm).toBeLessThan(out.firstHalfPaceSPerKm);
  });

  it('rend « positive » quand la 2ᵉ moitié est plus LENTE', () => {
    const out = computeSplitBalance(splitsOf(300, 330))!;
    expect(out.verdict).toBe('positive');
    expect(out.deltaPct).toBeCloseTo(10, 5);
  });

  it('rend « even » sur deux moitiés identiques, avec un écart nul', () => {
    const out = computeSplitBalance(splitsOf(300, 300))!;
    expect(out.verdict).toBe('even');
    expect(out.deltaPct).toBe(0);
  });
});

describe('computeSplitBalance — la tolérance (D4)', () => {
  it('classe « even » un écart sous la tolérance', () => {
    // +1 % : personne ne court deux moitiés exactement égales, et sans zone morte l'analyse
    // annoncerait un verdict tranché à chaque sortie.
    expect(computeSplitBalance(splitsOf(300, 303))!.verdict).toBe('even');
  });

  it('classe « even » un écart À la tolérance — borne inclusive', () => {
    expect(computeSplitBalance(splitsOf(300, 306))!.verdict).toBe('even');
  });

  it('tranche au-delà de la tolérance, dans les deux sens', () => {
    expect(computeSplitBalance(splitsOf(300, 310))!.verdict).toBe('positive');
    expect(computeSplitBalance(splitsOf(300, 290))!.verdict).toBe('negative');
  });
});

describe('computeSplitBalance — le découpage', () => {
  it('🔴 sur un nombre IMPAIR, le km central va à la 1ʳᵉ moitié', () => {
    // Arbitraire, donc figé : sans ce test, la prochaine lecture du code pourra l'inverser en
    // croyant corriger un bug. 5 km → 1ʳᵉ moitié = 3 km, 2ᵉ = 2 km.
    // 1ʳᵉ : (300+300+300)/3 = 300. 2ᵉ : (270+270)/2 = 270.
    const out = computeSplitBalance(splitsOf(300, 300, 300, 270, 270))!;
    expect(out.firstHalfPaceSPerKm).toBe(300);
    expect(out.secondHalfPaceSPerKm).toBe(270);
  });

  it('moyenne bien chaque moitié sur un nombre pair', () => {
    const out = computeSplitBalance(splitsOf(280, 320, 300, 300))!;
    expect(out.firstHalfPaceSPerKm).toBe(300);
    expect(out.secondHalfPaceSPerKm).toBe(300);
    expect(out.verdict).toBe('even');
  });

  it('rend les deux allures, pas seulement le verdict (R2)', () => {
    const out = computeSplitBalance(splitsOf(312, 299))!;
    expect(out.firstHalfPaceSPerKm).toBe(312);
    expect(out.secondHalfPaceSPerKm).toBe(299);
  });
});

describe('computeSplitBalance — données impossibles', () => {
  it('rend null si un split est à zéro seconde', () => {
    // Montre coupée ou trace corrompue : on refuse le calcul entier plutôt que de rendre une
    // moyenne à moitié fausse. Et zéro au dénominateur donnerait un Infinity affichable.
    expect(computeSplitBalance(splitsOf(300, 0))).toBeNull();
    expect(computeSplitBalance(splitsOf(0, 300))).toBeNull();
  });

  it('rend null sur un split négatif ou non fini', () => {
    expect(computeSplitBalance(splitsOf(300, -30))).toBeNull();
    expect(computeSplitBalance(splitsOf(300, Number.NaN))).toBeNull();
    expect(computeSplitBalance(splitsOf(Number.POSITIVE_INFINITY, 300))).toBeNull();
  });

  it('ne rend jamais un deltaPct non fini', () => {
    const out = computeSplitBalance(splitsOf(300, 300, 300, 300));
    expect(Number.isFinite(out!.deltaPct)).toBe(true);
  });
});
