/**
 * Conteneur animé de célébration (décoratif) — US MUSC-F8 (roadmap 3.42), repris par MOTION-01.
 *
 * ── Origine ────────────────────────────────────────────────────────────────────────────────────────
 * Extrait de `CelebrationBanner` (`apps/mobile/src/app/run/summary.tsx`), qui existait déjà côté
 * course : fondu + léger zoom, 320 ms. Son contenu (chips de distances, libellés
 * `running.records.*`) est **intégralement running** et n'a pas été extrait — seul le conteneur,
 * réutilisé pour la célébration muscu.
 *
 * ── Ce que MOTION-01 change (effet M7) ──────────────────────────────────────────────────────────
 * C'est le `prpop` de la maquette FitTrio, décrit dans `design/design-system.md` § « Animations
 * clés » et resté lettre morte depuis. Trois différences avec le fondu d'origine :
 *
 * 1. **Un ressort, pas une rampe.** 0,82 → dépassement → 1. Un record ne s'installe pas en
 *    douceur, il arrive. C'est le geste du pilier muscu (`SPRING.pop`), et c'est le seul endroit
 *    de l'app où l'on s'autorise un dépassement sur quelque chose qu'on lit.
 * 2. **Deux ondes** partent du centre, déphasées de 120 ms. Volontairement **pas des confettis** :
 *    on soulève de la fonte, on ne gagne pas à la loterie. Une onde appartient au produit.
 * 3. **Le réglage se lit par `useAppReducedMotion`**, qui combine le réglage système *et*
 *    l'interrupteur « Animations » des Réglages. Ce fichier était jusqu'ici le seul de l'app à
 *    gérer le sujet, avec son propre écouteur `AccessibilityInfo` ; cette logique vit maintenant
 *    dans le hook partagé, en version synchrone — plus d'état « pas encore su », donc plus de
 *    risque de jouer l'animation une fois de trop.
 *
 * Les deux écrans de résumé (muscu et course) en héritent **sans être modifiés**.
 *
 * ── Ce qui n'a pas changé ───────────────────────────────────────────────────────────────────────
 * L'animation reste **strictement décorative** (règle R1) : mouvement coupé, la carte s'affiche
 * directement à son état final et dit exactement la même chose. Les ondes sont masquées aux
 * lecteurs d'écran.
 */

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { DURATION, EASING, SPRING } from '@/theme/motion';

/** Décalage entre les deux ondes. Assez pour qu'on en distingue deux, pas assez pour compter. */
const WAVE_DELAY_MS = 120;

/** Diamètre de départ d'une onde. Elle grandit jusqu'à déborder de la carte, puis s'efface. */
const WAVE_SIZE = 48;

function Wave({ color, delay, reduced }: { color: string; delay: number; reduced: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    // Mouvement coupé : l'onde ne joue pas du tout. Contrairement au reste de l'US, il n'y a pas
    // d'« état final » à afficher — une onde n'est rien d'autre que son mouvement.
    if (reduced) return;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: DURATION.celebrate, easing: EASING.exit }),
    );
  }, [delay, progress, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.4 + progress.value * 6.6 }],
    opacity: progress.value === 0 ? 0 : 0.85 * (1 - progress.value),
  }));

  if (reduced) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wave, { borderColor: color }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export function CelebrationCard({
  children,
  style,
  /**
   * Couleur des ondes. Le défaut convient aux deux appelants actuels, dont la carte a un fond
   * accent ou sombre ; un fond clair demanderait une couleur explicite.
   */
  waveColor = 'rgba(255, 255, 255, 0.55)',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  waveColor?: string;
}) {
  const reduced = useAppReducedMotion();
  const entrance = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      // État final direct, sans transition : l'animation ne porte aucune information.
      entrance.value = 1;
      return;
    }
    entrance.value = withSpring(1, SPRING.pop);
  }, [entrance, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    // Part de 0,82 : `SPRING.pop` dépasse 1 en chemin, ce qui produit le « pop » sans qu'on ait à
    // enchaîner deux animations.
    transform: [{ scale: 0.82 + entrance.value * 0.18 }],
  }));

  return (
    <Animated.View style={[styles.container, style, animatedStyle]}>
      <Wave color={waveColor} delay={0} reduced={reduced} />
      <Wave color={waveColor} delay={WAVE_DELAY_MS} reduced={reduced} />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // `overflow: hidden` fait que les ondes sont **recoupées par la carte** : elles se lisent comme
  // un éclat interne, pas comme deux cercles posés par-dessus l'écran.
  container: { overflow: 'hidden' },
  wave: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -WAVE_SIZE / 2,
    width: WAVE_SIZE,
    height: WAVE_SIZE,
    borderRadius: WAVE_SIZE / 2,
    borderWidth: 2,
  },
});
