/**
 * Parcours « 7 jours pour démarrer » (US ACTIV-01, roadmap 1.27).
 *
 * Mini-programme d'activation : une suggestion par jour pendant 7 jours après la fin de
 * l'onboarding, ancrée sur `profiles.onboardingCompletedAt`. Fenêtre calendaire stricte — un jour
 * manqué n'est jamais rejoué (spec R1). Le thème du jour dépend des piliers **actuellement**
 * actifs (spec R2 : jamais un instantané figé à l'inscription), classés par priorité fixe
 * muscu＞running＞nutrition (spec R7). Le rang d'un pilier est **structurel** — dérivé uniquement
 * de la liste des piliers actifs, jamais de ce qui a été fait ou non (spec §2 ter).
 */

import type { Pillar } from './pillar';

export const ACTIVATION_PATH_LENGTH_DAYS = 7;

/** Ordre de priorité fixe pour cibler un pilier sur un jour pilier-spécifique (spec R7). */
export const PILLAR_PRIORITY: readonly Pillar[] = ['strength', 'running', 'nutrition'];

/**
 * Jour courant (1-based) du parcours, ou `null` si hors fenêtre : avant le jour 1 (ne devrait pas
 * arriver, l'onboarding vient de se terminer) ou après le jour 7. `null` si l'onboarding n'est pas
 * terminé.
 */
export function activationPathDayIndex(
  onboardingCompletedAt: string | null,
  nowIso: string,
): number | null {
  if (!onboardingCompletedAt) return null;
  const elapsedDays = Math.floor(
    (new Date(nowIso).getTime() - new Date(onboardingCompletedAt).getTime()) / 86_400_000,
  );
  const day = elapsedDays + 1;
  return day >= 1 && day <= ACTIVATION_PATH_LENGTH_DAYS ? day : null;
}

/** Piliers actifs triés par priorité fixe (spec R7) — calcul structurel, jamais comportemental. */
export function rankedActivePillars(activePillars: readonly Pillar[]): Pillar[] {
  return PILLAR_PRIORITY.filter((p) => activePillars.includes(p));
}

export type ActivationDayTheme =
  | { kind: 'pillar'; rank: 1 | 2 | 3; pillar: Pillar }
  | { kind: 'universal'; day: number };

/**
 * Thème du jour `day` (spec §2/§2 ter) — pur, ne dépend que du jour et des piliers actifs
 * actuels. Jours 1/3/5 ciblent respectivement le 1er/2e/3e pilier actif par rang de priorité ;
 * si ce rang est absent (moins de piliers actifs que de rangs), ou pour tout autre jour,
 * le thème est universel.
 */
export function activationDayTheme(
  day: number,
  activePillars: readonly Pillar[],
): ActivationDayTheme {
  const ranked = rankedActivePillars(activePillars);
  if (day === 1) {
    return ranked[0] ? { kind: 'pillar', rank: 1, pillar: ranked[0] } : { kind: 'universal', day };
  }
  if (day === 3) {
    return ranked[1] ? { kind: 'pillar', rank: 2, pillar: ranked[1] } : { kind: 'universal', day };
  }
  if (day === 5) {
    return ranked[2] ? { kind: 'pillar', rank: 3, pillar: ranked[2] } : { kind: 'universal', day };
  }
  return { kind: 'universal', day };
}
