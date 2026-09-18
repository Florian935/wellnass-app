import { describe, it, expect } from 'vitest';
import {
  ABSORPTION_G_PER_H,
  GLYCOGEN_G_PER_KG,
  LOW_ZONE_SHARE,
  MEAL_HOURS,
  REST_DRAIN_G_PER_H,
  START_OF_DAY_SHARE,
  capacityG,
  carbShareForMet,
  levelAt,
  lowestBetween,
  sessionCarbCostG,
  simulateDay,
  snackAdviceG,
  type FuelMeal,
  type FuelSession,
} from './fuel-tank';

const CAPACITY = capacityG(80)!; // 400 g
const START = CAPACITY * START_OF_DAY_SHARE; // 280 g

function meal(carbsG: number, atHour: number = MEAL_HOURS.lunch): FuelMeal {
  return { atHour, carbsG };
}
function session(startHour: number, durationH: number, kcal: number, met: number | null = 7): FuelSession {
  return { startHour, durationH, kcal, met };
}

describe('capacityG (D1)', () => {
  it('poids × 5 g/kg', () => {
    expect(capacityG(80)).toBe(400);
    expect(capacityG(62.5)).toBe(Math.round(62.5 * GLYCOGEN_G_PER_KG));
  });

  it('null sans poids exploitable (R9)', () => {
    expect(capacityG(null)).toBeNull();
    expect(capacityG(0)).toBeNull();
    expect(capacityG(-70)).toBeNull();
  });
});

describe('carbShareForMet (R4)', () => {
  it('trois paliers, bornes comprises', () => {
    expect(carbShareForMet(4)).toBe(0.5);
    expect(carbShareForMet(6)).toBe(0.65);
    expect(carbShareForMet(8.9)).toBe(0.65);
    expect(carbShareForMet(9)).toBe(0.8);
    expect(carbShareForMet(14)).toBe(0.8);
  });

  it('MET absent (chiffre de montre) : palier du milieu', () => {
    expect(carbShareForMet(null)).toBe(0.65);
  });
});

describe('sessionCarbCostG (R4)', () => {
  it('kcal × part glucidique ÷ 4', () => {
    // 600 kcal à MET 7 → 600 × 0,65 / 4 = 97,5 → 98 g
    expect(sessionCarbCostG({ kcal: 600, met: 7 })).toBe(98);
  });

  it('une séance sans dépense ne coûte rien', () => {
    expect(sessionCarbCostG({ kcal: 0, met: 7 })).toBe(0);
  });
});

describe('simulateDay (R1, R2, R3, R5)', () => {
  it('part de 70 % de la capacité (D2)', () => {
    const curve = simulateDay({ capacityG: CAPACITY, meals: [], sessions: [] });
    expect(curve[0]!.grams).toBeCloseTo(START, 6);
    expect(curve[0]!.hour).toBe(0);
  });

  it('journée vide : seule la vidange de repos descend la jauge', () => {
    const curve = simulateDay({ capacityG: CAPACITY, meals: [], sessions: [] });
    // 12 h de repos à 4 g/h = 48 g de moins.
    expect(levelAt(curve, 12)).toBeCloseTo(START - 12 * REST_DRAIN_G_PER_H, 1);
  });

  it('un repas remonte la jauge à partir de son heure, pas avant', () => {
    const curve = simulateDay({ capacityG: CAPACITY, meals: [meal(60, 12)], sessions: [] });
    const before = levelAt(curve, 11.9);
    const after = levelAt(curve, 13.1);
    expect(after).toBeGreaterThan(before);
  });

  it('un gros repas s’étale au lieu de tout remonter d’un coup (R3)', () => {
    const curve = simulateDay({ capacityG: CAPACITY, meals: [meal(150, 12)], sessions: [] });
    const at30min = levelAt(curve, 12.5) - levelAt(curve, 12);
    // Au plus une demi-heure d'absorption, moins la vidange de repos.
    expect(at30min).toBeLessThanOrEqual(ABSORPTION_G_PER_H / 2);
    expect(at30min).toBeGreaterThan(20);
  });

  it('ne dépasse jamais la capacité, même après une recharge massive (R1)', () => {
    const curve = simulateDay({ capacityG: CAPACITY, meals: [meal(900, 7)], sessions: [] });
    for (const point of curve) expect(point.grams).toBeLessThanOrEqual(CAPACITY);
  });

  it('ne descend jamais sous zéro (R1)', () => {
    const curve = simulateDay({
      capacityG: CAPACITY,
      meals: [],
      sessions: [session(8, 6, 6000, 12)],
    });
    for (const point of curve) expect(point.grams).toBeGreaterThanOrEqual(0);
  });

  it('une séance vide la jauge sur sa durée', () => {
    const curve = simulateDay({ capacityG: CAPACITY, meals: [], sessions: [session(18, 1, 600, 7)] });
    const before = levelAt(curve, 18);
    const after = levelAt(curve, 19);
    const cost = sessionCarbCostG({ kcal: 600, met: 7 });
    expect(before - after).toBeCloseTo(cost + REST_DRAIN_G_PER_H, 0);
  });

  it('deux séances qui se chevauchent additionnent leurs coûts', () => {
    const one = simulateDay({ capacityG: CAPACITY, meals: [], sessions: [session(18, 1, 400, 7)] });
    const two = simulateDay({
      capacityG: CAPACITY,
      meals: [],
      sessions: [session(18, 1, 400, 7), session(18, 1, 400, 7)],
    });
    expect(levelAt(one, 19) - levelAt(two, 19)).toBeCloseTo(sessionCarbCostG({ kcal: 400, met: 7 }), 0);
  });

  it('une séance de durée nulle ne fait rien perdre', () => {
    const curve = simulateDay({ capacityG: CAPACITY, meals: [], sessions: [session(18, 0, 600, 7)] });
    expect(levelAt(curve, 19)).toBeCloseTo(START - 19 * REST_DRAIN_G_PER_H, 1);
  });
});

describe('levelAt / lowestBetween', () => {
  const curve = simulateDay({ capacityG: CAPACITY, meals: [], sessions: [session(18, 1, 900, 9)] });

  it('borne les heures hors plage', () => {
    expect(levelAt(curve, -5)).toBeCloseTo(START, 6);
    expect(levelAt(curve, 99)).toBeCloseTo(levelAt(curve, 24), 6);
  });

  it('courbe vide : niveau nul plutôt qu’une exception', () => {
    expect(levelAt([], 12)).toBe(0);
  });

  it('trouve le minimum d’une fenêtre et son heure', () => {
    const low = lowestBetween(curve, 17, 24);
    expect(low.hour).toBeGreaterThanOrEqual(19);
    expect(low.grams).toBeLessThan(levelAt(curve, 17));
  });
});

describe('snackAdviceG (R7)', () => {
  const nextSession = session(18.5, 0.75, 700, 9);

  it('null sans séance à venir : une jauge basse un soir de repos n’est pas un problème', () => {
    expect(
      snackAdviceG({ capacityG: CAPACITY, meals: [], sessions: [], nextSession: null, atHour: 15 }),
    ).toBeNull();
  });

  it('null quand la projection reste au-dessus de la zone basse', () => {
    expect(
      snackAdviceG({
        capacityG: CAPACITY,
        meals: [meal(200, 8), meal(200, 12.5)],
        sessions: [nextSession],
        nextSession,
        atHour: 15,
      }),
    ).toBeNull();
  });

  it('propose un multiple de 10 g quand la séance finirait sous le seuil', () => {
    const advice = snackAdviceG({
      capacityG: CAPACITY,
      meals: [],
      sessions: [session(12, 1.5, 800, 8), nextSession],
      nextSession,
      atHour: 15,
    });
    expect(advice).not.toBeNull();
    expect(advice! % 10).toBe(0);
    expect(advice!).toBeLessThanOrEqual(120);
  });

  it('la quantité conseillée fait bien repasser la fin de séance au-dessus du seuil', () => {
    // Déficit modéré : le plafond de 120 g suffit largement. Le cas où il ne suffit PAS est couvert
    // par le test suivant — la carte conseille alors 120 g et la projection reste basse, c'est
    // assumé (spec R7) plutôt que de conseiller 300 g d'un coup.
    const meals: FuelMeal[] = [];
    const sessions = [session(12, 0.75, 300, 7), nextSession];
    const advice = snackAdviceG({
      capacityG: CAPACITY,
      meals,
      sessions,
      nextSession,
      atHour: 15,
    })!;
    const withSnack = simulateDay({
      capacityG: CAPACITY,
      meals: [...meals, { atHour: 16.5, carbsG: advice }],
      sessions,
    });
    const end = levelAt(withSnack, nextSession.startHour + nextSession.durationH);
    expect(end).toBeGreaterThanOrEqual(CAPACITY * LOW_ZONE_SHARE);
  });

  it('plafonne à 120 g même quand la séance est énorme', () => {
    const huge = session(18.5, 3, 3000, 10);
    const advice = snackAdviceG({
      capacityG: CAPACITY,
      meals: [],
      sessions: [huge],
      nextSession: huge,
      atHour: 15,
    });
    expect(advice).toBe(120);
  });
});
