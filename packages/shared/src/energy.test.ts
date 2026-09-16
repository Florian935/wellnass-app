import { describe, expect, it } from 'vitest';

import {
  ENERGY_SPREAD,
  MET_STANDARD_KCAL_PER_KG_H,
  activityMet,
  activitySpeedKmh,
  averageRestSeconds,
  estimateActivityEnergy,
  estimateMetEnergy,
  estimateRunEnergy,
  estimateStrengthEnergy,
  restingMetabolism,
  roundEnergy,
  runMetFromRpe,
  strengthActiveMinutes,
  strengthSessionMet,
  sumEnergyForTarget,
  toEnergyEstimate,
  type RestingMetabolism,
} from './energy';
import { estimateRunCalories } from './running';

/** Profil A de l'analyse : homme, 30 ans, 180 cm, 80 kg → métabolisme de base 1 780 kcal/j. */
const PROFIL_A = { sex: 'male' as const, weightKg: 80, heightCm: 180, age: 30 };
/** Profil B : femme, 45 ans, 165 cm, 60 kg → 1 245,25 kcal/j. */
const PROFIL_B = { sex: 'female' as const, weightKg: 60, heightCm: 165, age: 45 };

const restingA = restingMetabolism(PROFIL_A)!;
const restingB = restingMetabolism(PROFIL_B)!;

describe('restingMetabolism', () => {
  it('rend null sans poids — aucune valeur neutre n’existe', () => {
    expect(restingMetabolism({ ...PROFIL_A, weightKg: null })).toBeNull();
    expect(restingMetabolism({ ...PROFIL_A, weightKg: 0 })).toBeNull();
    expect(restingMetabolism({ ...PROFIL_A, weightKg: Number.NaN })).toBeNull();
  });

  it('personnalise avec âge, taille, poids et sexe', () => {
    expect(restingA.personalised).toBe(true);
    expect(restingA.kcalPerHour).toBeCloseTo(1780 / 24, 4);
    expect(restingB.kcalPerHour).toBeCloseTo(1245.25 / 24, 4);
  });

  it('replie sur le MET standard sans âge ni taille, et le dit', () => {
    const sansAge = restingMetabolism({ weightKg: 80, heightCm: 180, age: null })!;
    expect(sansAge.personalised).toBe(false);
    expect(sansAge.kcalPerHour).toBe(80 * MET_STANDARD_KCAL_PER_KG_H);

    const sansTaille = restingMetabolism({ weightKg: 80, heightCm: null, age: 30 })!;
    expect(sansTaille.personalised).toBe(false);

    const tailleNulle = restingMetabolism({ weightKg: 80, heightCm: 0, age: 30 })!;
    expect(tailleNulle.personalised).toBe(false);

    const ageNul = restingMetabolism({ weightKg: 80, heightCm: 180, age: 0 })!;
    expect(ageNul.personalised).toBe(false);
  });

  it('accepte un sexe absent (constante « non précisé »)', () => {
    const sansSexe = restingMetabolism({ weightKg: 80, heightCm: 180, age: 30 })!;
    // 10×80 + 6,25×180 − 5×30 − 78 = 1 697
    expect(sansSexe.kcalPerHour).toBeCloseTo(1697 / 24, 4);
  });

  it('le même effort coûte moins cher à un profil plus âgé et plus léger', () => {
    expect(restingB.kcalPerHour).toBeLessThan(restingA.kcalPerHour);
  });
});

describe('roundEnergy / toEnergyEstimate', () => {
  it('arrondit à 10 kcal — « 372 kcal » serait un mensonge', () => {
    expect(roundEnergy(372)).toBe(370);
    expect(roundEnergy(375)).toBe(380);
  });

  it('ne rend jamais une dépense négative', () => {
    const e = toEnergyEstimate({ netKcal: -50, spread: 0.25, confidence: 'low' });
    expect(e).toEqual({ kcal: 0, low: 0, high: 0, confidence: 'low', met: null, source: 'estimate' });
  });

  it('encadre l’estimation centrale par la largeur demandée', () => {
    const e = toEnergyEstimate({ netKcal: 400, spread: 0.25, confidence: 'medium', met: 6 });
    expect(e).toMatchObject({ kcal: 400, low: 300, high: 500, met: 6, source: 'estimate' });
  });
});

describe('estimateMetEnergy', () => {
  it('rend null quand il n’y a aucun surcoût sur le repos', () => {
    expect(estimateMetEnergy({ met: 1, minutes: 60, resting: restingA, spread: 0.25, confidence: 'medium' })).toBeNull();
    expect(estimateMetEnergy({ met: Number.NaN, minutes: 60, resting: restingA, spread: 0.25, confidence: 'medium' })).toBeNull();
    expect(estimateMetEnergy({ met: 6, minutes: 0, resting: restingA, spread: 0.25, confidence: 'medium' })).toBeNull();
    expect(estimateMetEnergy({ met: 6, minutes: Number.NaN, resting: restingA, spread: 0.25, confidence: 'medium' })).toBeNull();
  });

  it('applique (MET − 1) × repos/h × heures', () => {
    const e = estimateMetEnergy({ met: 6, minutes: 60, resting: restingA, spread: 0.3, confidence: 'medium' })!;
    expect(e.kcal).toBe(370); // 5 × 74,17 = 370,8
    expect(e.low).toBe(260);
    expect(e.high).toBe(480);
  });
});

describe('musculation', () => {
  it('déduit le repos moyen de la durée et du nombre de séries', () => {
    // 60 min, 22 séries : 22 × 40 s de travail, le reste réparti sur 21 intervalles.
    expect(averageRestSeconds({ durationSeconds: 3600, totalSets: 22 })).toBeCloseTo((3600 - 880) / 21, 4);
  });

  it('rend null quand le repos n’a pas de sens, et 0 quand la séance est plus courte que son travail', () => {
    expect(averageRestSeconds({ durationSeconds: null, totalSets: 10 })).toBeNull();
    expect(averageRestSeconds({ durationSeconds: 0, totalSets: 10 })).toBeNull();
    expect(averageRestSeconds({ durationSeconds: 1800, totalSets: 1 })).toBeNull();
    expect(averageRestSeconds({ durationSeconds: 60, totalSets: 10 })).toBe(0);
  });

  it('classe l’intensité par le ressenti', () => {
    expect(strengthSessionMet({ rpe: 4, avgRestSeconds: 180 })).toBe(3.5);
    expect(strengthSessionMet({ rpe: 7, avgRestSeconds: 180 })).toBe(5);
    expect(strengthSessionMet({ rpe: 9, avgRestSeconds: 180 })).toBe(6);
  });

  it('retient « modéré » sans ressenti — jamais la valeur haute', () => {
    expect(strengthSessionMet({ rpe: null, avgRestSeconds: 180 })).toBe(5);
  });

  it('ajoute la densité, et plafonne au circuit training', () => {
    expect(strengthSessionMet({ rpe: 5, avgRestSeconds: 45 })).toBe(5); // 3,5 + 1,5
    expect(strengthSessionMet({ rpe: 5, avgRestSeconds: 90 })).toBe(4); // 3,5 + 0,5
    expect(strengthSessionMet({ rpe: 5, avgRestSeconds: null })).toBe(3.5);
    expect(strengthSessionMet({ rpe: 10, avgRestSeconds: 30 })).toBe(7.5); // 6 + 1,5
    expect(strengthSessionMet({ rpe: 10, avgRestSeconds: 120 })).toBe(6.5);
  });

  it('plafonne le temps actif à 4 min par série — la séance oubliée ouverte', () => {
    // 3 h ouvertes (clôture automatique) pour 10 séries réellement faites → 40 min retenues.
    expect(strengthActiveMinutes({ durationSeconds: 3 * 3600, totalSets: 10 })).toBe(40);
    expect(strengthActiveMinutes({ durationSeconds: 3600, totalSets: 22 })).toBe(60);
    expect(strengthActiveMinutes({ durationSeconds: null, totalSets: 10 })).toBe(0);
    expect(strengthActiveMinutes({ durationSeconds: 0, totalSets: 10 })).toBe(0);
    // Aucune série : rien à plafonner, on garde la durée telle quelle.
    expect(strengthActiveMinutes({ durationSeconds: 1800, totalSets: 0 })).toBe(30);
  });

  it('valeur dorée — 1 h, 22 séries, ressenti 8, repos longs : 370 kcal pour A, 260 pour B', () => {
    const a = estimateStrengthEnergy({ durationSeconds: 3600, totalSets: 22, rpe: 8, resting: restingA })!;
    expect(a).toMatchObject({ kcal: 370, low: 260, high: 480, met: 6, confidence: 'medium' });

    const b = estimateStrengthEnergy({ durationSeconds: 3600, totalSets: 22, rpe: 8, resting: restingB })!;
    expect(b.kcal).toBe(260);
  });

  it('sans ressenti ou sans profil complet, la confiance tombe', () => {
    const sansRessenti = estimateStrengthEnergy({ durationSeconds: 3600, totalSets: 22, rpe: null, resting: restingA })!;
    expect(sansRessenti.confidence).toBe('low');

    const profilIncomplet: RestingMetabolism = { kcalPerHour: 80, personalised: false };
    const e = estimateStrengthEnergy({ durationSeconds: 3600, totalSets: 22, rpe: 8, resting: profilIncomplet })!;
    expect(e.confidence).toBe('low');
  });

  it('rend null sans poids ou sans durée', () => {
    expect(estimateStrengthEnergy({ durationSeconds: 3600, totalSets: 22, rpe: 8, resting: null })).toBeNull();
    expect(estimateStrengthEnergy({ durationSeconds: null, totalSets: 22, rpe: 8, resting: restingA })).toBeNull();
  });
});

describe('course', () => {
  it('non-régression RN-01 : sans dénivelé, le résultat reste celui d’estimateRunCalories', () => {
    for (const [distanceM, durationSeconds] of [[10000, 3300], [5000, 1500], [21097, 7200]] as const) {
      const attendu = roundEnergy(estimateRunCalories({ distanceM, durationSeconds, weightKg: 80 }));
      const obtenu = estimateRunEnergy({
        distanceM,
        durationSeconds,
        elevationGainM: null,
        weightKg: 80,
        resting: restingA,
      })!;
      expect(obtenu.kcal).toBe(attendu);
    }
  });

  it('compte le dénivelé en kilomètres-effort (100 m = 1 km)', () => {
    const plat = estimateRunEnergy({ distanceM: 10000, durationSeconds: 3300, weightKg: 80, resting: restingA })!;
    const vallonne = estimateRunEnergy({
      distanceM: 10000,
      durationSeconds: 3300,
      elevationGainM: 120,
      weightKg: 80,
      resting: restingA,
    })!;
    expect(plat.kcal).toBe(820);
    expect(vallonne.kcal).toBe(920);

    // Constat C5 : le trail de 15 km / D+ 800 m n’est plus estimé comme du plat.
    const trail = estimateRunEnergy({
      distanceM: 15000,
      durationSeconds: 6600,
      elevationGainM: 800,
      weightKg: 80,
      resting: restingA,
    })!;
    expect(trail.kcal).toBeGreaterThan(1800);
  });

  it('un dénivelé absurde ou négatif ne change rien', () => {
    const ref = estimateRunEnergy({ distanceM: 10000, durationSeconds: 3300, weightKg: 80, resting: restingA })!;
    for (const elevationGainM of [null, 0, -50, Number.NaN]) {
      expect(estimateRunEnergy({ distanceM: 10000, durationSeconds: 3300, elevationGainM, weightKg: 80, resting: restingA })!.kcal)
        .toBe(ref.kcal);
    }
  });

  it('l’allure se calcule sur la distance réelle, pas sur la distance-effort', () => {
    // À 10,9 km/h le terme d’allure vaut +2,9 % ; s’il était calculé sur 11,2 km d’effort, il
    // grimperait — le dénivelé serait payé deux fois.
    const e = estimateRunEnergy({
      distanceM: 10000,
      durationSeconds: 3300,
      elevationGainM: 120,
      weightKg: 80,
      resting: restingA,
    })!;
    const attendu = 80 * (10 + 1.2) * 1.0 * (1 + Math.min(0.1, (10000 / 1000 / (3300 / 3600) - 8) * 0.01));
    expect(e.kcal).toBe(roundEnergy(attendu));
  });

  it('constat C4 : sur tapis, sans distance, on n’affiche plus zéro', () => {
    const tapis = estimateRunEnergy({
      distanceM: null,
      durationSeconds: 40 * 60,
      rpe: 7,
      weightKg: 80,
      resting: restingA,
    })!;
    expect(tapis.kcal).toBe(440); // 8,8 × 74,17 × 0,667
    expect(tapis.confidence).toBe('medium');
  });

  it('sans distance ET sans ressenti, la confiance tombe ; sans durée, il n’y a rien à dire', () => {
    const sansRessenti = estimateRunEnergy({ distanceM: 0, durationSeconds: 2400, weightKg: 80, resting: restingA })!;
    expect(sansRessenti.confidence).toBe('low');
    expect(estimateRunEnergy({ distanceM: null, durationSeconds: null, weightKg: 80, resting: restingA })).toBeNull();
    expect(estimateRunEnergy({ distanceM: null, durationSeconds: 1800, weightKg: 80, resting: null })).toBeNull();
  });

  it('sans poids, une course avec distance repasse par le MET', () => {
    const e = estimateRunEnergy({ distanceM: 10000, durationSeconds: 3300, weightKg: null, resting: restingA })!;
    expect(e.met).not.toBeNull();
  });

  it('la fourchette est plus étroite avec GPS que sans', () => {
    expect(ENERGY_SPREAD.run).toBeLessThan(ENERGY_SPREAD.runNoGps);
  });

  it('le MET de course suit le ressenti', () => {
    expect(runMetFromRpe(null)).toBe(8.3);
    expect(runMetFromRpe(3)).toBe(7);
    expect(runMetFromRpe(6)).toBe(8.3);
    expect(runMetFromRpe(8)).toBe(9.8);
    expect(runMetFromRpe(10)).toBe(11);
  });
});

describe('activité libre', () => {
  it('calcule une vitesse quand les deux valeurs existent', () => {
    expect(activitySpeedKmh({ distanceM: 30000, durationSeconds: 5400 })).toBeCloseTo(20, 6);
    expect(activitySpeedKmh({ distanceM: null, durationSeconds: 5400 })).toBeNull();
    expect(activitySpeedKmh({ distanceM: 0, durationSeconds: 5400 })).toBeNull();
    expect(activitySpeedKmh({ distanceM: 30000, durationSeconds: null })).toBeNull();
    expect(activitySpeedKmh({ distanceM: 30000, durationSeconds: 0 })).toBeNull();
  });

  it('prend l’intensité déclarée quand il n’y a pas de vitesse exploitable', () => {
    expect(activityMet({ activityType: 'bike', intensity: 'moderate' })).toBe(8);
    expect(activityMet({ activityType: 'bike', intensity: 'moderate', speedKmh: null })).toBe(8);
    expect(activityMet({ activityType: 'bike', intensity: 'moderate', speedKmh: 0 })).toBe(8);
    expect(activityMet({ activityType: 'bike', intensity: 'moderate', speedKmh: Number.NaN })).toBe(8);
    // Type sans distance utile : la vitesse n’apprend rien.
    expect(activityMet({ activityType: 'yoga', intensity: 'light', speedKmh: 12 })).toBe(2.5);
  });

  it('affine le vélo et la marche par la vitesse mesurée', () => {
    expect(activityMet({ activityType: 'bike', intensity: 'vigorous', speedKmh: 12 })).toBe(4);
    expect(activityMet({ activityType: 'bike', intensity: 'light', speedKmh: 17 })).toBe(6.8);
    expect(activityMet({ activityType: 'bike', intensity: 'light', speedKmh: 20 })).toBe(8);
    expect(activityMet({ activityType: 'bike', intensity: 'light', speedKmh: 26 })).toBe(10);
    expect(activityMet({ activityType: 'walk', intensity: 'vigorous', speedKmh: 3 })).toBe(3);
    expect(activityMet({ activityType: 'walk', intensity: 'light', speedKmh: 5 })).toBe(4.3);
    expect(activityMet({ activityType: 'walk', intensity: 'light', speedKmh: 6.5 })).toBe(5);
  });

  it('un type à distance utile sans règle de vitesse garde l’intensité déclarée', () => {
    expect(activityMet({ activityType: 'swim', intensity: 'moderate', speedKmh: 3 })).toBe(5.8);
  });

  it('valeur dorée — vélo 1 h 30 soutenu : 780 kcal pour A, 540 pour B', () => {
    const a = estimateActivityEnergy({
      activityType: 'bike',
      intensity: 'moderate',
      durationSeconds: 90 * 60,
      resting: restingA,
    })!;
    expect(a).toMatchObject({ kcal: 780, low: 580, high: 970, met: 8, confidence: 'medium', source: 'estimate' });

    const b = estimateActivityEnergy({
      activityType: 'bike',
      intensity: 'moderate',
      durationSeconds: 90 * 60,
      resting: restingB,
    })!;
    expect(b.kcal).toBe(540);
  });

  it('le chiffre d’une montre remplace l’estimation et referme la fourchette', () => {
    const e = estimateActivityEnergy({
      activityType: 'bike',
      intensity: 'moderate',
      durationSeconds: 90 * 60,
      deviceKcal: 812,
      resting: restingA,
    })!;
    expect(e).toEqual({ kcal: 812, low: 812, high: 812, confidence: 'high', met: null, source: 'device' });
  });

  it('un chiffre de montre absurde ne court-circuite rien', () => {
    const zero = estimateActivityEnergy({
      activityType: 'bike',
      intensity: 'moderate',
      durationSeconds: 3600,
      deviceKcal: 0,
      resting: restingA,
    })!;
    expect(zero.source).toBe('estimate');
  });

  it('un type hors catalogue retombe sur « Autre », avec une confiance moindre', () => {
    const e = estimateActivityEnergy({
      activityType: 'kitesurf-2030',
      intensity: 'moderate',
      durationSeconds: 3600,
      resting: restingA,
    })!;
    expect(e.met).toBe(5.5);
    expect(e.confidence).toBe('low');
  });

  it('rend null sans poids ou sans durée', () => {
    expect(estimateActivityEnergy({ activityType: 'bike', intensity: 'moderate', durationSeconds: 3600, resting: null })).toBeNull();
    expect(estimateActivityEnergy({ activityType: 'bike', intensity: 'moderate', durationSeconds: 0, resting: restingA })).toBeNull();
    expect(estimateActivityEnergy({ activityType: 'bike', intensity: 'moderate', durationSeconds: Number.NaN, resting: restingA })).toBeNull();
  });
});

describe('ce que la cible retient', () => {
  it('somme les BAS de fourchette, pas les estimations centrales', () => {
    const muscu = estimateStrengthEnergy({ durationSeconds: 3600, totalSets: 22, rpe: 8, resting: restingA })!;
    const velo = estimateActivityEnergy({
      activityType: 'bike',
      intensity: 'moderate',
      durationSeconds: 90 * 60,
      resting: restingA,
    })!;
    expect(sumEnergyForTarget([muscu, velo, null])).toBe(260 + 580);
    expect(sumEnergyForTarget([])).toBe(0);
  });
});
