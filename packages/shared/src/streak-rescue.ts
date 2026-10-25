/**
 * US ACCUEIL-07 — **sauver la série par un vrai geste** (constat 5 du 24/10/2026).
 *
 * Le soir, quand rien n'est fait et qu'une série est en jeu, l'accueil proposait « Sauver ma
 * série »… qui ouvrait le planning. Le planning ne sauve rien. Les vraies sorties existent pourtant
 * toutes dans l'app, chacune avec sa règle déjà écrite :
 *  - **marcher** : l'objectif de pas atteint rend le jour actif (PAS-01, `isGoalReached`) — à
 *    condition que les pas soient suivis (Health Connect), sinon la marche ne serait pas comptée ;
 *  - **noter une activité** : vélo, yoga, foot… rend le jour actif (AUTRE-01) ;
 *  - **le joker** : il gèle le jour pour la série seulement (STREAK-01, D3) — s'il en reste un ce
 *    mois-ci, et pas au lendemain d'un autre joker (règle 2 : deux jokers d'affilée cassent la série).
 *
 * Ce module ne fait que choisir lesquelles proposer. Rien n'est écrit ici.
 */

import { jokersRemaining } from './streak-joker';

/** Une sortie proposée, dans l'ordre d'affichage. */
export type StreakRescueOption =
  | { kind: 'walk'; stepsLeft: number; minutes: number }
  | { kind: 'activity' }
  | { kind: 'joker' };

/** Cadence de marche retenue pour annoncer une durée : ~120 pas par minute, marche tranquille. */
export const WALK_STEPS_PER_MINUTE = 120;

/** Clé du jour précédent (UTC, insensible aux changements d'heure). */
function prevKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const p = new Date(Date.UTC(y!, m! - 1, d!) - 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.getUTCFullYear()}-${pad(p.getUTCMonth() + 1)}-${pad(p.getUTCDate())}`;
}

/**
 * Le joker peut-il couvrir **aujourd'hui** ?
 *
 * Il reste un joker ce mois-ci, aujourd'hui n'est pas déjà couvert, et hier ne l'est pas par un
 * joker — sinon les deux jours couverts se suivraient et le calcul de la série s'arrêterait là
 * (`computeStreakWithJokers`, règle 2) : le joker serait brûlé pour rien.
 */
export function canFreezeToday(input: { jokerDays: readonly string[]; todayKey: string }): boolean {
  const { jokerDays, todayKey } = input;
  if (jokersRemaining(jokerDays, todayKey) <= 0) return false;
  if (jokerDays.includes(todayKey)) return false;
  return !jokerDays.includes(prevKey(todayKey));
}

/** Minutes de marche pour `stepsLeft` pas, arrondies aux 5 minutes, jamais moins de 5. */
export function walkMinutesFor(stepsLeft: number): number {
  const raw = Math.max(0, stepsLeft) / WALK_STEPS_PER_MINUTE;
  return Math.max(5, Math.ceil(raw / 5) * 5);
}

export interface StreakRescueInput {
  /** Les pas du jour arrivent (Health Connect autorisé) : une marche sera comptée. */
  stepsTracked: boolean;
  steps: number;
  stepGoal: number;
  jokerDays: readonly string[];
  todayKey: string;
}

/** Les sorties à proposer, dans l'ordre : marcher, noter une activité, le joker. */
export function streakRescueOptions(input: StreakRescueInput): StreakRescueOption[] {
  const options: StreakRescueOption[] = [];
  const stepsLeft = input.stepGoal - input.steps;
  if (input.stepsTracked && stepsLeft > 0) {
    options.push({ kind: 'walk', stepsLeft, minutes: walkMinutesFor(stepsLeft) });
  }
  options.push({ kind: 'activity' });
  if (canFreezeToday(input)) options.push({ kind: 'joker' });
  return options;
}
