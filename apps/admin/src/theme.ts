/**
 * Palette et tokens de style du back-office (thème clair, accent terracotta
 * de la marque). Alignés sur la maquette design/admin-f1/admin-f1.html.
 */
export const theme = {
  colors: {
    bg: '#f6f4f1',
    bgPage: '#efeae4',
    panel: '#ffffff',
    border: '#e7e1d8',
    ink: '#2b2019',
    muted: '#8a7a68',
    accent: '#dd6e40',
    accentInk: '#ffffff',
    danger: '#c0492f',
    dangerBg: '#fbeae5',
    dangerBorder: '#e7b9ab',
    sidebar: '#241a12',
    sidebarInk: '#f4ecdd',
    sidebarMuted: '#b9a88f',
    field: '#fdfcfb',
  },
  radius: {
    sm: '8px',
    md: '9px',
    lg: '12px',
    xl: '14px',
  },
  font: '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
} as const;

export type Theme = typeof theme;
