/**
 * Tests du tracker GPS de fond — chemin auto-pause / AUTO-REPRISE (Volet B).
 *
 * DoD §5 (Volet B) : « reprise OK (tests) ». On exerce ici le chemin complet via
 * l'API publique `handleLocationBatch` (qui appelle `evaluateAutoPause` en interne)
 * plutot que d'exposer la fonction privee — l'observation se fait par `getPaused()`,
 * `trackerState` et le compteur de flush.
 *
 * `handleLocationBatch` persiste via `run-repository.flushTrack` : on le mocke pour
 * isoler la logique de decision (pas d'acces PowerSync).
 */

import type { LocationObject } from 'expo-location';
import { flushTrack } from '@/data/repositories/run-repository';
import {
  handleLocationBatch,
  getPaused,
  setPaused,
  trackerState,
  initialTrackerState,
  AUTO_PAUSE_SPEED_MS,
  AUTO_PAUSE_WINDOW_S,
  AUTO_PAUSE_DELAY_S,
} from '../tracker-task';

// Mock du repository pour isoler la logique de decision (pas d'acces PowerSync).
// La factory jest.mock() est hoistee par Babel au-dessus des imports ; le binding
// importe `flushTrack` est alors le mock, inspectable directement.
jest.mock('@/data/repositories/run-repository', () => ({
  flushTrack: jest.fn(() => Promise.resolve()),
}));

const flushTrackMock = flushTrack as jest.Mock;

// Un degre de latitude ~ 111_195 m (spherique, rayon 6 371 000 m).
const M_PER_DEG_LAT = (Math.PI / 180) * 6_371_000;

/** Construit un `LocationObject` minimal a `metersNorth` m au nord de la base, au temps `tS` (s). */
function loc(
  metersNorth: number,
  tS: number,
  baseLat = 48.85,
  altitude: number | null = null,
  altitudeAccuracy: number | null = null,
): LocationObject {
  return {
    coords: {
      latitude: baseLat + metersNorth / M_PER_DEG_LAT,
      longitude: 2.35,
      altitude,
      accuracy: 5,
      altitudeAccuracy,
      heading: null,
      speed: null,
    },
    timestamp: tS * 1000, // startedAtMs = 0 → t = timestamp/1000
  };
}

/** Reinitialise l'etat module partage entre chaque test. */
function resetTracker(): void {
  Object.assign(trackerState, initialTrackerState(), {
    runId: 'run-1',
    startedAtMs: 0,
    autoPause: true,
  });
}

describe('tracker-task — auto-pause / auto-reprise (Volet B)', () => {
  beforeEach(() => {
    flushTrackMock.mockClear();
    resetTracker();
  });

  it('constantes de reglage attendues (seuil abaisse + fenetre lissee)', () => {
    expect(AUTO_PAUSE_SPEED_MS).toBe(0.3);
    expect(AUTO_PAUSE_WINDOW_S).toBe(10);
    expect(AUTO_PAUSE_DELAY_S).toBe(8);
  });

  it('un arret prolonge (vitesse lissee < seuil) declenche l\'auto-pause', () => {
    // 12 points quasi immobiles a 1 Hz : vitesse lissee ~0 pendant > 8 s → pause.
    const stopped: LocationObject[] = Array.from({ length: 12 }, (_, i) =>
      loc(i * 0.01, i), // ~0,01 m/s, bien sous 0,3
    );
    handleLocationBatch(stopped);
    expect(getPaused()).toBe(true);
  });

  it('depuis un etat AUTO-PAUSE, un point rapide provoque l\'AUTO-REPRISE', () => {
    // 1) Amener a l'auto-pause via un arret prolonge.
    const stopped: LocationObject[] = Array.from({ length: 12 }, (_, i) => loc(i * 0.01, i));
    handleLocationBatch(stopped);
    expect(getPaused()).toBe(true);
    // La fenetre de vitesse basse est armee.
    expect(trackerState.lowSpeedSinceT).not.toBeNull();

    const distanceBeforeResume = trackerState.cumulativeDistanceM;
    const durationBeforeResume = trackerState.netDurationS;

    // 2) Un point qui ramene la vitesse LISSEE au-dessus du seuil : ~2 m/s sur la
    //    fenetre → franc au-dessus de 0,3 m/s → auto-reprise.
    const lastT = 11;
    const resumeBatch: LocationObject[] = [
      loc(0.11 + 20, lastT + 10), // +20 m en 10 s ≈ 2 m/s sur la fenetre
    ];
    handleLocationBatch(resumeBatch);

    // Auto-reprise : le drapeau repasse a false et la fenetre basse est reinitialisee.
    expect(getPaused()).toBe(false);
    expect(trackerState.lowSpeedSinceT).toBeNull();

    // 3) Apres reprise, distance ET duree recommencent a etre cumulees.
    const nextT = lastT + 20;
    handleLocationBatch([loc(0.11 + 20 + 4, nextT)]); // +4 m en 10 s
    expect(trackerState.cumulativeDistanceM).toBeGreaterThan(distanceBeforeResume);
    expect(trackerState.netDurationS).toBeGreaterThan(durationBeforeResume);
  });

  it('l\'auto-reprise notifie les abonnes (setPaused → false observable)', () => {
    // Auto-pause d'abord.
    handleLocationBatch(Array.from({ length: 12 }, (_, i) => loc(i * 0.01, i)));
    expect(getPaused()).toBe(true);

    // Point rapide → auto-reprise ; on verifie via getPaused (source de verite).
    handleLocationBatch([loc(0.11 + 20, 21)]);
    expect(getPaused()).toBe(false);
  });

  afterAll(() => {
    // Laisse l'etat module dans un etat neutre.
    setPaused(false);
    Object.assign(trackerState, initialTrackerState());
  });
});

describe('tracker-task — dénivelé cumulé (US RUN-F1b)', () => {
  beforeEach(() => {
    flushTrackMock.mockClear();
    resetTracker();
    trackerState.autoPause = false; // isole le calcul de dénivelé du chemin auto-pause
  });

  it('montée régulière au-delà du seuil (+5 m) → gain cumulé, solde remis à zéro', () => {
    handleLocationBatch([loc(0, 0, undefined, 100)]);
    handleLocationBatch([loc(1, 1, undefined, 105)]);
    expect(trackerState.cumulativeElevationGainM).toBe(5);
    expect(trackerState.cumulativeElevationLossM).toBe(0);
    expect(trackerState.pendingElevationDeltaM).toBe(0);
  });

  it('bruit sous le seuil (+1 m puis -1 m) → aucun cumul (spec R3, vérifié concrètement)', () => {
    handleLocationBatch([loc(0, 0, undefined, 100)]);
    handleLocationBatch([loc(1, 1, undefined, 101)]); // +1 m, sous le seuil de 3 m
    handleLocationBatch([loc(2, 2, undefined, 100)]); // -1 m, retombe à 0 avant le seuil
    expect(trackerState.cumulativeElevationGainM).toBe(0);
    expect(trackerState.cumulativeElevationLossM).toBe(0);
  });

  it('altitude null sur un point → aucun crash, aucun cumul dénivelé, distance/durée inchangées', () => {
    handleLocationBatch([loc(0, 0, undefined, 100)]);
    handleLocationBatch([loc(1, 1, undefined, null)]);
    expect(trackerState.cumulativeElevationGainM).toBe(0);
    expect(trackerState.cumulativeElevationLossM).toBe(0);
    expect(trackerState.cumulativeDistanceM).toBeGreaterThan(0);
    expect(trackerState.netDurationS).toBeGreaterThan(0);
  });

  it('altitudeAccuracy > 30 m → traité comme absent, même effet qu\'une altitude null', () => {
    handleLocationBatch([loc(0, 0, undefined, 100)]);
    handleLocationBatch([loc(1, 1, undefined, 110, 50)]); // +10 m mais précision 50 m > seuil
    expect(trackerState.cumulativeElevationGainM).toBe(0);
    expect(trackerState.cumulativeElevationLossM).toBe(0);
  });

  it('segment rejeté par le filtre vitesse (glitch) met quand même à jour lastAltitudeM (spec R2)', () => {
    handleLocationBatch([loc(0, 0, undefined, 100)]);
    // Saut de 1000 m en 1 s ≈ vitesse implausible → segment rejeté pour distance/durée/dénivelé,
    // mais lastPoint/lastAltitudeM avancent quand même (même règle que lastPoint aujourd'hui).
    handleLocationBatch([loc(1000, 1, undefined, 250)]);
    expect(trackerState.cumulativeElevationGainM).toBe(0); // le segment glitch n'a pas compté
    expect(trackerState.lastAltitudeM).toBe(250); // mais la base a bien avancé
  });

  it('pause puis reprise avec une altitude différente ne produit pas de saut de dénivelé (spec R4)', () => {
    handleLocationBatch([loc(0, 0, undefined, 100)]);
    setPaused(true);
    // Pendant la pause, l'altitude "descend" de 50 m (ex. ravitaillement en contrebas).
    handleLocationBatch([loc(0.5, 5, undefined, 50)]);
    expect(trackerState.cumulativeElevationLossM).toBe(0); // rien compté pendant la pause
    setPaused(false);
    // Reprise : nouvelle montée de 5 m depuis la base rebasée à 50 (pas depuis 100).
    handleLocationBatch([loc(1, 10, undefined, 55)]);
    expect(trackerState.cumulativeElevationGainM).toBe(5);
    expect(trackerState.cumulativeElevationLossM).toBe(0);
  });

  it('flushTrack reçoit les cumuls dénivelé arrondis, aux côtés de distance/durée', () => {
    handleLocationBatch([loc(0, 0, undefined, 100)]);
    handleLocationBatch([loc(1, 1, undefined, 105)]);
    expect(flushTrackMock).toHaveBeenLastCalledWith(
      'run-1',
      expect.objectContaining({ elevationGainM: 5, elevationLossM: 0 }),
    );
  });
});
