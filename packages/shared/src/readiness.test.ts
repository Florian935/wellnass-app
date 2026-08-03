import { describe, expect, it } from 'vitest';
import {
  classifyLoadComponent,
  classifyNutritionComponent,
  classifyWellbeingComponent,
  computeReadiness,
} from './readiness';

describe('classifyLoadComponent (US TRI-03, R1)', () => {
  it('acwr null → unavailable/insufficient-history (pas assez d’historique chronique)', () => {
    expect(classifyLoadComponent(null)).toEqual({
      state: 'unavailable',
      reason: 'insufficient-history',
    });
  });

  it('zone low → positive (fraîche)', () => {
    expect(classifyLoadComponent({ ratio: 0.5, zone: 'low', showAlert: false })).toEqual({
      state: 'positive',
    });
  });

  it('zone safe → neutral (stable)', () => {
    expect(classifyLoadComponent({ ratio: 1, zone: 'safe', showAlert: false })).toEqual({
      state: 'neutral',
    });
  });

  it('zone risk → negative (chargée)', () => {
    expect(classifyLoadComponent({ ratio: 1.5, zone: 'risk', showAlert: true })).toEqual({
      state: 'negative',
    });
  });
});

describe('classifyNutritionComponent (US TRI-03, R2)', () => {
  it('moins de MIN_LOGGED_DAYS (4) jours loggés → unavailable/insufficient-logged-days', () => {
    expect(
      classifyNutritionComponent({ loggedDaysCount: 3, avgKcal: 1000, targetKcal: 2000 }),
    ).toEqual({ state: 'unavailable', reason: 'insufficient-logged-days' });
  });

  it('targetKcal <= 0 → unavailable (pas de division par une cible absente)', () => {
    expect(
      classifyNutritionComponent({ loggedDaysCount: 5, avgKcal: 1500, targetKcal: 0 }),
    ).toEqual({ state: 'unavailable' });
  });

  it('écart pile 15 % sous la cible → negative (borne incluse, DEFICIT_ALERT_RATIO)', () => {
    expect(
      classifyNutritionComponent({ loggedDaysCount: 4, avgKcal: 1700, targetKcal: 2000 }),
    ).toEqual({ state: 'negative' });
  });

  it('écart de 5 % sous la cible → neutral (pas encore le seuil)', () => {
    expect(
      classifyNutritionComponent({ loggedDaysCount: 4, avgKcal: 1900, targetKcal: 2000 }),
    ).toEqual({ state: 'neutral' });
  });

  it('surplus au-dessus de la cible → neutral (pas de symétrie sur le surplus, R2)', () => {
    expect(
      classifyNutritionComponent({ loggedDaysCount: 4, avgKcal: 2200, targetKcal: 2000 }),
    ).toEqual({ state: 'neutral' });
  });
});

describe('classifyWellbeingComponent (US TRI-03, R3, D5 — energy+stress seulement)', () => {
  it('énergie et stress tous deux non renseignés → unavailable/no-recent-checkin', () => {
    expect(
      classifyWellbeingComponent({
        energy: { average: null, days: 0 },
        stress: { average: null, days: 0 },
      }),
    ).toEqual({ state: 'unavailable', reason: 'no-recent-checkin' });
  });

  it('énergie basse (≤ 2) → negative, même si le stress est correct', () => {
    expect(
      classifyWellbeingComponent({
        energy: { average: 1.5, days: 3 },
        stress: { average: 3, days: 3 },
      }),
    ).toEqual({ state: 'negative' });
  });

  it('stress haut (≥ 4) → negative, même si l’énergie est correcte', () => {
    expect(
      classifyWellbeingComponent({
        energy: { average: 3, days: 2 },
        stress: { average: 4.5, days: 2 },
      }),
    ).toEqual({ state: 'negative' });
  });

  it('énergie haute (≥ 4) ET stress bas (≤ 2) → positive', () => {
    expect(
      classifyWellbeingComponent({
        energy: { average: 4.5, days: 3 },
        stress: { average: 1.5, days: 3 },
      }),
    ).toEqual({ state: 'positive' });
  });

  it('valeurs moyennes des deux côtés → neutral', () => {
    expect(
      classifyWellbeingComponent({
        energy: { average: 3, days: 3 },
        stress: { average: 3, days: 3 },
      }),
    ).toEqual({ state: 'neutral' });
  });

  it('seule l’énergie est renseignée (stress jamais saisi) : bonne énergie → neutral, pas positive (le stress n’est pas confirmé)', () => {
    expect(
      classifyWellbeingComponent({
        energy: { average: 4.5, days: 3 },
        stress: { average: null, days: 0 },
      }),
    ).toEqual({ state: 'neutral' });
  });

  it('seule l’énergie est renseignée : énergie basse → negative quand même (la règle OR ne dépend pas du stress)', () => {
    expect(
      classifyWellbeingComponent({
        energy: { average: 1.5, days: 3 },
        stress: { average: null, days: 0 },
      }),
    ).toEqual({ state: 'negative' });
  });
});

describe('computeReadiness (US TRI-03, R4/R5)', () => {
  const unavailable = { state: 'unavailable' as const };
  const positive = { state: 'positive' as const };
  const neutral = { state: 'neutral' as const };
  const negative = { state: 'negative' as const };

  it('les 3 composantes indisponibles → show false, verdict null (R5)', () => {
    expect(
      computeReadiness({ load: unavailable, nutrition: unavailable, wellbeing: unavailable }),
    ).toEqual({
      show: false,
      verdict: null,
      load: unavailable,
      nutrition: unavailable,
      wellbeing: unavailable,
    });
  });

  it('une composante négative suffit → rest, même si les deux autres sont bonnes', () => {
    const result = computeReadiness({ load: negative, nutrition: positive, wellbeing: positive });
    expect(result.show).toBe(true);
    expect(result.verdict).toBe('rest');
  });

  it('une seule composante positive, les autres neutres/indisponibles → push (un seul signal positif suffit, symétrique de rest)', () => {
    const result = computeReadiness({ load: positive, nutrition: neutral, wellbeing: neutral });
    expect(result.verdict).toBe('push');

    const resultWithUnavailable = computeReadiness({
      load: positive,
      nutrition: unavailable,
      wellbeing: positive,
    });
    expect(resultWithUnavailable.verdict).toBe('push');
  });

  it('nutrition ne produit jamais positive : un utilisateur nutrition active peut quand même atteindre push via une autre composante', () => {
    // Régression du bug corrigé le 03/08/2026 (spec R4) : avec l'ancienne règle « toutes positives »,
    // ce cas était bloqué à 'ok' pour toujours, quelle que soit la forme réelle de l'utilisateur.
    const result = computeReadiness({ load: positive, nutrition: neutral, wellbeing: positive });
    expect(result.verdict).toBe('push');
  });

  it('aucune négative, aucune positive parmi les disponibles → ok', () => {
    const result = computeReadiness({ load: neutral, nutrition: neutral, wellbeing: unavailable });
    expect(result.verdict).toBe('ok');
  });

  it('le résultat porte les 3 composantes telles quelles, pour le détail dépliable (R8)', () => {
    const result = computeReadiness({ load: negative, nutrition: unavailable, wellbeing: neutral });
    expect(result.load).toEqual(negative);
    expect(result.nutrition).toEqual(unavailable);
    expect(result.wellbeing).toEqual(neutral);
  });
});
