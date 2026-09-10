/**
 * US CARDIO-UX01 (R3 / constat F37) — la bande « Ma semaine » du hub course.
 *
 * ── Ce qu'elle comble ────────────────────────────────────────────────────────────────────────────
 * Le hub ne montrait **qu'une action et rien de la semaine** : pas de « 2 faites sur 3 », pas de
 * volume, pas de prochaine séance si elle n'était pas aujourd'hui. Aucune vue d'ensemble — alors
 * que « où j'en suis cette semaine ? » est la première question d'un coureur qui suit un plan, et
 * la seule qui donne un sens au reste.
 *
 * ── Trois lectures, dans cet ordre ───────────────────────────────────────────────────────────────
 *  1. **le compte** : séances faites sur prévues, avec la fréquence visée du profil en repère —
 *     champ qui était saisi et lu nulle part (constat F40) ;
 *  2. **les sept jours** : couru, prévu, aujourd'hui ;
 *  3. **les volumes** : distance, temps, dénivelé.
 *
 * Tout vient de `resolveRunWeek` (`@wellness/shared`, testé) : ce composant ne calcule rien.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RunWeekSummary } from '@wellness/shared';
import { Card } from '@/components/Card';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

/** Initiales des jours, lundi → dimanche. Clés i18n : la semaine ne commence pas partout au lundi. */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

type Props = { week: RunWeekSummary };

export function RunWeekBand({ week }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  // Rien de prévu, rien de couru : la bande se tait plutôt que d'afficher sept cases vides et
  // trois zéros. Même règle que partout ailleurs dans ce pilier.
  if (week.doneCount === 0 && week.plannedCount === 0) {
    return null;
  }

  const target = week.targetFrequency;
  const goal = target ?? week.plannedCount;

  const a11y = [
    t('running.week.title'),
    t('running.week.countA11y', { done: week.doneCount, total: goal }),
    t('running.week.volumeA11y', {
      distance: units.formatDistance(week.distanceM / 1000),
      duration: formatHm(week.durationSeconds),
    }),
  ].join('. ');

  return (
    <Card>
      <View accessible accessibilityLabel={a11y}>
        <View style={styles.headRow}>
          <Text style={[styles.overline, { color: colors.textMuted }]}>
            {t('running.week.title')}
          </Text>
          <Text style={[styles.count, { color: week.doneCount >= goal ? colors.success : colors.text }]}>
            {t('running.week.count', { done: week.doneCount, total: goal })}
          </Text>
        </View>

        {/* La fréquence visée, dite explicitement quand elle diffère du prévu de la semaine. */}
        {target !== null && target !== week.plannedCount ? (
          <Text style={[styles.targetHint, { color: colors.textMuted }]}>
            {t('running.week.targetHint', { count: target })}
          </Text>
        ) : null}
      </View>

      {/* Les sept jours */}
      <View style={styles.days}>
        {week.days.map((day) => {
          const background = day.done
            ? colors.success
            : day.isToday
              ? colors.accent
              : day.planned
                ? colors.surfaceAlt
                : colors.track;
          return (
            <View key={day.dayKey} style={styles.dayCol}>
              <Text
                style={[
                  styles.dayLabel,
                  { color: day.isToday ? colors.accent : colors.textMuted },
                  day.isToday && styles.dayLabelToday,
                ]}
              >
                {t(`common.weekday.${WEEKDAY_KEYS[day.weekday]}`)}
              </Text>
              <View
                style={[
                  styles.dayCell,
                  { backgroundColor: background, borderColor: day.planned ? colors.accent : 'transparent' },
                  day.planned && styles.dayCellPlanned,
                ]}
              >
                {day.done ? (
                  <Ionicons name="checkmark" size={16} color={colors.accentText} />
                ) : day.isToday ? (
                  <Ionicons name="ellipse" size={8} color={colors.accentText} />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <View style={[styles.separator, { backgroundColor: colors.border }]} />

      {/* Les volumes */}
      <View style={styles.stats}>
        <Stat label={t('running.week.distance')} value={units.formatDistance(week.distanceM / 1000)} />
        <Stat label={t('running.week.time')} value={formatHm(week.durationSeconds)} />
        {week.elevationGainM > 0 ? (
          <Stat label={t('running.week.elevation')} value={`+${Math.round(week.elevationGainM)} m`} />
        ) : null}
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

/** Durée en secondes → `1 h 42` ou `41 min`. Une semaine ne se lit pas en secondes. */
function formatHm(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  overline: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  count: { fontFamily: fontFamily.monoBold, fontSize: 13 },
  targetHint: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 4 },
  days: { flexDirection: 'row', gap: 6 },
  dayCol: { flex: 1, alignItems: 'center', gap: 5 },
  dayLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11 },
  dayLabelToday: { fontFamily: fontFamily.bodyBold },
  dayCell: {
    width: '100%',
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellPlanned: { borderWidth: 1, borderStyle: 'dashed' },
  separator: { height: 1 },
  stats: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  stat: { gap: 1 },
  statLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: { fontFamily: fontFamily.monoBold, fontSize: 20 },
});
