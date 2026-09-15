/**
 * US LABO-01 — onglet « Semaine » : où tu en es, ta semaine jour par jour, et ce que le Labo propose.
 *
 * Chaque proposition porte **le chiffre qui la justifie** et **un geste**. Un geste qui touche le
 * plan ne s'applique pas au tap : il se met « prêt », et la feuille « ce qui change dans ton plan »
 * demande confirmation (R4 — rien n'est appliqué sans toi). Un geste qui ouvre un écran n'écrit
 * rien, donc il part tout de suite.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GOOD_NIGHT_MINUTES, type LabProposal, type LabWeek } from '@wellness/shared';

import { Lens } from './Lens';
import { dayMonth, formatDecimal, formatMinutes, weekdayInitial, weekdayName } from './lab-format';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  week: LabWeek;
  /** Propositions mises « prêtes », en attente de la feuille. */
  staged: readonly string[];
  /** Propositions déjà appliquées au plan. */
  applied: readonly string[];
  onStage: (proposal: LabProposal) => void;
  onUnstage: (id: string) => void;
  onOpen: (proposal: LabProposal) => void;
};

/** Une barre de progression sobre : la part faite, sur la part prévue. */
function Bar({ value, tone }: { value: number; tone: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.border }]}>
      <View style={[styles.barFill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: tone }]} />
    </View>
  );
}

export function LabWeekPanel({ week, staged, applied, onStage, onUnstage, onOpen }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = i18n.language;

  const open = week.proposals.filter((p) => !staged.includes(p.id) && !applied.includes(p.id));
  const lead =
    open.length > 0
      ? t('lab.week.lead', { count: open.length })
      : staged.length > 0
        ? t('lab.week.leadReady')
        : t('lab.week.leadClear');

  const { strength, running, nutrition, sleep } = week.progress;

  return (
    <View style={styles.panel}>
      <Text style={[styles.lead, { color: colors.text }]}>{lead}</Text>

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

      {/* Ce que le Labo propose */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('lab.week.proposals')}</Text>
          <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
            {open.length > 0 ? t('lab.week.toFix', { count: open.length }) : t('lab.week.allClear')}
          </Text>
        </View>

        {week.proposals.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('lab.week.empty')}</Text>
        ) : (
          week.proposals.map((proposal) => {
            const isStaged = staged.includes(proposal.id);
            const isApplied = applied.includes(proposal.id);
            const tone = proposal.tone === 'guard' ? colors.danger : proposal.tone === 'warn' ? colors.warnText : colors.textMuted;
            return (
              <View
                key={proposal.id}
                testID={`lab-proposal-${proposal.kind}`}
                style={[styles.proposal, { backgroundColor: colors.surface, borderColor: isStaged ? colors.success : colors.border }]}
              >
                <View style={styles.proposalHead}>
                  <Lens pair={proposal.pair} />
                  <Text style={[styles.proposalTitle, { color: colors.text }]}>
                    {t(`lab.proposals.${proposal.kind}.title`, proposal.values)}
                  </Text>
                  <Text style={[styles.proposalKind, { color: tone }]}>{t(`lab.proposals.${proposal.kind}.kind`)}</Text>
                </View>
                <Text style={[styles.proposalText, { color: colors.textMuted }]}>
                  {isStaged || isApplied
                    ? t(`lab.proposals.${proposal.kind}.done`, proposal.values)
                    : t(`lab.proposals.${proposal.kind}.text`, proposal.values)}
                </Text>

                {isApplied ? (
                  <View style={styles.proposalFoot}>
                    <Ionicons name="checkmark" size={16} color={colors.success} />
                    <Text style={[styles.state, { color: colors.success }]}>{t('lab.week.applied')}</Text>
                  </View>
                ) : isStaged ? (
                  <View style={styles.proposalFoot}>
                    <Ionicons name="checkmark" size={16} color={colors.success} />
                    <Text style={[styles.state, { color: colors.success }]}>{t('lab.week.staged')}</Text>
                    <Pressable accessibilityRole="button" onPress={() => onUnstage(proposal.id)} hitSlop={8}>
                      <Text style={[styles.link, { color: colors.textMuted }]}>{t('lab.week.remove')}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => (proposal.action.type === 'open' ? onOpen(proposal) : onStage(proposal))}
                    style={[styles.action, { borderColor: colors.text }]}
                  >
                    <Text style={[styles.actionLabel, { color: colors.text }]}>{t(`lab.proposals.${proposal.kind}.action`, proposal.values)}</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 20 },
  lead: { fontFamily: fontFamily.displayBold, fontSize: 19, lineHeight: 24 },
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
  empty: { fontFamily: fontFamily.body, fontSize: 13 },
  proposal: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 6 },
  proposalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  proposalTitle: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 14.5, lineHeight: 19 },
  proposalKind: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  proposalText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  proposalFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  state: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  link: { fontFamily: fontFamily.body, fontSize: 12.5, textDecorationLine: 'underline' },
  action: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  actionLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
});
