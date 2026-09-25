/**
 * L'onglet Historique du hub Musculation — US MUSCU-UX07, §4.3.
 *
 * Remplace l'écran `/history`, qu'aucun bouton du hub n'ouvrait (constat a). Le calendrier du mois
 * en tête (repris de B), puis « Séances · Par exercice » :
 *  - Séances : celles du mois affiché, de la plus récente à la plus ancienne, chacune avec Refaire ;
 *    appui long → suppression après confirmation (comportement de l'ancien écran, conservé) ;
 *  - Par exercice : la dernière fois de chaque exercice (repris de A).
 *
 * Les filtres 7 / 30 / 90 jours de l'ancien écran sont remplacés par la navigation de mois en mois
 * (D10) ; le total de tous les temps est dans Progrès.
 */

import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  localDayKey,
  monthOfDayKey,
  monthRange,
  type YearMonth,
} from '@wellness/shared';
import { deleteWorkout, useExercisesLastDone, type WorkoutHistoryItem } from '@/data/repositories/workout-repository';
import { usePlannedStrengthDays } from '@/data/repositories/planned-session-repository';
import { ExerciseLastDoneList } from '@/components/strength/ExerciseLastDoneList';
import { HistoryCalendar } from '@/components/strength/HistoryCalendar';
import { ResumeLine } from '@/components/strength/ResumeLine';
import { WorkoutRow, workoutDate } from '@/components/strength/WorkoutRow';
import { useActionLock } from '@/hooks/useActionLock';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  workouts: readonly WorkoutHistoryItem[];
  todayKey: string;
  /** Pendant une séance : le nom de la séance, pour la ligne « Reprendre » (D3). */
  resumeName: string | null;
  onResume: () => void;
  onOpenWorkout: (workoutId: string) => void;
  onRedo: (workoutId: string) => void;
  onOpenExercise: (exerciseId: string) => void;
};

type Tab = 'sessions' | 'byExercise';

const dayKeyOf = (item: WorkoutHistoryItem) => localDayKey(workoutDate(item));

export function HistorySection(props: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const lockDelete = useActionLock();
  const { workouts, todayKey } = props;

  const [tab, setTab] = useState<Tab>('sessions');
  const [month, setMonth] = useState<YearMonth>(() => monthOfDayKey(todayKey));
  const [day, setDay] = useState<string | null>(null);

  // `useWorkoutHistory` rend les séances de la plus récente à la plus ancienne : la dernière est la
  // première séance jamais faite, la borne basse de la navigation.
  const first = workouts[workouts.length - 1];
  const range = monthRange(first ? dayKeyOf(first) : null, todayKey);

  const pad = (n: number) => String(n).padStart(2, '0');
  const monthStart = `${month.year}-${pad(month.month)}-01`;
  const monthEnd = `${month.year}-${pad(month.month)}-${pad(new Date(month.year, month.month, 0).getDate())}`;
  const planned = usePlannedStrengthDays(monthStart > todayKey ? monthStart : todayKey, monthEnd);

  const inMonth = workouts.filter((w) => {
    const key = dayKeyOf(w);
    return key >= monthStart && key <= monthEnd;
  });
  const listed = day ? inMonth.filter((w) => dayKeyOf(w) === day) : inMonth;

  const onDay = (dayKey: string) => {
    const ofDay = inMonth.filter((w) => dayKeyOf(w) === dayKey);
    if (ofDay.length === 1) {
      props.onOpenWorkout(ofDay[0]!.id);
      return;
    }
    setTab('sessions');
    setDay(dayKey);
  };

  const describeDay = (dayKey: string) =>
    inMonth
      .filter((w) => dayKeyOf(w) === dayKey)
      .map((w) => {
        const name = w.sessionName?.trim() || t('history.freeSession');
        return w.recordCount > 0 ? `${name}, ${t('history.calendar.records', { count: w.recordCount })}` : name;
      })
      .join(' ; ');

  const onDelete = (item: WorkoutHistoryItem) => {
    const name = item.sessionName?.trim() || t('history.freeSession');
    Alert.alert(t('history.delete.title'), t('history.delete.message', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('history.delete.confirm'),
        style: 'destructive',
        // Verrou : deux appuis du même cycle rejoueraient la transaction, et la seconde remettrait
        // l'occurrence de planning en `planned` après coup.
        onPress: () => void lockDelete(async () => deleteWorkout(item.id)),
      },
    ]);
  };

  return (
    <View style={styles.section} testID="strength-section-history">
      {props.resumeName !== null ? <ResumeLine name={props.resumeName} onPress={props.onResume} /> : null}

      <HistoryCalendar
        month={month}
        range={range}
        workouts={inMonth.map((w) => ({ dayKey: dayKeyOf(w), recordCount: w.recordCount, tonnageKg: w.volumeKg }))}
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
        {(['sessions', 'byExercise'] as const).map((key) => {
          const selected = tab === key;
          return (
            <Pressable
              key={key}
              testID={`history-tab-${key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(key)}
              style={[styles.tab, selected && { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.tabLabel, { color: selected ? colors.text : colors.textMuted }]}>
                {t(`history.tabs.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'sessions' ? (
        <View style={styles.list}>
          {day ? (
            <View style={styles.dayFilter}>
              <Text style={[styles.dayLabel, { color: colors.text }]}>
                {new Date(`${day}T12:00:00`).toLocaleDateString(i18n.language, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
              <Pressable
                testID="history-whole-month"
                onPress={() => setDay(null)}
                accessibilityRole="button"
                style={[styles.chip, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.chipLabel, { color: colors.text }]}>{t('history.calendar.wholeMonth')}</Text>
              </Pressable>
            </View>
          ) : null}
          {listed.length === 0 ? (
            <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('history.calendar.empty')}</Text>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {listed.map((item) => (
                <WorkoutRow
                  key={item.id}
                  item={item}
                  todayKey={todayKey}
                  compact
                  onOpen={() => props.onOpenWorkout(item.id)}
                  onRedo={() => props.onRedo(item.id)}
                  onLongPress={() => onDelete(item)}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <ExercisesTab onOpen={props.onOpenExercise} />
      )}
    </View>
  );
}

/** Monté seulement quand l'onglet est ouvert : sa requête ne tourne pas pour rien. */
function ExercisesTab({ onOpen }: { onOpen: (exerciseId: string) => void }) {
  const { items } = useExercisesLastDone();
  return <ExerciseLastDoneList items={items} onOpen={onOpen} />;
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 15 },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  list: { gap: 10 },
  dayFilter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dayLabel: { flexShrink: 1, fontFamily: fontFamily.bodyBold, fontSize: 14 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1 },
  chipLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  empty: { borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 16 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 14 },
});
