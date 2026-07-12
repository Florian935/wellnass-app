import { describe, expect, it } from 'vitest';
import { encodeSegment, appendToTrack, decodeTrack, type GpsPoint } from './running';
import { cumulativeDistances, computeRunRecords } from './pace-records';

// ---------------------------------------------------------------------------
// Test de reproduction du bug « marche lente 1,01 km sans record 1 km ».
//
// Voir docs/specs/technical/fix-running-gps-precision-records.md §3.
//
// On synthetise une marche lente reelle : ~1400 points a 1 Hz, avancant vers le
// nord d'un pas moyen ~0,68 m, avec un bruit GPS sous-metrique (sigma ~0,4 m) sur
// les deux axes — comme un vrai releve device. La distance reelle (pleine
// precision, ce que cumule le tracker live) vaut ~1008 m. On insere aussi un
// point (0,0) « null island » (fix GPS degrade) qui doit etre ecarte a
// l'ingestion (Volet A) et donc absent de la trace encodee.
//
// Cause dominante (C) : a l'encodage 1e-5 (maille ~1,1 m), le bruit sous-metrique
// et les pas plus courts que la maille sont ecrases → la trace DECODEE sous-compte
// (~961 m < 1000 m) alors que le tracker live cumule ~1008 m a pleine precision.
// Trace decodee < 1000 m → `computeRunRecords` ne pose PAS la cle '1k'.
//
// A 1e-6 (~0,11 m), la trace decodee redevient fidele (≥ 1000 m) → le record 1 km
// apparait. Ce test etait ROUGE avant le passage a 1e-6, VERT apres.
// ---------------------------------------------------------------------------

const LAT0 = 48.85;
const LNG0 = 2.35;
const M_PER_DEG_LAT = (Math.PI / 180) * 6_371_000;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180);

/**
 * Genere une marche lente bruitee de ~1008 m reels, avec un point (0,0) insere.
 * PRNG deterministe (LCG) pour un test stable et reproductible.
 */
function slowNoisyWalkWithNullIsland(): GpsPoint[] {
  const count = 1400;
  const stepM = 0.68; // pas moyen vers le nord (marche lente ~23:05/km)
  const sigmaM = 0.4; // bruit GPS sous-metrique par axe
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  // Bruit quasi-gaussien (somme de 2 uniformes centrees).
  const noise = () => (rnd() - 0.5 + rnd() - 0.5) * sigmaM;

  const points: GpsPoint[] = [];
  for (let i = 0; i < count; i++) {
    const northM = stepM * i + noise();
    const eastM = noise();
    points.push({
      lat: LAT0 + northM / M_PER_DEG_LAT,
      lng: LNG0 + eastM / M_PER_DEG_LNG,
      t: i, // 1 Hz
    });
  }
  // Point aberrant (0,0) insere en milieu de trace.
  points.splice(Math.floor(count / 2), 0, {
    lat: 0,
    lng: 0,
    t: Math.floor(count / 2) - 0.5,
  });
  return points;
}

describe('reproduction : marche lente 1,01 km → record 1 km', () => {
  const walk = slowNoisyWalkWithNullIsland();
  // Trace nettoyee (comme apres le filtre d'ingestion Volet A : (0,0) ecarte).
  const cleanWalk = walk.filter((p) => !(p.lat === 0 && p.lng === 0));

  it('la marche reelle (pleine precision) depasse 1000 m (~1008 m)', () => {
    const cum = cumulativeDistances(cleanWalk);
    const total = cum[cum.length - 1]!;
    expect(total).toBeGreaterThan(1000);
    expect(total).toBeLessThan(1020);
  });

  it('APRES fix (1e-6) : trace encodee→decodee ≥ 1000 m et record 1 km present', () => {
    const track = appendToTrack('', encodeSegment(cleanWalk));
    const decoded = decodeTrack(track);
    const cum = cumulativeDistances(decoded);
    const total = cum[cum.length - 1]!;

    // Precision 1e-6 : trace decodee fidele (≥ 1000 m). A 1e-5, on retombait ~961 m.
    expect(total).toBeGreaterThanOrEqual(1000);

    const records = computeRunRecords(decoded);
    expect(Object.keys(records)).toContain('1k');
  });

  it('le point (0,0) n\'est pas encode dans la trace (filtre ingestion)', () => {
    // La trace encodee provient de cleanWalk : aucun point exactement a (0,0).
    const decoded = decodeTrack(appendToTrack('', encodeSegment(cleanWalk)));
    expect(decoded.some((p) => p.lat === 0 && p.lng === 0)).toBe(false);
  });
});
