import { describe, it, expect } from 'vitest';
import {
  GHOST_LEVEL_M,
  GHOST_MAX_START_DISTANCE_M,
  GHOST_PAUSE_GAP_S,
  buildGhostProfile,
  ghostDistanceAt,
  ghostGap,
  isGhostCandidate,
  shouldAnnounceGhost,
} from './run-ghost';
import type { GpsPoint } from './running';

/**
 * Trace de test : une ligne droite vers l'est depuis (48,0 ; 2,0).
 * À cette latitude, 0,001° de longitude ≈ 74,3 m — on ne code donc aucune distance en dur : les
 * attentes sont exprimées **relativement** à la distance totale mesurée par le profil lui-même.
 */
function straightLine(seconds: readonly number[], stepDeg = 0.001): GpsPoint[] {
  return seconds.map((t, i) => ({ lat: 48, lng: 2 + i * stepDeg, t }));
}

describe('buildGhostProfile (R1, R3)', () => {
  it('null en dessous de deux points', () => {
    expect(buildGhostProfile([])).toBeNull();
    expect(buildGhostProfile(straightLine([0]))).toBeNull();
  });

  it('temps net et distance cumulée croissants', () => {
    const profile = buildGhostProfile(straightLine([0, 10, 20, 30]));
    expect(profile).not.toBeNull();
    const { samples, totalSeconds, totalDistanceM } = profile!;
    expect(samples.map((s) => s.t)).toEqual([0, 10, 20, 30]);
    expect(totalSeconds).toBe(30);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.d).toBeGreaterThan(samples[i - 1]!.d);
    }
    expect(totalDistanceM).toBeCloseTo(samples[samples.length - 1]!.d, 6);
  });

  it('un trou plus long que le seuil ne compte pas dans le temps net (pause du fantôme)', () => {
    // Points à t = 0, 10, 100, 110 : trois intervalles de 10 s, 90 s (pause) et 10 s.
    // Le temps net vaut donc 20 s — la pause ne compte pas, mais la distance est conservée.
    const paused = buildGhostProfile(straightLine([0, 10, 10 + GHOST_PAUSE_GAP_S + 30, 10 + GHOST_PAUSE_GAP_S + 40]));
    expect(paused!.totalSeconds).toBe(20);
  });

  it('un trou plus court que le seuil compte normalement', () => {
    const short = buildGhostProfile(straightLine([0, 10, 10 + GHOST_PAUSE_GAP_S - 1]));
    expect(short!.totalSeconds).toBe(GHOST_PAUSE_GAP_S + 9);
  });

  it('la distance parcourue pendant une pause est conservée', () => {
    const paused = buildGhostProfile(straightLine([0, 10, 200, 210]));
    const continuous = buildGhostProfile(straightLine([0, 10, 20, 30]));
    expect(paused!.totalDistanceM).toBeCloseTo(continuous!.totalDistanceM, 6);
  });

  it('ignore les points aux coordonnées invalides', () => {
    const points: GpsPoint[] = [
      { lat: 48, lng: 2, t: 0 },
      { lat: 999, lng: 2, t: 10 },
      { lat: 48, lng: 2.001, t: 20 },
    ];
    const profile = buildGhostProfile(points);
    expect(profile!.samples).toHaveLength(2);
  });
});

describe('ghostDistanceAt (R1, R5 — jamais d’extrapolation)', () => {
  const profile = buildGhostProfile(straightLine([0, 10, 20]))!;
  const total = profile.totalDistanceM;

  it('0 avant le premier échantillon', () => {
    expect(ghostDistanceAt(profile, -5)).toBe(0);
    expect(ghostDistanceAt(profile, 0)).toBe(0);
  });

  it('interpole linéairement entre deux échantillons', () => {
    expect(ghostDistanceAt(profile, 5)).toBeCloseTo(total / 4, 6);
    expect(ghostDistanceAt(profile, 15)).toBeCloseTo((total * 3) / 4, 6);
  });

  it('valeur exacte sur un échantillon', () => {
    expect(ghostDistanceAt(profile, 10)).toBeCloseTo(total / 2, 6);
  });

  it('plafonne à la distance totale au-delà de la fin', () => {
    expect(ghostDistanceAt(profile, 20)).toBeCloseTo(total, 6);
    expect(ghostDistanceAt(profile, 10_000)).toBeCloseTo(total, 6);
  });
});

describe('ghostGap (R4, R5)', () => {
  const profile = buildGhostProfile(straightLine([0, 10, 20]))!;
  const half = profile.totalDistanceM / 2;

  it('devant : écart positif', () => {
    const gap = ghostGap({
      profile,
      runnerDistanceM: half + 42,
      netSeconds: 10,
      avgPaceSPerKm: null,
    });
    expect(gap.meters).toBe(42);
    expect(gap.status).toBe('ahead');
  });

  it('derrière : écart négatif', () => {
    const gap = ghostGap({ profile, runnerDistanceM: half - 30, netSeconds: 10, avgPaceSPerKm: null });
    expect(gap.meters).toBe(-30);
    expect(gap.status).toBe('behind');
  });

  it('coude à coude sous la tolérance', () => {
    const gap = ghostGap({
      profile,
      runnerDistanceM: half + GHOST_LEVEL_M - 1,
      netSeconds: 10,
      avgPaceSPerKm: null,
    });
    expect(gap.status).toBe('level');
  });

  it('au départ : l’écart vaut l’opposé de la distance du fantôme', () => {
    const gap = ghostGap({ profile, runnerDistanceM: 0, netSeconds: 10, avgPaceSPerKm: null });
    expect(gap.meters).toBe(-Math.round(half));
  });

  it('fantôme terminé : statut finished et écart figé sur la distance totale', () => {
    const gap = ghostGap({
      profile,
      runnerDistanceM: profile.totalDistanceM + 100,
      netSeconds: 999,
      avgPaceSPerKm: null,
    });
    expect(gap.status).toBe('finished');
    expect(gap.meters).toBe(100);
  });

  it('secondes : null sans allure moyenne', () => {
    expect(ghostGap({ profile, runnerDistanceM: half, netSeconds: 10, avgPaceSPerKm: null }).seconds).toBeNull();
  });

  it('secondes : conversion par l’allure moyenne du coureur', () => {
    // 300 s/km = 3,333 m/s → 100 m d'avance = 30 s.
    const gap = ghostGap({
      profile,
      runnerDistanceM: half + 100,
      netSeconds: 10,
      avgPaceSPerKm: 300,
    });
    expect(gap.seconds).toBe(30);
  });

  it('secondes : allure absurde (≤ 0) traitée comme absente', () => {
    expect(ghostGap({ profile, runnerDistanceM: half, netSeconds: 10, avgPaceSPerKm: 0 }).seconds).toBeNull();
  });
});

describe('isGhostCandidate (R2)', () => {
  const points = straightLine([0, 10, 20]);

  it('accepte une course proche du départ', () => {
    expect(isGhostCandidate({ distanceM: 5000, points, startLat: 48, startLng: 2 })).toBe(true);
  });

  it('refuse un départ trop éloigné', () => {
    // ~0,01° de latitude ≈ 1,1 km, bien au-delà du seuil.
    expect(isGhostCandidate({ distanceM: 5000, points, startLat: 48.01, startLng: 2 })).toBe(false);
  });

  it('accepte juste en deçà du seuil et refuse juste au-delà', () => {
    const justInside = GHOST_MAX_START_DISTANCE_M - 50;
    const justOutside = GHOST_MAX_START_DISTANCE_M + 50;
    const degPerMeter = 1 / 111_320;
    expect(
      isGhostCandidate({ distanceM: 5000, points, startLat: 48 + justInside * degPerMeter, startLng: 2 }),
    ).toBe(true);
    expect(
      isGhostCandidate({ distanceM: 5000, points, startLat: 48 + justOutside * degPerMeter, startLng: 2 }),
    ).toBe(false);
  });

  it('refuse un départ invalide (null island)', () => {
    expect(isGhostCandidate({ distanceM: 5000, points, startLat: 0, startLng: 0 })).toBe(false);
  });

  it('refuse une course trop courte', () => {
    expect(isGhostCandidate({ distanceM: 400, points, startLat: 48, startLng: 2 })).toBe(false);
  });

  it('refuse une distance absente et une trace d’un seul point', () => {
    expect(isGhostCandidate({ distanceM: null, points, startLat: 48, startLng: 2 })).toBe(false);
    expect(
      isGhostCandidate({ distanceM: 5000, points: straightLine([0]), startLat: 48, startLng: 2 }),
    ).toBe(false);
  });
});

describe('shouldAnnounceGhost (R6, R7)', () => {
  const base = { status: 'ahead' as const, lastStatus: 'ahead' as const, lastAnnouncedAtS: 0, netSeconds: 120 };

  it('annonce un changement de statut', () => {
    expect(shouldAnnounceGhost({ ...base, lastStatus: 'behind' })).toBe(true);
  });

  it('n’annonce pas deux fois le même changement', () => {
    expect(shouldAnnounceGhost({ ...base, lastStatus: 'ahead' })).toBe(false);
  });

  it('respecte le délai minimum entre deux annonces', () => {
    expect(shouldAnnounceGhost({ ...base, lastStatus: 'behind', netSeconds: 30 })).toBe(false);
  });

  it('première annonce possible quand rien n’a encore été dit', () => {
    expect(
      shouldAnnounceGhost({ status: 'behind', lastStatus: null, lastAnnouncedAtS: null, netSeconds: 5 }),
    ).toBe(true);
  });

  it('ne parle jamais du fantôme terminé', () => {
    expect(shouldAnnounceGhost({ ...base, status: 'finished', lastStatus: 'ahead' })).toBe(false);
  });

  it('ne parle pas du coude à coude', () => {
    expect(shouldAnnounceGhost({ ...base, status: 'level', lastStatus: 'ahead' })).toBe(false);
  });
});
