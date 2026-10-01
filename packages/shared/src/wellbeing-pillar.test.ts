/**
 * US BIEN-02 → BIEN-04 — les briques pures ajoutées à `wellbeing.ts` par le pilier Bien-être :
 * check-in en deux temps, étiquettes et modules, nuit courte ou agitée, garde-fou « humeur basse ».
 */
import { describe, expect, it } from 'vitest';

import {
  ALCOHOL_DRINKS_MAX,
  CHECKIN_EVENING_FROM_HOUR,
  CHECKIN_MORNING_UNTIL_HOUR,
  EVENING_TAGS,
  LOW_MOOD_COOLDOWN_DAYS,
  MORNING_TAGS,
  NAP_MINUTES_MAX,
  WELLBEING_TAGS,
  hasEveningCheckin,
  hasMorningCheckin,
  isAlcoholDrinks,
  isEmptyCheckin,
  isNapMinutes,
  isPoorNight,
  shouldShowLowMoodCard,
  suggestCheckinMoment,
  wellbeingScaleAverage,
  wellbeingSeries,
  type LocalWellbeing,
} from './wellbeing';
import { SHORT_NIGHT_MINUTES } from './lab-week';

const TODAY = '2026-10-01';

function day(n: number): string {
  const d = new Date(2026, 9, 1);
  d.setDate(d.getDate() - n);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

describe('étiquettes et modules (BIEN-03, BIEN-07)', () => {
  it('quatre étiquettes, une liste fermée, réparties entre le matin et le soir', () => {
    expect(WELLBEING_TAGS).toEqual(['sick', 'busyDay', 'lateNight', 'travel']);
    expect([...MORNING_TAGS, ...EVENING_TAGS].sort()).toEqual([...WELLBEING_TAGS].sort());
  });

  it('borne les verres à « 3 et plus » et la sieste à 3 h', () => {
    expect(isAlcoholDrinks(0)).toBe(true);
    expect(isAlcoholDrinks(ALCOHOL_DRINKS_MAX)).toBe(true);
    expect(isAlcoholDrinks(4)).toBe(false);
    expect(isAlcoholDrinks(1.5)).toBe(false);
    expect(isNapMinutes(20)).toBe(true);
    expect(isNapMinutes(NAP_MINUTES_MAX + 10)).toBe(false);
  });
});

describe('isEmptyCheckin — ce qui suffit à écrire une ligne', () => {
  it('une étiquette cochée, une qualité de nuit, une envie, une réponse de module suffisent', () => {
    expect(isEmptyCheckin({ sick: true })).toBe(false);
    expect(isEmptyCheckin({ sleepQuality: 2 })).toBe(false);
    expect(isEmptyCheckin({ motivation: 4 })).toBe(false);
    expect(isEmptyCheckin({ alcoholDrinks: 0 })).toBe(false);
    expect(isEmptyCheckin({ lateCaffeine: false })).toBe(false);
    expect(isEmptyCheckin({ napMinutes: 20 })).toBe(false);
  });

  it('une étiquette DÉCOCHÉE seule ne crée rien', () => {
    expect(isEmptyCheckin({ sick: false, travel: false, busyDay: null })).toBe(true);
  });
});

describe('le check-in en deux temps (décision D4)', () => {
  it('le matin est fait dès qu’un de ses gestes l’est, le soir de même', () => {
    expect(hasMorningCheckin(null)).toBe(false);
    expect(hasMorningCheckin({ sleepMinutes: 420 })).toBe(true);
    expect(hasMorningCheckin({ motivation: 2 })).toBe(true);
    expect(hasMorningCheckin({ sick: true })).toBe(true);
    expect(hasMorningCheckin({ mood: 4 })).toBe(false);
    expect(hasEveningCheckin({ mood: 4 })).toBe(true);
    expect(hasEveningCheckin({ lateNight: true })).toBe(true);
    expect(hasEveningCheckin({ alcoholDrinks: 0 })).toBe(true);
    expect(hasEveningCheckin({ energy: 3, sleepMinutes: 400 })).toBe(false);
  });

  it('propose le matin avant midi et le soir dès 17 h, quoi qu’il arrive', () => {
    expect(suggestCheckinMoment(CHECKIN_MORNING_UNTIL_HOUR - 1, { mood: 3, energy: 3 })).toBe('morning');
    expect(suggestCheckinMoment(CHECKIN_EVENING_FROM_HOUR, null)).toBe('evening');
  });

  it('entre midi et 17 h, le matin tant qu’il n’est pas fait — la nuit ne saute pas', () => {
    expect(suggestCheckinMoment(14, null)).toBe('morning');
    expect(suggestCheckinMoment(14, { sleepMinutes: 420 })).toBe('evening');
  });
});

describe('isPoorNight — la nuit courte ou agitée (BIEN-04)', () => {
  it('moins de 6 h, ou une qualité de 1 ou 2', () => {
    expect(isPoorNight({ sleepMinutes: SHORT_NIGHT_MINUTES - 15 })).toBe(true);
    expect(isPoorNight({ sleepMinutes: 480, sleepQuality: 2 })).toBe(true);
    expect(isPoorNight({ sleepQuality: 1 })).toBe(true);
  });

  it('une nuit connue et correcte est un « non » ; une nuit inconnue n’est PAS une bonne nuit', () => {
    expect(isPoorNight({ sleepMinutes: SHORT_NIGHT_MINUTES })).toBe(false);
    expect(isPoorNight({ sleepMinutes: 450, sleepQuality: 3 })).toBe(false);
    expect(isPoorNight({ sleepQuality: 4 })).toBe(false);
    expect(isPoorNight({})).toBeNull();
    expect(isPoorNight(null)).toBeNull();
  });
});

describe('séries et moyennes des nouvelles échelles', () => {
  it('trace la qualité de nuit et l’envie, un jour sans valeur reste un trou', () => {
    const rows: LocalWellbeing[] = [
      { logDate: day(2), sleepQuality: 2, motivation: 4 },
      { logDate: day(1), motivation: 3 },
      { logDate: day(0), sleepQuality: 4 },
    ];
    expect(wellbeingSeries(rows, 'sleepQuality', 30, TODAY)).toEqual([
      { dayKey: day(2), value: 2 },
      { dayKey: day(0), value: 4 },
    ]);
    expect(wellbeingScaleAverage(rows, 'motivation', 30, TODAY)).toEqual({ average: 3.5, days: 2 });
    expect(wellbeingScaleAverage(rows, 'cravings', 30, TODAY)).toEqual({ average: null, days: 0 });
  });
});

describe('shouldShowLowMoodCard — le garde-fou « humeur basse » (décision D7)', () => {
  const moods = (values: (number | null)[]): LocalWellbeing[] =>
    values.map((mood, i) => ({ logDate: day(values.length - 1 - i), mood }));

  it('5 des 7 derniers jours renseignés à 1 ou 2 : la carte apparaît', () => {
    expect(shouldShowLowMoodCard(moods([2, 1, 3, 2, 2, 4, 1]), TODAY, null)).toBe(true);
  });

  it('4 sur 7 ne suffisent pas ; un jour non renseigné ne compte pas comme bas', () => {
    expect(shouldShowLowMoodCard(moods([2, 1, 3, 2, 4, 4, 1]), TODAY, null)).toBe(false);
    expect(shouldShowLowMoodCard(moods([2, null, 1, null, 2, null, 2]), TODAY, null)).toBe(false);
  });

  it('ne se déclenche pas sur moins de 5 jours renseignés, même tous bas', () => {
    expect(shouldShowLowMoodCard(moods([1, 1, 1, 1]), TODAY, null)).toBe(false);
  });

  it('ne revient pas avant 14 jours : jamais un rappel', () => {
    const rows = moods([2, 1, 2, 2, 2, 1, 1]);
    expect(shouldShowLowMoodCard(rows, TODAY, day(3))).toBe(false);
    expect(shouldShowLowMoodCard(rows, TODAY, day(LOW_MOOD_COOLDOWN_DAYS))).toBe(true);
  });

  it('ignore les humeurs de plus de 14 jours', () => {
    const old: LocalWellbeing[] = [20, 19, 18, 17, 16].map((n) => ({ logDate: day(n), mood: 1 }));
    expect(shouldShowLowMoodCard(old, TODAY, null)).toBe(false);
  });
});
