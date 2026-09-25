/**
 * Une séance passée, en une ligne, avec son bouton Refaire — US MUSCU-UX07, §4.2-2 et §4.3.
 *
 * Partagée par « Refaire une séance » (S'entraîner) et la liste de l'Historique :
 *  - un pavé date (jour abrégé + numéro), la séance d'aujourd'hui en plein ;
 *  - le nom de la séance, ou « Séance libre » **suivie de ses deux premiers exercices** (D9) — une
 *    séance refaite est libre, et sans cela deux lignes « Séance libre » ne se distinguent pas ;
 *  - « durée · tonnage » (tonnes métriques, R6) et la pastille des records ;
 *  - Refaire (R4) : libellé en toutes lettres dans le hub, icône seule dans l'historique.
 *
 * Appui sur la ligne → détail ; appui long (historique seulement) → suppression.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WorkoutHistoryItem } from '@/data/repositories/workout-repository';
import { PressableScale } from '@/components/motion/PressableScale';
import { formatTonnes } from '@/hooks/useLastPerfFormat';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  item: WorkoutHistoryItem;
  todayKey: string;
  onOpen: () => void;
  onRedo: () => void;
  onLongPress?: () => void;
  /** Refaire en icône seule (liste de l'historique, plus dense). */
  compact?: boolean;
};

/** Date locale `AAAA-MM-JJ` d'une séance : sa fin, sinon son début (règle `dateOf` de l'historique). */
export function workoutDate(item: Pick<WorkoutHistoryItem, 'finishedAt' | 'startedAt'>): Date {
  return new Date(item.finishedAt ?? item.startedAt);
}

export function WorkoutRow({ item, todayKey, onOpen, onRedo, onLongPress, compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const date = workoutDate(item);
  const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const isToday = dayKey === todayKey;
  const dow = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(date).replace('.', '');
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');

  const name = item.sessionName?.trim() || t('history.freeSession');
  const exercisesHint =
    item.sessionName?.trim() || item.firstExercises.length === 0
      ? null
      : item.firstExercises.length === 1
        ? item.firstExercises[0]!
        : t('strengthHub.redo.freeExercises', { first: item.firstExercises[0], second: item.firstExercises[1] });

  const meta = [
    item.durationSeconds != null ? t('history.row.durationMin', { count: Math.round(item.durationSeconds / 60) }) : null,
    item.volumeKg > 0 ? t('history.calendar.tonnage', { tonnes: formatTonnes(item.volumeKg, i18n.language) }) : null,
    exercisesHint,
  ]
    .filter(Boolean)
    .join(' · ');

  const redoLabel = t('strengthHub.redo.a11y', { name, date: `${dd}/${mm}` });

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Pressable
        testID={`workout-row-${item.id}`}
        onPress={onOpen}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={[name, date.toLocaleDateString(i18n.language), meta].filter(Boolean).join(' · ')}
        accessibilityHint={onLongPress ? t('history.deleteHint') : undefined}
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
            {item.recordCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.warn }]}>
                <Ionicons name="trophy-outline" size={12} color={colors.warnText} />
                <Text style={[styles.badgeText, { color: colors.warnText }]}>{item.recordCount}</Text>
              </View>
            ) : null}
          </View>
          {meta ? (
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <PressableScale
        testID={`workout-redo-${item.id}`}
        haptic="confirm"
        onPress={onRedo}
        accessibilityRole="button"
        accessibilityLabel={redoLabel}
        style={[styles.redo, compact && styles.redoCompact, { backgroundColor: colors.surfaceAlt }]}
      >
        <Ionicons name="refresh" size={compact ? 18 : 16} color={colors.accent} />
        {compact ? null : (
          <Text style={[styles.redoLabel, { color: colors.accent }]}>{t('strengthHub.redo.action')}</Text>
        )}
      </PressableScale>
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
  texts: { flex: 1, gap: 3, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { flexShrink: 1, fontFamily: fontFamily.bodyBold, fontSize: 15.5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: fontFamily.bodyBold, fontSize: 11.5 },
  meta: { fontFamily: fontFamily.body, fontSize: 13 },
  redo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  redoCompact: { width: 44, paddingHorizontal: 0, justifyContent: 'center' },
  redoLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});
