/**
 * Calculs d'âge (déclaratif) — utilisés pour le contrôle RGPD « âge minimum 16 ans »
 * à l'inscription (voir compte-profil-onboarding §2.1). Fonctions pures, testables.
 */

/** Âge en années révolues à la date `at` (par défaut : maintenant). */
export function computeAge(birthDate: Date, at: Date = new Date()): number {
  let age = at.getFullYear() - birthDate.getFullYear();
  const monthDiff = at.getMonth() - birthDate.getMonth();
  const dayDiff = at.getDate() - birthDate.getDate();
  // Anniversaire pas encore atteint cette année → on retire 1.
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

/** Vrai si la personne a au moins `minYears` ans à la date `at`. */
export function isAtLeast(birthDate: Date, minYears: number, at: Date = new Date()): boolean {
  return computeAge(birthDate, at) >= minYears;
}

/**
 * Construit une `Date` valide à partir de jour/mois/année (calendrier grégorien).
 * Renvoie `null` si la date n'existe pas (ex. 31/02) ou si les champs sont hors bornes.
 */
export function toDate(day: number, month: number, year: number): Date | null {
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  // Rejette les débordements (ex. 31/02 → 03/03).
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Formate jour/mois/année en date-only ISO `AAAA-MM-JJ`, ou `null` si invalide.
 *
 * ⚠️ Ne PAS utiliser `toDate(...).toISOString()` pour une date de naissance : `toISOString`
 * convertit en UTC, or `toDate` crée une date à minuit **local** → dans un fuseau en avance
 * sur UTC (ex. France UTC+1/+2), le 11 à 00 h locale devient le 10 à 22 h UTC → jour -1.
 * Ici on formate depuis les composants **locaux** de la date validée : aucun décalage.
 */
export function toIsoDate(day: number, month: number, year: number): string | null {
  const date = toDate(day, month, year);
  if (!date) return null;
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Âge minimum requis à l'inscription (RGPD). */
export const MIN_SIGNUP_AGE = 16;
