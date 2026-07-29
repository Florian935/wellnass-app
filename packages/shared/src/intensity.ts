/**
 * US UX-05 — échelle d'intensité affichée : RPE ou RIR (roadmap 3.55).
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── Le principe, et il tient en une phrase ────────────────────────────────────────────────────────
 * **Le RIR n'est jamais stocké.** `workout_sets.rpe` reste la seule vérité ; l'échelle choisie ne
 * dit que dans quelle langue l'afficher. C'est le patron exact de `units` (« stockage toujours en
 * métrique, conversion à l'affichage »).
 *
 * Conséquence voulue : la bascule est **réversible et sans perte**. Un RPE saisi hier se lit en RIR
 * aujourd'hui, et inversement — ce qui n'aurait pas été vrai avec une plage RIR restreinte à 0-4,
 * où les RPE de 1 à 5 seraient devenus inaffichables.
 *
 * ── Pourquoi RIR = 10 − RPE ──────────────────────────────────────────────────────────────────────
 * Le RPE de musculation mesure la proximité de l'échec : 10 = plus aucune répétition possible. Le RIR
 * mesure la même chose par l'autre bout : le nombre de répétitions **encore en réserve**. RPE 10 →
 * RIR 0, RPE 8 → RIR 2. Les deux décrivent la même série.
 */

/** Les 2 échelles d'affichage de l'intensité d'une série. */
export const INTENSITY_SCALES = ['rpe', 'rir'] as const;

export type IntensityScale = (typeof INTENSITY_SCALES)[number];

/** Échelle par défaut : le RPE, qui était la seule avant cette US. */
export const DEFAULT_INTENSITY_SCALE: IntensityScale = 'rpe';

/** Valeurs de RPE saisissables — inchangées par cette US. */
export const RPE_MIN = 1;
export const RPE_MAX = 10;

/**
 * Convertit un RPE stocké en valeur **affichée** dans l'échelle demandée.
 *
 * `null` reste `null` : une intensité non saisie ne devient pas « RIR 10 ». C'est le piège de la
 * conversion naïve `10 - (rpe ?? 0)`, qui transformerait une absence de donnée en valeur maximale.
 */
export function toDisplayIntensity(
  rpe: number | null | undefined,
  scale: IntensityScale,
): number | null {
  if (rpe == null || !Number.isFinite(rpe)) return null;
  return scale === 'rir' ? RPE_MAX - rpe : rpe;
}

/**
 * Convertit une valeur **saisie** dans l'échelle affichée vers le RPE à stocker.
 *
 * Réciproque exacte de `toDisplayIntensity` : c'est ce qui garantit qu'un aller-retour ne dérive pas.
 */
export function fromDisplayIntensity(
  displayed: number | null | undefined,
  scale: IntensityScale,
): number | null {
  if (displayed == null || !Number.isFinite(displayed)) return null;
  return scale === 'rir' ? RPE_MAX - displayed : displayed;
}

/**
 * Valeurs proposées à la saisie, **dans l'ordre de lecture de l'échelle choisie**.
 *
 * En RPE : 1 → 10 (l'effort croît vers la droite). En RIR : 0 → 9 (la réserve croît vers la droite,
 * donc l'effort **décroît**). Les deux listes se lisent de gauche à droite comme l'utilisateur pense
 * son échelle ; présenter le RIR en 9 → 0 pour « garder le même ordre de RPE » serait déroutant.
 */
export function intensityChoices(scale: IntensityScale): number[] {
  const rpeValues = Array.from({ length: RPE_MAX - RPE_MIN + 1 }, (_, i) => RPE_MIN + i);
  if (scale === 'rpe') return rpeValues;
  // RIR = 10 − RPE, trié croissant → 0 … 9.
  return rpeValues.map((rpe) => RPE_MAX - rpe).sort((a, b) => a - b);
}

/** Clé i18n du libellé court de l'échelle (`intensity.rpe.short` / `intensity.rir.short`). */
export function intensityLabelKey(scale: IntensityScale): string {
  return `intensity.${scale}.short`;
}

/** Parse tolérant : toute valeur inconnue retombe sur le RPE, jamais sur une erreur. */
export function parseIntensityScale(raw: unknown): IntensityScale {
  return raw === 'rir' ? 'rir' : DEFAULT_INTENSITY_SCALE;
}
