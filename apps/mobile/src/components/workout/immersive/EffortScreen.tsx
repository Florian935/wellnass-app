/**
 * L'effort en direct — US MUSCU-UX03, spec §5.6.
 *
 * ── Le problème qu'il traite ────────────────────────────────────────────────────────────────────
 * Pendant la série — les 30 à 60 s où il se passe réellement quelque chose — l'app ne faisait rien.
 * L'écran affichait un formulaire et attendait. Ici, il passe en plein cadre et **bat au tempo** :
 * il se contracte pendant la descente, s'embrase à la poussée.
 *
 * ── Ce qui reste facultatif ─────────────────────────────────────────────────────────────────────
 * **Tout.** Compter au doigt est facultatif (on soulève, on n'a pas les mains libres) : sans un seul
 * toucher, le cadran s'ouvrira sur l'objectif. Le guide de tempo se coupe dans les réglages. Et le
 * pont garde « Valider directement » pour qui ne veut rien de tout ça.
 *
 * ── Accessibilité ───────────────────────────────────────────────────────────────────────────────
 * Le battement est **décoratif** : réglage « Animations » coupé ou « réduire les animations » du
 * système, l'écran devient fixe et dit exactement la même chose. Le compteur reste lisible, le
 * temps sous tension aussi.
 */

import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { RECORD_AMBER } from '@/components/workout/immersive/theme';
import type { ImmersiveRuntime } from '@/components/workout/immersive/types';
import { hapticSelect } from '@/lib/haptics';
import { fontFamily } from '@/theme/fonts';

/** Tempo par défaut : 2 s de descente, 1 s de poussée. Aucune donnée de tempo n'existe en base. */
const DESCENT_MS = 2000;
const PUSH_MS = 1000;

/** Formate un temps sous tension (« 0:21 »). */
function formatTut(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

type Props = {
  runtime: ImmersiveRuntime;
  /** Répétitions comptées au doigt. */
  taps: number;
  /** Début de l'effort (ms epoch), pour le temps sous tension. */
  startedAt: number | null;
  onTap: () => void;
  onDone: () => void;
};

export function EffortScreen({ runtime, taps, startedAt, onTap, onDone }: Props) {
  const { t } = useTranslation();
  const { colors, current, units, prefs } = runtime;
  const reduced = useAppReducedMotion();

  const isDuration = runtime.currentSetType === 'duration';
  const target = isDuration ? 0 : Number(runtime.displayReps) || 0;
  const [now, setNow] = useState(() => Date.now());

  // Le temps sous tension avance tant que l'écran est là. Une seconde suffit : c'est une durée
  // d'effort, pas un chronomètre de compétition.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = startedAt ? now - startedAt : 0;

  // Série à la durée : un **compte à rebours** remplace le compteur de reps. À zéro, le cadran
  // s'ouvre tout seul avec la durée atteinte — on n'a pas les mains libres pour le faire soi-même.
  const goalSeconds = runtime.displayDurationSeconds ?? 0;
  const remaining = isDuration ? Math.max(0, goalSeconds - Math.floor(elapsedMs / 1000)) : 0;
  const finishedRef = useRef(false);
  useEffect(() => {
    if (!isDuration || goalSeconds <= 0 || finishedRef.current) return;
    if (remaining <= 0 && startedAt !== null) {
      finishedRef.current = true;
      onDone();
    }
  }, [goalSeconds, isDuration, onDone, remaining, startedAt]);

  // Le battement : contraction lente, poussée franche. Une seule valeur animée, reprise par le
  // halo et par l'anneau — deux animations séparées se désynchroniseraient à l'œil.
  const beat = useSharedValue(1);
  useEffect(() => {
    if (reduced || !prefs.tempo || isDuration) {
      beat.value = 1;
      return;
    }
    beat.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: DESCENT_MS, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.06, { duration: PUSH_MS * 0.4, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: PUSH_MS * 0.6, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(beat);
  }, [beat, reduced, prefs.tempo, isDuration]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.25 + (beat.value - 0.9) * 1.8 }));

  const tut = elapsedMs;
  const over = target > 0 && taps > target;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Halo de chaleur : c'est lui qui « respire » le plus fort, derrière tout le reste. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { backgroundColor: colors.accent }, haloStyle]}
      />

      <View style={styles.top}>
        <Text style={[styles.eyebrow, { color: colors.accent }]} numberOfLines={1}>
          {current
            ? `${current.entry.exerciseName} · ${t('workout.setProgress', {
                current: current.rang + 1,
                total: current.entry.sets.length,
              })}`
            : ''}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('immersive.effort.countA11y', { count: taps })}
        disabled={isDuration}
        onPress={() => {
          hapticSelect();
          onTap();
        }}
        style={styles.ringZone}
      >
        <Animated.View
          style={[styles.ring, { borderColor: over ? RECORD_AMBER : colors.borderStrong }, pulseStyle]}
        />
        <View style={styles.ringCenter}>
          <Text style={[styles.count, { color: over ? RECORD_AMBER : colors.text }]}>
            {isDuration ? formatTut(remaining * 1000) : taps > 0 ? String(taps) : '—'}
          </Text>
          {prefs.tempo && !reduced && !isDuration ? (
            <Text style={[styles.tempo, { color: colors.textMuted }]}>
              {t('immersive.effort.tempo')}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.meta}>
        <Text style={[styles.load, { color: colors.text }]}>
          {isDuration
            ? runtime.durationValue
            : t('immersive.effort.target', {
                weight: units.formatWeight(runtime.displayWeightKg),
                reps: target,
              })}
        </Text>
        <Text style={[styles.tut, { color: colors.textMuted }]}>
          {t('immersive.effort.tut', { time: formatTut(tut) })}
        </Text>
        {/* La consigne technique de la fiche, **première phrase seulement** : on se met en place,
            on ne lit pas un mode d'emploi. Absente si l'exercice n'a pas d'instructions. */}
        {runtime.cue ? (
          <Text style={[styles.cue, { color: colors.text }]} numberOfLines={2}>
            {runtime.cue}
          </Text>
        ) : null}
        {!isDuration ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('immersive.effort.hint')}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <PressableScale
          accessibilityRole="button"
          haptic="confirm"
          onPress={onDone}
          style={[styles.done, { backgroundColor: colors.text }]}
        >
          <Text style={[styles.doneLabel, { color: colors.background }]}>
            {t('immersive.effort.done')}
          </Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  halo: {
    position: 'absolute',
    left: '-30%',
    right: '-30%',
    top: '15%',
    height: '55%',
    borderRadius: 999,
    opacity: 0.25,
  },
  top: { paddingHorizontal: 20, paddingTop: 12 },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  ringZone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 2,
  },
  ringCenter: { alignItems: 'center', gap: 6 },
  count: { fontFamily: fontFamily.displayXBold, fontSize: 104, letterSpacing: -4, lineHeight: 108 },
  tempo: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  meta: { alignItems: 'center', gap: 6, paddingHorizontal: 24 },
  load: { fontFamily: fontFamily.displayBold, fontSize: 26, letterSpacing: -0.8 },
  tut: { fontFamily: fontFamily.mono, fontSize: 13 },
  cue: { fontFamily: fontFamily.bodySemi, fontSize: 13.5, textAlign: 'center', lineHeight: 18 },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5, textAlign: 'center' },
  footer: { padding: 20 },
  done: { minHeight: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  doneLabel: { fontFamily: fontFamily.bodyBold, fontSize: 18 },
});
