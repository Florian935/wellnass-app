/**
 * US LABO-02 — la semaine réelle, pilier par pilier : où tu en es, et les sept jours.
 *
 * Extraite de l'ancien onglet « Semaine » (LABO-01) quand l'onglet Croiser l'a absorbé : ses
 * propositions sont devenues les gestes des liens (une proposition = un lien à régler), la semaine
 * elle-même reste — c'est le réel sur lequel tout le reste s'appuie (LABO-01 R2).
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GOOD_NIGHT_MINUTES, type LabWeek } from '@wellness/shared';

import { dayMonth, formatDecimal, formatMinutes, weekdayInitial, weekdayName } from './lab-format';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = { week: LabWeek };

/** Une barre de progression sobre : la part faite, sur la part prévue. */
function Bar({ value, tone }: { value: number; tone: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.border }]}>
      <View style={[styles.barFill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: tone }]} />
    </View>
  );
}

export function LabWeekOverview({ week }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = i18n.language;
  const { strength, running, nutrition, sleep } = week.progress;

  return (
    <View style={styles.panel} testID="lab-week-overview">

      {/* Où tu en es */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('lab.week.where')}</Text>
        <View style={styles.progressGrid}>
          {strength ? (
            <View style={styles.progressItem} testID="lab-progress-strength">
              <Text style={[styles.progressLabel, { color: colors.text }]}>{t('pillars.strength')}</Text>
              <Text style={[styles.progressValue, { color: colors.text }]}>
                {t('lab.week.strength', { done: strength.done, planned: strength.planned })}
              </Text>
              <Bar value={strength.planned === 0 ? 0 : strength.done / strength.planned} tone={colors.pillarStrength} />
              <Text style={[styles.progressNote, { color: colors.textMuted }]}>
                {strength.next
                  ? t('lab.week.next', { day: weekdayName(strength.next.dayKey, locale), name: strength.next.name ?? t('lab.week.session') })
                  : t('lab.week.noNext')}
              </Text>
            </View>
          ) : null}

          {running ? (
            <View style={styles.progressItem} testID="lab-progress-running">
              <Text style={[styles.progressLabel, { color: colors.text }]}>{t('pillars.running')}</Text>
              <Text style={[styles.progressValue, { color: colors.text }]}>
                {t('lab.week.running', { done: formatDecimal(running.doneKm, locale), planned: formatDecimal(running.plannedKm, locale) })}
              </Text>
              <Bar value={running.plannedKm === 0 ? 0 : running.doneKm / running.plannedKm} tone={colors.pillarRunning} />
              <Text style={[styles.progressNote, { color: colors.textMuted }]}>
                {running.next
                  ? t('lab.week.next', { day: weekdayName(running.next.dayKey, locale), name: running.next.name ?? t('lab.week.session') })
                  : t('lab.week.noNext')}
              </Text>
            </View>
          ) : null}

          {nutrition ? (
            <View style={styles.progressItem} testID="lab-progress-nutrition">
              <Text style={[styles.progressLabel, { color: colors.text }]}>{t('lab.week.protein')}</Text>
              <Text style={[styles.progressValue, { color: colors.text }]}>
                {nutrition.gPerKg === null || nutrition.target === null
                  ? t('lab.week.proteinEmpty')
                  : t('lab.week.proteinValue', { value: formatDecimal(nutrition.gPerKg, locale), target: formatDecimal(nutrition.target.min, locale) })}
              </Text>
              <Bar
                value={nutrition.gPerKg === null || nutrition.target === null ? 0 : nutrition.gPerKg / nutrition.target.min}
                tone={colors.pillarNutrition}
              />
              <Text style={[styles.progressNote, { color: colors.textMuted }]}>
                {t('lab.week.loggedDays', { count: nutrition.loggedDays })}
              </Text>
            </View>
          ) : null}

          <View style={styles.progressItem} testID="lab-progress-sleep">
            <Text style={[styles.progressLabel, { color: colors.text }]}>{t('lab.pillars.sleep')}</Text>
            <Text style={[styles.progressValue, { color: colors.text }]}>
              {sleep.loggedNights === 0
                ? t('lab.week.nightsEmpty')
                : t('lab.week.nights', { good: sleep.goodNights, logged: sleep.loggedNights })}
            </Text>
            <Bar value={sleep.loggedNights === 0 ? 0 : sleep.goodNights / sleep.loggedNights} tone={colors.pillarLab} />
            <Text style={[styles.progressNote, { color: colors.textMuted }]}>
              {sleep.lastMinutes === null ? t('lab.week.lastNightEmpty') : t('lab.week.lastNight', { value: formatMinutes(sleep.lastMinutes) })}
            </Text>
          </View>
        </View>
      </View>

      {/* La semaine, jour par jour */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('lab.week.grid')}</Text>
          <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{t('lab.week.gridLegend')}</Text>
        </View>
        <View style={styles.grid}>
          {week.days.map((day) => (
            <View key={day.dayKey} style={styles.gridDay} testID={`lab-day-${day.dayKey}`}>
              <View style={[styles.gridHead, day.isToday && { backgroundColor: colors.text }]}>
                <Text style={[styles.gridLetter, { color: day.isToday ? colors.background : colors.textMuted }]}>
                  {weekdayInitial(day.dayKey, locale)}
                </Text>
                <Text style={[styles.gridDate, { color: day.isToday ? colors.background : colors.textMuted }]}>{dayMonth(day.dayKey)}</Text>
              </View>
              {day.strength.map((session) => (
                <View
                  key={session.id}
                  style={[
                    styles.cell,
                    session.status === 'done'
                      ? { backgroundColor: colors.pillarStrength }
                      : { borderColor: colors.pillarStrength, borderWidth: 1, borderStyle: 'dashed' },
                  ]}
                >
                  <Text numberOfLines={1} style={[styles.cellText, { color: session.status === 'done' ? colors.background : colors.pillarStrength }]}>
                    {session.name ?? t('lab.week.session')}
                  </Text>
                </View>
              ))}
              {day.running.map((session) => (
                <View
                  key={session.id}
                  style={[
                    styles.cell,
                    session.status === 'done'
                      ? { backgroundColor: colors.pillarRunning }
                      : { borderColor: colors.pillarRunning, borderWidth: 1, borderStyle: 'dashed' },
                  ]}
                >
                  <Text numberOfLines={1} style={[styles.cellText, { color: session.status === 'done' ? colors.background : colors.pillarRunning }]}>
                    {session.distanceM === null ? t('lab.week.run') : t('lab.week.km', { value: Math.round(session.distanceM / 1000) })}
                  </Text>
                </View>
              ))}
              {day.sleepMinutes === null ? null : (
                <Text style={[styles.gridNight, { color: day.sleepMinutes >= GOOD_NIGHT_MINUTES ? colors.pillarLab : colors.warnText }]}>
                  {formatMinutes(day.sleepMinutes)}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 20 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  sectionTitle: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionMeta: { fontFamily: fontFamily.body, fontSize: 12 },
  progressGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  progressItem: { flexGrow: 1, flexBasis: '44%', gap: 4 },
  progressLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  progressValue: { fontFamily: fontFamily.mono, fontSize: 12.5 },
  progressNote: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 15 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  grid: { flexDirection: 'row', gap: 3 },
  gridDay: { flex: 1, gap: 3 },
  gridHead: { alignItems: 'center', borderRadius: 8, paddingVertical: 3 },
  gridLetter: { fontFamily: fontFamily.monoBold, fontSize: 10.5 },
  gridDate: { fontFamily: fontFamily.mono, fontSize: 9 },
  cell: { minHeight: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  cellText: { fontFamily: fontFamily.monoBold, fontSize: 8.5 },
  gridNight: { fontFamily: fontFamily.mono, fontSize: 8.5, textAlign: 'center' },
});
