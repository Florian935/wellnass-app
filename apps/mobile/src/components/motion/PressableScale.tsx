/**
 * Zone pressable qui s'enfonce sous le doigt — le **niveau 0** du langage de mouvement.
 *
 * ── Le défaut qu'elle corrige ───────────────────────────────────────────────────────────────────
 * `Button` ne produisait qu'un `opacity: 0.85` à l'appui, et `Card` strictement rien. Sur un écran
 * tactile, l'opacité est le retour le plus faible qui existe : elle est invisible sous le pouce qui
 * recouvre justement l'élément pressé. D'où la sensation d'interface « en carton » — on appuie, on
 * ne sent rien, on regarde si ça a marché.
 *
 * Un enfoncement de 3 % se voit **en périphérie** de la zone couverte par le doigt, et la vibration
 * arrive là où l'œil ne va pas.
 *
 * ── Pourquoi l'haptique survit à la coupure des animations ──────────────────────────────────────
 * `reduced` supprime le mouvement visuel, pas le retour tactile : quelqu'un qui coupe les
 * animations pour cause de sensibilité vestibulaire a toujours besoin de sentir qu'il a appuyé.
 * C'est aussi ce qui permet de poser cette primitive sur « Valider la série » sans rien retirer à
 * personne.
 *
 * ── Règle R2 : l'état d'abord ───────────────────────────────────────────────────────────────────
 * `onPress` est appelé **immédiatement**, jamais à la fin de l'animation. Le geste le plus répété
 * de l'app (30 à 40 validations par séance) ne paie pas une milliseconde de décoration.
 */

import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { hapticConfirm, hapticMilestone, hapticSelect } from '@/lib/haptics';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { DURATION, PRESS_SCALE, SPRING } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Intensité du retour tactile. `none` pour une zone pressée très souvent sans enjeu (onglet). */
export type PressHaptic = 'none' | 'select' | 'confirm' | 'milestone';

const HAPTIC: Record<Exclude<PressHaptic, 'none'>, () => void> = {
  select: hapticSelect,
  confirm: hapticConfirm,
  milestone: hapticMilestone,
};

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Retour tactile à l'appui. Défaut : `select` — le plus discret des trois. */
  haptic?: PressHaptic;
  /**
   * Enfoncement maximal. Le défaut (0,97) convient à une carte ou un bouton pleine largeur ; une
   * petite cible (icône de 24 px) a besoin d'aller plus bas pour que l'effet se voie.
   */
  scaleTo?: number;
};

export function PressableScale({
  style,
  haptic = 'select',
  scaleTo = PRESS_SCALE,
  onPressIn,
  onPress,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const reduced = useAppReducedMotion();
  const scale = useSharedValue(1);

  // Fonctions simples, **pas** de `useCallback` : la regle `react-hooks/immutability` (React
  // Compiler) refuse qu'une valeur partagee Reanimated soit mutee depuis une fonction
  // memoisee. Le cout est nul ici : `Pressable` ne re-rend pas sur une identite de
  // gestionnaire.
  const handlePressIn: PressableProps['onPressIn'] = (event) => {
    // L'haptique part à l'**enfoncement**, pas au relâchement : c'est le moment où le doigt
    // touche, donc celui où le retour est attendu. Elle survit à `reduced` (voir l'en-tête).
    if (haptic !== 'none' && !disabled) HAPTIC[haptic]();
    if (!reduced) scale.value = withTiming(scaleTo, { duration: DURATION.instant });
    onPressIn?.(event);
  };

  const handlePressOut: PressableProps['onPressOut'] = () => {
    if (!reduced) scale.value = withSpring(1, SPRING.settle);
  };

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
