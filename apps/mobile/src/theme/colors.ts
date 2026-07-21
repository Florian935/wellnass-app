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
  border: string;
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
};

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#f7eede',
    surface: '#fffaf2',
    surfaceAlt: '#f3ddd0',
    border: '#ece0cd',
    text: '#33291f',
    textMuted: '#96856f',
    accent: '#c0562f',
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
  },
  dark: {
    background: '#1c150e',
    surface: '#30271e',
    surfaceAlt: '#3a2e22',
    border: '#3a2e22',
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
  },
};
