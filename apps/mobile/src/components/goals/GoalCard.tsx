/**
 * US OBJ-01 — carte d'un objectif : anneau de progression + verdict.
 *
 * ── Ce que l'anneau ne fait PAS ────────────────────────────────────────────────────────────────
 * Il ne porte **jamais seul** l'information. Le pourcentage, la valeur atteinte, la cible et
 * l'échéance sont tous écrits en texte à côté — un anneau est illisible pour TalkBack et pour qui
 * distingue mal les contrastes. Les repères à 25/50/75 % sont des **repères, pas des récompenses** :
 * aucune animation, aucun badge (arbitrage C, pas de gamification en V1).
 *
 * ── Le cas qui compte ─────────────────────────────────────────────────────────────────────────
 * Progression **non calculable** (exercice visé supprimé) : on l'écrit. Afficher « 0 % » se lirait
 * comme un échec alors que c'est une absence de mesure.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { daysBetween, formatDayFull, GOAL_MILESTONES, localDayKey } from '@wellness/shared';

import { RingGauge } from '@/components/widgets/primitives';
import type { GoalWithProgress } from '@/data/repositories/goal-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  goal: GoalWithProgress;
  onDelete?: () => void;
};

export function GoalCard({ goal, onDelete }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  const { progress } = goal;
  const isRun = goal.kind === 'run_distance';

  /** Cible et valeur atteinte, dans l'unité de l'utilisateur. Les mètres sont stockés, les km affichés. */
  const formatValue = (value: number | null): string =>
    isRun ? units.formatDistance(value == null ? null : value / 1000) : units.formatWeight(value);

  const targetLabel = formatValue(goal.targetValue);
  const currentLabel = formatValue(progress.currentValue);
  const pct = progress.ratio === null ? null : Math.round(progress.ratio * 100);

  const daysLeft = daysBetween(localDayKey(new Date()), goal.deadline);
  const deadlineLabel =
    progress.status !== 'active'
      ? t('goals.deadlineOn', { date: formatDayFull(goal.deadline) })
      : daysLeft <= 0
        ? t('goals.lastDay')
        : t('goals.remaining', { count: daysLeft });

  // Le verdict est porté par un MOT, jamais par la seule couleur (accessibilité).
  const verdict =
    progress.status === 'achieved'
      ? { label: t('goals.status.achieved'), color: colors.success }
      : progress.status === 'missed'
        ? { label: t('goals.status.missed'), color: colors.textMuted }
        : null;

  const title = isRun ? t('goals.kinds.run_distance') : (goal.exerciseName ?? t('goals.kinds.exercise_1rm'));

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View
        accessible
        accessibilityLabel={
          progress.unavailable
            ? `${title}. ${t('goals.unavailable')}`
            : `${title}. ${t('goals.a11yRing', { pct: pct ?? 0, current: currentLabel, target: targetLabel })}. ${deadlineLabel}`
        }
        style={styles.row}
      >
        <RingGauge
          size={68}
          stroke={8}
          pct={progress.ratio ?? 0}
          milestones={GOAL_MILESTONES}
          color={progress.status === 'missed' ? colors.textMuted : colors.accent}
        >
          <Text
            style={[styles.ringPct, { color: colors.text }]}
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
          >
            {pct === null ? '—' : `${pct}%`}
          </Text>
        </RingGauge>

        <View style={styles.texts}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>

          {progress.unavailable ? (
            <Text style={[styles.unavailable, { color: colors.warnText }]}>
              {t('goals.unavailable')}
            </Text>
          ) : (
            <Text style={[styles.progress, { color: colors.textMuted }]} maxFontSizeMultiplier={1.4}>
              {t('goals.progress', { current: currentLabel, target: targetLabel })}
            </Text>
          )}

          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
              {deadlineLabel}
            </Text>
            {verdict !== null && (
              <Text style={[styles.verdict, { color: verdict.color }]} maxFontSizeMultiplier={1.3}>
                {verdict.label}
              </Text>
            )}
          </View>
        </View>
      </View>

      {onDelete !== undefined && (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={t('goals.delete')}
          hitSlop={12}
          style={styles.delete}
        >
          <Text style={[styles.deleteLabel, { color: colors.danger }]} maxFontSizeMultiplier={1.3}>
            {t('goals.delete')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  texts: { flex: 1, gap: 3 },
  ringPct: { fontFamily: fontFamily.displayBold, fontSize: 15 },
  title: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  progress: { fontFamily: fontFamily.body, fontSize: 13 },
  unavailable: { fontFamily: fontFamily.body, fontSize: 12.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  meta: { fontFamily: fontFamily.body, fontSize: 12.5 },
  verdict: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  // Cible tactile : 44 de hauteur + hitSlop 12 → bien au-delà des 48 dp exigés.
  delete: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  deleteLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
