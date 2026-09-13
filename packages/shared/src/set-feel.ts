/**
 * Ressenti d'une série en un mot — US MUSCU-UX03 (mode immersif), spec §5.7.
 *
 * Le cadran de reps propose quatre mots plutôt que dix chiffres : c'est plus rapide sous le pouce,
 * et surtout **c'est la même donnée** — la valeur atterrit dans la colonne `rpe` existante, jamais
 * dans une colonne neuve.
 *
 * ⚠️ **« Solide » vaut 7, jamais 8.** `sessionStruggled` (voir `workout.ts`) classe une séance comme
 * difficile **dès un RPE ≥ 8** : la progression assistée (MUSC-F7) coupe alors sa suggestion sur
 * l'exercice, puis propose un allègement si ça se répète. Mapper « Solide » — la réponse attendue
 * d'une bonne série — sur 8 éteindrait donc **silencieusement** la progression de tout le monde.
 * Le test `feelToRpe('solide') < 8` existe pour que ce seuil ne bouge pas par inadvertance.
 */

/** Les quatre ressentis, du plus facile au plus dur (ordre d'affichage). */
export const SET_FEELS = ['facile', 'solide', 'dur', 'limite'] as const;
export type SetFeel = (typeof SET_FEELS)[number];

/** Correspondance ressenti → RPE stocké. Voir l'avertissement en tête de fichier pour « solide ». */
const FEEL_TO_RPE: Record<SetFeel, number> = {
  facile: 6,
  solide: 7,
  dur: 9,
  limite: 10,
};

/** RPE stocké pour un ressenti. */
export function feelToRpe(feel: SetFeel): number {
  return FEEL_TO_RPE[feel];
}

/**
 * Ressenti correspondant à un RPE **exactement** égal à l'une des quatre valeurs. Toute autre
 * valeur (saisie au pavé RPE en niveau Détaillé, par exemple 8) retourne `null` : on n'invente pas
 * un mot pour un chiffre qui n'en portait pas.
 */
export function rpeToFeel(rpe: number | null | undefined): SetFeel | null {
  if (rpe === null || rpe === undefined) return null;
  const found = SET_FEELS.find((feel) => FEEL_TO_RPE[feel] === rpe);
  return found ?? null;
}

/** Parse tolérant (valeur persistée, paramètre de route) : toute valeur inconnue → `null`. */
export function parseSetFeel(value: string | null | undefined): SetFeel | null {
  if (!value) return null;
  return (SET_FEELS as readonly string[]).includes(value) ? (value as SetFeel) : null;
}
