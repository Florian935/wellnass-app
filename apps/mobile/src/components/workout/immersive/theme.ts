/**
 * Palette et jetons du **mode séance immersif** (US MUSCU-UX03, spec §4.1).
 *
 * ── Pourquoi une palette figée ──────────────────────────────────────────────────────────────────
 * La séance immersive est **sombre quel que soit le thème de l'app** : c'est ce qui fait « mode »,
 * comme une salle qu'on éclaire autrement. Rien à détourner dans `useTheme` pour autant — tous les
 * composants de séance reçoivent déjà leurs couleurs en **prop** (`colors: Palette`), il suffit donc
 * de leur passer la palette sombre.
 *
 * ── Sombre, mais **aux couleurs du pilier** (MUSCU-FIX02, recette du 23/09/2026) ─────────────────
 * Elle valait `palettes.dark` : le brun et le terracotta **neutres**, d'avant l'identité des piliers
 * (MUSCU-UX04, 19/09/2026). Basculer du classique — bordeaux, accent rose — vers l'immersif faisait
 * donc changer d'app : « ça revient sur du noir et du orange, alors que le pilier muscu est
 * bordeaux rosé » (Florian). C'est désormais la palette **sombre du pilier muscu** : mêmes
 * surfaces teintées à luminance constante, même accent, déjà vérifiés par le test de contraste.
 *
 * **Conséquence assumée** (spec §4.1) : la surcharge « Couleurs des menus » ne s'applique pas ici.
 * L'accent de la séance reste celui du pilier, pour que le geste de validation ait la même couleur
 * pour tout le monde.
 */

import type { Palette } from '@/theme/colors';
import { pillarPalette } from '@/theme/pillar';

/** La palette de la séance immersive : le pilier muscu, en sombre, sans condition. */
export const immersivePalette: Palette = pillarPalette('dark', 'strength');

/**
 * Échelle de chaleur du corps (spec §5.11), de l'éteint à l'or. Cinq valeurs interpolées —
 * l'interpolation elle-même vit dans `heatColor` pour rester testable à l'œil sur la maquette.
 */
// Le deuxième palier suit la teinte du pilier (rouge fonte depuis MUSCU-UX06, bordeaux avant).
export const HEAT_SCALE = ['#30271e', '#8e1b1b', '#b14f2b', '#dd6e40', '#e0b155'] as const;

/** Couleur d'un muscle pour une chaleur 0 → 1. Interpolation linéaire entre les cinq paliers. */
export function heatColor(value: number): string {
  const clamped = Math.max(0, Math.min(1, value));
  const steps = HEAT_SCALE.length - 1;
  const position = clamped * steps;
  const index = Math.min(steps - 1, Math.floor(position));
  const ratio = position - index;

  const from = hexToRgb(HEAT_SCALE[index] ?? HEAT_SCALE[0]);
  const to = hexToRgb(HEAT_SCALE[index + 1] ?? HEAT_SCALE[HEAT_SCALE.length - 1] ?? HEAT_SCALE[0]);
  const mix = from.map((channel, i) => Math.round(channel + ((to[i] ?? channel) - channel) * ratio));
  return `rgb(${mix.join(', ')})`;
}

function hexToRgb(hex: string): number[] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
}

/** Ambre des records et de l'enjeu — la seule couleur qui n'appartient pas à la palette de l'app. */
export const RECORD_AMBER = '#e0b155';
/** Fond des cartes de record : la teinte du pilier muscu (rouge fonte depuis MUSCU-UX06). */
export const RECORD_BG = '#8e1b1b';
