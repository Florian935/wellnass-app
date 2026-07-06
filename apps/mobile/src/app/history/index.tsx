import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  useWorkoutHistory,
  type WorkoutHistoryItem,
} from '@/data/repositories/workout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

// ---------------------------------------------------------------------------
// Filtre de période
// ---------------------------------------------------------------------------

type PeriodFilter = 'all' | '7d' | '30d' | '90d';

const PERIOD_OPTIONS: readonly PeriodFilter[] = ['all', '7d', '30d', '90d'];

/** Retourne la borne basse (Date locale) d'une période, ou null pour « tout ». */
function lowerBoundFor(period: PeriodFilter): Date | null {
  if (period === 'all') return null;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Formatage de date JJ/MM/AAAA
// ---------------------------------------------------------------------------

function formatDateFr(isoString: string): string {
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ---------------------------------------------------------------------------
// Écran principal
// ---------------------------------------------------------------------------

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [period, setPeriod] = useState<PeriodFilter>('all');

  const { workouts, isLoading } = useWorkoutHistory();

  const filtered = useMemo<WorkoutHistoryItem[]>(() => {
    const bound = lowerBoundFor(period);
    if (!bound) return workouts;
    return workouts.filter((w) => {
      const ref = w.finishedAt ?? w.startedAt;
      return new Date(ref) >= bound;
    });
  }, [workouts, period]);

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('history.title')} subtitle={t('history.subtitle')} />

      {/* Filtres de période */}
      <View style={styles.filtersRow}>
        {PERIOD_OPTIONS.map((opt) => {
          const selected = period === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => setPeriod(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: selected ? colors.accentText : colors.text },
                ]}
              >
                {t(opt === 'all' ? 'history.filterAll' : `history.filter${opt}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="barbell-outline"
          title={t('history.empty.title')}
          message={t('history.empty.message')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.list}>
            {filtered.map((item) => (
              <WorkoutRow
                key={item.id}
                item={item}
                onPress={() => router.push(`/history/${item.id}`)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Ligne de séance
// ---------------------------------------------------------------------------

function WorkoutRow({
  item,
  onPress,
}: {
  item: WorkoutHistoryItem;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const dateLabel = formatDateFr(item.finishedAt ?? item.startedAt);

  const metaParts: string[] = [];
  if (item.durationSeconds != null) {
    const minutes = Math.round(item.durationSeconds / 60);
    metaParts.push(t('history.row.durationMin', { count: minutes }));
  }
  if (item.rpe != null) {
    metaParts.push(t('history.row.rpe', { value: item.rpe }));
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={dateLabel}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.rowLeft}>
        <Text style={[styles.rowDate, { color: colors.text }]}>{dateLabel}</Text>
        {metaParts.length > 0 ? (
          <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
            {metaParts.join(' · ')}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  scroll: {
    paddingBottom: 24,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    gap: 3,
  },
  rowDate: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
  },
  rowMeta: {
    fontFamily: fontFamily.body,
    fontSize: 13,
  },
});
