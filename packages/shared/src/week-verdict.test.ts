import { describe, expect, it } from 'vitest';
import {
  composeWeekVerdict,
  HEAVY_MEAL_PCT,
  MIN_LOGGED_DAYS,
  ON_TRACK_RATIO,
  type WeekVerdictInput,
} from './week-verdict';

const base: WeekVerdictInput = {
  loggedDays: 6,
  daysInTarget: 5,
  protein: null,
  mealSplit: [],
};

describe('composeWeekVerdict — le garde-fou du peu de données', () => {
  it('🔴 sous le seuil de jours loggés, il ne conclut RIEN', () => {
    const v = composeWeekVerdict({ ...base, loggedDays: 2, daysInTarget: 2 });

    // 2 jours sur 2 dans la cible, c'est « 100 % » — et ça ne veut rien dire.
    expect(v.signal).toEqual({ kind: 'notEnoughData', loggedDays: 2, needed: MIN_LOGGED_DAYS });
  });

  it('🔴 et il ne place AUCUNE remarque non plus, même quand elles sont calculables', () => {
    const v = composeWeekVerdict({
      ...base,
      loggedDays: 1,
      daysInTarget: 1,
      protein: { gPerKg: 1.3, target: { min: 1.6, max: 2.2 }, status: 'low' },
      mealSplit: [{ mealKey: 'dinner', pct: 60 }],
    });

    // Une moyenne de g/kg sur un jour loggé hérite du même défaut que le chiffre principal.
    expect(v.remarks).toEqual([]);
  });

  it('sans cible définie, il n’y a pas d’adhérence à juger', () => {
    const v = composeWeekVerdict({ ...base, daysInTarget: null });

    expect(v.signal.kind).toBe('notEnoughData');
  });

  it('au seuil exact, il conclut', () => {
    const v = composeWeekVerdict({ ...base, loggedDays: MIN_LOGGED_DAYS, daysInTarget: 3 });

    expect(v.signal.kind).toBe('onTrack');
  });
});

describe('composeWeekVerdict — le cap', () => {
  it('cap tenu au-dessus du ratio', () => {
    expect(composeWeekVerdict({ ...base, loggedDays: 7, daysInTarget: 5 }).signal).toEqual({
      kind: 'onTrack',
      daysInTarget: 5,
      loggedDays: 7,
    });
  });

  it('cap perdu en dessous', () => {
    expect(composeWeekVerdict({ ...base, loggedDays: 7, daysInTarget: 2 }).signal).toEqual({
      kind: 'offTrack',
      daysInTarget: 2,
      loggedDays: 7,
    });
  });

  it('🔴 la borne est INCLUSE — sinon on annonce un échec pile au seuil', () => {
    // 6 jours loggés, 60 % = 3,6 → 4 jours suffisent tout juste.
    const pile = composeWeekVerdict({ ...base, loggedDays: 5, daysInTarget: 3 });
    expect(3 / 5).toBeGreaterThanOrEqual(ON_TRACK_RATIO);
    expect(pile.signal.kind).toBe('onTrack');
  });
});

describe('composeWeekVerdict — les remarques', () => {
  it('🔴 nomme le poste en retard SANS le chiffrer — la carte suivante porte la mesure', () => {
    const v = composeWeekVerdict({
      ...base,
      protein: { gPerKg: 1.3, target: { min: 1.6, max: 2.2 }, status: 'low' },
    });

    // Recette du 20/09 : le verdict recopiait « 1.5 g/kg, sous ta fourchette de 1.8 à 2.2 », et
    // `ProteinPerKgCard` redisait la même chose juste en dessous, en plus gros. Un verdict qui
    // répète la carte qu'il annonce n'ajoute rien.
    expect(v.remarks).toEqual([{ kind: 'protein', status: 'low' }]);
  });

  it('🔴 se tait quand les protéines sont DANS la fourchette', () => {
    const v = composeWeekVerdict({
      ...base,
      protein: { gPerKg: 1.9, target: { min: 1.6, max: 2.2 }, status: 'in' },
    });

    // « Tes protéines sont dans ta fourchette » occupe la place d'un verdict avec une
    // non-information. La carte, elle, le confirme — c'est son rôle.
    expect(v.remarks).toEqual([]);
  });

  it('se tait sur les protéines sans pesée — « 0 g/kg » serait un mensonge, pas une absence', () => {
    expect(composeWeekVerdict({ ...base, protein: null }).remarks).toEqual([]);
  });

  it('🔴 signale le repas dominant, et LUI SEUL', () => {
    const v = composeWeekVerdict({
      ...base,
      mealSplit: [
        { mealKey: 'breakfast', pct: 15 },
        { mealKey: 'dinner', pct: 45 },
        { mealKey: 'lunch', pct: 40 },
      ],
    });

    // Deux repas passent le seuil ; en signaler deux sur trois ne désigne plus rien.
    expect(v.remarks).toEqual([{ kind: 'heavyMeal', mealKey: 'dinner', pct: 45 }]);
  });

  it('ne dit rien d’une répartition normale', () => {
    const v = composeWeekVerdict({
      ...base,
      mealSplit: [
        { mealKey: 'breakfast', pct: 25 },
        { mealKey: 'lunch', pct: 37 },
        { mealKey: 'dinner', pct: 38 - 1 },
      ],
    });

    expect(v.remarks).toEqual([]);
  });

  it('la borne du repas lourd est INCLUSE', () => {
    const v = composeWeekVerdict({ ...base, mealSplit: [{ mealKey: 'dinner', pct: HEAVY_MEAL_PCT }] });

    expect(v.remarks).toHaveLength(1);
  });

  it('ordonne les remarques : les protéines avant la répartition', () => {
    const v = composeWeekVerdict({
      ...base,
      protein: { gPerKg: 1.3, target: { min: 1.6, max: 2.2 }, status: 'low' },
      mealSplit: [{ mealKey: 'dinner', pct: 44 }],
    });

    // Le substrat de construction musculaire passe avant l'horaire des calories.
    expect(v.remarks.map((r) => r.kind)).toEqual(['protein', 'heavyMeal']);
  });

  it('tolère une répartition vide sans planter', () => {
    expect(composeWeekVerdict({ ...base, mealSplit: [] }).remarks).toEqual([]);
  });
});
