/**
 * Halo d'accent en coin de carte — le **cercle** de la maquette FitTrio, qui casse la monotonie
 * des grands aplats.
 *
 * Reprise fidèle du halo HTML :
 * `position:absolute; right:-40; top:-40; width:150; height:150; border-radius:50%;
 *  background:rgba(var(--acc-rgb), .22)`.
 * Le cercle **déborde** du coin et c'est l'`overflow: hidden` de la carte qui le recoupe — le
 * débord fait partie de l'effet, ne pas le rentrer dans la carte.
 *
 * > Une variante en dégradé radial (react-native-svg) a été essayée le 30/07/2026 pour adoucir
 * > l'arête ; arbitrage de Damien après comparaison sur device : **on garde le cercle de la
 * > maquette**. Ne pas « corriger » ce bord net, il est voulu.
 *
 * **Le coin et la taille changent d'un widget à l'autre.** À géométrie identique partout, le
 * cercle se répétait au même endroit sur chaque carte d'un même écran : le halo redevenait un
 * motif de fond régulier, soit exactement la monotonie qu'il est censé casser.
 *
 * La géométrie est donc tirée d'un **hachage de l'identité du widget** (`useWidgetIdentity`,
 * fourni par les grilles). Deux propriétés comptent :
 *
 * - **déterministe** — un widget garde son coin d'un rendu à l'autre, d'un lancement à
 *   l'autre ; rien ne « saute » au re-render ni après un redémarrage ;
 * - **stable au réagencement** — la clé est l'id du widget, pas sa position dans la grille :
 *   déplacer une carte emporte son halo avec elle.
 *
 * Hors grille (carte héros d'un écran, ex. « Bilan du jour »), il n'y a pas d'identité : on
 * retombe sur la géométrie du **module actif** ({@link MENU_HALO}), pour que chaque pilier
 * garde malgré tout sa signature.
 *
 * Purement décoratif → `pointerEvents="none"` et aucun rôle d'accessibilité : les lecteurs
 * d'écran ne doivent pas l'annoncer.
 *
 * La carte porteuse doit avoir `overflow: 'hidden'` (sinon le cercle déborde par-dessus ses
 * voisines) et poser le halo **en premier enfant**, pour qu'il passe derrière le contenu.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useWidgetIdentity } from '@/components/widgets/widget-identity';
import { useMenuAccent, type MenuKey } from '@/stores/menu-accent-store';
import { useTheme } from '@/theme/useTheme';

/** Coin d'ancrage du cercle. */
export type HaloCorner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

/** Les 4 coins, dans l'ordre où le hachage les distribue. */
const CORNERS: readonly HaloCorner[] = ['top-right', 'bottom-right', 'bottom-left', 'top-left'];

/** Facteurs de diamètre. Volontairement resserrés : au-delà, le cercle devient une tache. */
const SCALES: readonly number[] = [0.85, 1, 1.15, 1.3];

/**
 * Hachage FNV-1a 32 bits — court, sans dépendance, et surtout **stable** : c'est ce qui
 * garantit qu'un widget retrouve le même coin à chaque lancement de l'app.
 */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Géométrie tirée de l'identité d'un widget. Coin et taille sont tirés de **deux tranches
 * différentes** du hachage : sinon les deux varieraient ensemble et on n'obtiendrait que
 * 4 combinaisons au lieu de 16.
 */
export function geometryFromId(id: string): { corner: HaloCorner; scale: number } {
  const h = hash(id);
  return {
    corner: CORNERS[h % CORNERS.length]!,
    scale: SCALES[(h >>> 8) % SCALES.length]!,
  };
}

/** Un widget sur `HALO_RATIO` porte un halo. */
const HALO_RATIO = 3;

/**
 * Le widget porte-t-il un halo ? **Non, pour la plupart.**
 *
 * Un cercle sur *chaque* carte n'accentue plus rien : l'ornement devient la norme, et l'œil
 * cesse de le voir — c'est de la monotonie décorée. En n'en posant qu'environ un sur trois,
 * les cartes qui en portent ressortent vraiment et l'écran garde une respiration.
 *
 * Tiré d'une **troisième tranche** du hachage, indépendante du coin et de la taille : sinon
 * la présence serait corrélée à la géométrie (p. ex. « tous les halos sont en bas-gauche »).
 * Déterministe et stable comme le reste — un widget qui n'a pas de halo n'en aura jamais,
 * et n'en gagnera pas au prochain rendu.
 */
export function hasHaloFor(id: string): boolean {
  return (hash(id) >>> 16) % HALO_RATIO === 0;
}

/**
 * Repli **hors grille** : géométrie par pilier, pour les cartes héros qui n'ont pas d'identité
 * de widget. `nutrition` reste sur le haut-droit de la maquette — c'est la carte « Bilan du
 * jour », dessinée avec ce cercle-là.
 */
export const MENU_HALO: Record<MenuKey, { corner: HaloCorner; scale: number }> = {
  home: { corner: 'top-right', scale: 1 },
  strength: { corner: 'bottom-right', scale: 1.15 },
  running: { corner: 'bottom-left', scale: 1.3 },
  nutrition: { corner: 'top-right', scale: 1 },
};

export function AccentHalo({
  /** Diamètre de base, avant le facteur du module. 150 sur une carte pleine largeur. */
  size = 150,
  /** Couleur du reflet. Défaut : l'accent (donc déjà la couleur du menu actif). */
  color,
  /** Opacité du cercle. Valeur de la maquette : .22. */
  opacity = 0.22,
  /** Force un coin, au lieu de le dériver. */
  corner,
  /**
   * Identité à hacher, au lieu de celle fournie par la grille. Utile pour une carte hors
   * grille qui veut malgré tout sa propre géométrie, et pour les tests.
   */
  seed,
  /** Force le module dont on emprunte la géométrie de repli (tests, écrans hors navigation). */
  menu,
  style,
}: {
  size?: number;
  color?: string;
  opacity?: number;
  corner?: HaloCorner;
  seed?: string;
  menu?: MenuKey;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const activeMenu = useMenuAccent((s) => s.activeMenu);
  const widgetId = useWidgetIdentity();

  const identity = seed ?? widgetId;

  // Dans une grille, seuls quelques widgets portent un halo (voir `hasHaloFor`). Le filtre est
  // ici plutôt que chez l'appelant pour que la règle « lesquels, où, quelle taille » tienne en
  // un seul endroit. Hors grille (carte héros d'un écran), il n'y a rien à espacer : le halo
  // est toujours rendu.
  if (identity != null && !hasHaloFor(identity)) return null;

  const geometry = identity != null ? geometryFromId(identity) : MENU_HALO[menu ?? activeMenu];

  const diameter = Math.round(size * geometry.scale);
  // Débord d'un quart du diamètre, comme la maquette (150 → −40, soit ~27 %).
  const bleed = -Math.round(diameter / 4);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.halo,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: color ?? colors.accent,
          opacity,
        },
        cornerStyle(corner ?? geometry.corner, bleed),
        style,
      ]}
    />
  );
}

/** Positionne le cercle sur le coin demandé, avec le même débord des deux côtés. */
function cornerStyle(corner: HaloCorner, bleed: number): ViewStyle {
  switch (corner) {
    case 'top-left':
      return { top: bleed, left: bleed };
    case 'bottom-right':
      return { bottom: bleed, right: bleed };
    case 'bottom-left':
      return { bottom: bleed, left: bleed };
    case 'top-right':
    default:
      return { top: bleed, right: bleed };
  }
}

const styles = StyleSheet.create({
  halo: { position: 'absolute' },
});
