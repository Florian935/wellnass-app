/**
 * Les trois onglets du hub Course — US CARDIO-UX03, décision D1.
 *
 * Même règle que la muscu (`hub-section.ts`, MUSCU-UX07 D3), **dupliquée exprès** : les deux
 * chantiers (et celui de la nutrition) avancent en parallèle sans toucher aux fichiers des autres, et
 * la factorisation viendra quand les trois auront atterri (spec §11).
 *
 * Ordre de priorité : un paramètre de route valide (lien entrant, redirection de `/running-history`),
 * puis le dernier onglet choisi pendant la vie de l'app, puis Courir. **Rien ne change d'onglet de
 * force** : pendant une course, Historique et Progrès portent une ligne « Reprendre ».
 */

export const RUN_HUB_SECTIONS = ['run', 'history', 'progress'] as const;
export type RunHubSection = (typeof RUN_HUB_SECTIONS)[number];

export function isRunHubSection(value: unknown): value is RunHubSection {
  return typeof value === 'string' && (RUN_HUB_SECTIONS as readonly string[]).includes(value);
}

export function resolveRunHubSection(input: {
  /** Paramètre de route brut (`useLocalSearchParams`) : chaîne, tableau ou absent. */
  param: unknown;
  remembered: RunHubSection | null;
}): RunHubSection {
  if (isRunHubSection(input.param)) return input.param;
  return input.remembered ?? 'run';
}
