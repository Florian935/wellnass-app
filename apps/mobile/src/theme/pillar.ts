/**
 * US MUSCU-UX04 — **la palette d'un pilier**.
 *
 * ── Le défaut que ça corrige ─────────────────────────────────────────────────────────────────────
 * Recette du 19/09/2026, Florian : « la carte du haut est jolie, mais les cartes en dessous, c'est
 * pas du tout ISO ». Mesuré, l'onglet Musculation portait **trois identités** sur un seul écran :
 *
 *  - la **scène** en bordeaux `#6b0028 → #2d0011`, accent rose `#ff9ec0`  (`theme/stage.ts`,
 *    adouci en `#7c2734 → #330f22` le 19/09 — voir l'en-tête de `stage.ts`) ;
 *  - la **barre d'onglets** en rose `#e07a98`                              (`colors.pillarStrength`) ;
 *  - les **cartes** en brun `#30271e`, accent terracotta `#dd6e40`        (palette neutre).
 *
 * Les cartes étaient l'intruse : le rose était déjà la couleur de la muscu partout ailleurs.
 *
 * ── Pourquoi ce module, et pas le réglage « Couleurs des menus » ─────────────────────────────────
 * Le store `menu-accent-store` existait déjà et faisait presque ça — mais c'est une **préférence
 * utilisateur**, désactivée par défaut, aux couleurs librement choisies. S'appuyer dessus aurait eu
 * deux conséquences : l'identité des piliers ne se serait jamais affichée (off par défaut), et sa
 * couleur muscu par défaut, `#6b0028`, mesure **1,15:1** sur une carte sombre — illisible.
 *
 * L'identité des piliers est donc un **fait du design system** (ce module, toujours actif), et le
 * réglage reste ce qu'il est : une surcharge volontaire de l'accent, appliquée par-dessus.
 *
 * ── La contrainte qui rend l'exercice sûr ────────────────────────────────────────────────────────
 * Les surfaces sont teintées **à luminance constante** (`tintPreservingLuminance`). Un mélange
 * ordinaire vers une couleur sombre aurait assombri les surfaces, et la palette claire ne peut pas
 * se le permettre : ses paires de texte sont à 4,53-4,55 pour un seuil de 4,5. À luminance
 * constante, **tout** rapport de contraste contre une surface est conservé par construction.
 * `__tests__/contrast.test.ts` le vérifie pilier par pilier contre la palette neutre.
 */

import { tintPreservingLuminance } from '@wellness/shared';
import { palettes, type ColorScheme, type Palette } from './colors';

export const PILLAR_KEYS = ['home', 'strength', 'running', 'nutrition', 'lab'] as const;
export type PillarKey = (typeof PILLAR_KEYS)[number];

/**
 * La teinte de chaque pilier : la couleur **profonde** de sa scène, pas son accent lisible. C'est
 * vers elle que les surfaces glissent ; l'accent, lui, est repris tel quel des tokens `pillar*`,
 * déjà validés ≥ 4,5:1 par DASH-01.
 */
const TINT: Record<PillarKey, string> = {
  home: '#b14f2b',
  strength: '#7c2734',
  running: '#1d4586',
  nutrition: '#2e4419',
  lab: '#8a6419',
};

/** L'accent du pilier — le token déjà mesuré lisible sur `surface` et `background`. */
const ACCENT: Record<PillarKey, keyof Palette> = {
  home: 'pillarHome',
  strength: 'pillarStrength',
  running: 'pillarRunning',
  nutrition: 'pillarNutrition',
  lab: 'pillarLab',
};

/**
 * Intensité de la teinte, par thème. Valeurs arrêtées à l'œil sur planche comparative
 * (0 · 0,12 · 0,2 · 0,3 · 0,45) : en dessous de 0,2 le sombre ne bascule pas, au-delà de 0,3 il
 * vire au bonbon. Le clair réagit plus vite — ses surfaces sont presque blanches et l'œil attrape
 * tout de suite un voile pastel — d'où une valeur plus basse à rendu équivalent.
 */
const AMOUNT: Record<ColorScheme, number> = { light: 0.22, dark: 0.3 };

/**
 * Le **fond** bouge moins que les cartes : la page doit rester la page, et garder son écart avec
 * les surfaces posées dessus. Sans ce facteur, fond et carte convergent vers la même teinte et la
 * carte cesse de se détacher.
 */
const BACKGROUND_RATIO = 0.6;

/** Les tokens de **surface** qui prennent la teinte. Tout le reste (encres, alertes) ne bouge pas. */
const TINTED = ['background', 'surface', 'surfaceAlt', 'border', 'track', 'panel'] as const;

/**
 * `warn` / `warnBorder` / `warnText` sont **volontairement absents** de `TINTED` : un bandeau
 * d'alerte doit se reconnaître d'un coup d'œil, la même couleur sur les cinq piliers. Lui donner la
 * teinte du pilier le ferait fondre dans la page, exactement là où il ne doit pas.
 */

const cache = new Map<string, Palette>();

/**
 * La palette du pilier `pillar` dans le thème `scheme`. Mémoïsée : les palettes de base sont des
 * constantes, il n'y a donc que dix résultats possibles, calculés une fois chacun.
 */
export function pillarPalette(scheme: ColorScheme, pillar: PillarKey): Palette {
  const key = `${scheme}:${pillar}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const base = palettes[scheme];
  const tint = TINT[pillar];
  const amount = AMOUNT[scheme];
  const next: Palette = { ...base };

  for (const token of TINTED) {
    const ratio = token === 'background' ? BACKGROUND_RATIO : 1;
    next[token] = tintPreservingLuminance(base[token], tint, amount * ratio) ?? base[token];
  }

  next.accent = base[ACCENT[pillar]];
  // L'encre des boutons pleins suit l'accent : en sombre le fond de page (déjà le choix de CONF-07
  // D1), en clair le blanc. Mesuré contre chaque accent de pilier par le test de contraste.
  next.accentText = scheme === 'dark' ? base.background : '#ffffff';

  cache.set(key, next);
  return next;
}
