/**
 * US DASH-01 (§4.4) — **la semaine, séance par séance**, touchable.
 *
 * Le hub muscu disait « semaine 3 sur 8 » (ProgramProgressBar) mais jamais **ce qu'il restait à
 * faire cette semaine** : il fallait ouvrir le planning pour savoir si la séance de jeudi était
 * passée. Sept jours, trois états (faite, prévue, rien), et un tap qui ouvre le planning au jour
 * choisi — le geste que tout le monde tentait déjà sur la barre de progression.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  localDateFromDayKey,
  localDayKey,
  startOfWeek,
} from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { DenseTile } from '@/components/stage/DenseTile';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useTodayKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

type DayState = 'done' | 'planned' | 'empty';

type Props = { onOpenDay: (dayKey: string) => void };

export function StrengthWeekCard({ onOpenDay }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const todayKey = useTodayKey();

  const weekStartKey = localDayKey(startOfWeek(localDateFromDayKey(todayKey)));
  const days = Array.from({ length: 7 }, (_, i) =>
    localDayKey(addDays(localDateFromDayKey(weekStartKey), i)),
  );

  const { items } = useWeekPlan(weekStartKey);
  const { workouts } = useWorkoutHistory();

  const planned = items.filter((item) => item.pillar === 'strength');
  // Une séance libre compte autant qu'une séance planifiée : elle a été faite.
  const doneDays = new Set(
    workouts
      .filter((w) => w.finishedAt != null)
      .map((w) => localDayKey(new Date(w.finishedAt as string))),
  );

  const stateOf = (dayKey: string): DayState => {
    if (doneDays.has(dayKey)) return 'done';
    if (planned.some((item) => item.scheduledDate === dayKey && item.status !== 'done')) {
      return 'planned';
    }
    return planned.some((item) => item.scheduledDate === dayKey) ? 'done' : 'empty';
  };

  const doneCount = days.filter((d) => stateOf(d) === 'done').length;
  const plannedCount = planned.length;
  if (plannedCount === 0 && doneCount === 0) return null;

  return (
    <DenseTile
      title={t('stage.strength.weekCard.title')}
      meta={t('stage.strength.weekCard.meta', { done: doneCount, planned: Math.max(plannedCount, doneCount) })}
      testID="strength-week-card"
    >
      <View style={styles.row}>
        {days.map((dayKey, index) => {
          const state = stateOf(dayKey);
          const isToday = dayKey === todayKey;
          const background =
            state === 'done' ? colors.accent : state === 'planned' ? colors.surfaceAlt : colors.track;
          return (
            <PressableScale
              key={dayKey}
              haptic="select"
              onPress={() => onOpenDay(dayKey)}
              accessibilityRole="button"
              accessibilityLabel={t('stage.strength.weekCard.dayA11y', {
                day: t(`common.weekday.${WEEKDAY_KEYS[index]}`),
                state: t(`stage.strength.weekCard.${state}`),
              })}
              style={styles.dayCol}
            >
              <View
                style={[
                  styles.day,
                  { backgroundColor: background, borderColor: isToday ? colors.text : 'transparent' },
                  isToday && styles.today,
                ]}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    { color: state === 'done' ? colors.accentText : colors.textMuted },
                  ]}
                >
                  {t(`common.weekdayShort.${WEEKDAY_KEYS[index]}`)}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </DenseTile>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  dayCol: { flex: 1 },
  day: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 2 },
  dayLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
});
