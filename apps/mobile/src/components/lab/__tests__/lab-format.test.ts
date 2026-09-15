/**
 * US LABO-01 — les mises en forme du Labo.
 *
 * Elles sont courtes mais lues partout, et deux d'entre elles sont des pièges connus :
 *  - `formatMinutes` ne doit jamais écrire « 0 h 45 » : une nuit de 45 min n'est pas une nuit à
 *    zéro heure, et le « 0 h » se lit comme un bug d'affichage ;
 *  - `dayMonth` / `weekdayName` ne doivent pas passer par `new Date('AAAA-MM-JJ')`, qui est
 *    interprété en UTC et décale le jour d'un cran pour tout fuseau à l'ouest de Greenwich.
 */

import { dayMonth, formatDecimal, formatMinutes, formatPace, pillarLabelKey, weekdayInitial, weekdayName } from '../lab-format';

describe('formatMinutes', () => {
  it.each([
    [450, '7 h 30'],
    [420, '7 h'],
    [45, '45 min'],
    [0, '0 min'],
  ])('%i min → « %s »', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });

  it('🔴 les minutes sont sur deux chiffres, sinon « 7 h 5 » se lit comme 7 h 50', () => {
    expect(formatMinutes(7 * 60 + 5)).toBe('7 h 05');
  });
});

describe('formatPace', () => {
  it('une allure en secondes par km devient « 4:58 »', () => {
    expect(formatPace(298)).toBe('4:58');
  });

  it('les secondes sont complétées à deux chiffres', () => {
    expect(formatPace(305)).toBe('5:05');
  });
});

describe('formatDecimal', () => {
  it('suit la locale : virgule en français, point en anglais', () => {
    expect(formatDecimal(1.85, 'fr')).toBe('1,9');
    expect(formatDecimal(1.85, 'en')).toBe('1.9');
  });

  it('accepte une précision explicite (le ratio de charge s’écrit à deux décimales)', () => {
    expect(formatDecimal(1.34, 'en', 2)).toBe('1.34');
  });
});

describe('dates', () => {
  it('🔴 « 2026-09-15 » reste le 15/09, sans décalage de fuseau', () => {
    // `new Date('2026-09-15')` vaut minuit UTC : à Paris en hiver, ou n'importe où à l'ouest, le
    // jour affiché serait le 14.
    expect(dayMonth('2026-09-15')).toBe('15/09');
    expect(weekdayName('2026-09-15', 'fr')).toBe('mardi');
  });

  it('l’initiale du jour sert de repère à la grille et à l’anneau des nuits', () => {
    expect(weekdayInitial('2026-09-14', 'fr')).toBe('L');
    expect(weekdayInitial('2026-09-14', 'en')).toBe('M');
  });
});

describe('pillarLabelKey', () => {
  it('le sommeil a sa propre clé : ce n’est pas un pilier de l’app', () => {
    expect(pillarLabelKey('sleep')).toBe('lab.pillars.sleep');
    expect(pillarLabelKey('strength')).toBe('pillars.strength');
    expect(pillarLabelKey('running')).toBe('pillars.running');
    expect(pillarLabelKey('nutrition')).toBe('pillars.nutrition');
  });
});
