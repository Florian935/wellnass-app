import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

/**
 * US PRISME-01 — le prisme : un triangle doré qui décompose un trait de lumière en trois rayons, aux
 * couleurs des piliers (rouge fonte, bleu course, vert nutrition). C'est la triade du Labo, en
 * petit — et l'identité de Prisme sur chaque texte qu'il signe.
 *
 * **Décoratif** : masqué aux lecteurs d'écran. Le nom « Prisme » et le badge « IA », eux, sont du texte
 * à côté (spec §12). Ses couleurs sont fixes, dans les deux thèmes : c'est un emblème posé sur sa
 * propre tuile sombre, comme les scènes de pilier (`stage.ts`).
 */
const TILE = '#1c140c';
const LIGHT = '#f4ecdd';
const GOLD = '#f2d28a';
const RAYS = ['#ff6b5e', '#6fa8ef', '#9ed16a'] as const;

export function PrismeMark({ size = 22 }: { size?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Rect width={32} height={32} rx={10} fill={TILE} />
        <Path d="M3 17 H11" stroke={LIGHT} strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
        <Path d="M10 23 L16 9 L22 23 Z" fill="none" stroke={GOLD} strokeWidth={2} strokeLinejoin="round" />
        <Path d="M20 17 L29 13.5" stroke={RAYS[0]} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M20.5 18.6 L29 18.6" stroke={RAYS[1]} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M21 20.2 L29 23.6" stroke={RAYS[2]} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
