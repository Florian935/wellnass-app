/**
 * Widget 7.8 — Records récents, décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : eyebrow + 🏆 + exercice + valeur (accent) ;
 *  - `wide`  : eyebrow + ligne « tuile 🏆 · exercice · date · valeur » ;
 *  - `large` : eyebrow + liste des derniers records (1ᵉʳ en avant) + total 7 jours.
 *
 * Formes small/wide : dernier record tous piliers (`useMostRecentRecord`). Forme large : liste
 * muscu (`useRecentStrengthRecords`), repli sur le hero du dernier record si aucun record muscu.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatPaceMMSS, type RecordDistanceKey, type RecordType, type WidgetSize } from '@wellness/shared';
import { Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import {
  useMostRecentRecord,
  useRecentStrengthRecords,
  type RecentStrengthRecord,
} from '@/data/repositories/dashboard-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

const RECORD_DISTANCE_KEY: Record<RecordDistanceKey, string> = {
  '1k': 'running.records.distance1k',
  '5k': 'running.records.distance5k',
  '10k': 'running.records.distance10k',
  semi: 'running.records.distanceSemi',
  marathon: 'running.records.distanceMarathon',
};

/** Nombre de jours entiers écoulés depuis `iso` (borné à 0) ; `null` si date invalide. */
function daysSince(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

/** Nombre de records dont la date est dans les 7 derniers jours. */
function countWithin7Days(records: { achievedAt: string }[]): number {
  return records.filter((r) => {
    const days = daysSince(r.achievedAt);
    return days != null && days <= 7;
  }).length;
}

export function RecordRecentCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { record, isLoading } = useMostRecentRecord();
  const { records: recent, isLoading: recentLoading } = useRecentStrengthRecords(4);

  if (isLoading || recentLoading) return null;

  /** Valeur formatée d'un record muscu (volume en kg localisé, sinon poids selon unités). */
  const strengthValue = (type: RecordType, value: number): string =>
    type === 'best_volume'
      ? `${new Intl.NumberFormat(i18n.language).format(Math.round(value))} kg`
      : units.formatWeight(value);

  /** Date relative courte : « Aujourd'hui » / « il y a N j ». */
  const relDay = (iso: string): string => {
    const days = daysSince(iso);
    if (days == null) return '';
    return days === 0 ? t('home.record.today') : t('home.record.daysAgo', { count: days });
  };

  // Libellé + valeur + route du dernier record (small/wide).
  let name: string | null = null;
  let value = '';
  let route: '/progress' | '/running-history' = '/progress';
  if (record != null) {
    if (record.pillar === 'strength') {
      name = record.exerciseName;
      value = strengthValue(record.type, record.value);
      route = '/progress';
    } else {
      name = t(RECORD_DISTANCE_KEY[record.distanceKey]);
      value = formatPaceMMSS(record.bestTimeSeconds, '—');
      route = '/running-history';
    }
  }
  const open = () => router.push(route);

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={name != null ? open : undefined} accessibilityLabel={t('home.record.title')}>
        <View style={styles.smallHead}>
          <Eyebrow>{t('home.record.eyebrow')}</Eyebrow>
          <Text style={styles.trophy}>🏆</Text>
        </View>
        <View style={styles.smallBottom}>
          {name != null ? (
            <>
              <Text style={[styles.smallName, { color: colors.textMuted }]} numberOfLines={1}>
                {name}
              </Text>
              <Metric value={value} color={colors.accent} />
            </>
          ) : (
            <Metric value={t('home.record.compactEmpty')} muted />
          )}
        </View>
      </WidgetFrame>
    );
  }

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} onPress={name != null ? open : undefined} accessibilityLabel={t('home.record.title')} style={styles.wideCol}>
        <Eyebrow>{t('home.record.lastEyebrow')}</Eyebrow>
        {name != null ? (
          <View style={styles.wideRow}>
            <View style={[styles.tile, { backgroundColor: withAlpha(colors.accent, 0.14) }]}>
              <Text style={styles.tileEmoji}>🏆</Text>
            </View>
            <View style={styles.wideText}>
              <Text style={[styles.wideName, { color: colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.wideDate, { color: colors.textMuted }]}>{relDay(record!.achievedAt)}</Text>
            </View>
            <Text style={[styles.wideValue, { color: colors.accent }]}>{value}</Text>
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('home.record.empty')}</Text>
        )}
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  const weekCount = countWithin7Days(recent);

  return (
    <WidgetFrame pad={22} onPress={name != null ? open : undefined} accessibilityLabel={t('home.record.title')} style={styles.largeCol}>
      <View style={styles.largeHead}>
        <Eyebrow>{t('home.record.eyebrow')}</Eyebrow>
        <Text style={styles.trophyBig}>🏆</Text>
      </View>
      {recent.length > 0 ? (
        <>
          <View style={styles.list}>
            {recent.slice(0, 3).map((r: RecentStrengthRecord, i) => (
              <View
                key={`${r.exerciseName}-${r.achievedAt}-${i}`}
                style={[
                  styles.listRow,
                  i === 0
                    ? { backgroundColor: withAlpha(colors.accent, 0.1), borderColor: withAlpha(colors.accent, 0.28) }
                    : { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <View style={styles.listText}>
                  <Text style={[styles.listName, { color: i === 0 ? colors.accent : colors.text }]} numberOfLines={1}>
                    {r.exerciseName}
                  </Text>
                  <Text style={[styles.listDate, { color: colors.textMuted }]}>{relDay(r.achievedAt)}</Text>
                </View>
                <Text style={[styles.listValue, { color: i === 0 ? colors.accent : colors.text }]}>
                  {strengthValue(r.type, r.value)}
                </Text>
              </View>
            ))}
          </View>
          {weekCount > 0 ? (
            <Text style={[styles.footer, { color: colors.textMuted }]}>
              {t('home.record.weekCount', { count: weekCount })}
            </Text>
          ) : null}
        </>
      ) : name != null ? (
        <View style={styles.heroRow}>
          <Text style={[styles.wideName, { color: colors.text }]}>{name}</Text>
          <Text style={[styles.wideValue, { color: colors.accent }]}>{value}</Text>
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('home.record.empty')}</Text>
      )}
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  smallHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trophy: { fontSize: 16 },
  trophyBig: { fontSize: 18 },
  smallBottom: { marginTop: 'auto', gap: 2 },
  smallName: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  wideCol: { justifyContent: 'center', gap: 12 },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 20 },
  wideText: { flex: 1 },
  wideName: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  wideDate: { fontFamily: fontFamily.body, fontSize: 12.5 },
  wideValue: { fontFamily: fontFamily.monoBold, fontSize: 18 },
  largeCol: { gap: 16 },
  largeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: 11 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listText: { flex: 1 },
  listName: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  listDate: { fontFamily: fontFamily.body, fontSize: 12 },
  listValue: { fontFamily: fontFamily.monoBold, fontSize: 17 },
  footer: { fontFamily: fontFamily.body, fontSize: 12.5, textAlign: 'center', marginTop: 'auto' },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
