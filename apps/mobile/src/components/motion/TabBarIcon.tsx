/**
 * Icône de la barre d'onglets, qui réagit à la prise de focus — MOTION-01, effet S7.
 *
 * ── Pourquoi ce micro-détail mérite un composant ────────────────────────────────────────────────
 * C'est l'élément le plus touché de toute l'app : quatre onglets, plusieurs dizaines de bascules
 * par séance. Jusqu'ici, le seul retour à un changement d'onglet était la **couleur** de l'icône.
 * Un changement de couleur sur un glyphe de 24 px, sous un pouce, est le retour le plus faible qui
 * existe — et c'est aussi le seul qui disparaisse complètement pour qui distingue mal les teintes.
 *
 * Un dépassement d'échelle court ajoute un second canal, perceptible en vision périphérique.
 *
 * ── Ce qu'on n'a pas fait, et pourquoi ──────────────────────────────────────────────────────────
 * La maquette prévoit aussi une **pastille colorée qui glisse** d'un onglet à l'autre (effet S6).
 * Elle demande de remplacer la barre d'onglets d'`expo-router` par une barre maison, alors que
 * celle-ci porte déjà une logique non triviale : masquage des piliers désactivés via `href: null`
 * (décision H), couleur d'accent par menu, libellés i18n. Le rapport risque / gain n'est pas le
 * même que pour l'icône, et ce n'est pas du mouvement mais de la reconstruction. Laissé de côté.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { SPRING } from '@/theme/motion';

/** Échelle de l'onglet actif. Au-delà, l'icône déborde de sa gouttière. */
const FOCUSED_SCALE = 1.14;

export function TabBarIcon({
  name,
  color,
  size,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  // `ColorValue` et non `string` : c'est le type que la barre d'onglets passe à `tabBarIcon`.
  color: ColorValue;
  size: number;
  focused: boolean;
}) {
  const reduced = useAppReducedMotion();
  const scale = useSharedValue(focused ? FOCUSED_SCALE : 1);

  useEffect(() => {
    const target = focused ? FOCUSED_SCALE : 1;
    if (reduced) {
      scale.value = target;
      return;
    }
    scale.value = withSpring(target, SPRING.pop);
  }, [focused, reduced, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    // Purement décoratif : le libellé de l'onglet et son état sélectionné restent portés par la
    // barre elle-même, donc rien à annoncer ici (règle R1).
    <Animated.View
      style={animatedStyle}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={name} color={color as string} size={size} />
    </Animated.View>
  );
}
