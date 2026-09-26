/**
 * L'onglet Historique du hub Course — US CARDIO-UX03, §4.3.
 *
 * Remplace la liste de l'écran « Historique & progression », qui arrivait en troisième section sous
 * les statistiques et la courbe d'allure, plate, sans type de séance, et ouvrait l'écran d'arrivée
 * (« C'est fait ») au lieu du détail. Ici :
 *  - le **calendrier du mois** en tête (R8, R9) ;
 *  - **Sorties** : celles du mois (ou du jour touché), lignes enrichies du type, du terrain et du
 *    ressenti, Recourir en icône ; un appui ouvre l'analyse (D6) ;
 *  - **Par type** : chaque type de séance couru, et sa dernière sortie (R10). Un appui filtre les
 *    sorties sur ce type, **sur tout l'historique**.
 *
 * La suppression d'une sortie reste dans son détail (l'analyse) : pas d'appui long ici.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  monthOfDayKey,
  monthRange,
  runDayKey,
  runMonthSummary,
  runTypeKey,
  runTypeSummaries,
  RUN_FREE_TYPE,
  type RunTypeKey,
  type YearMonth,
} from '@wellness/shared';
import type { RunHistoryItem } from '@/data/repositories/run-repository';
import { usePlannedRunningDays } from '@/data/repositories/planned-session-repository';
import { PressableScale } from '@/components/motion/PressableScale';
import { RunHistoryCalendar } from '@/components/running/RunHistoryCalendar';
import { RunResumeLine } from '@/components/running/RunResumeLine';
import { RunRow } from '@/components/running/RunRow';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  runs: readonly RunHistoryItem[];
  todayKey: string;
  recordCounts: ReadonlyMap<string, number>;
  /** Pendant une course : ce qu'en dit la ligne « Reprendre » (D1). */
  resumeDetail: string | null;
  onResume: () => void;
  onOpenRun: (runId: string) => void;
  onAgain: (runId: string) => void;
};

type Tab = 'runs' | 'byType';

const pad = (n: number) => String(n).padStart(2, '0');

export function RunHistorySection(props: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { runs, todayKey, recordCounts } = props;

  const [tab, setTab] = useState<Tab>('runs');
  const [month, setMonth] = useState<YearMonth>(() => monthOfDayKey(todayKey));
  const [day, setDay] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<RunTypeKey | null>(null);

  const typeLabel = (type: RunTypeKey) =>
    type === RUN_FREE_TYPE ? t('running.hub.freeRun') : t(`running.sessionType.${type}`);

  // `useRunHistory` rend les sorties de la plus récente à la plus ancienne : la dernière est la
  // première jamais courue, la borne basse de la navigation.
  const first = runs[runs.length - 1];
  const range = monthRange(first ? runDayKey(first) : null, todayKey);

  const monthStart = `${month.year}-${pad(month.month)}-01`;
  const monthEnd = `${month.year}-${pad(month.month)}-${pad(new Date(month.year, month.month, 0).getDate())}`;
  const planned = usePlannedRunningDays(monthStart > todayKey ? monthStart : todayKey, monthEnd);

  const inMonth = runs.filter((r) => {
    const key = runDayKey(r);
    return key >= monthStart && key <= monthEnd;
  });
  const listed = typeFilter
    ? runs.filter((r) => runTypeKey(r.sessionType) === typeFilter)
    : day
      ? inMonth.filter((r) => runDayKey(r) === day)
      : inMonth;

  const onDay = (dayKey: string) => {
    const ofDay = inMonth.filter((r) => runDayKey(r) === dayKey);
    if (ofDay.length === 1) {
      props.onOpenRun(ofDay[0]!.id);
      return;
    }
    setTab('runs');
    setTypeFilter(null);
    setDay(dayKey);
  };

  const describeDay = (dayKey: string) =>
    inMonth
      .filter((r) => runDayKey(r) === dayKey)
      .map((r) => {
        const parts = [typeLabel(runTypeKey(r.sessionType))];
        if (r.distanceM != null) parts.push(units.formatDistance(r.distanceM / 1000));
        const records = recordCounts.get(r.id) ?? 0;
        if (records > 0) parts.push(t('runningHub.history.records', { count: records }));
        return parts.join(', ');
      })
      .join(' ; ');

  const types = runTypeSummaries(runs);

  return (
    <View style={styles.section} testID="run-section-history">
      {props.resumeDetail !== null ? <RunResumeLine detail={props.resumeDetail} onPress={props.onResume} /> : null}

      <RunHistoryCalendar
        month={month}
        range={range}
        runs={inMonth.map((r) => ({ dayKey: runDayKey(r), recordCount: recordCounts.get(r.id) ?? 0 }))}
        summary={runMonthSummary(inMonth, recordCounts)}
        plannedDayKeys={planned}
        todayKey={todayKey}
        selectedDayKey={day}
        onMonth={(next) => {
          setMonth(next);
          setDay(null);
        }}
        onDay={onDay}
        describeDay={describeDay}
      />

      <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: colors.surfaceAlt }]}>
        {(['runs', 'byType'] as const).map((key) => {
          const selected = tab === key;
          return (
            <Pressable
              key={key}
              testID={`run-history-tab-${key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(key)}
              style={[styles.tab, selected && { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.tabLabel, { color: selected ? colors.text : colors.textMuted }]}>
                {t(`runningHub.history.tabs.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'runs' ? (
        <View style={styles.list}>
          {typeFilter ? (
            <PressableScale
              testID="run-history-clear-type"
              onPress={() => setTypeFilter(null)}
              accessibilityRole="button"
              style={[styles.filter, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.filterLabel, { color: colors.accentText }]}>
                {t('runningHub.history.filterAll', { type: typeLabel(typeFilter) })}
              </Text>
              <Ionicons name="close" size={16} color={colors.accentText} />
            </PressableScale>
          ) : day ? (
            <View style={styles.dayFilter}>
              <Text style={[styles.dayLabel, { color: colors.text }]}>
                {new Date(`${day}T12:00:00`).toLocaleDateString(i18n.language, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
              <Pressable
                testID="run-history-whole-month"
                onPress={() => setDay(null)}
                accessibilityRole="button"
                style={[styles.chip, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.chipLabel, { color: colors.text }]}>{t('runningHub.history.wholeMonth')}</Text>
              </Pressable>
            </View>
          ) : null}
          {listed.length === 0 ? (
            <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('runningHub.history.emptyMonth')}</Text>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {listed.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  todayKey={todayKey}
                  recordCount={recordCounts.get(run.id) ?? 0}
                  compact
                  onOpen={() => props.onOpenRun(run.id)}
                  onAgain={() => props.onAgain(run.id)}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.list} testID="run-history-types">
          <Text style={[styles.intro, { color: colors.textMuted }]}>{t('runningHub.history.typesIntro')}</Text>
          {types.map((summary) => {
            const [, mm, dd] = summary.lastDayKey.split('-');
            const last = [
              summary.lastDistanceM != null ? units.formatDistance(summary.lastDistanceM / 1000) : null,
              summary.lastAvgPaceSPerKm != null ? units.formatPace(summary.lastAvgPaceSPerKm) : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <PressableScale
                key={summary.type}
                testID={`run-history-type-${summary.type}`}
                onPress={() => {
                  setTypeFilter(summary.type);
                  setDay(null);
                  setTab('runs');
                }}
                accessibilityRole="button"
                style={[styles.typeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.typeHead}>
                  <Text style={[styles.typeName, { color: colors.text }]}>{typeLabel(summary.type)}</Text>
                  <Text style={[styles.typeCount, { color: colors.textMuted }]}>
                    {t('runningHub.history.typeCount', { count: summary.count })}
                  </Text>
                </View>
                <Text style={[styles.typeLast, { color: colors.textMuted }]}>
                  {t('runningHub.history.typeLast', { date: `${dd}/${mm}`, summary: last })}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 15 },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  list: { gap: 10 },
  filter: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  filterLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  dayFilter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dayLabel: { flexShrink: 1, fontFamily: fontFamily.bodyBold, fontSize: 14 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1 },
  chipLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  empty: { borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 16 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 14 },
  intro: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  typeRow: { gap: 4, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  typeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  typeName: { flexShrink: 1, fontFamily: fontFamily.bodyBold, fontSize: 15 },
  typeCount: { fontFamily: fontFamily.mono, fontSize: 12 },
  typeLast: { fontFamily: fontFamily.body, fontSize: 13 },
});
