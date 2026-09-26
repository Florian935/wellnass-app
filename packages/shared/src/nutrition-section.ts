/**
 * Les trois onglets du hub Nutrition — US NUTRI-UX03, décision D3.
 *
 * Ordre de priorité : un paramètre de route valide (lien entrant), puis le dernier onglet choisi
 * pendant la vie de l'app, puis Aujourd'hui. **Rien ne change d'onglet de force**, pas même au
 * changement de jour (décision Q5 de Florian) : relancer l'app rouvre Aujourd'hui, revenir sur Alim
 * depuis un autre pilier rouvre le dernier onglet choisi.
 *
 * Même règle que `hub-section.ts` (muscu, MUSCU-UX07), écrite à part pendant que les deux chantiers
 * avançaient en parallèle : la factorisation est notée au §11 de la spec NUTRI-UX03.
 */

export const NUTRITION_SECTIONS = ['today', 'history', 'progress'] as const;
export type NutritionSection = (typeof NUTRITION_SECTIONS)[number];

export function isNutritionSection(value: unknown): value is NutritionSection {
  return typeof value === 'string' && (NUTRITION_SECTIONS as readonly string[]).includes(value);
}

export function resolveNutritionSection(input: {
  /** Paramètre de route brut (`useLocalSearchParams`) : chaîne, tableau ou absent. */
  param: unknown;
  remembered: NutritionSection | null;
}): NutritionSection {
  if (isNutritionSection(input.param)) return input.param;
  return input.remembered ?? 'today';
}

/**
 * Les sous-onglets de l'écran Statistiques nutrition (NUTRI-UX01 R4.1). Ouvrables par un paramètre
 * `tab` depuis NUTRI-UX03 (R12) : « Me peser » ouvrait Régularité alors que la pesée est dans Poids.
 */
export const NUTRITION_STATS_TABS = ['regularity', 'intake', 'weight', 'quality'] as const;
export type NutritionStatsTab = (typeof NUTRITION_STATS_TABS)[number];

export function resolveStatsTab(param: unknown): NutritionStatsTab {
  return typeof param === 'string' && (NUTRITION_STATS_TABS as readonly string[]).includes(param)
    ? (param as NutritionStatsTab)
    : 'regularity';
}
