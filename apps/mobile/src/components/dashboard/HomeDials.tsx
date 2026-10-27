/**
 * US ACCUEIL-08 — **les trois cadrans** du ciel : Bouger · Manger · Récupérer (décision D2).
 *
 * Ce que l'accueil ne disait nulle part d'un coup d'œil : où j'en suis aujourd'hui. Trois anneaux
 * légendés, dans un encart de verre posé sur la scène, chacun visible seulement si son pilier est
 * actif (`buildDayDials`, `@wellness/shared`, testée) :
 *  - **Bouger** — les séances de la semaine en segments (rouge muscu, bleu course ; celle du jour en
 *    pâle tant qu'elle n'est pas faite) ;
 *  - **Manger** — les kcal restantes (anneau continu) et les protéines ;
 *  - **Marcher** — à la place de Bouger pour un compte nutrition seule ;
 *  - **Récupérer** — le verdict de forme existant (TRI-03) en trois segments ; « ? » le matin tant
 *    que le check-in n'est pas fait.
 *
 * Les couleurs sont celles de la scène sombre (identiques en clair et en sombre, comme la scène).
 * Le mouvement (ACCUEIL-09) : les anneaux se remplissent à l'arrivée et suivent chaque geste.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { DayDial, DialTone } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { useStageTheme } from '@/components/stage/PillarStage';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { DURATION, EASING } from '@/theme/motion';
import { fontFamily } from '@/theme/fonts';

const SIZE = 84;
const RADIUS = 36;
const STROKE = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_GAP = 7;

/** Les couleurs des segments, sur la scène sombre. */
export const DIAL_TONES: Record<DialTone, string> = {
  strength: '#ff6b5e',
  running: '#6fa8ef',
  'strength-soft': 'rgba(255,107,94,0.34)',
  'running-soft': 'rgba(111,168,239,0.34)',
  idle: 'rgba(255,255,255,0.18)',
  positive: '#9ed16a',
  neutral: '#e0b155',
  negative: '#6fa8ef',
};
const TRACK = 'rgba(255,255,255,0.14)';
const EAT = '#9ed16a';
const WALK = '#5eead4';

type Props = {
  dials: readonly DayDial[];
  onPress: (key: DayDial['key']) => void;
  formatNumber: (n: number) => string;
};

/**
 * US ACCUEIL-09 — **les cadrans s'ouvrent** à l'arrivée, une seule fois par montage : chaque segment
 * (ou l'arc continu) se remplit en 900 ms, décalé de 80 ms du précédent, et d'un cadran au suivant.
 * Ensuite, l'anneau **suit** : un repas noté fait monter Manger depuis sa valeur d'avant (420 ms),
 * jamais depuis zéro (R5 de MOTION-01). Animations réduites : la valeur finale, d'emblée.
 *
 * Tout passe par `strokeDashoffset` (un nombre, animable sur le thread UI) ; la position d'un
 * segment est une rotation fixe. Aucune information n'est portée par le mouvement (R1).
 */
export const DIAL_FILL_MS = 900;
export const DIAL_STAGGER_MS = 80;
/** D'un cadran au suivant : l'œil lit de gauche à droite. */
export const DIAL_STEP_MS = 120;
/** Les légendes suivent leur anneau. */
const LEGEND_DELAY_MS = 200;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const CENTER = SIZE / 2;

/** Une valeur dans [0, 1] qui se remplit à l'arrivée, puis suit ses changements. */
function useFill(target: number, delay: number): SharedValue<number> {
  const reduced = useAppReducedMotion();
  const value = useSharedValue(reduced ? target : 0);
  const arrived = useSharedValue(0);
  useEffect(() => {
    const first = arrived.value === 0;
    arrived.value = 1;
    if (reduced) {
      value.value = target;
      return;
    }
    value.value = first
      ? withDelay(delay, withTiming(target, { duration: DIAL_FILL_MS, easing: EASING.fill }))
      : withTiming(target, { duration: DURATION.data, easing: EASING.fill });
  }, [arrived, delay, reduced, target, value]);
  return value;
}

/** Un segment : la piste éteinte, et par-dessus la couleur qui se déroule depuis son début. */
function Segment({ tone, index, count, delay }: { tone: DialTone; index: number; count: number; delay: number }) {
  const gap = count > 1 ? SEGMENT_GAP : 0;
  const len = CIRCUMFERENCE / count - gap;
  const angle = -90 + (index * 360) / count + ((gap / 2) * 360) / CIRCUMFERENCE;
  const fill = useFill(1, delay);
  const lit = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - fill.value) }));
  const rotate = `rotate(${angle} ${CENTER} ${CENTER})`;
  return (
    <>
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke={DIAL_TONES.idle}
        strokeWidth={STROKE}
        strokeDasharray={`${len} ${CIRCUMFERENCE}`}
        transform={rotate}
      />
      {tone === 'idle' ? null : (
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={DIAL_TONES[tone]}
          strokeWidth={STROKE}
          strokeDasharray={`${len} ${CIRCUMFERENCE}`}
          animatedProps={lit}
          transform={rotate}
        />
      )}
    </>
  );
}

/** L'arc continu de Manger et Marcher. */
function Arc({ progress, color, delay }: { progress: number; color: string; delay: number }) {
  const p = Math.min(1, Math.max(0, progress));
  const fill = useFill(p, delay);
  const arc = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - fill.value),
    // Un bout arrondi d'un arc vide dessinerait un point : on ne montre l'arc qu'une fois lancé.
    strokeOpacity: fill.value > 0.005 ? 1 : 0,
  }));
  return (
    <AnimatedCircle
      cx={CENTER}
      cy={CENTER}
      r={RADIUS}
      fill="none"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap={p > 0.02 ? 'round' : 'butt'}
      strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
      animatedProps={arc}
      transform={`rotate(-90 ${CENTER} ${CENTER})`}
    />
  );
}

/** Un anneau : en segments (Bouger, Récupérer) ou continu (Manger, Marcher). */
function Ring({
  segments,
  progress,
  color,
  delay,
}: {
  segments?: readonly DialTone[];
  progress?: number;
  color?: string;
  /** Départ du remplissage à l'arrivée (rang du cadran). */
  delay: number;
}) {
  if (segments) {
    const n = Math.max(1, segments.length);
    return (
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {segments.map((tone, i) => (
          // La teinte dans la clé : une séance faite remonte son segment, qui se déroule à nouveau
          // dans sa couleur — l'anneau « suit » le geste.
          <Segment key={`${i}-${tone}`} tone={tone} index={i} count={n} delay={delay + i * DIAL_STAGGER_MS} />
        ))}
      </Svg>
    );
  }
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke={TRACK} strokeWidth={STROKE} />
      <Arc progress={progress ?? 0} color={color ?? EAT} delay={delay} />
    </Svg>
  );
}

export function HomeDials({ dials, onPress, formatNumber }: Props) {
  const { t } = useTranslation();
  const stage = useStageTheme('home');
  const reduced = useAppReducedMotion();

  if (dials.length === 0) return null;

  return (
    <View
      testID="home-dials"
      style={[
        styles.box,
        { backgroundColor: stage.glass, borderColor: stage.glassBorder },
        dials.length < 3 ? styles.centered : styles.spread,
      ]}
    >
      {dials.map((dial, dialIndex) => {
        const delay = dialIndex * DIAL_STEP_MS;
        let big = '';
        let unit = '';
        let label = '';
        let sub = '';
        let a11y = '';
        let ring: React.ReactElement;
        switch (dial.key) {
          case 'move':
            big = `${dial.done}/${dial.total}`;
            unit = t('home.dials.move.unit', { count: dial.total });
            label = t('home.dials.move.label');
            sub = dial.restToday ? t('home.dials.move.rest') : t('home.dials.move.week');
            a11y = t('home.dials.move.a11y', { done: dial.done, total: dial.total });
            ring = <Ring segments={dial.segments} delay={delay} />;
            break;
          case 'eat':
            if (dial.remaining === null) {
              big = formatNumber(dial.consumed);
              unit = t('home.dials.eat.unitEaten');
            } else if (dial.remaining >= 0) {
              big = formatNumber(dial.remaining);
              unit = t('home.dials.eat.unitLeft');
            } else {
              big = `+${formatNumber(-dial.remaining)}`;
              unit = t('home.dials.eat.unitOver');
            }
            label = t('home.dials.eat.label');
            sub =
              dial.proteinTarget !== null
                ? t('home.dials.eat.protein', { value: dial.proteinG, target: Math.round(dial.proteinTarget) })
                : t('home.dials.eat.noTarget');
            a11y =
              dial.remaining !== null
                ? t('home.dials.eat.a11y', { kcal: formatNumber(Math.max(0, dial.remaining)), protein: dial.proteinG })
                : t('home.dials.eat.a11yNoTarget', { kcal: formatNumber(dial.consumed) });
            ring = <Ring progress={dial.progress} color={EAT} delay={delay} />;
            break;
          case 'walk':
            big = formatNumber(dial.steps);
            unit = t('home.dials.walk.unit');
            label = t('home.dials.walk.label');
            sub = t('home.dials.walk.goal', { goal: formatNumber(dial.goal) });
            a11y = t('home.dials.walk.a11y', { steps: formatNumber(dial.steps), goal: formatNumber(dial.goal) });
            ring = <Ring progress={dial.progress} color={WALK} delay={delay} />;
            break;
          case 'recover':
          default:
            big = dial.pending || !dial.verdict ? '?' : t(`home.dials.recover.word.${dial.verdict}`);
            unit = dial.pending ? t('home.dials.recover.unitPending') : t('home.dials.recover.unit');
            label = t('home.dials.recover.label');
            sub = dial.pending ? t('home.dials.recover.pending') : t('home.dials.recover.why');
            a11y = dial.pending
              ? t('home.dials.recover.a11yPending')
              : t('home.dials.recover.a11y', { verdict: t(`home.readiness.verdict.${dial.verdict ?? 'ok'}.title`) });
            ring = <Ring segments={dial.segments} delay={delay} />;
            break;
        }
        const long = big.length >= 5;
        return (
          <PressableScale
            key={dial.key}
            testID={`home-dial-${dial.key}`}
            haptic="confirm"
            onPress={() => onPress(dial.key)}
            accessibilityRole="button"
            accessibilityLabel={a11y}
            style={styles.dial}
          >
            <View style={styles.ringBox}>
              {ring}
              <View style={styles.center} pointerEvents="none">
                <Text
                  style={[styles.big, long && styles.bigLong, { color: stage.ink }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  maxFontSizeMultiplier={1.2}
                >
                  {big}
                </Text>
                <Text style={[styles.unit, { color: stage.inkMuted }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {unit}
                </Text>
              </View>
            </View>
            {/* Les légendes montent de 6 px à l'arrivée, après leur anneau (un seul montage). */}
            <Animated.View
              style={styles.legend}
              entering={
                reduced
                  ? undefined
                  : FadeInDown.duration(DURATION.base)
                      .delay(LEGEND_DELAY_MS + dialIndex * DIAL_STEP_MS)
                      .withInitialValues({ transform: [{ translateY: 6 }] })
              }
            >
              <Text style={[styles.label, { color: stage.ink }]} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[styles.sub, { color: stage.inkMuted }]} numberOfLines={2}>
                {sub}
              </Text>
            </Animated.View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: 4,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 6,
    borderRadius: 26,
    borderWidth: 1,
  },
  spread: { justifyContent: 'space-between' },
  centered: { justifyContent: 'center' },
  dial: { flexBasis: 104, flexShrink: 1, minWidth: 0, alignItems: 'center', gap: 3, minHeight: 44 },
  ringBox: { width: SIZE, height: SIZE },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  big: { fontFamily: fontFamily.displayXBold, fontSize: 22, letterSpacing: -0.8 },
  bigLong: { fontSize: 19 },
  unit: { fontFamily: fontFamily.bodyBold, fontSize: 9.5, marginTop: 2 },
  legend: { alignItems: 'center', gap: 3 },
  label: { fontFamily: fontFamily.displayBold, fontSize: 14.5, marginTop: 3 },
  sub: { fontFamily: fontFamily.bodySemi, fontSize: 11, textAlign: 'center', lineHeight: 14 },
});
