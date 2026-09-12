/**
 * L'anneau du temps de repos — MOTION-01, effets M3 / M4.
 *
 * ── Le manque qu'il comble ──────────────────────────────────────────────────────────────────────
 * Jusqu'ici, le repos entre deux séries était **un texte qui décrémente**, et rien d'autre. C'est
 * pourtant l'écran où l'on passe le plus de temps immobile, souvent posé sur un banc, regardé du
 * coin de l'œil. Un chiffre demande d'être lu ; un arc qui se vide se comprend sans lecture, et de
 * plus loin.
 *
 * ── Pourquoi `RingGauge` ne convenait pas ici ───────────────────────────────────────────────────
 * L'anneau partagé anime chaque changement de valeur sur `DURATION.data` (420 ms) avec
 * `EASING.fill`, ce qui est juste pour une donnée qui saute d'un état à un autre (des calories qui
 * s'ajoutent). Un compte à rebours, lui, ne saute pas : il **s'écoule**. Avec une décélération à
 * chaque seconde, l'arc avancerait par à-coups — vite puis lentement, douze fois par minute.
 *
 * D'où un anneau dédié, en `EASING.flow` (linéaire) sur exactement une seconde : la durée du pas
 * de la minuterie. L'arc se vide donc à vitesse constante et l'on ne voit aucune couture entre deux
 * secondes.
 *
 * ── Le virage au vert (M4) ──────────────────────────────────────────────────────────────────────
 * Dans les cinq dernières secondes, l'arc passe de l'accent au vert. C'est ce qui permet de se
 * préparer **sans regarder le chiffre** — on perçoit un changement de couleur en vision
 * périphérique, pas une valeur numérique.
 *
 * ⚠️ Règle R1 : ce vert ne porte aucune information à lui seul. Le chiffre reste affiché, et la
 * fin du repos est de toute façon annoncée par une vibration (`hapticMilestone`, déjà en place).
 * Quelqu'un qui ne distingue pas les couleurs ne perd rien.
 */

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { EASING } from '@/theme/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Seuil du virage de couleur, en secondes restantes. */
export const WARN_THRESHOLD_S = 5;

/** Pas de la minuterie parente (`setInterval` à 1 s dans `workout.tsx`). */
const TICK_MS = 1000;

type RestRingProps = {
  /** Secondes restantes, telles que la minuterie les compte. */
  secondsLeft: number;
  /**
   * Durée totale du repos en cours. Sert de dénominateur à l'arc — et change quand l'utilisateur
   * appuie sur « + 30 s », auquel cas l'anneau se **remplit** au lieu de se vider. C'est voulu :
   * c'est exactement ce qui vient de se passer.
   */
  totalSeconds: number;
  size: number;
  stroke: number;
  /** Couleur de l'arc au-dessus du seuil. */
  color: string;
  /** Couleur de l'arc dans les cinq dernières secondes. */
  warnColor: string;
  /** Couleur de la piste. */
  trackColor: string;
  /** Contenu centré — le compte à rebours. */
  children?: ReactNode;
};

export function RestRing({
  secondsLeft,
  totalSeconds,
  size,
  stroke,
  color,
  warnColor,
  trackColor,
  children,
}: RestRingProps) {
  const reduced = useAppReducedMotion();

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;

  // Fraction restante. `totalSeconds` peut être nul ou négatif si un repos est configuré à zéro :
  // on montre alors un anneau vide plutôt que de diviser par zéro.
  const safeTotal = totalSeconds > 0 ? totalSeconds : 0;
  const fraction = safeTotal > 0 ? Math.max(0, Math.min(1, secondsLeft / safeTotal)) : 0;

  const progress = useSharedValue(fraction);

  useEffect(() => {
    if (reduced) {
      progress.value = fraction;
      return;
    }
    // Exactement le pas de la minuterie, en linéaire : l'arc arrive à sa nouvelle position au
    // moment précis où la seconde suivante s'affiche. Aucune couture, aucun à-coup.
    progress.value = withTiming(fraction, { duration: TICK_MS, easing: EASING.flow });
  }, [fraction, progress, reduced]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const arcColor = secondsLeft <= WARN_THRESHOLD_S ? warnColor : color;

  return (
    <View style={{ width: size, height: size }}>
      {/*
        L'anneau est **décoratif** : toute l'information est dans le compte à rebours chiffré, qui
        reste lisible par les lecteurs d'écran (règle R1). C'est donc le SVG qu'on masque, jamais
        son contenu centré.
      */}
      <Svg
        width={size}
        height={size}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke={arcColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          animatedProps={arcProps}
          strokeDasharray={circumference}
          // L'arc démarre à 12 h et tourne dans le sens horaire, comme `RingGauge`.
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {/* Le compte à rebours, centré dans l'anneau. Il reste annoncé : c'est l'information. */}
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
