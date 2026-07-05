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

/** Âge minimum requis à l'inscription (RGPD). */
export const MIN_SIGNUP_AGE = 16;
