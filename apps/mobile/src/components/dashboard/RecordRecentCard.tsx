/**
 * Widget 7.8 — Record récent.
 *
 * Affiche le **dernier record battu**, tous piliers actifs confondus (muscu ou
 * course), avec sa date. Gardé par pilier en amont (rendu si `strength` OU
 * `running` actif, cf. dashboard) ; le hook filtre en plus les sources selon les
 * piliers actifs (jamais de record d'un pilier désactivé).
 *
 * États :
 *  - `record = null` : état vide (`home.record.empty`).
 *  - Muscu           : badge « Muscu » + « {exercice} — {valeur} » + date.
 *  - Course          : badge « Course » + « {distance} — {M:SS} » + date.
 *
 * Formatage :
 *  - Poids muscu (`max_weight` / `estimated_1rm`) via `useUnits().formatWeight`
 *    (respecte le réglage métrique/impérial) ;
 *  - `best_volume` = charge cumulée **toujours en kg** (comme le widget Volume 7.9),
 *    avec séparateur de milliers localisé (pas de conversion impériale d'un volume).
 *  - Temps de course en M:SS via `formatPaceMMSS` (helper partagé).
 *  - Date courte locale JJ/MM/AAAA (`—` si date invalide).
 *
 * Routing :
 *  - Muscu  → `/progress` (Progression).
 *  - Course → `/running-history` (Historique).
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatPaceMMSS, type RecordDistanceKey } from '@wellness/shared';
import { DashboardCard } from '@/components/DashboardCard';
import { useMostRecentRecord } from '@/data/repositories/dashboard-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Clé i18n du libellé de distance pour chaque record d'allure canonique. */
const RECORD_DISTANCE_KEY: Record<RecordDistanceKey, string> = {
  '1k': 'running.records.distance1k',
  '5k': 'running.records.distance5k',
  '10k': 'running.records.distance10k',
  semi: 'running.records.distanceSemi',
  marathon: 'running.records.distanceMarathon',
};

/** Formate une date ISO en JJ/MM/AAAA (date courte locale) ; `—` si invalide. */
function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function RecordRecentCard() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { record, isLoading } = useMostRecentRecord();

  if (isLoading) return null;

  // ── État : aucun record ────────────────────────────────────────────────────
  if (record == null) {
    return (
      <DashboardCard icon="trophy-outline" title={t('home.record.title')}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('home.record.empty')}
        </Text>
      </DashboardCard>
    );
  }

  // ── État : record présent ──────────────────────────────────────────────────
  const badge = t(`home.record.${record.pillar}`);

  let label: string;
  let route: '/progress' | '/running-history';
  if (record.pillar === 'strength') {
    const value =
      record.type === 'best_volume'
        ? `${new Intl.NumberFormat(i18n.language).format(Math.round(record.value))} kg`
        : units.formatWeight(record.value);
    label = `${record.exerciseName} — ${value}`;
    route = '/progress';
  } else {
    const distance = t(RECORD_DISTANCE_KEY[record.distanceKey]);
    const time = formatPaceMMSS(record.bestTimeSeconds, '—');
    label = `${distance} — ${time}`;
    route = '/running-history';
  }

  return (
    <DashboardCard icon="trophy-outline" title={t('home.record.title')}>
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.badgeText, { color: colors.text }]}>{badge}</Text>
        </View>
        <Pressable
          onPress={() => router.push(route)}
          hitSlop={8}
          accessibilityRole="link"
        >
          <Text style={[styles.link, { color: colors.accent }]}>
            {t('home.record.link')}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.recordLabel, { color: colors.text }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.date, { color: colors.textMuted }]}>
        {formatDateFr(record.achievedAt)}
      </Text>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  link: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  recordLabel: {
    fontFamily: fontFamily.displayBold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  date: { fontFamily: fontFamily.body, fontSize: 12 },
});
