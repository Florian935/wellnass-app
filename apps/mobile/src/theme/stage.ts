/**
 * US DASH-01 — les couleurs des scènes (spec §3).
 *
 * Une scène n'est pas une carte : c'est une surface pleine largeur, en couleur, sous la barre d'état.
 * Ses couleurs sont donc **propres au pilier** et **indépendantes du thème** : le rouge fonte, le bleu
 * nuit, le vert profond et, depuis ACCUEIL-07, la nuit d'Aurore sont déjà sombres — un thème sombre
 * n'a rien à y changer. (L'accueil restait en clair jusqu'au 25/10/2026 ; voir `HOME`.)
 *
 * ── Le contrat de lisibilité ──────────────────────────────────────────────────────────────────────
 * `surfaces` liste **toutes** les teintes qu'un texte peut traverser : les arrêts du dégradé, et en
 * nutrition le niveau qui monte sous le texte. `__tests__/stage.test.ts` mesure chaque encre contre
 * chacune. Les teintes de maquette y échouaient (libellé course 2,9:1, libellé nutrition 3,9:1) ; les
 * valeurs ci-dessous sont celles qui passent, teintes conservées.
 */

import type { ColorScheme } from './colors';

export const STAGE_KEYS = ['home', 'strength', 'running', 'nutrition', 'lab', 'wellbeing'] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export type StageTheme = {
  /** Du haut vers le bas de la scène. */
  gradient: readonly [string, string, ...string[]];
  /** Toutes les teintes qu'un texte de la scène peut recouvrir. */
  surfaces: readonly string[];
  ink: string;
  inkMuted: string;
  /** Pastilles et encarts translucides posés sur la scène. */
  glass: string;
  glassBorder: string;
  /** Bouton plein principal de la scène. */
  solid: string;
  onSolid: string;
  /**
   * US ACCUEIL-07 — le bouton plein en dégradé (Aurore : turquoise → rose). `solid` reste la couleur
   * de repli (et celle qu'un test mesure) ; `onSolid` est mesuré contre **chaque** arrêt.
   */
  solidGradient?: readonly [string, string];
  /**
   * Surfaces translucides (`glass`) posées sur la scène, déjà mêlées au fond : seul le texte
   * principal (`ink`) y est posé — libellés des pastilles du check-in, chiffres des cadrans.
   */
  glassSurfaces?: readonly string[];
  /** Couleur de la matière (halo, comète, tiges, onde). Jamais porteuse de texte. */
  accent: string;
  /** Nutrition : dégradé du niveau et trait de la ligne d'eau. */
  fill?: readonly [string, string];
  wave?: string;
};

const GLASS_ON_DARK = 'rgba(255,255,255,0.12)';
const GLASS_BORDER_ON_DARK = 'rgba(255,255,255,0.22)';

/**
 * ── Le bordeaux adouci, 19/09/2026 ───────────────────────────────────────────────────────────────
 * Retour de Florian en recette : « pas très smooth, pas très sexy ». Le défaut était mesurable, pas
 * une affaire de goût — les trois arrêts d'origine (`#6b0028 → #440019 → #2d0011`) étaient à
 * **100 % de saturation** (canal vert à zéro sur les trois), et la clarté tombait de 21 % à 9 %.
 * Une teinte pleinement saturée qui plonge vers le noir se lit comme du néon, pas comme du vin.
 *
 * Trois corrections, dans cet ordre d'importance :
 *  1. **Désaturer** (100 % → 52-57 %) : c'est ce qui enlève l'arête dure.
 *  2. **Réchauffer le départ** (337° → 351°) : un vrai bordeaux tire sur le rouge profond, pas sur
 *     le magenta.
 *  3. **Faire dériver la teinte** de 22° vers la prune en descendant (351° → 329°), et remonter le
 *     plancher de clarté (9 % → 13 %) : le dégradé devient un balayage au lieu d'une chute.
 *
 * Écarté : une variante plus chaude encore (352°, 52 %) se rapprochait trop du terracotta de
 * l'Accueil — deux piliers ne doivent pas se confondre d'un coup d'œil.
 */
/**
 * ── Le rouge fonte, 23/09/2026 (US MUSCU-UX06) ───────────────────────────────────────────────────
 * Le bordeaux adouci ci-dessus n'a pas tenu : « trop rose », « le bordeaux n'est pas adapté »
 * (Florian). Quatre directions ont été posées côte à côte sur les vrais écrans (hub, séance
 * classique, immersif, repos, en sombre et en clair) : rouge fonte, graphite + rouge, prune,
 * acier + corail. **Florian a retenu le rouge fonte.**
 *
 * Même grammaire que le bordeaux — un dégradé qui descend vers le presque-noir — mais sur un rouge
 * franc (0-5°) au lieu d'un rouge qui dérive vers la prune (351° → 329°) : c'est la dérive vers le
 * magenta qui faisait lire « rose ». Encres mesurées par `__tests__/stage.test.ts` sur les trois
 * arrêts : `inkMuted` 5,88:1 au pire (haut de scène), blanc 9,04:1.
 */
const STRENGTH: StageTheme = {
  gradient: ['#8e1b1b', '#5f1512', '#2b0d0b'],
  surfaces: ['#8e1b1b', '#5f1512', '#2b0d0b'],
  ink: '#ffffff',
  inkMuted: '#f6c5bf',
  glass: GLASS_ON_DARK,
  glassBorder: GLASS_BORDER_ON_DARK,
  solid: '#ffffff',
  onSolid: '#8e1b1b',
  // La matière (halo de la silhouette) : un rouge clair, jamais porteur de texte.
  accent: '#ff9a8f',
};

const RUNNING: StageTheme = {
  // #2f6fc0 de maquette assombri en tête de dégradé : le libellé clair y tombait à 2,9:1.
  gradient: ['#2a64ad', '#1d4586', '#0f2547'],
  surfaces: ['#2a64ad', '#1d4586', '#0f2547'],
  ink: '#ffffff',
  inkMuted: '#d6e6fa',
  glass: GLASS_ON_DARK,
  glassBorder: GLASS_BORDER_ON_DARK,
  solid: '#ffffff',
  onSolid: '#1d4586',
  accent: '#b7d6ff',
};

/**
 * ── US NUTRI-UX02, 20/09/2026 — la scène suit le pilier ──────────────────────────────────────────
 * Cinq valeurs reteintées en même temps que `TINT.nutrition`. Sans ça, le défaut que Florian avait
 * signalé sur la course se serait produit **à l'envers** : les cartes du corps seraient devenues
 * plus vertes que la scène qui les annonce.
 *
 * Toutes gagnent de la chroma à luminance quasi constante, donc le contrat de `stage.test.ts` tient,
 * et il le vérifie encre par encre :
 *
 * | rôle        | avant     | chroma | après     | chroma | `inkMuted` après |
 * |-------------|-----------|--------|-----------|--------|------------------|
 * | fond        | `#22301a` | 22     | `#1f3110` | 33     | 11,29            |
 * | niveau haut | `#4a6c2e` | 62     | `#456f22` | 77     | 4,78             |
 * | niveau bas  | `#3a5622` | 52     | `#365f19` | 70     | 6,05             |
 * | onde        | `#a9ba7e` | 60     | `#9ed16a` | 103    | — (sans texte)   |
 * | `onSolid`   | `#2e4419` | 43     | `#2f6b12` | 89     | 6,50 sur blanc   |
 *
 * ⚠️ Écarté : `#4a7c22` (chroma 90) pour le haut du niveau. Il passait le seuil pour `ink` mais
 * faisait tomber `inkMuted` à **4,05** — sous les 4,5. C'est la borne réelle de ce dégradé : le
 * texte secondaire est posé *sur* le niveau qui monte, et c'est lui qui plafonne la saturation.
 */
const NUTRITION: StageTheme = {
  gradient: ['#1f3110', '#1f3110'],
  // Le niveau monte sous le texte : ses deux teintes font partie des surfaces.
  surfaces: ['#1f3110', '#456f22', '#365f19'],
  ink: '#ffffff',
  inkMuted: '#e1ebcf',
  glass: 'rgba(255,255,255,0.14)',
  glassBorder: 'rgba(255,255,255,0.24)',
  solid: '#ffffff',
  onSolid: '#2f6b12',
  accent: '#e8f0d6',
  fill: ['#456f22', '#365f19'],
  wave: '#9ed16a',
};

/**
 * ── US ACCUEIL-07 — la teinte Aurore (décision D1 de Florian, 25/10/2026) ─────────────────────────
 * L'accueil était la seule scène claire : crème et terracotta en clair, brun et orange en sombre —
 * c'est-à-dire la couleur de marque de toute l'app, d'où l'effet « fade » à côté du rouge, du bleu et
 * du vert des piliers. Aurore prend les deux trous de la roue des teintes (muscu 3°, marque 17°,
 * Labo 40°, nutrition 90°, course 213°, bien-être 265°) : une **lueur turquoise** (~172°) en haut à
 * gauche et une **lueur framboise** (~330°) en haut à droite, sur une nuit bleutée. Sombre dans les
 * deux thèmes, comme les autres scènes. Le terracotta ne reste que la couleur de marque.
 *
 * Les lueurs sont la **matière** de la scène (`AuroraGlows`) : deux dégradés radiaux, dont le dosage
 * suit le moment de la journée (`AURORA_DOSES`). Elles passent **sous le texte** — d'où les surfaces
 * mêlées ci-dessous, que `__tests__/stage.test.ts` mesure encre par encre.
 *
 * ⚠️ **La lueur turquoise est plafonnée à 0,38** (`AURORA_TURQUOISE_CAP`). Mesuré : au-delà, le texte
 * secondaire posé dessus (la date, en haut à gauche) passe sous 4,5:1. La framboise, plus sombre une
 * fois mêlée, monte jusqu'à 0,52.
 */
export const AURORA_BASE = ['#13203a', '#0a0e1c'] as const;
export const AURORA_TURQUOISE = [45, 212, 191] as const;
export const AURORA_FRAMBOISE = [236, 72, 153] as const;
export const AURORA_TURQUOISE_CAP = 0.38;

/** Les cinq lumières d'une journée, du lever au coucher. */
export const AURORA_MOMENTS = ['aube', 'jour', 'dore', 'soir', 'nuit'] as const;
export type AuroraMoment = (typeof AURORA_MOMENTS)[number];

/** Dosage `[turquoise, framboise]` de chaque lumière : turquoise le matin, framboise le soir. */
export const AURORA_DOSES: Readonly<Record<AuroraMoment, readonly [number, number]>> = {
  aube: [0.38, 0.2],
  jour: [0.36, 0.34],
  dore: [0.3, 0.46],
  soir: [0.24, 0.52],
  nuit: [0.14, 0.16],
};

/** `rgb` posé à `alpha` sur `hex` — la couleur qu'on voit vraiment sous le texte. */
export function blendOver(hex: string, rgb: readonly [number, number, number], alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const base = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const out = base.map((c, i) => Math.round(c + (rgb[i]! - c) * alpha));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const maxDose = (i: 0 | 1) => Math.max(...AURORA_MOMENTS.map((m) => AURORA_DOSES[m][i]));
const AURORA_TOP = AURORA_BASE[0];
const WHITE = [255, 255, 255] as const;
const AURORA_GLASS_ALPHA = 0.09;

/**
 * Les teintes que le texte peut traverser : les deux arrêts du fond, puis le haut du fond sous chaque
 * lueur **à son dosage le plus fort**, puis la zone où les deux lueurs se croisent. Les deux disques
 * ne se recouvrent qu'à leur périphérie (le turquoise s'éteint à ~66 % de la largeur, la framboise
 * commence à ~56 %) : à cet endroit, chacun est au plus à la moitié de son dosage.
 */
const AURORA_SURFACES = [
  AURORA_BASE[0],
  AURORA_BASE[1],
  blendOver(AURORA_TOP, AURORA_TURQUOISE, maxDose(0)),
  blendOver(AURORA_TOP, AURORA_FRAMBOISE, maxDose(1)),
  blendOver(blendOver(AURORA_TOP, AURORA_TURQUOISE, maxDose(0) / 2), AURORA_FRAMBOISE, maxDose(1) / 2),
];

const HOME: StageTheme = {
  gradient: AURORA_BASE,
  surfaces: AURORA_SURFACES,
  ink: '#ffffff',
  inkMuted: '#dbe3f7',
  glass: `rgba(255,255,255,${AURORA_GLASS_ALPHA})`,
  glassBorder: 'rgba(255,255,255,0.16)',
  solid: '#5eead4',
  onSolid: '#151024',
  solidGradient: ['#5eead4', '#f9a8d4'],
  // Le verre posé là où les lueurs sont les plus fortes : c'est le pire cas des pastilles.
  glassSurfaces: AURORA_SURFACES.map((s) => blendOver(s, WHITE, AURORA_GLASS_ALPHA)),
  accent: '#5eead4',
};

/**
 * US LABO-01 — la scène du Labo : les trois piliers dans la même image, sur le fond nocturne de
 * l'app. Sombre dans les deux thèmes, comme les scènes de pilier : la 3D y est posée dessus.
 */
// Haut = la musculation, bas = la course. Le haut suit le rouge fonte (MUSCU-UX06 : `#3a0f22`,
// un prune, → `#3b0f0c`) et le milieu le fond abaissé (`#1c150e` → `#0f0a06`).
const LAB: StageTheme = {
  gradient: ['#3b0f0c', '#0f0a06', '#10233f'],
  surfaces: ['#3b0f0c', '#0f0a06', '#10233f'],
  ink: '#ffffff',
  inkMuted: '#e6d8c4',
  glass: GLASS_ON_DARK,
  glassBorder: GLASS_BORDER_ON_DARK,
  solid: '#ffffff',
  onSolid: '#1c150e',
  accent: '#f2d28a',
};

/**
 * US BIEN-02 — la scène du pilier Bien-être : un violet qui descend vers la nuit. Sombre dans les deux
 * thèmes, comme les autres piliers. Encres mesurées par `__tests__/stage.test.ts` : `inkMuted` 6,4:1 au
 * pire (haut de scène), blanc 8,7:1.
 */
const WELLBEING: StageTheme = {
  gradient: ['#5a33a0', '#3f2178', '#1c1033'],
  surfaces: ['#5a33a0', '#3f2178', '#1c1033'],
  ink: '#ffffff',
  inkMuted: '#e4d9fb',
  glass: GLASS_ON_DARK,
  glassBorder: GLASS_BORDER_ON_DARK,
  solid: '#ffffff',
  onSolid: '#3f2178',
  accent: '#cdb8ff',
};

export function stageTheme(key: StageKey, _scheme: ColorScheme): StageTheme {
  switch (key) {
    case 'strength':
      return STRENGTH;
    case 'running':
      return RUNNING;
    case 'nutrition':
      return NUTRITION;
    case 'lab':
      return LAB;
    case 'wellbeing':
      return WELLBEING;
    case 'home':
      // Sombre dans les deux thèmes depuis ACCUEIL-07, comme les autres scènes.
      return HOME;
  }
}

/** La lumière d'Aurore pour une heure locale (décimale admise). */
export function auroraMoment(hour: number): AuroraMoment {
  if (!Number.isFinite(hour)) return 'jour';
  if (hour < 5.5) return 'nuit';
  if (hour < 9) return 'aube';
  if (hour < 17) return 'jour';
  if (hour < 19.5) return 'dore';
  if (hour < 22) return 'soir';
  return 'nuit';
}
