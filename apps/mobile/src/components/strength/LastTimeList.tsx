/**
 * « La dernière fois », dans la carte de la séance du jour — US MUSCU-UX07, §4.2.1.
 *
 * La question qu'on se pose devant la barre : « j'avais mis combien ? ». Avant cette US, la réponse
 * n'apparaissait qu'une fois la séance lancée, série par série. Ici, les trois premiers exercices de
 * la séance, leur dernière fois (R3) et la suggestion du jour pour la première série (R11), calculée
 * par le même hook que la séance.
 *
 * En-tête : la date commune aux trois quand ils viennent de la même séance ; sinon chaque ligne
 * porte la sienne.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { commonDayKey, formatLastPerformance, localDayKey } from '@wellness/shared';
import { useLastDoneDates } from '@/data/repositories/workout-repository';
import { formatShortDay, useLastPerfFormat } from '@/hooks/useLastPerfFormat';
import { useProgressionSuggestion } from '@/hooks/useProgressionSuggestion';
import { useUnits } from '@/hooks/useUnits';
import { formatProgressionSuggestion, makeLoadProposer } from '@/lib/progression-suggestion';
import { useImmersivePrefs } from '@/stores/immersive-prefs-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export type LastTimeExercise = { exerciseId: string; name: string | null; equipment: string | null };

/** Le nombre d'exercices montrés dans la carte ; les autres sont dans l'aperçu. */
export const LAST_TIME_COUNT = 3;

type Program = { programId: string | null; weekIndex: number | null };

export function LastTimeList({ exercises, program }: { exercises: readonly LastTimeExercise[]; program: Program }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const shown = exercises.slice(0, LAST_TIME_COUNT);
  const dates = useLastDoneDates(shown.map((e) => e.exerciseId));

  const common = commonDayKey(
    shown.map((e) => (dates[e.exerciseId] ? localDayKey(new Date(dates[e.exerciseId]!)) : null)),
  );
  const commonIso = common ? shown.map((e) => dates[e.exerciseId]).find(Boolean) ?? null : null;

  if (shown.length === 0) return null;

  return (
    <View testID="strength-last-time" style={[styles.box, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.textMuted }]}>
        {commonIso
          ? t('strengthHub.lastTime.titleOn', { date: formatShortDay(commonIso, i18n.language) })
          : t('strengthHub.lastTime.title')}
      </Text>
      {shown.map((exercise) => (
        <LastTimeRow
          key={exercise.exerciseId}
          exercise={exercise}
          program={program}
          date={common ? null : (dates[exercise.exerciseId] ?? null)}
        />
      ))}
    </View>
  );
}

function LastTimeRow({
  exercise,
  program,
  date,
}: {
  exercise: LastTimeExercise;
  program: Program;
  /** Date propre à la ligne, quand les exercices ne viennent pas tous de la même séance. */
  date: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const format = useLastPerfFormat();
  const barKg = useImmersivePrefs((s) => s.barKg);
  const { lastPerf, suggestion } = useProgressionSuggestion(exercise.exerciseId, 0, program);

  const last = formatLastPerformance(lastPerf, format);
  const tip = formatProgressionSuggestion(suggestion, {
    t,
    formatWeight: units.formatWeight,
    propose: makeLoadProposer({
      isBarbell: exercise.equipment === 'barbell',
      barKg,
      imperial: units.system === 'imperial',
    }),
    short: true,
  });
  const name = exercise.name?.trim() || '—';

  return (
    <View
      style={[styles.row, { borderTopColor: colors.border }]}
      accessible
      accessibilityLabel={[name, last ?? t('strengthHub.lastTime.firstTime'), tip].filter(Boolean).join(' · ')}
    >
      <View style={styles.texts}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.last, { color: colors.textMuted }]} numberOfLines={1}>
          {last ?? t('strengthHub.lastTime.firstTime')}
          {last && date ? ` · ${formatShortDay(date, i18n.language)}` : ''}
        </Text>
      </View>
      {tip ? (
        <View style={[styles.tip, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.tipText, { color: colors.accent }]} numberOfLines={1}>
            {tip}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 14 },
  header: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  texts: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  last: { fontFamily: fontFamily.mono, fontSize: 12 },
  tip: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0, maxWidth: '45%' },
  tipText: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
});
