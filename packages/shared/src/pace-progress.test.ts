import { describe, expect, it } from 'vitest';
import {
  PACE_FLAT_S_PER_KM,
  PACE_PROGRESS_MIN_RUNS,
  PACE_WINDOW_DAYS,
  computePaceProgress,
  paceDirection,
  type PaceRun,
} from './pace-progress';

const TODAY = '2026-09-19';

/** Une sortie à `age` jours de `TODAY`, d'allure donnée. */
function run(age: number, paceSPerKm: number, distanceM = 8000): PaceRun {
  const d = new Date(2026, 8, 19);
  d.setDate(d.getDate() - age);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { dayKey: key, paceSPerKm, distanceM };
}

describe('computePaceProgress', () => {
  it('se tait sans aucune sortie exploitable', () => {
    expect(computePaceProgress({ runs: [], todayKey: TODAY, trend: 'stable' })).toEqual({
      kind: 'empty',
    });
    // Une allure nulle ou négative n'est pas une allure : elle ne fait pas exister la carte.
    const broken = computePaceProgress({
      runs: [run(1, 0), run(2, -30)],
      todayKey: TODAY,
      trend: 'stable',
    });
    expect(broken.kind).toBe('empty');
  });

  it('passe en onboarding tant qu’une des deux fenêtres n’est pas pleine', () => {
    // Fenêtre courante pleine, fenêtre précédente vide : pas de comparaison possible.
    const result = computePaceProgress({
      runs: [run(1, 330), run(5, 345), run(9, 320, 12000)],
      todayKey: TODAY,
      trend: 'improving',
    });
    expect(result.kind).toBe('onboarding');
    if (result.kind !== 'onboarding') return;
    expect(result.runs).toBe(3);
    expect(result.bestPaceSPerKm).toBe(320);
    expect(result.totalDistanceM).toBe(28000);
  });

  it('retient le meilleur de TOUTE l’histoire, pas de la fenêtre', () => {
    // La meilleure sortie a 200 jours : un palier franchi ne se périme pas.
    const result = computePaceProgress({
      runs: [run(200, 290), run(2, 340)],
      todayKey: TODAY,
      trend: 'stable',
    });
    expect(result.kind).toBe('onboarding');
    if (result.kind !== 'onboarding') return;
    expect(result.bestPaceSPerKm).toBe(290);
  });

  it('compare les deux fenêtres par la MÉDIANE et rend un écart positif quand on accélère', () => {
    const result = computePaceProgress({
      runs: [
        // Fenêtre courante : médiane 330
        run(2, 320),
        run(8, 330),
        run(15, 400),
        // Fenêtre précédente : médiane 350
        run(32, 340),
        run(40, 350),
        run(52, 360),
      ],
      todayKey: TODAY,
      trend: 'improving',
    });
    expect(result.kind).toBe('established');
    if (result.kind !== 'established') return;
    expect(result.currentPaceSPerKm).toBe(330);
    expect(result.previousPaceSPerKm).toBe(350);
    // Positif = plus rapide, alors que le nombre brut (330 − 350) est négatif.
    expect(result.deltaSPerKm).toBe(20);
    expect(result.direction).toBe('up');
    expect(result.runsCurrent).toBe(3);
    expect(result.runsPrevious).toBe(3);
    expect(result.trend).toBe('improving');
  });

  it('une sortie très lente ne déplace pas le verdict (c’est le point de la médiane)', () => {
    const moyenne = computePaceProgress({
      runs: [
        run(2, 330),
        run(8, 330),
        run(15, 900), // sortie de récupération avec de la marche
        run(32, 340),
        run(40, 340),
        run(52, 340),
      ],
      todayKey: TODAY,
      trend: 'stable',
    });
    expect(moyenne.kind).toBe('established');
    if (moyenne.kind !== 'established') return;
    // Avec une moyenne, la fenêtre courante serait à 520 s/km et la carte annoncerait un effondrement.
    expect(moyenne.currentPaceSPerKm).toBe(330);
    expect(moyenne.direction).toBe('up');
  });

  it('dit « stable » sous le plancher d’écart', () => {
    const result = computePaceProgress({
      runs: [
        run(2, 330),
        run(8, 330),
        run(15, 330),
        run(32, 332),
        run(40, 332),
        run(52, 332),
      ],
      todayKey: TODAY,
      trend: 'stable',
    });
    expect(result.kind).toBe('established');
    if (result.kind !== 'established') return;
    expect(result.deltaSPerKm).toBe(2);
    expect(result.direction).toBe('flat');
  });

  it('écarte une sortie datée du futur au lieu de la ranger dans la fenêtre courante', () => {
    const result = computePaceProgress({
      runs: [run(-3, 200), run(2, 330), run(8, 330), run(15, 330), run(32, 340), run(40, 340), run(52, 340)],
      todayKey: TODAY,
      trend: 'stable',
    });
    expect(result.kind).toBe('established');
    if (result.kind !== 'established') return;
    // Sans la garde, la médiane courante tomberait à 330 → inchangée ici, mais runsCurrent à 4.
    expect(result.runsCurrent).toBe(3);
  });

  it('les deux fenêtres sont accolées et fermées', () => {
    // Une sortie à exactement PACE_WINDOW_DAYS jours appartient à la fenêtre PRÉCÉDENTE,
    // une à 2 × PACE_WINDOW_DAYS n'appartient à aucune des deux.
    const runs = [
      run(0, 330),
      run(1, 330),
      run(PACE_WINDOW_DAYS - 1, 330),
      run(PACE_WINDOW_DAYS, 350),
      run(PACE_WINDOW_DAYS + 1, 350),
      run(PACE_WINDOW_DAYS * 2 - 1, 350),
      run(PACE_WINDOW_DAYS * 2, 999),
    ];
    const result = computePaceProgress({ runs, todayKey: TODAY, trend: 'stable' });
    expect(result.kind).toBe('established');
    if (result.kind !== 'established') return;
    expect(result.runsCurrent).toBe(PACE_PROGRESS_MIN_RUNS);
    expect(result.runsPrevious).toBe(PACE_PROGRESS_MIN_RUNS);
    expect(result.previousPaceSPerKm).toBe(350);
  });
});

describe('paceDirection', () => {
  it('applique le plancher dans les deux sens', () => {
    expect(paceDirection(PACE_FLAT_S_PER_KM)).toBe('up');
    expect(paceDirection(PACE_FLAT_S_PER_KM - 1)).toBe('flat');
    expect(paceDirection(-PACE_FLAT_S_PER_KM)).toBe('down');
    expect(paceDirection(-(PACE_FLAT_S_PER_KM - 1))).toBe('flat');
    expect(paceDirection(0)).toBe('flat');
  });
});
