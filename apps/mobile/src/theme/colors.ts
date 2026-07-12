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
  },
};
