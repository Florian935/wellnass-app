/**
 * Barre de progression qui se remplit — macros, volume, avancement de programme, adhérence.
 *
 * ── Le décalage fait le travail ─────────────────────────────────────────────────────────────────
 * La prop `index` sert aux groupes de barres, et c'est là que se joue la lisibilité : trois barres
 * de macros qui partent exactement ensemble se lisent comme **un seul bloc qui grandit**, et on ne
 * voit plus qu'elles ont des longueurs différentes. Soixante millisecondes d'écart suffisent à ce
 * que l'œil les compare une à une.
 *
 * ── `scaleX` plutôt qu'une largeur ──────────────────────────────────────────────────────────────
 * Animer `width` force une mesure de disposition à chaque image, sur le thread JS. `scaleX` avec
 * une origine à gauche reste une transformation pure, donc entièrement sur le thread UI (R3). La
 * barre est en largeur pleine et c'est son échelle qui varie.
 *
 * ⚠️ Conséquence à connaître : l'échelle déforme aussi le contenu d'une barre. Celle-ci est donc
 * une **surface de couleur uniquement** — jamais de texte à l'intérieur.
 *
 * ── Overshoot interdit ──────────────────────────────────────────────────────────────────────────
 * `EASING.fill`, pas un ressort (règle R6). Une jauge de calories ou de protéines qui dépasse puis
 * revient affiche un chiffre faux pendant une fraction de seconde, sur une donnée que l'utilisateur
 * surveille précisément.
 */

import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { DURATION, EASING } from '@/theme/motion';

/** Décalage entre deux barres d'un même groupe. Plus court que `STAGGER` : elles sont côte à côte. */
const GROUP_DELAY = 60;

type AnimatedBarProps = {
  /** Remplissage 0–1. Borné : une valeur hors bornes déborderait de la piste. */
  pct: number;
  /** Couleur du remplissage. */
  color: string;
  /** Couleur de la piste. */
  trackColor: string;
  /** Épaisseur. Défaut 6, celle des macros et de la progression de programme. */
  height?: number;
  /** Rang dans un groupe de barres — retard de `index × 60 ms`. */
  index?: number;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedBar({
  pct,
  color,
  trackColor,
  height = 6,
  index = 0,
  style,
}: AnimatedBarProps) {
  const reduced = useAppReducedMotion();
  const safe = Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
  const progress = useSharedValue(safe);

  useEffect(() => {
    if (reduced) {
      progress.value = safe;
      return;
    }
    progress.value = withDelay(
      index * GROUP_DELAY,
      withTiming(safe, { duration: DURATION.data, easing: EASING.fill }),
    );
  }, [index, progress, reduced, safe]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }, style]}
    >
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: height / 2, backgroundColor: color },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  // `transformOrigin` : sans lui l'échelle part du centre et la barre grandit des deux côtés.
  fill: { width: '100%', height: '100%', transformOrigin: 'left' },
});
