/**
 * Le repos qui respire — US MUSCU-UX03, spec §5.9.
 *
 * ── Le moment le plus mal traité de la séance ──────────────────────────────────────────────────
 * Le repos, c'est **la moitié du temps passé dans l'app** et c'est exactement là qu'on la quitte :
 * on sort le téléphone, on ouvre autre chose, et la séance s'arrête là. L'écran de repos classique
 * n'offrait qu'un chiffre qui descend.
 *
 * Ici, il offre trois choses, dans cet ordre de priorité :
 *  1. **ce qui vient d'être fait** — la série validée, son verdict, le record s'il y en a un ;
 *  2. **quelque chose à faire** — respirer au rythme du disque, plutôt que regarder ailleurs ;
 *  3. **quelque chose à regarder** — le fantôme de la dernière fois, ou le corps qui chauffe.
 *
 * ── La veille ───────────────────────────────────────────────────────────────────────────────────
 * Vingt secondes sans toucher : l'écran s'assombrit, les chiffres passent en braise. Ce n'est pas
 * une économie d'énergie, c'est un **refus d'attirer l'œil** quand personne ne regarde. Le réveil
 * est automatique à T−5 s — jamais on ne rate la reprise à cause d'elle.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  computeSessionHeat,
  hottestMuscles,
  pickCoachLine,
  type FineMuscle,
  type GhostState,
} from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { RestRing } from '@/components/workout/RestRing';
import { describeBarChange, describeLoad } from '@/components/workout/immersive/BarbellLoad';
import { BodyHeatCard } from '@/components/workout/immersive/BodyHeatCard';
import { GhostCard } from '@/components/workout/immersive/GhostCard';
import { RecordTakeover } from '@/components/workout/immersive/RecordTakeover';
import { VerdictChip } from '@/components/workout/immersive/VerdictChip';
import { RECORD_AMBER } from '@/components/workout/immersive/theme';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { hapticSelect } from '@/lib/haptics';
import type { ImmersiveRuntime } from '@/components/workout/immersive/types';
import { fontFamily } from '@/theme/fonts';

const RING_SIZE = 236;
const RING_STROKE = 10;

/** Inactivité avant la veille, et seuil de réveil automatique (spec §5.9). */
const SLEEP_AFTER_MS = 20000;
const WAKE_AT_SECONDS = 5;

/** Respiration : 2 s d'inspiration, 3 s d'expiration. Le rythme qui fait redescendre le cœur. */
const INHALE_MS = 2000;
const EXHALE_MS = 3000;

type Tab = 'ghost' | 'heat';

type Props = {
  runtime: ImmersiveRuntime;
  ghost: GhostState;
  ghostVisible: boolean;
  /** Libellé du jour de référence du fantôme (« mardi »). */
  ghostDayLabel: string;
  onOpenPlan: () => void;
};

/** Formate un nombre de secondes en `m:ss` (≥ 60 s) ou `{n} s` sinon — repris de `RestOverlay`. */
function formatSecondsLeft(
  seconds: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const safe = Math.max(0, Math.floor(seconds));
  if (safe < 60) return t('workout.restRemaining', { seconds: safe });
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export function ImmersiveRest({ runtime, ghost, ghostVisible, ghostDayLabel, onOpenPlan }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, units, prefs, rest, feedback } = runtime;
  const reducedMotion = useAppReducedMotion();

  const [tab, setTab] = useState<Tab>(ghostVisible ? 'ghost' : 'heat');
  const [sleeping, setSleeping] = useState(false);
  const [lastTouch, setLastTouch] = useState(() => Date.now());
  const [takeoverOpen, setTakeoverOpen] = useState(Boolean(feedback?.takeover));

  // Une nouvelle série validée rouvre le plein écran si elle en mérite un, et réveille l'écran.
  // Ajusté **pendant le rendu** (patron React pour « remettre à zéro quand une prop change ») :
  // dans un effet, le plein écran de record s'afficherait un rendu trop tard, soit après que
  // l'utilisateur a déjà vu le repos ordinaire.
  const [lastFeedback, setLastFeedback] = useState(feedback);
  if (lastFeedback !== feedback) {
    setLastFeedback(feedback);
    setTakeoverOpen(Boolean(feedback?.takeover));
    setSleeping(false);
    // Forme fonctionnelle : `Date.now()` est lu à l'application de la mise à jour, pas pendant le
    // rendu (règle `react-hooks/purity`).
    setLastTouch(() => Date.now());
  }

  // ── Veille ───────────────────────────────────────────────────────────────────────────────────
  // Le réveil automatique à T−5 s est **dérivé**, pas déclenché : un état « endormi » qui doive
  // être annulé par un effet finirait tôt ou tard par survivre d'un rendu, et on raterait la
  // reprise. Ici, il ne peut structurellement pas rester endormi dans les cinq dernières secondes.
  const asleep = sleeping && rest.secondsLeft > WAKE_AT_SECONDS;

  useEffect(() => {
    if (!prefs.sleep || sleeping || takeoverOpen) return;
    const id = setInterval(() => {
      if (Date.now() - lastTouch >= SLEEP_AFTER_MS) setSleeping(true);
    }, 1000);
    return () => clearInterval(id);
  }, [sleeping, lastTouch, prefs.sleep, takeoverOpen]);

  // ── Les trois derniers battements ────────────────────────────────────────────────────────────
  // `hapticMilestone` à zéro est déjà émis par l'écran de séance : ici, seulement T−3, T−2, T−1.
  const tickedAt = useRef<number | null>(null);
  useEffect(() => {
    const left = rest.secondsLeft;
    if (left > 0 && left <= 3 && tickedAt.current !== left) {
      tickedAt.current = left;
      hapticSelect();
    }
    if (left > 3) tickedAt.current = null;
  }, [rest.secondsLeft]);

  // ── « On y retourne » ────────────────────────────────────────────────────────────────────────
  // T−7 s : assez tôt pour se relever et se placer, assez tard pour que ce ne soit pas oublié.
  const preppedRef = useRef(false);
  useEffect(() => {
    if (rest.secondsLeft > 7) {
      preppedRef.current = false;
      return;
    }
    if (rest.secondsLeft <= 0 || preppedRef.current || !runtime.current) return;
    preppedRef.current = true;
    runtime.speak(
      pickCoachLine({
        event: 'restPrep',
        character: prefs.coach,
        vars: {
          weight: units.formatWeight(runtime.current.set.weightKg),
          reps: runtime.current.set.reps ?? 0,
        },
      }),
    );
  }, [rest.secondsLeft, prefs.coach, runtime, units]);

  // ── Respiration ──────────────────────────────────────────────────────────────────────────────
  const breath = useSharedValue(1);
  const breathing = prefs.breathing && !reducedMotion && !asleep;
  useEffect(() => {
    if (!breathing) {
      cancelAnimation(breath);
      breath.value = 1;
      return;
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1.16, { duration: INHALE_MS, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: EXHALE_MS, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(breath);
      breath.value = 1;
    };
  }, [breath, breathing]);
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  // Le libellé de respiration suit le cycle de 5 s, sans animation : c'est une consigne, elle doit
  // rester lisible même quand les animations sont coupées.
  const phase = breathing ? ((rest.totalSeconds - rest.secondsLeft) % 5 < 2 ? 'in' : 'out') : null;

  // ── Chaleur du corps ─────────────────────────────────────────────────────────────────────────
  const heatSets = useMemo(
    () =>
      runtime.entries.flatMap((entry) =>
        entry.sets.map((set) => ({
          exerciseId: entry.exerciseId,
          setType: set.setType,
          done: set.done,
        })),
      ),
    [runtime.entries],
  );
  const heat = useMemo(
    () => computeSessionHeat(heatSets, runtime.muscles),
    [heatSets, runtime.muscles],
  );
  const setsByMuscle = useMemo(() => {
    const counts: Partial<Record<FineMuscle, number>> = {};
    for (const set of heatSets) {
      if (!set.done || set.setType === 'warmup') continue;
      const muscles = runtime.muscles[set.exerciseId];
      if (!muscles) continue;
      for (const muscle of muscles.full) counts[muscle] = (counts[muscle] ?? 0) + 1;
    }
    return counts;
  }, [heatSets, runtime.muscles]);
  const hottest = hottestMuscles(heat, 1)[0] ?? null;

  const countdown = formatSecondsLeft(rest.secondsLeft, t);

  const imperial = units.system === 'imperial';
  const nextLoadLabel =
    runtime.current && runtime.showBarbell && runtime.displayWeightKg !== null
      ? runtime.barChange
        ? describeBarChange({ change: runtime.barChange, imperial, t, language: i18n.language })
        : describeLoad({
            totalKg: runtime.displayWeightKg,
            barKg: prefs.barKg,
            imperial,
            t,
            language: i18n.language,
          }).label
      : null;
  const almostDone = rest.secondsLeft <= WAKE_AT_SECONDS;

  const wake = () => {
    setSleeping(false);
    setLastTouch(Date.now());
  };

  // ── Veille : l'écran devient une braise ──────────────────────────────────────────────────────
  if (asleep) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('immersive.rest.wake')}
        onPress={wake}
        style={[styles.sleep, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      >
        <Text style={[styles.sleepCountdown, { color: RECORD_AMBER }]}>{countdown}</Text>
        <Text style={styles.sleepHint}>{t('immersive.rest.wake')}</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.screen, { backgroundColor: colors.background }]}
      onTouchStart={() => setLastTouch(Date.now())}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workout.restCollapse')}
            hitSlop={12}
            onPress={rest.onToggleCollapse}
          >
            <Ionicons name="chevron-down" size={26} color={colors.textMuted} />
          </Pressable>
          <Text style={[styles.title, { color: colors.textMuted }]}>{t('workout.restTitle')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workout.menu.title')}
            hitSlop={12}
            onPress={runtime.onOpenMenu}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Ce qui vient d'être fait : la série, puis son verdict ou son record. */}
        {feedback ? (
          <View style={styles.done}>
            <Text style={[styles.doneLabel, { color: colors.text }]} numberOfLines={2}>
              {t('immersive.rest.validated', {
                index: feedback.setIndex,
                detail: feedback.doneLabel,
              })}
            </Text>
            <VerdictChip
              verdict={feedback.verdict}
              record={feedback.record}
              dayLabel={feedback.dayLabel}
              units={units}
              colors={colors}
            />
            {feedback.coach ? (
              <Text style={[styles.coach, { color: colors.textMuted }]} numberOfLines={2}>
                {t(feedback.coach.key, feedback.coach.vars)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Exercice bouclé : le bilan d'un exercice se lit ici, au moment où il est fini — pas
            quinze minutes plus tard au résumé de séance. */}
        {feedback?.exerciseDone ? (
          <View style={[styles.exerciseDone, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.exerciseDoneTitle, { color: colors.text }]} numberOfLines={2}>
              {t('immersive.exerciseDone.title', { name: feedback.exerciseDone.name })}
            </Text>
            <Text style={[styles.exerciseDoneStats, { color: colors.textMuted }]}>
              {t('immersive.exerciseDone.stats', {
                sets: feedback.exerciseDone.sets,
                tonnage: units.formatWeight(Math.round(feedback.exerciseDone.tonnage)),
              })}
            </Text>
            {feedback.exerciseDone.deltaPercent !== null && runtime.level !== 'simplified' ? (
              <Text
                style={[
                  styles.exerciseDoneDelta,
                  {
                    color:
                      feedback.exerciseDone.deltaPercent >= 0 ? colors.success : colors.textMuted,
                  },
                ]}
              >
                {t('immersive.exerciseDone.delta', {
                  percent: Math.abs(Math.round(feedback.exerciseDone.deltaPercent)),
                  day: ghostDayLabel,
                  context: feedback.exerciseDone.deltaPercent >= 0 ? 'up' : 'down',
                })}
              </Text>
            ) : null}
            {feedback.exerciseDone.records > 0 ? (
              <Text style={[styles.exerciseDoneDelta, { color: RECORD_AMBER }]}>
                {t('immersive.exerciseDone.records', { count: feedback.exerciseDone.records })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* L'anneau, et le disque qui respire dedans. */}
        <View style={styles.ringZone}>
          {breathing ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.breath, { backgroundColor: `${colors.accent}1f` }, breathStyle]}
            />
          ) : null}
          <RestRing
            secondsLeft={rest.secondsLeft}
            totalSeconds={rest.totalSeconds}
            size={RING_SIZE}
            stroke={RING_STROKE}
            color={colors.accent}
            warnColor={colors.success}
            trackColor={`${colors.text}1f`}
          >
            <Text style={[styles.countdown, { color: colors.text }]}>{countdown}</Text>
          </RestRing>
        </View>

        <Text
          style={[styles.breathLabel, { color: almostDone ? colors.success : colors.textMuted }]}
        >
          {almostDone
            ? t('immersive.rest.getReady')
            : phase === 'in'
              ? t('immersive.rest.inhale')
              : phase === 'out'
                ? t('immersive.rest.exhale')
                : ''}
        </Text>

        {/* La proposition d'ajustement : une carte, deux boutons, aucune décision prise à ta place. */}
        {feedback?.adjust ? (
          <View style={[styles.adjust, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.adjustText, { color: colors.text }]}>
              {t(
                feedback.adjust.direction === 'down'
                  ? 'immersive.adjust.lighter'
                  : 'immersive.adjust.heavier',
                { weight: units.formatWeight(feedback.adjust.weightKg) },
              )}
            </Text>
            <View style={styles.adjustActions}>
              <PressableScale
                accessibilityRole="button"
                haptic="confirm"
                onPress={runtime.onAcceptAdjust}
                style={[styles.adjustAccept, { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.adjustAcceptLabel, { color: colors.accentText }]}>
                  {units.formatWeight(feedback.adjust.weightKg)}
                </Text>
              </PressableScale>
              <Pressable
                accessibilityRole="button"
                onPress={runtime.onDismissAdjust}
                style={styles.adjustKeep}
              >
                <Text style={[styles.adjustKeepLabel, { color: colors.textMuted }]}>
                  {t('immersive.adjust.keep')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Quelque chose à regarder, plutôt qu'une autre app. */}
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.tabs}>
            {ghostVisible ? (
              <TabButton
                label={t('immersive.rest.tabGhost', { day: ghostDayLabel })}
                active={tab === 'ghost'}
                onPress={() => setTab('ghost')}
                colors={colors}
              />
            ) : null}
            <TabButton
              label={t('immersive.rest.tabHeat')}
              active={tab === 'heat'}
              onPress={() => setTab('heat')}
              colors={colors}
            />
          </View>
          {tab === 'ghost' && ghostVisible ? (
            <GhostCard ghost={ghost} dayLabel={ghostDayLabel} units={units} colors={colors} />
          ) : (
            <BodyHeatCard heat={heat} setsByMuscle={setsByMuscle} pulse={hottest} colors={colors} />
          )}
        </View>

        {/* Ce qui vient — même geste qu'au pont : un appui ouvre le plan complet. */}
        <Pressable
          accessibilityRole="button"
          onPress={onOpenPlan}
          style={[styles.next, { borderColor: colors.border }]}
        >
          <Ionicons name="list-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.nextText, { color: colors.text }]} numberOfLines={1}>
            <Text style={[styles.nextLabel, { color: colors.textMuted }]}>
              {`${t('workout.restNext')} · `}
            </Text>
            {runtime.current
              ? `${runtime.current.entry.exerciseName} · ${t('workout.setProgress', {
                  current: runtime.current.rang + 1,
                  total: runtime.current.entry.sets.length,
                })}`
              : t('immersive.deck.nextEnd')}
          </Text>
        </Pressable>

        {/* Ce qu'il faut toucher sur la barre pour la série qui vient — c'est pendant le repos qu'on
            recharge (MUSCU-FIX02, passe 3). Même exercice : la différence ; nouvel exercice à la
            barre : le chargement complet par côté. */}
        {nextLoadLabel ? (
          <View style={styles.nextLoad}>
            <Ionicons name="barbell-outline" size={18} color={colors.accent} />
            <Text testID="rest-next-load" style={[styles.nextLoadText, { color: colors.text }]}>
              {nextLoadLabel}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={rest.onSkip}
            style={[styles.action, { borderColor: `${colors.text}52` }]}
          >
            <Text style={[styles.actionLabel, { color: colors.text }]}>{t('workout.skipRest')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={rest.onExtend}
            style={[styles.action, { borderColor: `${colors.text}52` }]}
          >
            <Text style={[styles.actionLabel, { color: colors.text }]}>
              {t('workout.restExtend')}
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.restAlways', { count: rest.restSeconds + 30 })}
          onPress={() => rest.onChangeRest(rest.restSeconds + 30)}
          style={[styles.restSetting, { borderColor: `${colors.text}4d` }]}
        >
          <Ionicons name="timer-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.restSettingText, { color: colors.textMuted }]} numberOfLines={2}>
            {t('workout.restAlways', { count: rest.restSeconds + 30 })}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Le plein écran de record se pose **par-dessus** : la minuterie continue dessous. */}
      {takeoverOpen && feedback?.record ? (
        <RecordTakeover
          record={feedback.record}
          exerciseName={feedback.exerciseName}
          units={units}
          onClose={() => {
            setTakeoverOpen(false);
            runtime.onDismissTakeover();
            wake();
          }}
        />
      ) : null}
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ImmersiveRuntime['colors'];
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.tab,
        { backgroundColor: active ? colors.surfaceAlt : 'transparent' },
      ]}
    >
      <Text style={[styles.tabLabel, { color: active ? colors.text : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  done: { alignItems: 'center', gap: 8 },
  doneLabel: { fontFamily: fontFamily.displaySemi, fontSize: 17, textAlign: 'center' },
  coach: { fontFamily: fontFamily.body, fontSize: 13, textAlign: 'center', fontStyle: 'italic' },
  ringZone: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  breath: { position: 'absolute', width: 188, height: 188, borderRadius: 94 },
  countdown: { fontFamily: fontFamily.monoBold, fontSize: 58, letterSpacing: -2, lineHeight: 66 },
  breathLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    letterSpacing: 0.6,
    textAlign: 'center',
    minHeight: 18,
  },
  exerciseDone: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 4 },
  exerciseDoneTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  exerciseDoneStats: { fontFamily: fontFamily.mono, fontSize: 12.5 },
  exerciseDoneDelta: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  adjust: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  adjustText: { fontFamily: fontFamily.bodySemi, fontSize: 14, lineHeight: 19 },
  adjustActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adjustAccept: {
    minHeight: 44,
    borderRadius: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustAcceptLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  adjustKeep: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  adjustKeepLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  panel: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 12 },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { minHeight: 36, borderRadius: 11, paddingHorizontal: 12, justifyContent: 'center' },
  tabLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  nextText: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  nextLoad: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  nextLoadText: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 15, lineHeight: 20 },
  nextLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actions: { flexDirection: 'row', gap: 12 },
  action: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  restSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  restSettingText: { flex: 1, fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },

  sleep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000000',
  },
  sleepCountdown: {
    fontFamily: fontFamily.monoBold,
    fontSize: 76,
    letterSpacing: -3,
    // Faible luminance : la veille ne doit pas éclairer la pièce ni attirer l'œil.
    opacity: 0.55,
  },
  sleepHint: { fontFamily: fontFamily.body, fontSize: 13, color: '#ffffff59' },
});
