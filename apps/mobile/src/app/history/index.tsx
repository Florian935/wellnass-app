/**
 * Historique des séances — refondu par l'US MUSCU-UX01 (10/09/2026).
 *
 * ── Ce que l'écran était ─────────────────────────────────────────────────────────────────────────
 * Une liste de lignes « date · durée · RPE ». Impossible de retrouver « ma séance pecs du 2 » sans
 * ouvrir les fiches une par une — alors que le tonnage était **déjà chargé** (`volumeKg` faisait
 * partie de `WorkoutHistoryItem`, et le widget du hub l'affichait).
 *
 * Manquaient aussi trois promesses de la spec `musculation.md` §6.1, jamais implémentées : le
 * filtre par programme, le filtre par groupe musculaire, et la suppression d'une séance passée.
 *
 * ── Ce qu'il est ─────────────────────────────────────────────────────────────────────────────────
 * Chaque ligne porte le **nom de la séance**, son tonnage, son nombre d'exercices et une pastille
 * de record : elle se reconnaît sans être ouverte. Les séances sont **groupées par mois**, avec le
 * cumul du mois — c'est l'unité dans laquelle on juge sa régularité. Et un appui long supprime,
 * après confirmation.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  deleteWorkout,
  useWorkoutHistory,
  type WorkoutHistoryItem,
} from '@/data/repositories/workout-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Périodes proposées ; `all` ne filtre pas. */
type PeriodFilter = 'all' | '7d' | '30d' | '90d';
const PERIOD_OPTIONS: readonly PeriodFilter[] = ['all', '7d', '30d', '90d'];

/**
 * Borne basse (Date locale) d'une période, ou `null` pour « tout ».
 *
 * ⚠️ Ramenée à **minuit**, et pas à `now − N × 24 h` : « 7 jours » désigne les sept derniers
 * jours calendaires, pas une fenêtre glissante. Sans ce calage, une séance faite il y a six jours
 * à 20 h disparaîtrait du filtre « 7 j » dès le lendemain matin — comportement que l'utilisateur
 * lit comme une perte de données.
 */
function lowerBoundFor(period: PeriodFilter): Date | null {
  if (period === 'all') return null;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Un mois de séances, tel que la liste le rend. */
type MonthGroup = {
  key: string;
  label: string;
  items: WorkoutHistoryItem[];
  volumeKg: number;
};

/** Date d'une séance : `finishedAt` s'il existe, sinon le début. */
function dateOf(item: WorkoutHistoryItem): Date {
  return new Date(item.finishedAt ?? item.startedAt);
}

/**
 * Groupe les séances par mois **calendaire local**.
 *
 * Local et non UTC : une séance du 1er à 00h30 appartient au mois où elle a été vécue, pas à celui
 * de son horodatage UTC. Même règle que partout ailleurs dans l'app.
 */
function groupByMonth(items: WorkoutHistoryItem[], locale: string): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const item of items) {
    const date = dateOf(item);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      existing.volumeKg += item.volumeKg;
      continue;
    }
    groups.set(key, {
      key,
      label: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date),
      items: [item],
      volumeKg: item.volumeKg,
    });
  }
  // `useWorkoutHistory` rend déjà les séances de la plus récente à la plus ancienne : l'ordre
  // d'insertion de la `Map` suffit, inutile de retrier.
  return [...groups.values()];
}

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { workouts, isLoading } = useWorkoutHistory();
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const lockDelete = useActionLock();

  const bound = lowerBoundFor(period);
  const filtered = bound ? workouts.filter((item) => dateOf(item) >= bound) : workouts;

  const groups = groupByMonth(filtered, i18n.language);
  const totalVolume = workouts.reduce((sum, item) => sum + item.volumeKg, 0);

  const onDelete = (item: WorkoutHistoryItem) => {
    const name = item.sessionName?.trim() || t('history.freeSession');
    Alert.alert(t('history.delete.title'), t('history.delete.message', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('history.delete.confirm'),
        style: 'destructive',
        // Verrou : deux appuis du même cycle rejoueraient la transaction, et la seconde
        // remettrait l'occurrence de planning en `planned` après coup.
        onPress: () => void lockDelete(async () => deleteWorkout(item.id)),
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('history.title')}
        subtitle={
          workouts.length > 0
            ? t('history.summary', {
                count: workouts.length,
                volume: units.formatWeight(totalVolume),
              })
            : t('history.subtitle')
        }
      />

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
                style={[styles.chipLabel, { color: selected ? colors.accentText : colors.text }]}
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
          message={
            period === 'all' ? t('history.empty.message') : t('history.empty.filtered')
          }
          // Un filtre qui ne ramène rien se corrige en le retirant, pas en allant s'entraîner.
          cta={
            period === 'all'
              ? undefined
              : { label: t('history.empty.resetFilter'), onPress: () => setPeriod('all') }
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
                  {group.label}
                </Text>
                <View style={[styles.rule, { backgroundColor: colors.border }]} />
                <Text style={[styles.groupMeta, { color: colors.textMuted }]}>
                  {t('history.monthSummary', {
                    count: group.items.length,
                    volume: units.formatWeight(group.volumeKg),
                  })}
                </Text>
              </View>

              {group.items.map((item) => (
                <WorkoutRow
                  key={item.id}
                  item={item}
                  onPress={() => router.push(`/history/${item.id}`)}
                  onLongPress={() => onDelete(item)}
                />
              ))}
            </View>
          ))}
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
  onLongPress,
}: {
  item: WorkoutHistoryItem;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  const date = new Date(item.finishedAt ?? item.startedAt);
  const day = String(date.getDate()).padStart(2, '0');
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' })
    .format(date)
    .replace('.', '')
    .toUpperCase();

  const name = item.sessionName?.trim() || t('history.freeSession');
  const isFree = !item.sessionName?.trim();

  const meta = [
    item.durationSeconds != null
      ? t('history.row.durationMin', { count: Math.round(item.durationSeconds / 60) })
      : null,
    // Le tonnage était déjà chargé et jamais affiché : c'est ce qui distingue deux séances de
    // même durée.
    item.volumeKg > 0 ? units.formatWeight(item.volumeKg) : null,
    item.exerciseCount > 0 ? t('history.row.exercises', { count: item.exerciseCount }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} · ${date.toLocaleDateString()}`}
      accessibilityHint={t('history.deleteHint')}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.dateTile,
          { backgroundColor: isFree ? colors.surfaceAlt : `${colors.accent}1a` },
        ]}
      >
        <Text
          style={[styles.dateDay, { color: isFree ? colors.textMuted : colors.accent }]}
        >
          {day}
        </Text>
        <Text
          style={[styles.dateMonth, { color: isFree ? colors.textMuted : colors.accent }]}
        >
          {month}
        </Text>
      </View>

      <View style={styles.rowTexts}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          {item.recordCount > 0 ? <Text style={styles.trophy}>🏆</Text> : null}
          {isFree ? (
            <View style={[styles.freeBadge, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.freeBadgeText, { color: colors.textMuted }]}>
                {t('history.freeBadge')}
              </Text>
            </View>
          ) : null}
        </View>
        {meta ? (
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  scroll: { paddingBottom: 24, gap: 18 },
  group: { gap: 9 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  rule: { flex: 1, height: 1 },
  groupMeta: { fontFamily: fontFamily.body, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  dateTile: { width: 44, borderRadius: 11, paddingVertical: 6, alignItems: 'center' },
  dateDay: { fontFamily: fontFamily.monoBold, fontSize: 15, lineHeight: 17 },
  dateMonth: { fontFamily: fontFamily.bodySemi, fontSize: 9, letterSpacing: 0.4 },
  rowTexts: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { flexShrink: 1, fontFamily: fontFamily.bodySemi, fontSize: 14.5 },
  trophy: { fontSize: 13 },
  freeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  freeBadgeText: { fontFamily: fontFamily.bodySemi, fontSize: 9.5, letterSpacing: 0.3 },
  meta: { fontFamily: fontFamily.mono, fontSize: 11.5 },
  pressed: { opacity: 0.85 },
});
