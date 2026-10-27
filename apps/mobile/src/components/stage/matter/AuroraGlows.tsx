/**
 * US ACCUEIL-07 — **la matière de la scène Aurore** : deux lueurs posées sur la nuit.
 *
 * Une lueur turquoise ancrée en haut à gauche, une lueur framboise en haut à droite, chacune un
 * dégradé radial qui s'éteint avant le milieu de la scène. Leur dosage suit la lumière de la
 * journée : turquoise le matin, framboise le soir, presque éteintes la nuit.
 *
 * ── US ACCUEIL-09 — elles suivent l'heure, et elles respirent ───────────────────────────────────
 *  - **L'heure** : le dosage est interpolé en continu (`auroraDose`), et chaque changement — un pas
 *    de 5 minutes de l'horloge de l'accueil — glisse en 1,2 s au lieu de sauter.
 *  - **Le souffle** (R2 de DASH-01 : le SEUL élément vivant au repos) : 4,8 s par cycle, l'échelle
 *    monte à 1,07 depuis le coin de chaque lueur et l'opacité respire entre 85 % et 100 % du dosage,
 *    les deux lueurs en opposition de phase.
 *  - **R3** : tout tourne sur le thread UI (opacité et échelle d'une vue, jamais un état React par
 *    image). Le dégradé SVG est posé une fois, à pleine intensité ; c'est la vue qui le dose.
 *  - **R4** : le souffle s'arrête hors focus, app en arrière-plan ou animations réduites (`active`,
 *    tiré de `useLoopActive('home')`) ; la lueur se pose alors à son dosage exact, sans échelle.
 *
 * ⚠️ Elles passent sous le texte. Le contrat de lisibilité est tenu par `theme/stage.ts` (surfaces
 * mêlées mesurées par `__tests__/stage.test.ts`, plafond turquoise à 0,38) : la respiration ne fait
 * que BAISSER l'opacité sous le dosage, jamais la monter.
 *
 * Décor pur (R1) : aucune information n'est portée par les lueurs, d'où `pointerEvents` coupé et
 * aucune étiquette d'accessibilité.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { EASING } from '@/theme/motion';
import { AURORA_BREATH, AURORA_FRAMBOISE, AURORA_TURQUOISE, auroraDose } from '@/theme/stage';

const rgb = (c: readonly number[]) => `rgb(${c.join(',')})`;

/** Le glissement d'un dosage à l'autre : assez lent pour ne jamais se remarquer. */
export const AURORA_DOSE_TRANSITION_MS = 1200;

type GlowShape = {
  id: string;
  color: readonly number[];
  cx: string;
  cy: string;
  rx: string;
  ry: string;
  fade: number;
  /** Coin d'où la lueur grandit en respirant. */
  origin: string;
  /** Décalage du souffle : la seconde lueur respire en opposition de phase. */
  phase: number;
};

const TURQUOISE: GlowShape = {
  id: 'aurora-turquoise',
  color: AURORA_TURQUOISE,
  cx: '0%',
  cy: '0%',
  rx: '110%',
  ry: '75%',
  fade: 0.6,
  origin: '0% 0%',
  phase: 0,
};

const FRAMBOISE: GlowShape = {
  id: 'aurora-framboise',
  color: AURORA_FRAMBOISE,
  cx: '100%',
  cy: '18%',
  rx: '90%',
  ry: '70%',
  fade: 0.62,
  origin: '100% 18%',
  phase: AURORA_BREATH.period / 2,
};

type Props = {
  /** Heure locale décimale (`useCurrentClock`). */
  hour: number;
  /** Le souffle tourne (focus, app au premier plan, animations permises). */
  active?: boolean;
};

export function AuroraGlows({ hour, active = false }: Props) {
  const [turquoise, framboise] = auroraDose(hour);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="aurora-glows">
      <Glow shape={TURQUOISE} dose={turquoise} active={active} />
      <Glow shape={FRAMBOISE} dose={framboise} active={active} />
    </View>
  );
}

function Glow({ shape, dose, active }: { shape: GlowShape; dose: number; active: boolean }) {
  const reduced = useAppReducedMotion();
  const opacity = useSharedValue(dose);
  // 0 → 1 : du creux au sommet du souffle. Au repos (souffle coupé), 1 : la lueur à son dosage.
  const breath = useSharedValue(1);
  const alive = useSharedValue(0);

  useEffect(() => {
    opacity.value = reduced
      ? dose
      : withTiming(dose, { duration: AURORA_DOSE_TRANSITION_MS, easing: EASING.breath });
  }, [dose, opacity, reduced]);

  useEffect(() => {
    if (!active) {
      cancelAnimation(breath);
      breath.value = 1;
      alive.value = 0;
      return;
    }
    alive.value = 1;
    breath.value = 0;
    breath.value = withDelay(
      shape.phase,
      withRepeat(withTiming(1, { duration: AURORA_BREATH.period / 2, easing: EASING.breath }), -1, true),
    );
    return () => {
      cancelAnimation(breath);
      breath.value = 1;
      alive.value = 0;
    };
  }, [active, alive, breath, shape.phase]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value * (AURORA_BREATH.minOpacity + (1 - AURORA_BREATH.minOpacity) * breath.value),
    transform: [{ scale: 1 + (AURORA_BREATH.scale - 1) * breath.value * alive.value }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { transformOrigin: shape.origin }, style]}
      testID={shape.id}
    >
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id={shape.id}
            cx={shape.cx}
            cy={shape.cy}
            rx={shape.rx}
            ry={shape.ry}
            fx={shape.cx}
            fy={shape.cy}
          >
            {/* Pleine intensité : c'est l'opacité de la vue qui dose (pas d'état par image, R3). */}
            <Stop offset="0" stopColor={rgb(shape.color)} stopOpacity={1} />
            <Stop offset={String(shape.fade)} stopColor={rgb(shape.color)} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${shape.id})`} />
      </Svg>
    </Animated.View>
  );
}
