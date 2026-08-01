/**
 * US MUSC-F9 (roadmap 3.10) — cible de dépôt d'un glisser-déposer sur une grille de jours.
 * Calcul pur : le composant mesure les 7 zones (`onLayout`) et convertit la position visuelle
 * courante de la carte tirée en coordonnée absolue avant d'appeler cette fonction.
 */

/** Zone de dépôt mesurée à l'écran pour un jour (`dateKey` AAAA-MM-JJ). */
export type DropZone = {
  dateKey: string;
  /** Position verticale du haut de la zone (coordonnée du conteneur défilant, offset inclus). */
  y: number;
  height: number;
};

/**
 * Jour dont la zone contient `y`, ou `null` si `y` ne tombe dans aucune zone — au-dessus de la
 * première, en dessous de la dernière, ou aucune zone fournie. Un dépôt hors-zone n'écrit rien
 * (R6) : c'est à l'appelant de traiter `null` comme une annulation, pas une erreur.
 *
 * Les zones ne sont pas supposées triées : chacune est testée indépendamment (bornes
 * `[y, y + height)`, la borne haute exclusive évite qu'une frontière exacte matche deux zones).
 */
export function findDropTarget(y: number, zones: readonly DropZone[]): string | null {
  for (const zone of zones) {
    if (y >= zone.y && y < zone.y + zone.height) return zone.dateKey;
  }
  return null;
}
