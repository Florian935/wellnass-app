/**
 * La série en cours — US MUSCU-UX03, spec §5.6, **repensée** par MUSCU-FIX02 (passe 2, 23/09/2026).
 *
 * ── Ce qu'il était, et pourquoi c'était faux ────────────────────────────────────────────────────
 * Un grand anneau à toucher « à chaque répétition ». Florian, en recette : « si tu es en train de
 * faire un squat, tu vas pas t'arrêter à chaque répétition pour taper ». L'écran demandait un
 * geste impossible au seul moment où l'on n'a pas les mains libres — et le compteur restait à
 * « — », puisque personne ne le touchait.
 *
 * ── Ce qu'il est ────────────────────────────────────────────────────────────────────────────────
 * Un écran **à regarder, pas à toucher**, lisible posé sur le banc, à un mètre :
 *  - **l'objectif** en très grand — la charge × les répétitions ;
 *  - **ce qu'il y a sur la barre**, par côté (exercices à la barre) — le dernier coup d'œil avant
 *    de se placer ;
 *  - **le chrono de la série** au centre de l'anneau, qui bat au tempo si le réglage est actif ;
 *  - **ce qu'il faut battre** : la même série, la dernière fois ;
 *  - **la consigne technique**, une phrase.
 * Un seul geste, **à la fin** : « Série terminée », sur toute la largeur. Le cadran s'ouvre alors
 * sur l'objectif — un glissé corrige si on en a fait plus ou moins.
 *
 * Série à la durée : l'anneau fait un **compte à rebours**, et le cadran s'ouvre tout seul à zéro.
 *
 * ── Accessibilité ───────────────────────────────────────────────────────────────────────────────
 * Le battement est **décoratif** : animations coupées (réglage ou système), l'écran est fixe et dit
 * exactement la même chose.
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { describeLoad } from '@/components/workout/immersive/BarbellLoad';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import type { ImmersiveRuntime } from '@/components/workout/immersive/types';
import { fontFamily } from '@/theme/fonts';

/** Tempo par défaut : 2 s de descente, 1 s de poussée. Aucune donnée de tempo n'existe en base. */
const DESCENT_MS = 2000;
const PUSH_MS = 1000;

/** Formate une durée en « m:ss ». */
function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

type Props = {
  runtime: ImmersiveRuntime;
  /** Début de la série (ms epoch) — le chrono, et la durée mesurée d'une série à la durée. */
  startedAt: number | null;
  onDone: () => void;
};

export function EffortScreen({ runtime, startedAt, onDone }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, current, units, prefs } = runtime;
  const reduced = useAppReducedMotion();

  const isDuration = runtime.currentSetType === 'duration';
  const target = isDuration ? 0 : Number(runtime.displayReps) || 0;
  const [now, setNow] = useState(() => Date.now());

  // Une seconde suffit : c'est une durée d'effort, pas un chronomètre de compétition.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = startedAt ? now - startedAt : 0;

  // Série à la durée : un **compte à rebours**. À zéro, le cadran s'ouvre tout seul avec la durée
  // atteinte — on n'a pas les mains libres pour le faire soi-même.
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
  const beating = !reduced && prefs.tempo && !isDuration;
  useEffect(() => {
    if (!beating) {
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
  }, [beat, beating]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.25 + (beat.value - 0.9) * 1.8 }));

  // Ce qu'il y a sur la barre, par côté — le dernier coup d'œil avant de se placer.
  const loadLabel =
    runtime.showBarbell && !isDuration && runtime.displayWeightKg !== null
      ? describeLoad({
          totalKg: runtime.displayWeightKg,
          barKg: prefs.barKg,
          imperial: units.system === 'imperial',
          t,
          language: i18n.language,
        }).label
      : null;

  // La même série, la dernière fois : ce qu'il faut égaler ou battre.
  const reference = current
    ? runtime.references[current.entry.exerciseId]?.sets[current.rang]
    : undefined;
  const lastLabel = reference
    ? isDuration
      ? reference.durationSeconds != null
        ? formatClock(reference.durationSeconds * 1000)
        : null
      : reference.reps != null
        ? `${units.formatWeight(reference.weightKg)} × ${reference.reps}`
        : null
    : null;

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
        <Text
          testID="effort-target"
          style={[styles.target, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {isDuration
            ? runtime.durationValue
            : t('immersive.effort.target', {
                weight: units.formatWeight(runtime.displayWeightKg),
                reps: target,
              })}
        </Text>
        {loadLabel ? (
          <Text style={[styles.load, { color: colors.textMuted }]} numberOfLines={2}>
            {loadLabel}
          </Text>
        ) : null}
      </View>

      <View style={styles.ringZone}>
        <Animated.View
          style={[styles.ring, { borderColor: colors.borderStrong }, pulseStyle]}
        />
        <View style={styles.ringCenter}>
          <Text testID="effort-clock" style={[styles.clock, { color: colors.text }]}>
            {formatClock(isDuration ? remaining * 1000 : elapsedMs)}
          </Text>
          <Text style={[styles.clockLabel, { color: colors.textMuted }]}>
            {beating ? t('immersive.effort.tempo') : t('immersive.effort.clock')}
          </Text>
        </View>
      </View>

      <View style={styles.meta}>
        {lastLabel ? (
          <Text style={[styles.last, { color: colors.textMuted }]}>
            {t('immersive.effort.last', { value: lastLabel })}
          </Text>
        ) : null}
        {/* La consigne technique de la fiche, **première phrase seulement**. Absente si
            l'exercice n'a pas d'instructions. */}
        {runtime.cue ? (
          <Text style={[styles.cue, { color: colors.text }]} numberOfLines={2}>
            {runtime.cue}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <PressableScale
          accessibilityRole="button"
          testID="effort-done"
          haptic="confirm"
          onPress={onDone}
          style={[styles.done, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.doneLabel, { color: colors.accentText }]}>
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
    top: '25%',
    height: '45%',
    borderRadius: 999,
    opacity: 0.25,
  },
  top: { paddingHorizontal: 20, paddingTop: 12, gap: 6 },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  // L'objectif se lit posé sur le banc : c'est le plus gros texte de l'écran.
  target: { fontFamily: fontFamily.displayXBold, fontSize: 52, letterSpacing: -2, lineHeight: 58 },
  load: { fontFamily: fontFamily.mono, fontSize: 13.5, lineHeight: 19 },
  ringZone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 2,
  },
  ringCenter: { alignItems: 'center', gap: 6 },
  clock: { fontFamily: fontFamily.monoBold, fontSize: 64, letterSpacing: -2, lineHeight: 70 },
  clockLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  meta: { alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  last: { fontFamily: fontFamily.bodySemi, fontSize: 15, textAlign: 'center' },
  cue: { fontFamily: fontFamily.bodySemi, fontSize: 13.5, textAlign: 'center', lineHeight: 18 },
  footer: { padding: 20 },
  // Tout en bas, sur toute la largeur, et haut : on le touche du bout d'un doigt fatigué.
  done: { minHeight: 84, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  doneLabel: { fontFamily: fontFamily.bodyBold, fontSize: 20 },
});
