/**
 * US CARDIO-UX02 — **« Ma semaine »**, et ce qu'il reste à faire dedans.
 *
 * ── Ce qu'elle remplace ──────────────────────────────────────────────────────────────────────────
 * `RunWeekBand` (CARDIO-UX01, constat F37) disait la semaine écoulée et s'arrêtait là. Le hub
 * répondait donc à « où j'en suis » mais jamais à « qu'est-ce qu'il me reste », qui est la moitié
 * de la question — et il fallait descendre jusqu'à la grille de widgets pour trouver un
 * mini-calendrier et un nom de programme. Les trois fondent ici.
 *
 * Elle porte, de haut en bas :
 *  1. **le compte**, `doneCount / goalCount` — le MÊME dénominateur que la scène désormais
 *     (`resolveRunWeek.goalCount`, voir l'audit défaut 2 : la scène affichait « 2 / 0 » pendant que
 *     cette carte affichait « 2 / 3 ») ;
 *  2. **les sept jours** : couru, prévu, aujourd'hui ;
 *  3. **ce qui reste** : la prochaine séance datée, quand il y en a une ;
 *  4. **les volumes** : distance, temps, dénivelé.
 *
 * Tout vient de `resolveRunWeek` (`@wellness/shared`, testé) : ce composant ne calcule rien.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RunWeekSummary } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

/** Initiales des jours, lundi → dimanche. Clés i18n : la semaine ne commence pas partout au lundi. */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

type Props = {
  week: RunWeekSummary;
  /** Prochaine séance à venir, déjà formatée par le hub — `null` s'il n'y en a pas. */
  nextLabel: string | null;
  /** Programme de course actif, pour la ligne de pied — `null` sans programme. */
  programLabel: string | null;
  onOpenPlanning: () => void;
};

export function RunWeekCard({ week, nextLabel, programLabel, onOpenPlanning }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  // Rien de prévu, rien de couru : la carte se tait plutôt que d'afficher sept cases vides et
  // trois zéros. Même règle que partout ailleurs dans ce pilier.
  if (week.doneCount === 0 && week.plannedCount === 0) return null;

  const reached = week.goalCount > 0 && week.doneCount >= week.goalCount;

  const a11y = [
    t('running.week.title'),
    // Le dénominateur peut valoir 0 (ni programme ni fréquence visée) : on ne dit alors pas « sur 0 »,
    // on dit juste le nombre de sorties. Inventer un objectif serait prêter une intention.
    week.goalCount > 0
      ? t('running.week.countA11y', { done: week.doneCount, total: week.goalCount })
      : t('runningHub.week.doneOnly', { count: week.doneCount }),
    t('running.week.volumeA11y', {
      distance: units.formatDistance(week.distanceM / 1000),
      duration: formatHm(week.durationSeconds),
    }),
  ].join('. ');

  return (
    <PressableScale
      haptic="select"
      onPress={onOpenPlanning}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={t('runningHub.week.hint')}
      testID="run-week-card"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.headRow}>
        <Text style={[styles.overline, { color: colors.textMuted }]}>{t('running.week.title')}</Text>
        <Text style={[styles.count, { color: reached ? colors.success : colors.text }]}>
          {week.goalCount > 0
            ? t('running.week.count', { done: week.doneCount, total: week.goalCount })
            : t('runningHub.week.doneOnly', { count: week.doneCount })}
        </Text>
      </View>

      {/* Dire d'où vient l'objectif quand il ne vient pas du programme : sans ça, « 2 / 3 » sur une
          semaine qui ne planifie rien ressemble à un chiffre sorti de nulle part. */}
      {week.targetFrequency !== null && week.targetFrequency !== week.plannedCount ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('running.week.targetHint', { count: week.targetFrequency })}
        </Text>
      ) : null}

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

      {/* Ce qui reste — la moitié de la question à laquelle le hub ne répondait pas. */}
      {nextLabel ? (
        <View style={[styles.next, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="calendar-outline" size={15} color={colors.accent} />
          <Text style={[styles.nextText, { color: colors.text }]} numberOfLines={2}>
            {nextLabel}
          </Text>
        </View>
      ) : null}

      <View style={[styles.separator, { backgroundColor: colors.border }]} />

      <View style={styles.stats}>
        <Stat label={t('running.week.distance')} value={units.formatDistance(week.distanceM / 1000)} />
        <Stat label={t('running.week.time')} value={formatHm(week.durationSeconds)} />
        {week.elevationGainM > 0 ? (
          <Stat label={t('running.week.elevation')} value={`+${Math.round(week.elevationGainM)} m`} />
        ) : null}
      </View>

      {programLabel ? (
        <Text style={[styles.program, { color: colors.textMuted }]} numberOfLines={1}>
          {programLabel}
        </Text>
      ) : null}
    </PressableScale>
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
  card: { borderRadius: 22, borderWidth: 1, padding: 18, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  overline: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  count: { fontFamily: fontFamily.monoBold, fontSize: 13 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, marginTop: -6 },
  days: { flexDirection: 'row', gap: 6 },
  dayCol: { flex: 1, alignItems: 'center', gap: 5 },
  dayLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11 },
  dayLabelToday: { fontFamily: fontFamily.bodyBold },
  dayCell: { width: '100%', height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayCellPlanned: { borderWidth: 1, borderStyle: 'dashed' },
  next: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, padding: 11 },
  nextText: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 12.5, lineHeight: 17 },
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
  program: { fontFamily: fontFamily.body, fontSize: 12 },
});
