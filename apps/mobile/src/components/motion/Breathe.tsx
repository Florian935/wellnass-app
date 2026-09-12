/**
 * Respiration de fond — une boucle si lente qu'on ne la remarque pas, mais qui empêche l'écran
 * d'avoir l'air mort.
 *
 * ── Où elle sert ────────────────────────────────────────────────────────────────────────────────
 * Le halo d'accent des **cartes héros** (« Séance du jour », « Bilan du jour », « Régularité »), et
 * rien d'autre. `AccentHalo` ne pose déjà un cercle que sur un widget sur trois, pour la raison
 * écrite dans son en-tête : *un ornement partout n'accentue plus rien*. Le faire respirer sur toutes
 * les cartes referait exactement l'erreur qu'il évitait — en mouvement cette fois.
 *
 * ── Règle R4 : la boucle s'arrête ───────────────────────────────────────────────────────────────
 * C'est la seule primitive de l'US qui tourne **indéfiniment**, donc la seule à pouvoir coûter de
 * la batterie. `useIsAppActive` annule l'animation dès que l'app passe en arrière-plan et la
 * relance au retour. Sans ça, une sortie GPS d'une heure garderait une boucle de rendu vivante
 * derrière la carte, pour un cercle que personne ne regarde.
 *
 * `cancelAnimation` remet aussi l'échelle à 1 : une boucle interrompue en plein cycle laisserait
 * sinon le halo figé à une taille arbitraire.
 */

import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { useIsAppActive } from '@/hooks/useIsAppActive';
import { BREATH_SCALE, DURATION } from '@/theme/motion';

type BreatheProps = {
  children: ReactNode;
  /** Échelle maximale. Défaut 1,07 — au-delà, le halo devient une pulsation qui attire l'œil. */
  scaleTo?: number;
  /** Durée d'un aller-retour complet. Défaut 2,4 s ; la carte héros de l'accueil monte à 6 s. */
  duration?: number;
  /**
   * Transmis à la vue animée. **Indispensable quand l'enveloppe recouvre du contenu cliquable** :
   * une `Animated.View` en `absoluteFill` par-dessus une carte avalerait tous ses appuis.
   */
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
  style?: StyleProp<ViewStyle>;
};

export function Breathe({
  children,
  scaleTo = BREATH_SCALE,
  duration = DURATION.ambient,
  pointerEvents,
  style,
}: BreatheProps) {
  const reduced = useAppReducedMotion();
  const focused = useIsAppActive();
  const scale = useSharedValue(1);

  // Boucle annulée dès que l'app passe en arrière-plan (règle R4). `useIsAppActive` plutôt que
  // `useFocusEffect` : ce dernier lève hors conteneur de navigation, ce qu'un halo décoratif n'a
  // aucune raison d'imposer à l'écran qui l'héberge. Voir l'en-tête du hook.
  useEffect(() => {
    if (reduced || !focused) {
      cancelAnimation(scale);
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withTiming(scaleTo, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
      -1,
      // `true` = aller-retour. Sans ça, le halo reviendrait sèchement à 1 à chaque cycle.
      true,
    );
    return () => {
      cancelAnimation(scale);
      scale.value = 1;
    };
  }, [duration, focused, reduced, scale, scaleTo]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View pointerEvents={pointerEvents} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
