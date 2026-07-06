import { describe, expect, it } from 'vitest';
import {
  RUN_STATUSES,
  runStatusSchema,
  RUN_SOURCES,
  runSourceSchema,
  haversineMeters,
  totalDistance,
  averagePace,
  instantPace,
  encodeSegment,
  appendToTrack,
  decodeTrack,
  runRowSchema,
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
