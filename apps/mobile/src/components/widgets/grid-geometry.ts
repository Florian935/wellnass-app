/**
 * Géométrie pixel de la grille de widgets — **source unique** (US ACCUEIL-04).
 *
 * Elle vivait en double : `cellRect` dans `WidgetGrid` pour l'affichage, `rectOf` dans
 * `SortableWidgetGrid` pour l'édition. Deux formules identiques, donc deux formules à corriger —
 * et la bascule en demi-cases de ACCUEIL-04 est exactement le genre de changement qui n'en aurait
 * corrigé qu'une, avec pour symptôme des widgets qui sautent au moment du glisser-déposer.
 *
 * ── La demi-case ────────────────────────────────────────────────────────────────────────────────
 * `sizeSpan` compte désormais les hauteurs en **demi-cases** (`row` 2×1, `small` 1×2, `wide` 2×2,
 * `large` 2×4). Une ligne de grille vaut donc la moitié d'une colonne, gouttière déduite :
 *
 *     cellH = (colW - gap) / 2
 *
 * C'est cette soustraction qui fait que **deux `row` empilées pavent exactement un `wide`** :
 * 2 × cellH + gap = colW. Avec `colW / 2`, chaque paire de lignes dériverait d'une demi-gouttière
 * et la grille cesserait d'être alignée en bas de page.
 *
 * ── Deux pas différents ─────────────────────────────────────────────────────────────────────────
 * Les cellules n'étant plus carrées, la conversion pixel → case a un pas **horizontal** et un pas
 * **vertical** distincts. L'ancien `step = colW + gap` unique, appliqué aux deux axes, viserait
 * désormais une ligne sur deux pendant un drag.
 */

import { sizeSpan, type WidgetLayoutEntry } from '@wellness/shared';

/** Rectangle pixel d'une cellule. */
export type CellRect = { left: number; top: number; width: number; height: number };

/**
 * Hauteur d'une ligne de grille (une demi-case), en px.
 *
 * Bornée à 0 : `colW` vaut 0 au premier rendu, avant que `onLayout` n'ait mesuré la largeur, et
 * une hauteur négative produirait des styles invalides que React Native signale en avertissement.
 */
export function rowHeight(colW: number, gap: number): number {
  return Math.max(0, (colW - gap) / 2);
}

/** Pas horizontal (colonne suivante), en px. */
export function stepX(colW: number, gap: number): number {
  return colW + gap;
}

/** Pas vertical (ligne suivante = demi-case), en px. */
export function stepY(colW: number, gap: number): number {
  return rowHeight(colW, gap) + gap;
}

/** Rectangle pixel d'une entrée (position en grille + empreinte). */
export function cellRect(entry: WidgetLayoutEntry, colW: number, gap: number): CellRect {
  const { w, h } = sizeSpan(entry.size);
  const cellH = rowHeight(colW, gap);
  return {
    left: entry.col * stepX(colW, gap),
    top: entry.row * stepY(colW, gap),
    width: w * colW + (w - 1) * gap,
    height: h * cellH + (h - 1) * gap,
  };
}

/**
 * Hauteur totale occupée par un ensemble d'entrées, en px.
 *
 * Prend le **bas le plus bas** plutôt que `gridRowCount × stepY` : les deux coïncident quand la
 * grille est compactée, mais pas quand elle ne l'est pas (prévisualisation de drag), et une
 * hauteur sous-estimée rognerait le widget en cours de déplacement.
 */
export function gridHeight(entries: readonly WidgetLayoutEntry[], colW: number, gap: number): number {
  let bottom = 0;
  for (const e of entries) {
    const r = cellRect(e, colW, gap);
    bottom = Math.max(bottom, r.top + r.height);
  }
  return bottom;
}
