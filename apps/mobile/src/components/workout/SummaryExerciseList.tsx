/**
 * US MUSCU-UX01 — « ce que tu as fait », le bloc qui manquait au résumé de séance.
 *
 * Le résumé affichait cinq agrégats en tableau — durée, exercices, séries, volume, densité — et
 * **rien** sur ce qui avait été soulevé. Pour revoir sa propre séance, il fallait quitter l'écran
 * et rouvrir l'historique.
 *
 * Ce bloc passe donc **devant** les agrégats, avec l'écart depuis le passage précédent : c'est lui
 * qui donne le sentiment de progresser, pas un tonnage cumulé.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ExerciseDelta, SetType } from '@wellness/shared';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Une série telle que le résumé la rend. */
type SummarySet = {
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  done: boolean;
};

type SummaryEntry = {
  exerciseId: string;
  exerciseName: string;
  sets: SummarySet[];
};

type Props = {
  entries: SummaryEntry[];
  /** Écart par exercice ; absent quand il n'y a pas de référence (premier passage). */
  deltas: Map<string, ExerciseDelta>;
};

/** « m:ss » pour les séries à la durée. */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function SummaryExerciseList({ entries, deltas }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  /** Résume les séries d'un exercice : « 82,5 kg × 8 · 8 · 8 · 7 ». */
  const summarize = (sets: SummarySet[]): string | null => {
    const working = sets.filter((s) => s.done && s.setType !== 'warmup');
    if (working.length === 0) return null;

    const first = working[0]!;
    if (first.setType === 'duration') {
      return working.map((s) => formatDuration(s.durationSeconds ?? 0)).join(' · ');
    }

    const sameWeight = working.every((s) => s.weightKg === first.weightKg);
    const reps = working.map((s) => s.reps ?? '—').join(' · ');
    // Charge commune sortie en préfixe : « 82,5 kg × 8 · 8 · 8 » se lit d'un coup, là où
    // « 82,5×8, 82,5×8, 82,5×8 » oblige à comparer trois fois le même nombre.
    if (sameWeight && first.weightKg != null) {
      return `${units.formatWeight(first.weightKg)} × ${reps}`;
    }
    return working
      .map((s) => (s.weightKg == null ? `${s.reps ?? '—'}` : `${units.formatWeight(s.weightKg)}×${s.reps ?? '—'}`))
      .join(' · ');
  };

  /** Libellé de l'écart, dans l'unité de ce qui a bougé. */
  const deltaLabel = (delta: ExerciseDelta): { text: string; positive: boolean } | null => {
    if (delta.kind === 'equal') return { text: '=', positive: true };
    if (delta.kind === 'weight') {
      return {
        text: `${delta.deltaKg > 0 ? '▲ +' : '▼ −'}${units.formatWeight(Math.abs(delta.deltaKg))}`,
        positive: delta.deltaKg > 0,
      };
    }
    if (delta.kind === 'reps') {
      return {
        text: t(delta.deltaReps > 0 ? 'workout.summary.deltaRepsUp' : 'workout.summary.deltaRepsDown', {
          count: Math.abs(delta.deltaReps),
        }),
        positive: delta.deltaReps > 0,
      };
    }
    return {
      text: t(
        delta.deltaSeconds > 0 ? 'workout.summary.deltaTimeUp' : 'workout.summary.deltaTimeDown',
        { duration: formatDuration(Math.abs(delta.deltaSeconds)) },
      ),
      positive: delta.deltaSeconds > 0,
    };
  };

  const visible = entries.filter((entry) => summarize(entry.sets) !== null);
  if (visible.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
        {t('workout.summary.whatYouDid')}
      </Text>

      {visible.map((entry) => {
        const delta = deltas.get(entry.exerciseId);
        const badge = delta ? deltaLabel(delta) : null;
        const neutral = delta?.kind === 'equal';
        return (
          <View
            key={entry.exerciseId}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.headRow}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {entry.exerciseName}
              </Text>
              {badge ? (
                <Text
                  style={[
                    styles.delta,
                    neutral
                      ? { color: colors.textMuted, backgroundColor: colors.surfaceAlt }
                      : badge.positive
                        ? { color: colors.success, backgroundColor: `${colors.success}24` }
                        : { color: colors.accent, backgroundColor: `${colors.accent}1f` },
                  ]}
                >
                  {badge.text}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.sets, { color: colors.textMuted }]}>
              {summarize(entry.sets)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  eyebrow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  card: { borderRadius: 16, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 7 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14.5 },
  delta: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  sets: { fontFamily: fontFamily.mono, fontSize: 12.5 },
});
