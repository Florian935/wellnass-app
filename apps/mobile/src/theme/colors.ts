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
  /**
   * US DASH-01 — la couleur de chaque pilier, **lisible en texte** (≥ 4,5:1) sur `surface` et `background`
   * dans le thème courant. Onglet actif, barres, libellés des cartes d'un pilier.
   *
   * ⚠️ Distinctes des `DEFAULT_MENU_COLORS` (préférence « couleur par menu », qui pilote l'accent
   * global) : ces valeurs-là étaient choisies pour un fond clair et le bordeaux y tombait à 1,15:1 sur
   * une carte sombre. Les teintes de maquette du bleu et du vert échouaient aussi, de peu, sur le fond
   * clair (4,39 et 4,23) : elles sont assombries ici, teinte conservée.
   */
  pillarHome: string;
  pillarStrength: string;
  pillarRunning: string;
  pillarNutrition: string;
  /** US LABO-01 — la couleur du Labo : le doré du socle, assombri pour rester lisible en clair. */
  pillarLab: string;
};

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#f7eede',
    surface: '#fffaf2',
    surfaceAlt: '#f3ddd0',
    // US MUSCU-UX06 (23/09/2026) — `#ece0cd` (1,13 / fond) relevé : en clair, la carte presque
    // blanche ne se détache du fond qu'à 1,11:1, c'est donc le filet qui fait la séparation.
    border: '#e3d3ba', // 1,28 / fond
    borderStrong: '#90897d', // 3,01 / fond · 3,33 / surface
    text: '#33291f',
    // Assombris le 30/07/2026 : les valeurs d'origine (#96856f, #c0562f) donnaient 3,10 et 3,95
    // contre le fond, sous les 4,5 exigés par WCAG AA pour du texte normal. Le thème sombre, lui,
    // passait déjà — c'est le clair seul qui échouait. Teinte et saturation conservées.
    textMuted: '#786a59', // 4,55 / fond · 5,05 / surface
    accent: '#b14f2b', // 4,53 / fond · blanc dessus : 5,22
    accentText: '#ffffff',
    // Assombri le 01/08/2026 (CONF-07) : 3,23 / fond, sous les 4,5 exigés — employé comme texte
    // (« Compte créé », « Objectif atteint »). Teinte et saturation conservées (R1).
    success: '#66714b', // 4,53 / fond · 5,02 / surface
    danger: '#b23b2e',
    track: '#eadcc6',
    // Diverge volontairement de `success` depuis CONF-07 (R3) : `chartGreen` ne peint que des
    // courbes (seuil 3,0, déjà tenu à 3,23) — l'assombrir comme `success` noircirait les graphes
    // sans aucun gain d'accessibilité. Ne pas réunifier les deux tokens.
    chartGreen: '#7c8a5b',
    // Assombri le 01/08/2026 (CONF-07) : 2,29 / fond, sous les 3,0 exigés pour une couleur de
    // donnée (WCAG 1.4.11 — barre glucides). Échouait même au seuil abaissé.
    amber: '#b47f31', // 3,03 / fond · 3,36 / surface
    warn: '#f7ead6',
    warnBorder: '#e9cfa0',
    // Assombri le 01/08/2026 (CONF-07) : 3,19 / warn, sous les 4,5 exigés — le nom dit « text », et
    // c'en est (titre + message des bandeaux d'alerte).
    warnText: '#8a6419', // 4,52 / warn · 5,16 / surface
    panel: '#33291f',
    panelText: '#f0e4d0',
    panelMuted: '#c9b79a',
    panelAccent: '#d9a888',
    pillarHome: '#b14f2b', // 4,53 / fond · 5,0 / surface (= accent)
    // US MUSCU-UX06 (23/09/2026) — « rouge fonte », choisi par Florian sur planche comparative :
    // le bordeaux `#7c2734` « trop rose, pas adapté » est remplacé. 6,83 / surface · 6,18 / fond
    // teinté · blanc dessus 7,09. Teinte 4°, contre 16° pour l'accueil (`#b14f2b`).
    pillarStrength: '#a8261d',
    pillarRunning: '#2a64ad', // 5,18 / fond — #2f6fc0 de maquette : 4,39
    // US NUTRI-UX02 — `#52703a` (5,22 / fond, chroma 54) remplacé le 20/09/2026 : il était, comme
    // la teinte du pilier, le moins coloré des cinq accents. `#3f6b1c` monte la chroma à 79 **et**
    // le contraste à 5,86 — la couleur gagnée ne coûte rien à la lisibilité.
    pillarNutrition: '#3f6b1c', // 5,86 / fond — #52703a d'avant : 5,22 · #5c7a3f de maquette : 4,23
    pillarLab: '#7a5714', // 5,0 / fond — le doré #8a6419 tombait à 4,33
  },
  dark: {
    // US MUSCU-UX06 (23/09/2026) — « les cartes ne se détachent pas » (Florian). Mesuré : carte /
    // fond = 1,23:1, et **dans tous les piliers**, puisque la teinte d'un pilier conserve la
    // luminance. La séparation se règle donc ici, pas pilier par pilier. Deux leviers :
    //  - le **fond** descend (`#1c150e` → `#0f0a06`) : 1,23 → 1,35:1, sans toucher aux cartes ;
    //  - le **filet** des cartes monte (`#3a2e22` → `#4b3d30`) : 1,40 / carte, 1,88 / fond.
    // ⚠️ Écarté : éclaircir franchement la carte (~1,6:1). Mesuré, les accents y passent sous
    // 4,5:1 (muscu 3,9, accueil 3,8) et `borderStrong` sous 3:1 — la carte reste donc `#30271e`.
    background: '#0f0a06',
    surface: '#30271e',
    surfaceAlt: '#3a2e22',
    border: '#4b3d30',
    // Même défaut de limite de champ qu'en clair (`border` n'était qu'à 1,37 du fond) : la bordure
    // de composant est donc relevée ici aussi. Les couleurs de texte du thème sombre, elles, sont
    // inchangées — elles passaient déjà largement.
    borderStrong: '#797169', // 4,11 / fond (3,77 avant MUSCU-UX06) · 3,05 / surface
    text: '#f4ecdd',
    textMuted: '#c9b79a',
    // `accent` / `surface` = 4,45, à 0,05 du seuil 4,5 (WCAG 1.4.3) — écart ASSUMÉ (CONF-07, D2,
    // 01/08/2026) : sous le bruit de l'arrondi, et l'éclaircir rendrait `accent` sombre plus clair
    // que sa version en thème clair ; assombrir `surface` toucherait toutes les cartes. Ne pas
    // « corriger » sans revalider D2.
    accent: '#dd6e40',
    // Assombri le 01/08/2026 (CONF-07, D1) : le libellé blanc des boutons pleins n'était qu'à
    // 3,29 / accent, sous les 4,5 exigés. C'est le changement le plus visible de CONF-07 — validé
    // sur maquette avant d'être posé ici.
    accentText: '#0f0a06', // 5,98 / accent (= le fond sombre — 5,48 avec l'ancien `#1c150e`)
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
    pillarHome: '#e07a4d', // 4,94 / surface — l'accent sombre #dd6e40 n'y fait que 4,45 (D2)
    // US MUSCU-UX06 — rouge fonte : 5,21 / surface teintée · 7,06 / fond teinté. Le rose `#e07a98`
    // d'avant (teinte 342°) est écarté : « trop rose » (Florian, 23/09/2026).
    pillarStrength: '#ff6b5e', // 5,24 / surface neutre — #e07a98 : 5,16 · #6b0028 : 1,15
    pillarRunning: '#6fa8ef', // 5,94 / surface
    // US NUTRI-UX02 — `#a9ba7e` (6,98 / surface, chroma 60) remplacé le 20/09/2026. Il restait le
    // plus terne des quatre accents de pilier (course 128, labo 104, muscu 102). `#9ed16a` : chroma
    // 103 et 8,21 / surface. ⚠️ `success` et `chartGreen` gardent `#a9ba7e` — ce sont des rôles
    // sémantiques distincts, qui ne suivent pas l'identité d'un pilier.
    pillarNutrition: '#9ed16a', // 8,21 / surface — #a9ba7e d'avant : 6,98
    pillarLab: '#e0b155', // doré du socle — 8,4 / fond
  },
};
