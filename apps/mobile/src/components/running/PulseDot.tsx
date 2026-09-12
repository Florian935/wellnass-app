/**
 * Le halo qui se propage autour de la position GPS — MOTION-01, effet C1 (`pulsedot`).
 *
 * ── Une animation validée en 2026 et jamais écrite ──────────────────────────────────────────────
 * `design/design-system.md` § « Animations clés » nomme `pulsedot` depuis la maquette d'origine.
 * Elle n'a jamais existé dans le code. Ce fichier la livre.
 *
 * ── Pourquoi une surcouche, et pas le calque MapLibre ───────────────────────────────────────────
 * Le marqueur de position est un `Layer` de type `circle` : ses propriétés de peinture
 * (`circle-radius`, `circle-opacity`) sont du **style de carte**, pas des vues React Native.
 * Reanimated ne peut pas les piloter, et les animer depuis le JS demanderait un `setState` par
 * image — exactement ce que la règle R3 interdit, sur l'écran qui tourne le plus longtemps de
 * toute l'app.
 *
 * D'où l'astuce : **en mode suivi, la caméra est centrée sur le dernier point**. La position à
 * l'écran est donc connue sans calcul — c'est le centre du conteneur — et un halo posé par-dessus
 * la carte coïncide avec le marqueur. Aucun pont avec MapLibre, aucune reprojection.
 *
 * ⚠️ C'est aussi pourquoi ce composant **ne sert qu'en mode suivi**. En mode résumé, la caméra
 * cadre les bornes du tracé et le dernier point n'est plus au centre : le halo tomberait à côté.
 *
 * ── Règle R4 : la boucle s'arrête ───────────────────────────────────────────────────────────────
 * C'est la boucle la plus coûteuse de l'US — elle tourne pendant toute une sortie, parfois une
 * heure. `useIsAppActive` l'annule dès que l'app passe en arrière-plan (voir l'en-tête du hook :
 * `useFocusEffect` a été écarté parce qu'il lève hors conteneur de navigation).
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { useIsAppActive } from '@/hooks/useIsAppActive';

/** Durée d'une propagation complète. Assez lent pour être une respiration, pas un clignotement. */
const PULSE_MS = 2000;

/** Diamètre du halo au repos, avant propagation. Celui du marqueur MapLibre (rayon 7 + bord 2). */
const DOT_SIZE = 18;

/** Facteur d'expansion. Au-delà, le halo couvre une portion de carte qu'on veut voir. */
const MAX_SCALE = 5.5;

function Ring({
  color,
  delay,
  reduced,
  focused,
}: {
  color: string;
  delay: number;
  reduced: boolean;
  focused: boolean;
}) {
  const progress = useSharedValue(0);

  // Voir la note de `Breathe`. Ici l'enjeu n'est pas stylistique : c'est la boucle la plus longue
  // de l'app, et l'annuler en arrière-plan est ce qui évite de la laisser tourner une heure,
  // écran éteint, pendant une sortie.
  useEffect(() => {
    if (reduced || !focused) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => {
      cancelAnimation(progress);
      progress.value = 0;
    };
  }, [delay, focused, progress, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * (MAX_SCALE - 1) }],
    opacity: 0.55 * (1 - progress.value),
  }));

  if (reduced) return null;

  return <Animated.View style={[styles.ring, { backgroundColor: color }, style]} />;
}

/**
 * Deux ondes déphasées d'une demi-période : il y en a toujours une visible, donc la propagation
 * paraît continue au lieu de repartir de zéro toutes les deux secondes.
 */
export function PulseDot({ color }: { color: string }) {
  const reduced = useAppReducedMotion();
  const focused = useIsAppActive();

  return (
    // Décoratif de bout en bout : la position est déjà portée par le marqueur de la carte, et les
    // chiffres de distance et d'allure sont ailleurs à l'écran (règle R1).
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.center}>
        <Ring color={color} delay={0} reduced={reduced} focused={focused} />
        <Ring color={color} delay={PULSE_MS / 2} reduced={reduced} focused={focused} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
