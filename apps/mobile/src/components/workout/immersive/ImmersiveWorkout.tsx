/**
 * L'écran de séance en **mode immersif** — US MUSCU-UX03, spec §4.
 *
 * ── Ce qu'il est, et ce qu'il n'est pas ─────────────────────────────────────────────────────────
 * Ce n'est **pas** un nouvel écran de séance : c'est un **rendu** de l'état que `workout.tsx`
 * porte déjà. Aucune donnée n'est lue ni écrite ici ; tout passe par le `runtime`. C'est ce qui
 * permet de basculer classique ↔ immersif en pleine séance sans rien perdre (spec R-MO-4), et
 * c'est aussi ce qui garantit que le mode classique reste, lui, **strictement inchangé**.
 *
 * ── La composition ─────────────────────────────────────────────────────────────────────────────
 *  · en-tête  — chrono, ruban segmenté par exercice, avance sur le fantôme ;
 *  · scène    — l'exercice, ses repères, la barre chargée, l'enjeu du record ;
 *  · pont     — la saisie et l'action, **au même endroit qu'en classique** (règle R4-1).
 *
 * Les moments qui prennent l'écran (effort, cadran, repos, clôture) sont des composants à part.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  computeFinalChallenge,
  computeGhost,
  pickCoachLine,
  rpeToFeel,
  type GhostDoneSet,
} from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { SetOptions } from '@/components/workout/SetOptions';
import { BarbellLoad } from '@/components/workout/immersive/BarbellLoad';
import { EffortScreen } from '@/components/workout/immersive/EffortScreen';
import { ImmersiveRest } from '@/components/workout/immersive/ImmersiveRest';
import { RepDial } from '@/components/workout/immersive/RepDial';
import { SessionClosing } from '@/components/workout/immersive/SessionClosing';
import { SessionPlanSheet } from '@/components/workout/immersive/SessionPlanSheet';
import { ghostDayLabel } from '@/components/workout/immersive/day-label';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { RECORD_AMBER } from '@/components/workout/immersive/theme';
import type { ImmersiveRuntime } from '@/components/workout/immersive/types';
import { fontFamily } from '@/theme/fonts';

/**
 * Les moments qui appartiennent à ce rendu. Le repos et la clôture, eux, sont portés par le
 * runtime : ils se déclenchent aussi hors de ce rendu (le menu ⋮ clôt la séance, par exemple).
 */
type Phase = 'ready' | 'effort' | 'dial';

export function ImmersiveWorkout({ runtime }: { runtime: ImmersiveRuntime }) {
  const { t, i18n } = useTranslation();
  const { colors, current, entries, units, prefs } = runtime;

  // Le pont suit le clavier (règle R4-1 de MUSCU-UX01, conservée) : depuis l'edge-to-edge forcé
  // du SDK 54, `adjustResize` ne redimensionne plus rien et la zone de saisie passerait SOUS le
  // clavier — on taperait une charge sans voir ce qu'on tape.
  const keyboardHeight = useKeyboardHeight();

  const [phase, setPhase] = useState<Phase>('ready');
  const [taps, setTaps] = useState(0);
  const [effortStartedAt, setEffortStartedAt] = useState<number | null>(null);
  // « Modifier avant de commencer », depuis le brief : la séance s'ouvre sur son plan.
  const [planOpen, setPlanOpen] = useState(runtime.openPlanOnMount);

  // Le repos reprend la main : l'effort et le cadran appartiennent à la série qui vient d'être
  // validée, ils n'ont plus de sens une fois qu'elle l'est.
  //
  // Ajusté **pendant le rendu** et non dans un effet : c'est le patron que React recommande pour
  // « remettre à zéro quand une prop change » — un effet provoquerait un rendu de plus, pendant
  // lequel l'écran d'effort resterait visible par-dessus le repos qui vient de démarrer.
  const [restWasActive, setRestWasActive] = useState(runtime.rest.active);
  if (restWasActive !== runtime.rest.active) {
    setRestWasActive(runtime.rest.active);
    if (runtime.rest.active) {
      setPhase('ready');
      setTaps(0);
      setEffortStartedAt(null);
    }
  }

  // ── Fantôme : cumul d'aujourd'hui contre la même séance, la dernière fois ─────────────────────
  const doneSets: GhostDoneSet[] = entries.flatMap((entry) =>
    entry.sets
      .map((set, rank) => ({ set, rank }))
      .filter(({ set }) => set.done)
      .map(({ set, rank }) => ({
        exerciseId: entry.exerciseId,
        rank,
        setType: set.setType,
        reps: set.reps,
        weightKg: set.weightKg,
      })),
  );
  const ghost = computeGhost({ done: doneSets, references: runtime.references });
  const ghostVisible = prefs.ghost && ghost.hasGhost && runtime.doneSets > 0;

  // Le jour du fantôme : la référence la plus récente de la séance. « mardi » tant qu'il n'y a
  // qu'un mardi possible (moins de 7 jours), la date au-delà.
  const dayLabel = ghostDayLabel(runtime.references, i18n.language) ?? t('immersive.ghost.lastTime');

  // ── Repères de la scène ──────────────────────────────────────────────────────────────────────
  const exerciseIndex = current ? entries.findIndex((e) => e.exerciseId === current.entry.exerciseId) : -1;
  const isLastExercise = exerciseIndex >= 0 && exerciseIndex === entries.length - 1;
  const isLastSet =
    Boolean(current) && isLastExercise && current!.rang === current!.entry.sets.length - 1;

  const bests = current ? runtime.bests[current.entry.exerciseId] : undefined;
  const recordWeight = bests?.maxWeightKg ?? null;
  const stakeOn =
    runtime.level !== 'simplified' &&
    recordWeight !== null &&
    runtime.displayWeightKg !== null &&
    runtime.displayWeightKg > recordWeight;

  // Le défi de la dernière série (spec §5.12) : le seul moment où le fantôme sert à autre chose
  // qu'à regarder. Il reste prudent — jamais après un « Limite », jamais hors de portée.
  const lastDoneRpe = entries
    .flatMap((entry) => entry.sets)
    .filter((set) => set.done)
    .at(-1)?.rpe;
  const challenge =
    isLastSet && ghostVisible
      ? computeFinalChallenge({
          you: ghost.you,
          ghostTotal: ghost.ghostTotal,
          weightKg: runtime.displayWeightKg,
          plannedReps: Number(runtime.displayReps) || null,
          lastFeel: lastDoneRpe == null ? null : rpeToFeel(lastDoneRpe),
        })
      : { kind: 'none' as const };

  // « Dernière série de la séance » : dite une fois, quand elle devient la série courante.
  const { speak } = runtime;
  useEffect(() => {
    if (!isLastSet) return;
    speak(pickCoachLine({ event: 'lastSet', character: prefs.coach }));
  }, [isLastSet, prefs.coach, speak]);

  const eyebrow = isLastSet
    ? t('immersive.stage.lastSet')
    : isLastExercise
      ? t('immersive.stage.lastExercise')
      : t('immersive.stage.exerciseIndex', { index: exerciseIndex + 1, total: entries.length });

  const nextLabel = current
    ? current.rang + 1 < current.entry.sets.length
      ? t('immersive.deck.nextSet', { name: current.entry.exerciseName, index: current.rang + 2 })
      : (entries[exerciseIndex + 1]?.exerciseName ?? t('immersive.deck.nextEnd'))
    : t('immersive.deck.nextEnd');

  // ── Clôture : la cérémonie se joue pendant le calcul, puis mène au bilan ──────────────────────
  // C'est l'écran de séance qui dit quand (`runtime.closing`), quel que soit le bouton — pont ou
  // menu. Séance sans aucune série validée : `onFinish` ouvre sa confirmation, et part au bilan
  // sans cérémonie, il n'y a rien à fêter.
  if (runtime.closing) {
    return (
      <SessionClosing
        runtime={runtime}
        ghost={ghost}
        ghostDayLabel={dayLabel}
        onOpenSummary={runtime.goToSummary}
      />
    );
  }

  // Le repos plein écran. Replié, il laisse la scène visible et se pose **au-dessus du pont**
  // (spec §5.9) — plus bas dans ce fichier, avec le reste de l'écran.
  if (runtime.rest.active && !runtime.rest.collapsed) {
    return (
      <>
        <ImmersiveRest
          runtime={runtime}
          ghost={ghost}
          ghostVisible={ghostVisible}
          ghostDayLabel={dayLabel}
          onOpenPlan={() => setPlanOpen(true)}
        />
        <SessionPlanSheet visible={planOpen} onClose={() => setPlanOpen(false)} runtime={runtime} />
      </>
    );
  }

  if (phase === 'effort' && current) {
    return (
      <EffortScreen
        runtime={runtime}
        taps={taps}
        startedAt={effortStartedAt}
        onTap={() => setTaps((n) => n + 1)}
        onDone={() => setPhase('dial')}
      />
    );
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Pressable onPress={runtime.onLeave} hitSlop={10} accessibilityLabel={t('workout.leave.later')}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.timer, { color: colors.text }]}>{runtime.elapsed}</Text>
        <Pressable onPress={runtime.onOpenMenu} hitSlop={10} accessibilityLabel={t('workout.menu.title')}>
          <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Ruban segmenté : un segment par exercice, large comme son nombre de séries. L'avancement
          d'une séance n'est pas une barre unique — on veut voir où l'on en est **dans le plan**. */}
      {entries.length > 0 ? (
        <View
          style={styles.ribbon}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: runtime.totalSets, now: runtime.doneSets }}
        >
          {entries.map((entry) => {
            const done = entry.sets.filter((set) => set.done).length;
            const ratio = entry.sets.length > 0 ? done / entry.sets.length : 0;
            const complete = ratio >= 1;
            return (
              <View
                key={entry.exerciseId}
                style={[styles.segment, { flexGrow: entry.sets.length, backgroundColor: colors.track }]}
              >
                <View
                  style={[
                    styles.segmentFill,
                    {
                      width: `${Math.round(ratio * 100)}%`,
                      backgroundColor: complete ? colors.success : colors.accent,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {t('workout.setsProgress', { done: runtime.doneSets, total: runtime.totalSets })}
        </Text>
        {ghostVisible ? (
          <Text
            style={[
              styles.ghostPill,
              {
                color: ghost.delta >= 0 ? colors.success : colors.textMuted,
                backgroundColor: colors.surfaceAlt,
              },
            ]}
          >
            {t(ghost.delta >= 0 ? 'immersive.ghost.pillAhead' : 'immersive.ghost.pillBehind', {
              weight: units.formatWeight(Math.abs(Math.round(ghost.delta))),
            })}
          </Text>
        ) : null}
      </View>
    </View>
  );

  /** Tout est validé : le pont devient la clôture, comme en classique (spec §4.3). */
  if (!current && entries.length > 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.doneStage}>
          <View style={[styles.doneIcon, { backgroundColor: `${colors.success}29` }]}>
            <Ionicons name="checkmark" size={30} color={colors.success} />
          </View>
          <Text style={[styles.doneTitle, { color: colors.text }]}>{t('workout.sessionDone')}</Text>
          <Text style={[styles.doneHint, { color: colors.textMuted }]}>
            {t('immersive.done.hint')}
          </Text>
        </View>
        <View style={[styles.deck, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.finishStats}>
            <Text style={[styles.finishValue, { color: colors.text }]}>{runtime.elapsed}</Text>
            <Text style={[styles.finishLabel, { color: colors.textMuted }]}>
              {t('workout.summary.duration')}
            </Text>
          </View>
          <PressableScale
            accessibilityRole="button"
            onPress={runtime.onFinish}
            style={[styles.primary, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.primaryLabel, { color: colors.accentText }]}>
              {t('workout.finishSession')}
            </Text>
          </PressableScale>
          <Pressable
            accessibilityRole="button"
            onPress={() => runtime.onAddSet(entries[entries.length - 1]?.exerciseId ?? '')}
            style={styles.secondary}
          >
            <Text style={[styles.secondaryLabel, { color: colors.textMuted }]}>
              {t('workout.addSet')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: colors.background },
        keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null,
      ]}
      edges={keyboardHeight > 0 ? ['top'] : ['top', 'bottom']}
    >
      {header}

      {current ? (
        <>
          <ScrollView contentContainerStyle={styles.stage} keyboardShouldPersistTaps="handled">
            <View>
              <Text
                style={[
                  styles.eyebrow,
                  { color: isLastExercise || isLastSet ? colors.accent : colors.textMuted },
                ]}
              >
                {eyebrow}
              </Text>
              <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={2}>
                {current.entry.exerciseName}
              </Text>
            </View>

            {/* Frise des séries : ce qui est fait, où l'on en est, ce qui reste. */}
            <View style={styles.chips}>
              {runtime.setChips.map((chip, index) => {
                const isCurrent = index === current.rang;
                if (chip.done) {
                  return (
                    <View key={chip.id} style={[styles.chipDone, { backgroundColor: `${colors.success}24` }]}>
                      <Ionicons name="checkmark" size={12} color={colors.success} />
                      <Text style={[styles.chipDoneText, { color: colors.success }]}>
                        {chip.label ?? '—'}
                      </Text>
                    </View>
                  );
                }
                return (
                  <View
                    key={chip.id}
                    style={[
                      isCurrent ? styles.chipCurrent : styles.chipTodo,
                      isCurrent ? { borderColor: colors.accent } : { backgroundColor: colors.surfaceAlt },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: isCurrent ? colors.accent : colors.textMuted }]}>
                      {isCurrent
                        ? t('workout.setProgress', { current: index + 1, total: runtime.setChips.length })
                        : String(index + 1)}
                    </Text>
                  </View>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('workout.addSet')}
                hitSlop={8}
                onPress={() => runtime.onAddSet(current.entry.exerciseId)}
                style={styles.chipAdd}
              >
                <Ionicons name="add" size={16} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Repères : la dernière fois, la consigne du plan, la suggestion — par niveau. */}
            <View style={styles.refs}>
              {runtime.lastPerfLabel ? (
                <Ref label={t('workout.lastTimeShort')} value={runtime.lastPerfLabel} colors={colors} />
              ) : null}
              {runtime.plannedLabel ? (
                <Ref
                  label={t('workout.plannedShort')}
                  value={runtime.plannedLabel}
                  delta={runtime.deltaLabel}
                  deltaPositive={runtime.deltaPositive}
                  colors={colors}
                />
              ) : null}
              {runtime.suggestionLabel ? (
                <Ref
                  label={t('workout.suggestionShort')}
                  value={runtime.suggestionLabel}
                  valueColor={colors.success}
                  colors={colors}
                />
              ) : null}
            </View>

            {/* La barre chargée : ce qu'il faut mettre de chaque côté. Exercices à la barre
                seulement — sur une machine ou des haltères, il n'y a rien à charger. */}
            {runtime.showBarbell ? (
              <BarbellLoad
                totalKg={runtime.displayWeightKg}
                barKg={prefs.barKg}
                imperial={units.system === 'imperial'}
                colors={colors}
              />
            ) : null}

            {/* L'enjeu : l'app prévient AVANT de soulever. */}
            {stakeOn && recordWeight !== null ? (
              <View style={[styles.stake, { borderColor: `${RECORD_AMBER}58`, backgroundColor: `${RECORD_AMBER}14` }]}>
                <Ionicons name="trophy-outline" size={20} color={RECORD_AMBER} />
                <Text style={[styles.stakeText, { color: colors.text }]}>
                  {t('immersive.stage.stake', {
                    weight: units.formatWeight(runtime.displayWeightKg ?? 0),
                    record: units.formatWeight(recordWeight),
                  })}
                </Text>
              </View>
            ) : null}

            {/* Le défi : « 6 reps à 82,5 kg et mardi est battu ». Chiffré, atteignable, ou tu. */}
            {challenge.kind !== 'none' ? (
              <View style={[styles.stake, { borderColor: `${colors.success}58`, backgroundColor: `${colors.success}14` }]}>
                <Ionicons name="flash-outline" size={20} color={colors.success} />
                <Text style={[styles.stakeText, { color: colors.text }]}>
                  {challenge.kind === 'challenge'
                    ? t('immersive.challenge.reach', {
                        count: challenge.reps,
                        weight: units.formatWeight(runtime.displayWeightKg ?? 0),
                        day: dayLabel,
                      })
                    : t('immersive.challenge.ahead', {
                        weight: units.formatWeight(challenge.aheadKg),
                        day: dayLabel,
                      })}
                </Text>
              </View>
            ) : null}

            {/* Échauffement et options : exactement les contrôles du mode classique. */}
            <View style={styles.chipsRow}>
              {runtime.level !== 'simplified' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: runtime.currentSetType === 'warmup' }}
                  onPress={() =>
                    runtime.onSetType(runtime.currentSetType === 'warmup' ? 'normal' : 'warmup')
                  }
                  style={[
                    styles.warmup,
                    {
                      backgroundColor:
                        runtime.currentSetType === 'warmup' ? colors.accent : colors.surfaceAlt,
                    },
                  ]}
                >
                  <Ionicons
                    name="flame-outline"
                    size={14}
                    color={runtime.currentSetType === 'warmup' ? colors.accentText : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.warmupLabel,
                      {
                        color:
                          runtime.currentSetType === 'warmup' ? colors.accentText : colors.textMuted,
                      },
                    ]}
                  >
                    {t('workout.warmupToggle')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <SetOptions
              level={runtime.level}
              setType={runtime.currentSetType}
              onSetType={runtime.onSetType}
              rpe={runtime.rpe}
              onSetRpe={runtime.onSetRpe}
              note={runtime.note}
              onChangeNote={runtime.onChangeNote}
              onBlurNote={runtime.onBlurNote}
              supersetLink={runtime.supersetLink}
              onRequestLinkSuperset={runtime.onRequestLinkSuperset}
              onUnlinkSuperset={runtime.onUnlinkSuperset}
              colors={colors}
            />
          </ScrollView>

          {/* Repos replié : il se pose **au-dessus** du pont au lieu de le recouvrir (spec §5.9),
              ce qui laisse la série suivante réglable pendant que le temps tourne. */}
          {runtime.rest.active ? <RestBar runtime={runtime} /> : null}

          {/* ── Le pont : « Ensuite », la saisie, l'action. Jamais ailleurs qu'ici. ───────────── */}
          <View style={[styles.deck, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPlanOpen(true)}
              style={[styles.peek, { borderBottomColor: colors.border }]}
            >
              <Ionicons name="list-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.peekText, { color: colors.text }]} numberOfLines={1}>
                <Text style={[styles.peekLabel, { color: colors.textMuted }]}>
                  {`${t('workout.restNext')} · `}
                </Text>
                {nextLabel}
              </Text>
              <Ionicons name="chevron-up" size={16} color={colors.accent} />
            </Pressable>

            <View style={styles.deckMeta}>
              <Text style={[styles.deckMetaText, { color: colors.textMuted }]}>
                {t('workout.setProgress', {
                  current: current.rang + 1,
                  total: current.entry.sets.length,
                })}
              </Text>
              <Text style={[styles.deckMetaText, { color: colors.textMuted }]}>
                {t('workout.restSeconds', { count: runtime.rest.restSeconds })}
              </Text>
            </View>

            <View style={styles.fields}>
              <Field
                value={
                  runtime.currentSetType === 'duration' ? runtime.durationValue : runtime.displayReps
                }
                unit={
                  runtime.currentSetType === 'duration' ? t('workout.durationLabel') : t('workout.reps')
                }
                onStep={(delta) => {
                  if (runtime.currentSetType === 'duration') {
                    runtime.applyEdit({
                      durationSeconds: Math.max(0, (runtime.displayDurationSeconds ?? 0) + delta * 5),
                    });
                    return;
                  }
                  const base = Number(runtime.displayReps);
                  runtime.applyEdit({
                    reps: String(Math.max(0, (Number.isNaN(base) ? 0 : base) + delta)),
                  });
                }}
                colors={colors}
              />
              <Field
                value={units.weightInputValue(runtime.displayWeightKg)}
                unit={units.weightSymbol}
                highlight={stakeOn}
                onStep={(delta) =>
                  runtime.applyEdit({
                    weightKg: Math.max(0, (runtime.displayWeightKg ?? 0) + delta * 2.5),
                  })
                }
                colors={colors}
              />
            </View>

            <PressableScale
              accessibilityRole="button"
              onPress={() => {
                setTaps(0);
                setEffortStartedAt(Date.now());
                setPhase('effort');
                // La seule parole autorisée pendant l'effort : la consigne, dite au moment où l'on
                // se met en place. Sans instructions sur la fiche, le coach se tait.
                if (runtime.cue) {
                  runtime.speak(
                    pickCoachLine({
                      event: 'setCue',
                      character: prefs.coach,
                      vars: { cue: runtime.cue },
                    }),
                  );
                }
              }}
              style={[styles.primary, { backgroundColor: colors.accent }]}
            >
              <Ionicons name="play" size={18} color={colors.accentText} />
              <Text style={[styles.primaryLabel, { color: colors.accentText }]}>
                {t('immersive.deck.launch')}
              </Text>
            </PressableScale>

            {/* Le chemin court des habitués : valider sans passer par l'effort ni le cadran. */}
            <Pressable accessibilityRole="button" onPress={() => runtime.onValidate()} style={styles.secondary}>
              <Text style={[styles.secondaryLabel, { color: colors.textMuted }]}>
                {runtime.chainsToSuperset
                  ? t('workout.validateAndChain')
                  : t('immersive.deck.validateDirectly')}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.doneStage}>
          <Text style={[styles.doneHint, { color: colors.textMuted }]}>{t('workout.empty')}</Text>
        </View>
      )}

      {phase === 'dial' && current ? (
        <RepDial
          runtime={runtime}
          taps={taps}
          startedAt={effortStartedAt}
          onCancel={() => setPhase('ready')}
          onValidate={(override) => {
            setPhase('ready');
            setTaps(0);
            runtime.onValidate(override);
          }}
        />
      ) : null}

      <SessionPlanSheet visible={planOpen} onClose={() => setPlanOpen(false)} runtime={runtime} />
    </SafeAreaView>
  );
}

/** La barre de repos repliée : le temps continue, la scène reste manipulable. */
function RestBar({ runtime }: { runtime: ImmersiveRuntime }) {
  const { t } = useTranslation();
  const { colors, rest } = runtime;
  const left = Math.max(0, rest.secondsLeft);
  const countdown =
    left < 60
      ? t('workout.restRemaining', { seconds: left })
      : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <View style={[styles.restBar, { backgroundColor: colors.surfaceAlt }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.restTitle')}
        onPress={rest.onToggleCollapse}
        style={styles.restBarMain}
      >
        <Ionicons name="timer-outline" size={18} color={colors.text} />
        <Text style={[styles.restBarText, { color: colors.text }]}>
          {`${t('workout.restTitle')} · ${countdown}`}
        </Text>
        <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={rest.onSkip} style={styles.restBarSkip}>
        <Text style={[styles.restBarSkipLabel, { color: colors.accent }]}>
          {t('workout.skipRest')}
        </Text>
      </Pressable>
    </View>
  );
}

/** Une ligne de repère « libellé · valeur », avec l'écart au prévu quand il existe. */
function Ref({
  label,
  value,
  delta,
  deltaPositive,
  valueColor,
  colors,
}: {
  label: string;
  value: string;
  delta?: string | null;
  deltaPositive?: boolean;
  valueColor?: string;
  colors: ImmersiveRuntime['colors'];
}) {
  return (
    <View style={styles.refRow}>
      <Text style={[styles.refLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.refValue, { color: valueColor ?? colors.text }]}>{value}</Text>
      {delta ? (
        <Text
          style={[
            styles.refDelta,
            {
              color: deltaPositive ? colors.success : colors.accent,
              backgroundColor: colors.surfaceAlt,
            },
          ]}
        >
          {delta}
        </Text>
      ) : null}
    </View>
  );
}

/** Un champ du pont : − / valeur / +. Même geste qu'en classique, en plus grand. */
function Field({
  value,
  unit,
  onStep,
  highlight = false,
  colors,
}: {
  value: string;
  unit: string;
  onStep: (delta: number) => void;
  highlight?: boolean;
  colors: ImmersiveRuntime['colors'];
}) {
  const { t } = useTranslation();
  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: colors.background,
          borderColor: highlight ? RECORD_AMBER : colors.border,
        },
      ]}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('workout.stepDown', { field: unit })}
        haptic="select"
        onPress={() => onStep(-1)}
        style={[styles.step, { backgroundColor: colors.surfaceAlt }]}
      >
        <Ionicons name="remove" size={18} color={colors.text} />
      </PressableScale>
      <View style={styles.fieldCore}>
        <Text style={[styles.fieldValue, { color: colors.text }]} numberOfLines={1}>
          {value === '' ? '—' : value}
        </Text>
        <Text style={[styles.fieldUnit, { color: highlight ? RECORD_AMBER : colors.textMuted }]}>
          {unit.toUpperCase()}
        </Text>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('workout.stepUp', { field: unit })}
        haptic="select"
        onPress={() => onStep(1)}
        style={[styles.step, { backgroundColor: colors.surfaceAlt }]}
      >
        <Ionicons name="add" size={18} color={colors.text} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timer: { fontFamily: fontFamily.monoBold, fontSize: 19 },
  ribbon: { flexDirection: 'row', gap: 4, height: 6 },
  segment: { height: 6, borderRadius: 3, overflow: 'hidden', flexBasis: 0 },
  segmentFill: { height: 6, borderRadius: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meta: { fontFamily: fontFamily.mono, fontSize: 11 },
  ghostPill: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },

  stage: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, gap: 14 },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  exerciseName: {
    fontFamily: fontFamily.displayXBold,
    fontSize: 32,
    letterSpacing: -1.1,
    lineHeight: 34,
    marginTop: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  chipDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  chipDoneText: { fontFamily: fontFamily.monoBold, fontSize: 12 },
  chipCurrent: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  chipTodo: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontFamily: fontFamily.monoBold, fontSize: 12 },
  chipAdd: { paddingHorizontal: 6, paddingVertical: 6 },
  refs: { gap: 6 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refLabel: { width: 96, flexShrink: 0, fontFamily: fontFamily.body, fontSize: 12.5 },
  refValue: { flexShrink: 1, fontFamily: fontFamily.mono, fontSize: 13.5 },
  refDelta: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  stake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stakeText: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14, lineHeight: 19 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  warmup: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  warmupLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },

  restBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  restBarMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  restBarText: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  restBarSkip: { paddingHorizontal: 8, paddingVertical: 6 },
  restBarSkipLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  deck: {
    borderTopWidth: 1,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 10,
  },
  peek: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
  },
  peekText: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  peekLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  deckMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  deckMetaText: { fontFamily: fontFamily.mono, fontSize: 11.5 },
  fields: { flexDirection: 'row', gap: 10 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 18,
    padding: 5,
  },
  step: {
    width: 38,
    height: 52,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCore: { flex: 1, alignItems: 'center', gap: 2 },
  fieldValue: { fontFamily: fontFamily.displayXBold, fontSize: 32, letterSpacing: -1 },
  fieldUnit: { fontFamily: fontFamily.mono, fontSize: 9.5, letterSpacing: 1 },
  primary: {
    minHeight: 62,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryLabel: { fontFamily: fontFamily.bodyBold, fontSize: 18 },
  secondary: { minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },

  doneStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fontFamily.displayXBold, fontSize: 28, letterSpacing: -0.8 },
  doneHint: { fontFamily: fontFamily.body, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  finishStats: { alignItems: 'center', gap: 2, paddingTop: 12 },
  finishValue: { fontFamily: fontFamily.monoBold, fontSize: 18 },
  finishLabel: { fontFamily: fontFamily.bodySemi, fontSize: 9.5, letterSpacing: 0.6 },
});
