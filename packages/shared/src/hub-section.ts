/**
 * Les trois onglets du hub Musculation — US MUSCU-UX07, décision D3.
 *
 * Ordre de priorité : un paramètre de route valide (lien entrant, redirection de `/history`), puis
 * le dernier onglet choisi pendant la vie de l'app, puis S'entraîner. **Rien ne change d'onglet de
 * force** : pendant une séance, Historique et Progrès portent une ligne « Reprendre » plutôt que de
 * renvoyer l'utilisateur sur S'entraîner à chaque retour d'un détail.
 */

export const HUB_SECTIONS = ['train', 'history', 'progress'] as const;
export type HubSection = (typeof HUB_SECTIONS)[number];

export function isHubSection(value: unknown): value is HubSection {
  return typeof value === 'string' && (HUB_SECTIONS as readonly string[]).includes(value);
}

export function resolveHubSection(input: {
  /** Paramètre de route brut (`useLocalSearchParams`) : chaîne, tableau ou absent. */
  param: unknown;
  remembered: HubSection | null;
}): HubSection {
  if (isHubSection(input.param)) return input.param;
  return input.remembered ?? 'train';
}
