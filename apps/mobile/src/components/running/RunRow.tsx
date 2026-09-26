/**
 * Une sortie en une ligne, avec son bouton Recourir — US CARDIO-UX03, §4.2-3 et §4.3.
 *
 * Partagée par « Tes dernières sorties » (Courir) et la liste de l'Historique :
 *  - un pavé date (jour abrégé + numéro), la sortie du jour en plein ;
 *  - le **type de la séance** réalisée, ou « Course libre » — l'ancienne liste ne disait que la date
 *    et trois chiffres, alors que la requête remontait déjà le type (constat F24 de CARDIO-UX01) ;
 *  - la pastille des records que la sortie **détient encore** (R7) ;
 *  - « distance · durée · allure », puis « terrain · ressenti » (parties absentes omises) ;
 *  - Recourir (D4, R5) : libellé en toutes lettres sur Courir, icône seule dans l'historique. Absent
 *    d'une sortie qui ne peut pas servir de fantôme (sans GPS, ou trop courte).
 *
 * Appui sur la ligne → le détail, c'est-à-dire l'**analyse** de la sortie (D6), plus l'écran d'arrivée.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { canRunAgain, feelingFromStoredRpe, formatDurationHms, runDayKey } from '@wellness/shared';
import type { RunHistoryItem } from '@/data/repositories/run-repository';
import { PressableScale } from '@/components/motion/PressableScale';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  run: RunHistoryItem;
  todayKey: string;
  /** Records d'allure que la sortie détient encore (R7). */
  recordCount: number;
  onOpen: () => void;
  onAgain: () => void;
  /** Recourir en icône seule (liste de l'historique, plus dense). */
  compact?: boolean;
};

/** « Fractionné (VMA) », ou « Course libre » pour une course qui ne réalise aucune séance. */
export function useRunTypeLabel() {
  const { t } = useTranslation();
  return (sessionType: RunHistoryItem['sessionType']) =>
    sessionType ? t(`running.sessionType.${sessionType}`) : t('running.hub.freeRun');
}

export function RunRow({ run, todayKey, recordCount, onOpen, onAgain, compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const typeLabel = useRunTypeLabel();

  const date = new Date(run.finishedAt ?? run.startedAt);
  const dayKey = runDayKey(run);
  const isToday = dayKey === todayKey;
  const dow = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(date).replace('.', '');
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');

  const name = typeLabel(run.sessionType);
  const figures = [
    run.distanceM != null ? units.formatDistance(run.distanceM / 1000) : null,
    run.durationSeconds != null ? formatDurationHms(run.durationSeconds) : null,
    run.avgPaceSPerKm != null ? units.formatPace(run.avgPaceSPerKm) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const feeling = feelingFromStoredRpe(run.rpe);
  const context = [
    run.terrain ? t(`running.terrain.${run.terrain}`) : null,
    feeling ? t(`workout.summary.feeling.${feeling}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const again = canRunAgain(run);
  const againLabel = t('runningHub.recent.againA11y', { date: `${dd}/${mm}` });

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Pressable
        testID={`run-row-${run.id}`}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={[name, date.toLocaleDateString(i18n.language), figures, context]
          .filter(Boolean)
          .join(' · ')}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
      >
        <View style={[styles.date, { backgroundColor: isToday ? colors.accent : colors.surfaceAlt }]}>
          <Text style={[styles.dow, { color: isToday ? colors.accentText : colors.accent }]}>
            {dow.toUpperCase()}
          </Text>
          <Text style={[styles.day, { color: isToday ? colors.accentText : colors.text }]}>{date.getDate()}</Text>
        </View>
        <View style={styles.texts}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            {recordCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.warn }]}>
                <Ionicons name="trophy-outline" size={12} color={colors.warnText} />
                <Text style={[styles.badgeText, { color: colors.warnText }]}>{recordCount}</Text>
              </View>
            ) : null}
          </View>
          {figures ? (
            <Text style={[styles.figures, { color: colors.textMuted }]} numberOfLines={1}>
              {figures}
            </Text>
          ) : null}
          {context ? (
            <Text style={[styles.context, { color: colors.textMuted }]} numberOfLines={1}>
              {context}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {again ? (
        <PressableScale
          testID={`run-again-${run.id}`}
          haptic="confirm"
          onPress={onAgain}
          accessibilityRole="button"
          accessibilityLabel={againLabel}
          style={[styles.again, compact && styles.againCompact, { borderColor: colors.accent }]}
        >
          <Ionicons name="repeat" size={compact ? 18 : 16} color={colors.accent} />
          {compact ? null : (
            <Text style={[styles.againLabel, { color: colors.accent }]}>{t('runningHub.recent.again')}</Text>
          )}
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50 },
  pressed: { opacity: 0.7 },
  date: { width: 46, height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dow: { fontFamily: fontFamily.mono, fontSize: 9.5 },
  day: { fontFamily: fontFamily.displayXBold, fontSize: 20, lineHeight: 22 },
  texts: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { flexShrink: 1, fontFamily: fontFamily.bodyBold, fontSize: 15.5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: fontFamily.bodyBold, fontSize: 11.5 },
  figures: { fontFamily: fontFamily.mono, fontSize: 12.5 },
  context: { fontFamily: fontFamily.body, fontSize: 12.5 },
  again: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  againCompact: { width: 44, paddingHorizontal: 0, justifyContent: 'center' },
  againLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});
