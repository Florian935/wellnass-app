/**
 * Entrée en cascade — les cartes d'un écran arrivent **décalées**, pas toutes en même temps.
 *
 * ── Ce que ça change ────────────────────────────────────────────────────────────────────────────
 * Un écran dont tout apparaît à la même frame se reçoit comme un mur : l'œil n'a aucun ordre de
 * lecture et doit en construire un. Quarante millisecondes d'écart suffisent à ce qu'il suive une
 * composition — sans que personne ne puisse dire qu'il a vu une animation.
 *
 * ── Le plafond est la partie importante ─────────────────────────────────────────────────────────
 * `STAGGER_MAX` borne le rang décalé à six. Sans lui, la grille de l'accueil (jusqu'à huit widgets)
 * ferait arriver le dernier 320 ms après le premier : à ce stade le décalage n'est plus une
 * élégance, c'est une latence, et elle tombe au moment précis du premier contact du matin.
 *
 * ── Au montage seulement ────────────────────────────────────────────────────────────────────────
 * L'animation ne joue qu'à la **construction** du composant. Revenir d'une sous-page ne rejoue rien :
 * une cascade qu'on subit à chaque retour arrière devient une taxe sur la navigation.
 */

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { DURATION, staggerDelay } from '@/theme/motion';

/** Décalage vertical de départ. Assez pour suggérer une arrivée, pas assez pour être un glissement. */
const OFFSET_Y = 12;

type StaggerInProps = {
  children: ReactNode;
  /** Rang dans la cascade. Le retard vaut `min(index, 5) × 40 ms`. */
  index?: number;
  style?: StyleProp<ViewStyle>;
};

export function StaggerIn({ children, index = 0, style }: StaggerInProps) {
  const reduced = useAppReducedMotion();

  if (reduced) {
    // État final immédiat, sans transition — et surtout sans `entering`, qui rejouerait malgré tout.
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      style={style}
      // `FadeInDown` plutôt que `FadeIn` : c'est le seul des deux qui anime **aussi** la
      // translation. Son décalage par défaut (25 px) est trop ample pour une grille de cartes —
      // à cette distance on voit un glissement, pas une arrivée — d'où les 12 px imposés ici.
      entering={FadeInDown.duration(DURATION.base)
        .delay(staggerDelay(index))
        .withInitialValues({ transform: [{ translateY: OFFSET_Y }] })}
    >
      {children}
    </Animated.View>
  );
}
