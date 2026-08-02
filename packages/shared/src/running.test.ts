import { describe, expect, it } from 'vitest';
import {
  RUN_STATUSES,
  runStatusSchema,
  RUN_SOURCES,
  runSourceSchema,
  haversineMeters,
  totalDistance,
  computeKmSplits,
  averagePace,
  instantPace,
  encodeSegment,
  appendToTrack,
  decodeTrack,
  isValidFix,
  isValidCoord,
  ACCURACY_MAX_M,
  smoothedSpeedMs,
  runRowSchema,
  estimateRunCalories,
  NET_KCAL_PER_KG_KM,
  MAX_INTENSITY_BONUS,
  nextAnnouncementThreshold,
} from './running';

// ---------------------------------------------------------------------------
// Constantes de test
// ---------------------------------------------------------------------------
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const NOW = '2026-07-06T00:00:00.000Z';

const BASE_SYNC = {
  id: UUID,
  userId: UUID,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

// ---------------------------------------------------------------------------
// RUN_STATUSES
// ---------------------------------------------------------------------------
describe('RUN_STATUSES', () => {
  it('contient les 3 statuts canoniques', () => {
    expect(RUN_STATUSES).toEqual(['active', 'completed', 'cancelled']);
  });

  it('runStatusSchema accepte une valeur valide', () => {
    expect(runStatusSchema.parse('active')).toBe('active');
    expect(runStatusSchema.parse('completed')).toBe('completed');
    expect(runStatusSchema.parse('cancelled')).toBe('cancelled');
  });

  it('runStatusSchema rejette une valeur inconnue', () => {
    expect(runStatusSchema.safeParse('paused').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RUN_SOURCES
// ---------------------------------------------------------------------------
describe('RUN_SOURCES', () => {
  it('contient les 2 sources canoniques', () => {
    expect(RUN_SOURCES).toEqual(['gps', 'manual']);
  });

  it('runSourceSchema accepte une valeur valide', () => {
    expect(runSourceSchema.parse('gps')).toBe('gps');
    expect(runSourceSchema.parse('manual')).toBe('manual');
  });

  it('runSourceSchema rejette une valeur inconnue', () => {
    expect(runSourceSchema.safeParse('estimated').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// haversineMeters
// ---------------------------------------------------------------------------
describe('haversineMeters', () => {
  it('retourne 0 pour deux points identiques', () => {
    expect(haversineMeters({ lat: 48.8566, lng: 2.3522 }, { lat: 48.8566, lng: 2.3522 })).toBe(0);
  });

  it('calcule la distance Paris-Lyon a +/- 200 m pres (~391 km)', () => {
    // Paris : 48.8566, 2.3522 / Lyon : 45.7640, 4.8357
    // Distance haversine ~391 499 m (spherique, pas ellipsoidale)
    const d = haversineMeters({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 });
    expect(d).toBeGreaterThan(391_400);
    expect(d).toBeLessThan(391_700);
  });

  it('calcule une distance courte (~111 m) sur 0.001 degre de lat', () => {
    // 0.001 degre de latitude ~111.195 m
    const d = haversineMeters({ lat: 48.0, lng: 2.0 }, { lat: 48.001, lng: 2.0 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
});

// ---------------------------------------------------------------------------
// totalDistance
// ---------------------------------------------------------------------------
describe('totalDistance', () => {
  it('retourne 0 pour un tableau vide', () => {
    expect(totalDistance([])).toBe(0);
  });

  it('retourne 0 pour un seul point', () => {
    expect(totalDistance([{ lat: 48.0, lng: 2.0, t: 0 }])).toBe(0);
  });

  it("somme les segments d'un trajet simple (aucun outlier)", () => {
    // 3 points espaces de ~111 m chacun (0.001 degre lat)
    const pts = [
      { lat: 48.000, lng: 2.0, t: 0 },
      { lat: 48.001, lng: 2.0, t: 10 },
      { lat: 48.002, lng: 2.0, t: 20 },
    ];
    const d = totalDistance(pts);
    // ~222 m (2 x ~111 m)
    expect(d).toBeGreaterThan(220);
    expect(d).toBeLessThan(224);
  });

  it('exclut un segment glitch (saut > 12 m/s)', () => {
    // Segment 0->1 : 0.001 deg en 10 s ~111 m / 10 s = 11.1 m/s (< 12, inclus)
    // Segment 1->2 : 0.5 deg en 10 s ~55 600 m / 10 s = 5560 m/s (glitch, exclu)
    // Segment 2->3 : 0.001 deg en 10 s ~111 m / 10 s = 11.1 m/s (< 12, inclus)
    const pts = [
      { lat: 48.000, lng: 2.0, t: 0 },
      { lat: 48.001, lng: 2.0, t: 10 },
      { lat: 48.501, lng: 2.0, t: 20 }, // point glitch GPS
      { lat: 48.502, lng: 2.0, t: 30 },
    ];
    const d = totalDistance(pts);
    // Seuls les segments 0->1 et 2->3 sont inclus ~222 m
    expect(d).toBeGreaterThan(220);
    expect(d).toBeLessThan(224);
  });

  it('exclut le segment si delta-t = 0 (vitesse infinie)', () => {
    const pts = [
      { lat: 48.000, lng: 2.0, t: 0 },
      { lat: 48.001, lng: 2.0, t: 0 }, // delta-t = 0, glitch
    ];
    expect(totalDistance(pts)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// averagePace
// ---------------------------------------------------------------------------
describe('averagePace', () => {
  it('retourne null si distanceM <= 0', () => {
    expect(averagePace(0, 600)).toBeNull();
    expect(averagePace(-10, 600)).toBeNull();
  });

  it('calcule allure : 5 km en 25 min = 5 min/km = 300 s/km', () => {
    expect(averagePace(5000, 25 * 60)).toBe(300);
  });

  it('calcule allure : 10 km en 50 min = 5 min/km = 300 s/km', () => {
    expect(averagePace(10_000, 50 * 60)).toBe(300);
  });

  it('calcule allure : 1 km en 6 min = 360 s/km', () => {
    expect(averagePace(1000, 360)).toBe(360);
  });
});

// ---------------------------------------------------------------------------
// instantPace
// ---------------------------------------------------------------------------
describe('instantPace', () => {
  it('retourne null pour un tableau vide', () => {
    expect(instantPace([])).toBeNull();
  });

  it('retourne null pour un seul point', () => {
    expect(instantPace([{ lat: 48.0, lng: 2.0, t: 0 }])).toBeNull();
  });

  it('calcule allure sur la fenetre glissante par defaut (60 s)', () => {
    // Points espaces de 0.001 deg lat (~111 m) toutes les 10 s
    const pts = Array.from({ length: 8 }, (_, i) => ({
      lat: 48.0 + i * 0.001,
      lng: 2.0,
      t: i * 10,
    }));
    const pace = instantPace(pts);
    // Dernier t=70, fenetre [10, 70], 6 segments ~666 m / 60 s = 11.1 m/s
    // allure ~1000 / 11.1 ~90 s/km
    expect(pace).not.toBeNull();
    if (pace !== null) {
      expect(pace).toBeGreaterThan(85);
      expect(pace).toBeLessThan(96);
    }
  });

  it('retourne null si distance dans la fenetre est 0', () => {
    const pts = [
      { lat: 48.0, lng: 2.0, t: 0 },
      { lat: 48.0, lng: 2.0, t: 30 },
      { lat: 48.0, lng: 2.0, t: 60 },
    ];
    expect(instantPace(pts)).toBeNull();
  });

  it('supporte une fenetre personnalisee (windowS = 30)', () => {
    const pts = Array.from({ length: 6 }, (_, i) => ({
      lat: 48.0 + i * 0.001,
      lng: 2.0,
      t: i * 10,
    }));
    const pace = instantPace(pts, 30);
    // Dernier t=50, fenetre [20, 50], 3 segments ~333 m / 30 s = 11.1 m/s
    expect(pace).not.toBeNull();
    if (pace !== null) {
      expect(pace).toBeGreaterThan(85);
      expect(pace).toBeLessThan(96);
    }
  });
});

// ---------------------------------------------------------------------------
// encodeSegment / appendToTrack / decodeTrack (round-trip)
// ---------------------------------------------------------------------------
describe('encodage trace GPS', () => {
  const seg1 = [
    { lat: 48.8520, lng: 2.3512, t: 0 },
    { lat: 48.8521, lng: 2.3513, t: 5 },
    { lat: 48.8522, lng: 2.3514, t: 10 },
  ];

  const seg2 = [
    { lat: 48.8523, lng: 2.3515, t: 15 },
    { lat: 48.8524, lng: 2.3516, t: 20 },
  ];

  it('encodeSegment retourne une chaine non vide pour des points valides', () => {
    const encoded = encodeSegment(seg1);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('encodeSegment retourne une chaine vide pour un tableau vide', () => {
    expect(encodeSegment([])).toBe('');
  });

  it('appendToTrack sur piste vide produit une piste decodable', () => {
    const encoded = encodeSegment(seg1);
    const track = appendToTrack('', encoded);
    // La piste est prefixee par la longueur du segment pour permettre l'ajout sans re-encodage
    expect(track).toContain(encoded);
    // Et doit etre correctement decodable
    const decoded = decodeTrack(track);
    expect(decoded).toHaveLength(seg1.length);
  });

  it("appendToTrack d'un segment vide ne modifie pas la piste", () => {
    const track = encodeSegment(seg1);
    const result = appendToTrack(track, '');
    expect(result).toBe(track);
  });

  it('round-trip : decodeTrack reconstruit seg1 + seg2 avec precision 1e-5', () => {
    const track = appendToTrack(appendToTrack('', encodeSegment(seg1)), encodeSegment(seg2));
    const decoded = decodeTrack(track);
    const expected = [...seg1, ...seg2];

    expect(decoded).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
      const d = decoded[i]!;
      const e = expected[i]!;
      expect(d.lat).toBeCloseTo(e.lat, 5);
      expect(d.lng).toBeCloseTo(e.lng, 5);
      expect(d.t).toBe(e.t);
    }
  });

  it('round-trip avec un seul segment', () => {
    const track = appendToTrack('', encodeSegment(seg1));
    const decoded = decodeTrack(track);

    expect(decoded).toHaveLength(seg1.length);
    for (let i = 0; i < seg1.length; i++) {
      const d = decoded[i]!;
      const e = seg1[i]!;
      expect(d.lat).toBeCloseTo(e.lat, 5);
      expect(d.lng).toBeCloseTo(e.lng, 5);
      expect(d.t).toBe(e.t);
    }
  });

  it('decodeTrack("") retourne []', () => {
    expect(decodeTrack('')).toEqual([]);
  });

  it("append n'encode pas les segments precedents (idempotence append)", () => {
    const s1 = encodeSegment(seg1);
    const s2 = encodeSegment(seg2);
    const track1 = appendToTrack('', s1);
    const track2 = appendToTrack(track1, s2);
    // Le debut de track2 doit commencer par track1
    expect(track2.startsWith(track1)).toBe(true);
  });

  it('round-trip 1e-6 : coordonnees fideles a 6 decimales', () => {
    // Deux points distants de ~0,11 m (sous la maille 1e-5, au-dessus de 1e-6).
    const fine = [
      { lat: 48.8500000, lng: 2.3500000, t: 0 },
      { lat: 48.8500010, lng: 2.3500010, t: 1 },
    ];
    const decoded = decodeTrack(appendToTrack('', encodeSegment(fine)));
    expect(decoded).toHaveLength(2);
    expect(decoded[0]!.lat).toBeCloseTo(48.85, 6);
    expect(decoded[1]!.lat).toBeCloseTo(48.850001, 6);
    expect(decoded[1]!.lng).toBeCloseTo(2.350001, 6);
  });
});

// ---------------------------------------------------------------------------
// Versionnage du format de segment + compat ascendante (1e-5 herite)
// ---------------------------------------------------------------------------
describe('versionnage format de segment', () => {
  const seg1 = [
    { lat: 48.852, lng: 2.3512, t: 0 },
    { lat: 48.8521, lng: 2.3513, t: 5 },
    { lat: 48.8522, lng: 2.3514, t: 10 },
  ];
  const seg2 = [
    { lat: 48.8523, lng: 2.3515, t: 15 },
    { lat: 48.8524, lng: 2.3516, t: 20 },
  ];

  // Fixtures HERITEES (v0) generees par l'ancien encodeur 1e-5 (separateur `|`,
  // aucun marqueur de version). NE PAS regenerer : elles simulent des traces
  // deja stockees en base avant le passage a 1e-6.
  const LEGACY_SEG1 = '_ldiH_fjMSSSS|?II';
  const LEGACY_TRACK_1E5 = '17:_ldiH_fjMSSSS|?II14:{mdiH{gjMSS|]I';

  it('encodeSegment emet le marqueur de version `#1#` en tete', () => {
    const enc = encodeSegment(seg1);
    expect(enc.startsWith('#1#')).toBe(true);
  });

  it('decode une trace HERITEE 1e-5 (sans marqueur) correctement', () => {
    const decoded = decodeTrack(LEGACY_TRACK_1E5);
    const expected = [...seg1, ...seg2];
    expect(decoded).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(decoded[i]!.lat).toBeCloseTo(expected[i]!.lat, 5);
      expect(decoded[i]!.lng).toBeCloseTo(expected[i]!.lng, 5);
      expect(decoded[i]!.t).toBe(expected[i]!.t);
    }
  });

  it('decode une trace MIXTE (segment herite 1e-5 puis segment neuf 1e-6) dans l\'ordre', () => {
    // Segment herite v0 (prefixe par sa longueur) suivi d'un segment neuf v1.
    const legacyBlock = LEGACY_SEG1.length.toString() + ':' + LEGACY_SEG1;
    const mixed = appendToTrack(legacyBlock, encodeSegment(seg2));
    const decoded = decodeTrack(mixed);
    const expected = [...seg1, ...seg2];
    expect(decoded).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(decoded[i]!.lat).toBeCloseTo(expected[i]!.lat, 5);
      expect(decoded[i]!.lng).toBeCloseTo(expected[i]!.lng, 5);
      expect(decoded[i]!.t).toBe(expected[i]!.t);
    }
  });

  it('ignore un segment de version inconnue sans casser le decodage', () => {
    // Version 9 inconnue → segment saute ; le segment v1 suivant est decode.
    const unknown = '#9#abc';
    const block = unknown.length.toString() + ':' + unknown;
    const decoded = decodeTrack(appendToTrack(block, encodeSegment(seg2)));
    expect(decoded).toHaveLength(seg2.length);
    expect(decoded[0]!.lat).toBeCloseTo(seg2[0]!.lat, 6);
  });

  it('ignore un marqueur de version malformed (pas de `#` fermant)', () => {
    // `#1` sans `#` fermant → segment ignore, aucun point.
    const bad = '#1abcdef';
    const block = bad.length.toString() + ':' + bad;
    expect(decodeTrack(block)).toEqual([]);
  });

  it('ignore un marqueur de version non numerique', () => {
    const bad = '#x#abc';
    const block = bad.length.toString() + ':' + bad;
    expect(decodeTrack(block)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// smoothedSpeedMs (vitesse lissée pour l'auto-pause — Volet B)
// ---------------------------------------------------------------------------
describe('smoothedSpeedMs', () => {
  const M_PER_DEG_LAT = (Math.PI / 180) * 6_371_000;
  const toLat = (baseLat: number, m: number) => baseLat + m / M_PER_DEG_LAT;
  const WINDOW_S = 10;
  // Seuils du tracker mobile (Volet B) : à valider ici, dans le suite CI Vitest.
  const AUTO_PAUSE_SPEED_MS = 0.3;
  const OLD_THRESHOLD_MS = 0.5;

  it('retourne null pour moins de 2 points', () => {
    expect(smoothedSpeedMs([], WINDOW_S)).toBeNull();
    expect(smoothedSpeedMs([{ lat: 48.85, lng: 2.35, t: 0 }], WINDOW_S)).toBeNull();
  });

  it('retourne null si la fenêtre ne contient qu\'un point', () => {
    // 2 points mais espacés au-delà de la fenêtre → un seul dans la fenêtre.
    const pts = [
      { lat: 48.85, lng: 2.35, t: 0 },
      { lat: toLat(48.85, 5), lng: 2.35, t: 100 },
    ];
    expect(smoothedSpeedMs(pts, WINDOW_S)).toBeNull();
  });

  it('marche lente bruitée (~0,72 m/s) : lissée > 0,3 → PAS d\'auto-pause', () => {
    // Pas moyen 0,72 m mais alternance 0,2 / 1,24 m : la vitesse INSTANTANÉE
    // plonge sous 0,5 (et 0,3) un point sur deux, mais la moyenne reste ~0,72.
    let cursor = 0;
    const pts = Array.from({ length: 11 }, (_, i) => {
      const step = i % 2 === 0 ? 0.2 : 1.24; // moyenne = 0,72 m
      cursor += i === 0 ? 0 : step;
      return { lat: toLat(48.85, cursor), lng: 2.35, t: i };
    });
    const smoothed = smoothedSpeedMs(pts, WINDOW_S)!;
    // Le lissage neutralise les creux instantanés : la moyenne (~0,72) reste
    // largement au-dessus du seuil (0,3) et même de l'ancien (0,5). C'est le
    // lissage — pas seulement le seuil — qui évite l'auto-pause à tort ici.
    expect(smoothed).toBeGreaterThan(AUTO_PAUSE_SPEED_MS);
    expect(smoothed).toBeGreaterThan(OLD_THRESHOLD_MS);
  });

  it('les creux instantanés sous 0,5 m/s n\'abaissent pas la moyenne sous 0,3', () => {
    // Marche à ~0,4 m/s (proche du quasi-arrêt) avec creux : lissée reste > 0,3,
    // là où le seuil 0,5 aurait auto-pausé à tort.
    let cursor = 0;
    const pts = Array.from({ length: 11 }, (_, i) => {
      const step = i % 2 === 0 ? 0.05 : 0.75; // moyenne = 0,40 m/s
      cursor += i === 0 ? 0 : step;
      return { lat: toLat(48.85, cursor), lng: 2.35, t: i };
    });
    const smoothed = smoothedSpeedMs(pts, WINDOW_S)!;
    expect(smoothed).toBeGreaterThan(AUTO_PAUSE_SPEED_MS);
    expect(smoothed).toBeLessThan(OLD_THRESHOLD_MS); // aurait pausé à 0,5
  });

  it('vrai arrêt prolongé : lissée ~0 → sous le seuil (auto-pause justifiée)', () => {
    // 11 points quasi immobiles (dérive GPS < 0,05 m) sur 10 s.
    let cursor = 0;
    const pts = Array.from({ length: 11 }, (_, i) => {
      cursor += i === 0 ? 0 : 0.02;
      return { lat: toLat(48.85, cursor), lng: 2.35, t: i };
    });
    const smoothed = smoothedSpeedMs(pts, WINDOW_S)!;
    expect(smoothed).toBeLessThan(AUTO_PAUSE_SPEED_MS);
  });

  it('exclut les segments glitch (> vitesse plausible) du lissage', () => {
    // Un saut aberrant au milieu ne doit pas gonfler la vitesse lissée.
    const pts = [
      { lat: 48.85, lng: 2.35, t: 0 },
      { lat: toLat(48.85, 0.4), lng: 2.35, t: 1 },
      { lat: toLat(48.85, 5000), lng: 2.35, t: 2 }, // glitch (~5 km en 1 s)
      { lat: toLat(48.85, 5000.4), lng: 2.35, t: 3 },
    ];
    const smoothed = smoothedSpeedMs(pts, WINDOW_S)!;
    // Seuls les 2 pas de 0,4 m comptent (~0,8 m sur 3 s ≈ 0,27 m/s), pas les 5 km.
    expect(smoothed).toBeLessThan(1);
  });

  it('ignore un delta-t nul entre deux points', () => {
    const pts = [
      { lat: 48.85, lng: 2.35, t: 0 },
      { lat: toLat(48.85, 1), lng: 2.35, t: 0 }, // dt = 0
      { lat: toLat(48.85, 2), lng: 2.35, t: 2 },
    ];
    // Pas de crash ; seule la portion à dt>0 compte.
    expect(smoothedSpeedMs(pts, WINDOW_S)).not.toBeNull();
  });

  it('retourne null si la durée de fenêtre est nulle (tous même t)', () => {
    const pts = [
      { lat: 48.85, lng: 2.35, t: 5 },
      { lat: toLat(48.85, 1), lng: 2.35, t: 5 },
    ];
    expect(smoothedSpeedMs(pts, WINDOW_S)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isValidCoord (validite geographique pure — partagee par isValidFix et buildGpx)
// ---------------------------------------------------------------------------
describe('isValidCoord', () => {
  it('accepte une coordonnee nominale (Paris)', () => {
    expect(isValidCoord(48.8566, 2.3522)).toBe(true);
  });

  it('rejette le point (0,0) « null island »', () => {
    expect(isValidCoord(0, 0)).toBe(false);
  });

  it('accepte une coordonnee avec une seule composante nulle', () => {
    expect(isValidCoord(0, 2.35)).toBe(true);
    expect(isValidCoord(48.85, 0)).toBe(true);
  });

  it('rejette une latitude hors bornes (|lat| > 90)', () => {
    expect(isValidCoord(91, 2.35)).toBe(false);
    expect(isValidCoord(-90.1, 2.35)).toBe(false);
  });

  it('rejette une longitude hors bornes (|lng| > 180)', () => {
    expect(isValidCoord(48.85, 181)).toBe(false);
    expect(isValidCoord(48.85, -180.5)).toBe(false);
  });

  it('accepte les bornes exactes (|lat| = 90, |lng| = 180)', () => {
    expect(isValidCoord(90, 180)).toBe(true);
    expect(isValidCoord(-90, -180)).toBe(true);
  });

  it('rejette des coordonnees non finies (NaN / Infinity)', () => {
    expect(isValidCoord(NaN, 2.35)).toBe(false);
    expect(isValidCoord(48.85, Infinity)).toBe(false);
    expect(isValidCoord(-Infinity, 2.35)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidFix (filtre des fixes GPS invalides)
// ---------------------------------------------------------------------------
describe('isValidFix', () => {
  it('accepte un fix nominal (Paris, bonne precision)', () => {
    expect(isValidFix({ lat: 48.8566, lng: 2.3522, accuracy: 8 })).toBe(true);
  });

  it('accepte un fix sans accuracy (absent ou null)', () => {
    expect(isValidFix({ lat: 48.8566, lng: 2.3522 })).toBe(true);
    expect(isValidFix({ lat: 48.8566, lng: 2.3522, accuracy: null })).toBe(true);
  });

  it('rejette le point (0,0) « null island »', () => {
    expect(isValidFix({ lat: 0, lng: 0 })).toBe(false);
  });

  it('accepte une coordonnee legitime avec une seule composante nulle', () => {
    // Equateur (lat 0) ou meridien de Greenwich (lng 0) restent valides.
    expect(isValidFix({ lat: 0, lng: 2.35 })).toBe(true);
    expect(isValidFix({ lat: 48.85, lng: 0 })).toBe(true);
  });

  it('rejette une latitude hors bornes (|lat| > 90)', () => {
    expect(isValidFix({ lat: 91, lng: 2.35 })).toBe(false);
    expect(isValidFix({ lat: -90.1, lng: 2.35 })).toBe(false);
  });

  it('rejette une longitude hors bornes (|lng| > 180)', () => {
    expect(isValidFix({ lat: 48.85, lng: 181 })).toBe(false);
    expect(isValidFix({ lat: 48.85, lng: -180.5 })).toBe(false);
  });

  it('rejette des coordonnees non finies (NaN / Infinity)', () => {
    expect(isValidFix({ lat: NaN, lng: 2.35 })).toBe(false);
    expect(isValidFix({ lat: 48.85, lng: Infinity })).toBe(false);
  });

  it('rejette une accuracy au-dela du seuil', () => {
    expect(isValidFix({ lat: 48.85, lng: 2.35, accuracy: ACCURACY_MAX_M + 1 })).toBe(false);
  });

  it('accepte une accuracy pile au seuil', () => {
    expect(isValidFix({ lat: 48.85, lng: 2.35, accuracy: ACCURACY_MAX_M })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runRowSchema
// ---------------------------------------------------------------------------
describe('runRowSchema', () => {
  const validRow = {
    ...BASE_SYNC,
    status: 'active',
    source: 'gps',
    startedAt: NOW,
    finishedAt: null,
    durationSeconds: null,
    distanceM: null,
    avgPaceSPerKm: null,
    gpsTrack: null,
    rpe: null,
    notes: null,
    plannedSessionId: null,
    terrain: null,
  };

  it('valide une ligne course minimale', () => {
    const result = runRowSchema.parse(validRow);
    expect(result.status).toBe('active');
    expect(result.source).toBe('gps');
  });

  it('valide une ligne course complete', () => {
    const fullRow = {
      ...validRow,
      status: 'completed',
      source: 'gps',
      finishedAt: NOW,
      durationSeconds: 1800,
      distanceM: 5000,
      avgPaceSPerKm: 360,
      gpsTrack: 'abcdef',
      rpe: 7,
      notes: 'Belle sortie',
    };
    const result = runRowSchema.parse(fullRow);
    expect(result.status).toBe('completed');
    expect(result.distanceM).toBe(5000);
    expect(result.rpe).toBe(7);
  });

  it('valide source manual', () => {
    const row = { ...validRow, source: 'manual' };
    expect(runRowSchema.safeParse(row).success).toBe(true);
  });

  it('rejette un status inconnu', () => {
    const row = { ...validRow, status: 'paused' };
    expect(runRowSchema.safeParse(row).success).toBe(false);
  });

  it('rejette une source inconnue', () => {
    const row = { ...validRow, source: 'estimated' };
    expect(runRowSchema.safeParse(row).success).toBe(false);
  });

  it('accepte rpe a 1 (minimum)', () => {
    expect(runRowSchema.safeParse({ ...validRow, rpe: 1 }).success).toBe(true);
  });

  it('accepte rpe a 10 (maximum)', () => {
    expect(runRowSchema.safeParse({ ...validRow, rpe: 10 }).success).toBe(true);
  });

  it('rejette rpe hors plage (0)', () => {
    expect(runRowSchema.safeParse({ ...validRow, rpe: 0 }).success).toBe(false);
  });

  it('rejette rpe hors plage (11)', () => {
    expect(runRowSchema.safeParse({ ...validRow, rpe: 11 }).success).toBe(false);
  });

  it('rejette durationSeconds negatif', () => {
    expect(runRowSchema.safeParse({ ...validRow, durationSeconds: -1 }).success).toBe(false);
  });

  it('accepte durationSeconds a 0', () => {
    expect(runRowSchema.safeParse({ ...validRow, durationSeconds: 0 }).success).toBe(true);
  });

  it('rejette distanceM negative', () => {
    expect(runRowSchema.safeParse({ ...validRow, distanceM: -1 }).success).toBe(false);
  });

  it('accepte distanceM a 0', () => {
    expect(runRowSchema.safeParse({ ...validRow, distanceM: 0 }).success).toBe(true);
  });

  it('exige userId (champ syncFields)', () => {
    const { userId: _uid, ...withoutUser } = validRow;
    expect(runRowSchema.safeParse(withoutUser).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// estimateRunCalories (depense calorique NET — croisement running <-> nutrition)
// ---------------------------------------------------------------------------
describe('estimateRunCalories', () => {
  it('0 si distance ou poids manquant/nul', () => {
    expect(estimateRunCalories({ distanceM: null, durationSeconds: 1800, weightKg: 70 })).toBe(0);
    expect(estimateRunCalories({ distanceM: 10000, durationSeconds: 1800, weightKg: null })).toBe(0);
    expect(estimateRunCalories({ distanceM: 0, durationSeconds: 1800, weightKg: 70 })).toBe(0);
    expect(estimateRunCalories({ distanceM: 10000, durationSeconds: 1800, weightKg: 0 })).toBe(0);
  });
  it('base NET = poids × km × 1.0 pour une allure « facile » (≤ 8 km/h → +0 %)', () => {
    expect(estimateRunCalories({ distanceM: 10000, durationSeconds: 4500, weightKg: 70 })).toBe(700);
  });
  it('durée absente → base NET seule (pas de terme d’intensité)', () => {
    expect(estimateRunCalories({ distanceM: 10000, durationSeconds: null, weightKg: 70 })).toBe(700);
  });
  it('allure rapide → bonus d’intensité borné à +10 %', () => {
    const kcal = estimateRunCalories({ distanceM: 10000, durationSeconds: 1800, weightKg: 70 });
    expect(kcal).toBe(Math.round(700 * (1 + MAX_INTENSITY_BONUS)));
  });
  it('allure intermédiaire → bonus proportionnel non plafonné', () => {
    const kcal = estimateRunCalories({ distanceM: 10000, durationSeconds: 3000, weightKg: 70 });
    expect(kcal).toBe(Math.round(700 * 1.04));
  });
  it('NET_KCAL_PER_KG_KM vaut 1.0', () => {
    expect(NET_KCAL_PER_KG_KM).toBe(1.0);
  });
});

describe('computeKmSplits', () => {
  const M_PER_DEG = 111_320;
  // Trace ~ `segments` × 100 m le long de l'equateur (lat=0), 30 s par pas de 100 m.
  const track = (segments: number) =>
    Array.from({ length: segments + 1 }, (_, k) => ({
      lat: 0,
      lng: (k * 100) / M_PER_DEG,
      t: k * 30,
    }));

  it('renvoie [] avec moins de 2 points', () => {
    expect(computeKmSplits([])).toEqual([]);
    expect(computeKmSplits([{ lat: 0, lng: 0, t: 0 }])).toEqual([]);
  });

  it('aucun split si la trace fait moins d\'un km', () => {
    expect(computeKmSplits(track(5))).toEqual([]); // ~500 m
  });

  it('numerote les km pleins, ignore le dernier partiel, secondes positives', () => {
    const pts = track(25); // ~2,5 km
    const splits = computeKmSplits(pts);
    expect(splits.map((s) => s.km)).toEqual([1, 2]);
    expect(splits.length).toBe(Math.floor(totalDistance(pts) / 1000));
    for (const s of splits) expect(s.seconds).toBeGreaterThan(0);
  });
});

describe('nextAnnouncementThreshold (US RUN-F2a)', () => {
  it('franchit un nouveau seuil → renvoie index + distance', () => {
    expect(nextAnnouncementThreshold(2500, 1000, 1)).toEqual({ index: 2, thresholdM: 2000 });
  });

  it('même distance rejouée (seuil déjà annoncé) → null, jamais deux fois le même (spec R2)', () => {
    expect(nextAnnouncementThreshold(2500, 1000, 2)).toBeNull();
  });

  it('intervalle de 500 m, seuil franchi une seconde fois', () => {
    expect(nextAnnouncementThreshold(1400, 500, 1)).toEqual({ index: 2, thresholdM: 1000 });
  });

  it('saut de plusieurs seuils d\'un coup → annonce seulement le dernier, pas de rattrapage', () => {
    expect(nextAnnouncementThreshold(3200, 1000, 0)).toEqual({ index: 3, thresholdM: 3000 });
  });

  it('intervalle <= 0 → null (garde-fou)', () => {
    expect(nextAnnouncementThreshold(1000, 0, 0)).toBeNull();
    expect(nextAnnouncementThreshold(1000, -100, 0)).toBeNull();
  });

  it('distance sous le premier seuil → null', () => {
    expect(nextAnnouncementThreshold(400, 1000, 0)).toBeNull();
  });
});
