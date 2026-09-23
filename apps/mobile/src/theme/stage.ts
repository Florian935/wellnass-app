/**
 * US DASH-01 — les couleurs des scènes (spec §3).
 *
 * Une scène n'est pas une carte : c'est une surface pleine largeur, en couleur, sous la barre d'état.
 * Ses couleurs sont donc **propres au pilier** et, pour les trois piliers, **indépendantes du thème** :
 * le bordeaux, le bleu nuit et le vert profond sont déjà sombres, un thème sombre n'a rien à y changer.
 * Seul l'accueil, qui reste en clair (« le souffle »), a une variante sombre.
 *
 * ── Le contrat de lisibilité ──────────────────────────────────────────────────────────────────────
 * `surfaces` liste **toutes** les teintes qu'un texte peut traverser : les arrêts du dégradé, et en
 * nutrition le niveau qui monte sous le texte. `__tests__/stage.test.ts` mesure chaque encre contre
 * chacune. Les teintes de maquette y échouaient (libellé course 2,9:1, libellé nutrition 3,9:1) ; les
 * valeurs ci-dessous sont celles qui passent, teintes conservées.
 */

import type { ColorScheme } from './colors';

export const STAGE_KEYS = ['home', 'strength', 'running', 'nutrition', 'lab'] as const;
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

const HOME_LIGHT: StageTheme = {
  gradient: ['#fff6e8', '#efc39c'],
  surfaces: ['#fff6e8', '#efc39c'],
  ink: '#33291f',
  // Le textMuted de la palette (#786a59) ne fait que 3,2:1 sur le bas du dégradé.
  inkMuted: '#5e5244',
  glass: 'rgba(255,250,242,0.72)',
  glassBorder: 'rgba(255,255,255,0.8)',
  solid: '#b14f2b',
  onSolid: '#ffffff',
  accent: 'rgba(192,86,47,0.26)',
};

// Le bas du dégradé est le fond sombre de la palette : c'est lui qui coule sous la page. Suit le
// fond abaissé par MUSCU-UX06 (`#1c150e` → `#0f0a06`), sans quoi une bande plus claire apparaît.
const HOME_DARK: StageTheme = {
  gradient: ['#45331f', '#0f0a06'],
  surfaces: ['#45331f', '#0f0a06'],
  ink: '#f4ecdd',
  inkMuted: '#c9b79a',
  glass: 'rgba(48,39,30,0.72)',
  glassBorder: 'rgba(244,236,221,0.12)',
  solid: '#dd6e40',
  onSolid: '#1c150e',
  accent: 'rgba(221,110,64,0.28)',
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

export function stageTheme(key: StageKey, scheme: ColorScheme): StageTheme {
  switch (key) {
    case 'strength':
      return STRENGTH;
    case 'running':
      return RUNNING;
    case 'nutrition':
      return NUTRITION;
    case 'lab':
      return LAB;
    case 'home':
      return scheme === 'dark' ? HOME_DARK : HOME_LIGHT;
  }
}
