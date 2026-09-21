import { describe, expect, it } from 'vitest';
import {
  computeRunEfforts, rankEfforts, pickMapMedals,
  approxPixelGap, dropOverlappingMedals, ordinalCategory,
  EFFORT_MIN_PACE_S_PER_KM, MAX_MAP_MEDALS, MAX_MEDAL_RANK, MEDAL_MIN_PIXEL_GAP,
  type MapBounds,
} from './run-efforts';
import type { GpsPoint } from './running';

/**
 * Trace droite le long d'un méridien : `n` points espacés de `stepM` mètres et `stepS` secondes.
 * 1° de latitude ≈ 111 320 m — on ne teste jamais la distance exacte, seulement des ordres de
 * grandeur et les invariants du module.
 */
const line = (n: number, stepM: number, stepS: number): GpsPoint[] =>
  Array.from({ length: n }, (_, i) => ({ lat: 45 + (i * stepM) / 111320, lng: 3, t: i * stepS }));

describe('computeRunEfforts (US EFFORT-01, spec R2/R5)', () => {
  it('une sortie de ~2 km a enfin quelque chose à dire : 400 m, demi-mile, 1 km, mile', () => {
    // C'est le cas qui motive l'US : avec les 5 distances d'origine, cette sortie ne donnait
    // qu'un seul effort (1 km). Elle en donne maintenant quatre.
    const efforts = computeRunEfforts(line(201, 10, 3)); // 2 000 m à 5:00 /km
    expect(efforts.map((e) => e.distanceKey)).toEqual(['400m', 'halfmile', '1k', 'mile']);
  });

  it('aucune distance non atteinte n’est écrite (R2) — jamais de zéro, jamais de null', () => {
    const efforts = computeRunEfforts(line(201, 10, 3));
    expect(efforts.map((e) => e.distanceKey)).not.toContain('5k');
    expect(efforts.every((e) => e.timeSeconds > 0)).toBe(true);
  });

  it('trace plus courte que 400 m → aucun effort', () => {
    expect(computeRunEfforts(line(31, 10, 3))).toEqual([]); // 300 m
  });

  it('trace vide ou à un seul point → aucun effort', () => {
    expect(computeRunEfforts([])).toEqual([]);
    expect(computeRunEfforts([{ lat: 45, lng: 3, t: 0 }])).toEqual([]);
  });

  it('les bornes de fenêtre sont cohérentes et dans la trace', () => {
    const points = line(201, 10, 3);
    for (const e of computeRunEfforts(points)) {
      expect(e.startIndex).toBeGreaterThanOrEqual(0);
      expect(e.endIndex).toBeGreaterThan(e.startIndex);
      expect(e.endIndex).toBeLessThan(points.length);
    }
  });

  it('le point milieu tombe SUR la trace, au milieu de la fenêtre (R10)', () => {
    const points = line(101, 10, 3); // ~1 km à 5:00 /km
    const e = computeRunEfforts(points).find((x) => x.distanceKey === '400m')!;
    expect(e.midLat).not.toBeNull();
    expect(e.midLng).toBe(3); // trace rectiligne le long d'un méridien
    // La trace est régulière : un pas = 10 m, donc l'indice fractionnaire du milieu doit tomber
    // 20 pas (200 m, la moitié de 400) avant le point qui a franchi la distance.
    const midIndex = ((e.midLat! - 45) * 111320) / 10;
    expect(midIndex).toBeCloseTo(e.endIndex - 20, 0);
    expect(e.midLat!).toBeGreaterThan(points[e.startIndex]!.lat);
    expect(e.midLat!).toBeLessThan(points[e.endIndex]!.lat);
  });

  it('un segment plus rapide que 2:00 /km est du bruit GPS, pas une performance (R17)', () => {
    // 400 m couverts en 40 s = 1:40 /km : sous le seuil, donc rien n'est écrit — alors que la
    // vitesse (10 m/s) passe sous MAX_PLAUSIBLE_SPEED_MS (12) et survit à `cumulativeDistances`.
    expect(EFFORT_MIN_PACE_S_PER_KM).toBe(120);
    const efforts = computeRunEfforts(line(41, 10, 1)); // 10 m/s partout
    expect(efforts).toEqual([]);
  });

  it('une trace honnête n’est jamais filtrée par le seuil de bruit', () => {
    // 45 points = 44 pas ≈ 440 m, donc les 400 m sont franchis — à 5:00 /km, bien au-dessus du seuil.
    expect(computeRunEfforts(line(45, 10, 3)).map((e) => e.distanceKey)).toEqual(['400m']);
  });
});

describe('rankEfforts (spec R6/R7/R8)', () => {
  const e = (id: string, timeSeconds: number, achievedAt: string) => ({ id, timeSeconds, achievedAt });

  it('classe par temps croissant, rang 1 = record, écart 0', () => {
    const ranked = rankEfforts([
      e('b', 280, '2026-05-01T00:00:00.000Z'),
      e('a', 240, '2026-06-01T00:00:00.000Z'),
      e('c', 300, '2026-07-01T00:00:00.000Z'),
    ]);
    expect(ranked.map((r) => [r.id, r.rank, r.gapSeconds])).toEqual([
      ['a', 1, 0], ['b', 2, 40], ['c', 3, 60],
    ]);
  });

  it('égalité stricte au temps → le PLUS ANCIEN garde la tête (R6)', () => {
    // On ne déclasse pas un record existant avec un temps identique.
    const ranked = rankEfforts([
      e('recent', 240, '2026-09-01T00:00:00.000Z'),
      e('ancien', 240, '2026-01-01T00:00:00.000Z'),
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['ancien', 'recent']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2]);
    expect(ranked.every((r) => r.gapSeconds === 0)).toBe(true);
  });

  it('un seul effort → rang 1, écart 0', () => {
    expect(rankEfforts([e('seul', 500, '2026-01-01T00:00:00.000Z')])).toEqual([
      { id: 'seul', timeSeconds: 500, achievedAt: '2026-01-01T00:00:00.000Z', rank: 1, gapSeconds: 0 },
    ]);
  });

  it('liste vide → liste vide', () => expect(rankEfforts([])).toEqual([]));

  it('l’arrivée d’un meilleur temps déclasse l’ancien record (R7 : le rang est dérivé)', () => {
    const before = rankEfforts([e('a', 240, '2026-01-01T00:00:00.000Z')]);
    expect(before[0]!.rank).toBe(1);
    const after = rankEfforts([
      e('a', 240, '2026-01-01T00:00:00.000Z'),
      e('b', 230, '2026-09-01T00:00:00.000Z'),
    ]);
    // La ligne de `a` n'a pas bougé d'un octet, et pourtant son rang a changé.
    expect(after.find((r) => r.id === 'a')!.rank).toBe(2);
    expect(after.find((r) => r.id === 'a')!.gapSeconds).toBe(10);
  });

  it('n’altère pas la liste reçue', () => {
    const input = [e('b', 300, '2026-01-01T00:00:00.000Z'), e('a', 200, '2026-02-01T00:00:00.000Z')];
    const copy = [...input];
    rankEfforts(input);
    expect(input).toEqual(copy);
  });
});

describe('pickMapMedals (spec R11/R12)', () => {
  const m = (rank: number, distanceMeters: number) => ({ rank, distanceMeters });

  it('au plus deux médailles (R11)', () => {
    expect(MAX_MAP_MEDALS).toBe(2);
    expect(pickMapMedals([m(1, 1000), m(2, 5000), m(3, 400), m(1, 1609.344)])).toHaveLength(2);
  });

  it('rang croissant d’abord, puis distance décroissante à égalité (R11)', () => {
    const picked = pickMapMedals([m(2, 400), m(1, 1000), m(1, 5000)]);
    expect(picked.map((p) => [p.rank, p.distanceMeters])).toEqual([[1, 5000], [1, 1000]]);
  });

  it('rien au-delà du rang 3 (R12)', () => {
    expect(MAX_MEDAL_RANK).toBe(3);
    expect(pickMapMedals([m(4, 1000), m(12, 5000)])).toEqual([]);
  });

  it('une sortie sans podium garde une carte propre', () => {
    expect(pickMapMedals([m(7, 400), m(9, 1000), m(22, 5000)])).toEqual([]);
  });

  it('liste vide → aucune médaille', () => expect(pickMapMedals([])).toEqual([]));

  it('un seul candidat classé → une seule médaille', () => {
    expect(pickMapMedals([m(3, 1000), m(8, 5000)])).toEqual([m(3, 1000)]);
  });
});

describe('approxPixelGap / dropOverlappingMedals (spec R13)', () => {
  // Un carré d'1/100e de degré rendu dans 300 × 300 px : 1 px = 1/30 000e de degré.
  const bounds: MapBounds = [3, 45, 3.01, 45.01];
  const at = (lat: number, lng: number) => ({ midLat: lat, midLng: lng, id: `${lat},${lng}` });

  it('mesure un écart cohérent avec le cadrage', () => {
    // Un dixième de la largeur = 30 px.
    expect(
      approxPixelGap({ lat: 45, lng: 3 }, { lat: 45, lng: 3.001 }, bounds, 300, 300),
    ).toBeCloseTo(30, 6);
  });

  it('deux positions identiques sont à zéro pixel', () => {
    expect(approxPixelGap({ lat: 45, lng: 3 }, { lat: 45, lng: 3 }, bounds, 300, 300)).toBe(0);
  });

  it('un cadrage dégénéré met tout au même endroit plutôt que de mentir', () => {
    // Des bornes réduites à un point : prétendre que deux médailles sont loin serait faux.
    expect(approxPixelGap({ lat: 45, lng: 3 }, { lat: 46, lng: 4 }, [3, 45, 3, 45], 300, 300)).toBe(0);
  });

  it('le seuil est la taille minimale d’une cible tactile', () => expect(MEDAL_MIN_PIXEL_GAP).toBe(44));

  it('garde les deux médailles quand elles sont assez écartées', () => {
    const kept = dropOverlappingMedals([at(45.002, 3.002), at(45.008, 3.008)], bounds, 300, 300);
    expect(kept).toHaveLength(2);
  });

  it('🔴 n’en garde qu’UNE quand elles se chevaucheraient — la première, donc la mieux classée', () => {
    const first = at(45.005, 3.005);
    const second = at(45.0051, 3.0051); // ~4 px plus loin
    const kept = dropOverlappingMedals([first, second], bounds, 300, 300);
    expect(kept).toEqual([first]);
  });

  it('ignore une médaille sans position — elle ne peut pas se poser', () => {
    const placed = at(45.005, 3.005);
    const kept = dropOverlappingMedals(
      [{ midLat: null, midLng: null, id: 'nulle' }, placed],
      bounds,
      300,
      300,
    );
    expect(kept).toEqual([placed]);
  });

  it('liste vide → rien', () => expect(dropOverlappingMedals([], bounds, 300, 300)).toEqual([]));
});

describe('ordinalCategory (spec §6)', () => {
  it('l’anglais distingue 1st / 2nd / 3rd / 4th', () => {
    expect([1, 2, 3, 4].map((n) => ordinalCategory(n, 'en'))).toEqual(['one', 'two', 'few', 'other']);
  });

  it('🔴 l’anglais retombe sur « th » à partir de 11 — le piège de la concaténation', () => {
    // `n + 'th'` donnerait « 21th » ; `n + 'st'` donnerait « 11st ». Les deux sont faux.
    expect(ordinalCategory(11, 'en')).toBe('other');
    expect(ordinalCategory(12, 'en')).toBe('other');
    expect(ordinalCategory(13, 'en')).toBe('other');
    expect(ordinalCategory(21, 'en')).toBe('one');
    expect(ordinalCategory(22, 'en')).toBe('two');
  });

  it('le français ne distingue que le premier', () => {
    expect(ordinalCategory(1, 'fr')).toBe('one');
    expect([2, 3, 4, 11, 21].map((n) => ordinalCategory(n, 'fr'))).toEqual(
      ['other', 'other', 'other', 'other', 'other'],
    );
  });

  it('une locale inconnue retombe sur la forme la plus courante, sans lever', () => {
    expect(ordinalCategory(2, 'zz-ZZ-invalide!!')).toBe('other');
  });
});
