/**
 * US MUSCU-UX02 — « ce que tu as fait », l'ancre du bilan.
 *
 * ── Ce que ce composant réunit ───────────────────────────────────────────────────────────────────
 * Il remplace **deux** rendus qui avaient divergé : le `SummaryExerciseList` du récap (une ligne
 * condensée par exercice + l'écart depuis la dernière fois, mais aucun détail) et les
 * `ExerciseCard`/`SetRow` de l'historique (le détail série par série avec l'écart au planifié et le
 * RPE, mais aucune comparaison). Chacun avait la moitié de l'information ; personne n'avait les deux.
 *
 * ── Les trois états du détail ────────────────────────────────────────────────────────────────────
 * `hidden` (Simple) · `collapsed` (Intermédiaire — la carte est dépliable au doigt) · `expanded`
 * (Avancé). C'est la parade à l'écran de 4 000 px (spec D6) : le détail existe dès l'Intermédiaire,
 * mais il ne s'impose qu'en Avancé.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { ExerciseDelta, ReportExercise, ReportSet } from '@wellness/shared';
import { useIntensity } from '@/hooks/useIntensity';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { Eyebrow } from './ReportPrimitives';

/** « m:ss » pour les séries à la durée. */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Une série, en détail
// ---------------------------------------------------------------------------

function SetRow({ set, index }: { set: ReportSet; index: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const intensity = useIntensity();

  const isWarmup = set.setType === 'warmup';
  const typeLabel = t(`workout.report.setType.${set.setType}`, set.setType);

  let value: string;
  if (set.setType === 'duration') {
    const duration = set.durationSeconds === null ? '—' : formatDuration(set.durationSeconds);
    value = set.weightKg === null ? duration : `${duration} · +${units.formatWeight(set.weightKg)}`;
  } else if (set.reps !== null && set.weightKg !== null) {
    value = `${units.formatWeight(set.weightKg)} × ${set.reps}`;
  } else if (set.reps !== null) {
    value = t('workout.report.repsOnly', { count: set.reps });
  } else if (set.weightKg !== null) {
    value = units.formatWeight(set.weightKg);
  } else {
    value = '—';
  }

  // Écart au planifié + intensité de la série. La flèche compare le réalisé à la prescription du
  // jour (`planned_weight_kg`, figée au démarrage) et non au plan actuel, qui a pu changer depuis.
  const meta: string[] = [];
  if (set.plannedWeightKg !== null) {
    const arrow =
      set.weightKg === null
        ? '='
        : set.weightKg > set.plannedWeightKg
          ? '▲'
          : set.weightKg < set.plannedWeightKg
            ? '▼'
            : '=';
    meta.push(
      `${t('workout.report.planned', { weight: units.formatWeight(set.plannedWeightKg) })} ${arrow}`,
    );
  }
  // Affiché dans l'échelle choisie par l'utilisateur (RPE ou RIR, US UX-05). La donnée stockée reste
  // le RPE : le RIR est calculé à l'affichage, jamais écrit.
  const intensityLabel = intensity.format(set.rpe);
  if (intensityLabel !== null) meta.push(intensityLabel);

  return (
    <View style={styles.setRow}>
      <Text style={[styles.setIndex, { color: isWarmup ? colors.borderStrong : colors.textMuted }]}>
        {index + 1}
      </Text>
      <Text style={[styles.setType, { color: isWarmup ? colors.borderStrong : colors.textMuted }]}>
        {typeLabel}
      </Text>
      <View style={styles.setValueCol}>
        <Text style={[styles.setValue, { color: isWarmup ? colors.textMuted : colors.text }]}>
          {value}
        </Text>
        {meta.length > 0 ? (
          <Text style={[styles.setMeta, { color: colors.borderStrong }]}>{meta.join(' · ')}</Text>
        ) : null}
      </View>
      {/* Une séance interrompue garde ses séries prévues : sans cette distinction, on relirait un
          entraînement qu'on n'a pas fait. */}
      {set.done ? (
        <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
      ) : (
        <Ionicons name="ellipse-outline" size={14} color={colors.border} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Une carte d'exercice
// ---------------------------------------------------------------------------

function ExerciseCard({
  exercise,
  detail,
}: {
  exercise: ReportExercise;
  detail: 'hidden' | 'collapsed' | 'expanded';
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  /**
   * 🔴 **L'état suit la prop, il ne la copie pas.**
   *
   * `useState(detail === 'expanded')` n'évalue son initialiseur qu'au **montage**. Or la carte est
   * keyée sur `exerciseId`, qui ne change pas quand on bascule de niveau : React re-rendait sans
   * remonter, et `open` restait figé sur la valeur du premier affichage. Passer en Avancé laissait
   * donc le détail replié, et revenir en Simple laissait un écran déplié **sans chevron pour le
   * refermer** — l'utilisateur coincé avec un contenu Avancé sous un libellé Simple.
   *
   * L'effet réaligne l'état à chaque changement de niveau, tout en laissant le dépliage manuel
   * vivre à l'intérieur d'un niveau donné.
   */
  const [state, setState] = useState({ detail, open: detail === 'expanded' });
  if (state.detail !== detail) {
    // Ajustement **pendant le rendu**, le patron officiel de React pour un état dérivé d'une prop.
    // Un `useEffect` ferait le travail mais déclencherait un second rendu en cascade — et la règle
    // de lint du dépôt le refuse, à raison : ici l'ajustement est synchrone et sans effet de bord.
    setState({ detail, open: detail === 'expanded' });
  }
  const open = state.open;
  const setOpen = (next: (v: boolean) => boolean) =>
    setState((s) => ({ ...s, open: next(s.open) }));

  /** Résumé d'une ligne : « 82,5 kg × 8 · 8 · 7 ». */
  const summarize = (): string | null => {
    const working = exercise.workingSets;
    if (working.length === 0) return null;
    const first = working[0]!;
    if (first.setType === 'duration') {
      return working.map((s) => formatDuration(s.durationSeconds ?? 0)).join(' · ');
    }
    const sameWeight = working.every((s) => s.weightKg === first.weightKg);
    const reps = working.map((s) => s.reps ?? '—').join(' · ');
    // Charge commune sortie en préfixe : « 82,5 kg × 8 · 8 · 8 » se lit d'un coup, là où
    // « 82,5×8, 82,5×8, 82,5×8 » oblige à comparer trois fois le même nombre.
    if (sameWeight && first.weightKg !== null) {
      return `${units.formatWeight(first.weightKg)} × ${reps}`;
    }
    return working
      .map((s) => (s.weightKg === null ? `${s.reps ?? '—'}` : `${units.formatWeight(s.weightKg)}×${s.reps ?? '—'}`))
      .join(' · ');
  };

  /** Libellé de l'écart, dans l'unité de ce qui a bougé. */
  const deltaLabel = (delta: ExerciseDelta): { text: string; tone: 'up' | 'down' | 'neutral' } => {
    if (delta.kind === 'equal') return { text: '=', tone: 'neutral' };
    if (delta.kind === 'weight') {
      return {
        text: `${delta.deltaKg > 0 ? '▲ +' : '▼ −'}${units.formatWeight(Math.abs(delta.deltaKg))}`,
        tone: delta.deltaKg > 0 ? 'up' : 'down',
      };
    }
    if (delta.kind === 'reps') {
      return {
        text: t(delta.deltaReps > 0 ? 'workout.report.deltaRepsUp' : 'workout.report.deltaRepsDown', {
          count: Math.abs(delta.deltaReps),
        }),
        tone: delta.deltaReps > 0 ? 'up' : 'down',
      };
    }
    return {
      text: t(
        delta.deltaSeconds > 0 ? 'workout.report.deltaTimeUp' : 'workout.report.deltaTimeDown',
        { duration: formatDuration(Math.abs(delta.deltaSeconds)) },
      ),
      tone: delta.deltaSeconds > 0 ? 'up' : 'down',
    };
  };

  const summary = summarize();
  if (summary === null) return null;

  const badge = exercise.delta ? deltaLabel(exercise.delta) : null;
  const badgeStyle =
    badge?.tone === 'up'
      ? { color: colors.success, backgroundColor: `${colors.success}24` }
      : badge?.tone === 'down'
        ? { color: colors.accent, backgroundColor: `${colors.accent}1f` }
        : { color: colors.textMuted, backgroundColor: colors.surfaceAlt };

  const expandable = detail !== 'hidden';

  const head = (
    <View style={styles.headRow}>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {exercise.exerciseName}
      </Text>
      {badge ? <Text style={[styles.delta, badgeStyle]}>{badge.text}</Text> : null}
      {expandable ? (
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      ) : null}
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {expandable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${exercise.exerciseName} · ${summary}`}
          onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          {head}
        </Pressable>
      ) : (
        head
      )}

      {open ? (
        <View style={[styles.setList, { borderTopColor: colors.border }]}>
          {exercise.sets.map((set, index) => (
            <SetRow key={set.id} set={set} index={index} />
          ))}
        </View>
      ) : (
        <Text style={[styles.sets, { color: colors.textMuted }]}>{summary}</Text>
      )}

      {/* Dit **pourquoi** il n'y a pas de badge, plutôt que de laisser un vide qu'on lit comme un
          oubli. Un premier passage n'a pas « progressé de 0 ». */}
      {exercise.delta === null && open ? (
        <Text style={[styles.firstTime, { color: colors.borderStrong }]}>
          {t('workout.report.firstTime')}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// La liste
// ---------------------------------------------------------------------------

export function ReportExerciseList({
  exercises,
  detail,
  warmupSets,
}: {
  exercises: ReportExercise[];
  detail: 'hidden' | 'collapsed' | 'expanded';
  warmupSets: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (exercises.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Eyebrow>{t('workout.report.whatYouDid')}</Eyebrow>
      {exercises.map((exercise) => (
        <ExerciseCard key={exercise.exerciseId} exercise={exercise} detail={detail} />
      ))}
      {/* Les échauffements sortent du tonnage et du compte de séries (règle métier §8). Sans cette
          mention, le total paraît simplement trop bas et rien ne l'explique. */}
      {warmupSets > 0 ? (
        <Text style={[styles.warmupNote, { color: colors.textMuted }]}>
          {t('workout.report.warmupCount', { count: warmupSets })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  card: { borderRadius: 16, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 7 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 24 },
  name: { flex: 1, minWidth: 0, fontFamily: fontFamily.bodySemi, fontSize: 14.5 },
  delta: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  sets: { fontFamily: fontFamily.mono, fontSize: 12.5 },
  setList: { gap: 7, paddingTop: 11, borderTopWidth: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setIndex: { fontFamily: fontFamily.mono, fontSize: 11.5, width: 14, textAlign: 'right' },
  setType: { fontFamily: fontFamily.body, fontSize: 11.5, width: 52 },
  setValueCol: { flex: 1, minWidth: 0, gap: 2 },
  setValue: { fontFamily: fontFamily.mono, fontSize: 13 },
  setMeta: { fontFamily: fontFamily.mono, fontSize: 10.5 },
  firstTime: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 15 },
  warmupNote: { fontFamily: fontFamily.body, fontSize: 12.5, textAlign: 'center' },
  pressed: { opacity: 0.8 },
});
