/**
 * US LABO-01 — les mises en forme du Labo, pures et testables.
 *
 * Elles vivent ici plutôt que dans les composants pour deux raisons : la même durée s'affiche dans
 * quatre écrans, et une mise en forme de date se teste sans monter de React.
 */

import { localDateFromDayKey, type LabPillar } from '@wellness/shared';

/** Minutes → « 7 h 30 » / « 45 min ». Jamais « 0h05 » : on ne fabrique pas de faux zéros. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Une allure en secondes par kilomètre → « 4:58 ». */
export function formatPace(secondsPerKm: number): string {
  const s = Math.round(secondsPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Un nombre à une décimale, virgule française comprise (via la locale). */
export function formatDecimal(value: number, locale: string, digits = 1): string {
  return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** `AAAA-MM-JJ` → « mardi » (jour de la semaine, en toutes lettres, dans la langue courante). */
export function weekdayName(dayKey: string, locale: string): string {
  return localDateFromDayKey(dayKey).toLocaleDateString(locale, { weekday: 'long' });
}

/** `AAAA-MM-JJ` → « 15/09 » (sans passer par `new Date('AAAA-MM-JJ')`, qui décalerait le jour). */
export function dayMonth(dayKey: string): string {
  const [, month, day] = dayKey.split('-');
  return `${day}/${month}`;
}

/** L'initiale du jour pour la grille et pour l'anneau des nuits de la scène. */
export function weekdayInitial(dayKey: string, locale: string): string {
  return weekdayName(dayKey, locale).charAt(0).toUpperCase();
}

/** La clé i18n du nom d'un pilier du Labo (les trois piliers, plus le socle). */
export function pillarLabelKey(pillar: LabPillar): string {
  return pillar === 'sleep' ? 'lab.pillars.sleep' : `pillars.${pillar}`;
}
