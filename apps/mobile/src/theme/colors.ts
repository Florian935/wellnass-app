/**
 * Échelle de couleurs nommée, dérivée de la maquette de référence (design/design-system.md).
 * On garde le mapping clair ↔ sombre ; accent terracotta, surfaces chaleureuses.
 * (Les `--c_<hex>` bruts de la maquette ne sont pas reportés : on nomme les rôles.)
 */
export type ColorScheme = 'light' | 'dark';

export type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  /** Séparateurs et contours **décoratifs** (cartes, lignes de liste). Volontairement discret. */
  border: string;
  /**
   * Contour d'un **composant d'interface** dont la limite doit être perceptible — champ de saisie
   * d'abord. WCAG 1.4.11 exige **3:1** pour ce cas, et le tient contre les **deux** couleurs que la
   * bordure sépare : le remplissage (`surface`) et la page (`background`).
   *
   * Distinct de `border` à dessein : un séparateur de carte ne porte aucune information nécessaire
   * pour identifier un composant, il n'a donc pas à être aussi contrasté. Monter `border` à 3:1
   * aurait cerné toutes les cartes d'un trait lourd pour un gain d'accessibilité nul.
   */
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  success: string;
  danger: string;
  /** Piste (fond) des barres de progression / mini-graphes. */
  track: string;
  /** Vert « données » (courbes, barres) — plus saturé que `success`. */
  chartGreen: string;
  /** Ambre « données » (barres secondaires, alertes douces). */
  amber: string;
  /** Surface d'alerte douce (fond) + bordure + texte (ton ambre). */
  warn: string;
  warnBorder: string;
  warnText: string;
  /** Carte inversée « panneau » (grand carré Séance du jour) : fond sombre + textes. */
  panel: string;
  panelText: string;
  panelMuted: string;
  /** Accent **lisible sur `panel`** — l'accent terracotta standard y manque de contraste. */
  panelAccent: string;
};

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#f7eede',
    surface: '#fffaf2',
    surfaceAlt: '#f3ddd0',
    border: '#ece0cd',
    borderStrong: '#90897d', // 3,01 / fond · 3,33 / surface
    text: '#33291f',
    // Assombris le 30/07/2026 : les valeurs d'origine (#96856f, #c0562f) donnaient 3,10 et 3,95
    // contre le fond, sous les 4,5 exigés par WCAG AA pour du texte normal. Le thème sombre, lui,
    // passait déjà — c'est le clair seul qui échouait. Teinte et saturation conservées.
    textMuted: '#786a59', // 4,55 / fond · 5,05 / surface
    accent: '#b14f2b', // 4,53 / fond · blanc dessus : 5,22
    accentText: '#ffffff',
    success: '#7c8a5b',
    danger: '#b23b2e',
    track: '#eadcc6',
    chartGreen: '#7c8a5b',
    amber: '#cc9544',
    warn: '#f7ead6',
    warnBorder: '#e9cfa0',
    warnText: '#a97b1f',
    panel: '#33291f',
    panelText: '#f0e4d0',
    panelMuted: '#c9b79a',
    panelAccent: '#d9a888',
  },
  dark: {
    background: '#1c150e',
    surface: '#30271e',
    surfaceAlt: '#3a2e22',
    border: '#3a2e22',
    // Même défaut de limite de champ qu'en clair (`border` n'était qu'à 1,37 du fond) : la bordure
    // de composant est donc relevée ici aussi. Les couleurs de texte du thème sombre, elles, sont
    // inchangées — elles passaient déjà largement.
    borderStrong: '#797169', // 3,77 / fond · 3,05 / surface
    text: '#f4ecdd',
    textMuted: '#c9b79a',
    accent: '#dd6e40',
    accentText: '#ffffff',
    success: '#a9ba7e',
    danger: '#e0524a',
    track: '#362c22',
    chartGreen: '#a9ba7e',
    amber: '#e0b155',
    warn: '#312414',
    warnBorder: '#4a3a1e',
    warnText: '#e0b155',
    panel: '#241e18',
    panelText: '#f0e4d0',
    panelMuted: '#c9b79a',
    panelAccent: '#e0a97f',
  },
};
