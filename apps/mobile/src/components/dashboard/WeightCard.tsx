/**
 * Widget 7.7 — Poids corporel.
 *
 * États :
 *  - Données présentes : poids formaté + flèche de tendance 7 j + lien "Voir la courbe →"
 *  - Vide              : texte + CTA "Ajouter ma première pesée"
 *
 * Tendance : down → success, up → danger, stable → textMuted.
 * Unités   : useUnits().formatWeight(kg) — kg ou lb selon réglage.
 * Routing  :
 *   - Lien "Voir la courbe" → `/nutrition-stats`
 *   - CTA première pesée   → `/nutrition-stats`
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { weightTrend, type WidgetSize } from '@wellness/shared';
import { Button } from '@/components/Button';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardCardCompact } from '@/components/dashboard/DashboardCardCompact';
import {
  useLatestWeight,
  useWeightEntries,
} from '@/data/repositories/bodyweight-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function sevenDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return isoDay(d);
}

export function WeightCard({ size = 'full' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  const { latest, isLoading: latestLoading } = useLatestWeight();
  const { entries, isLoading: entriesLoading } = useWeightEntries(sevenDaysAgo());

  if (latestLoading || entriesLoading) return null;

  // ── Variante compacte (US 7.11) : dernière pesée ───────────────────────────
  if (size === 'compact') {
    return (
      <DashboardCardCompact
        icon="scale-outline"
        title={t('home.weight.title')}
        value={latest != null ? units.formatWeight(latest.weightKg) : t('home.weight.compactEmpty')}
      />
    );
  }

  // ── État : aucune pesée ────────────────────────────────────────────────────
  if (latest == null) {
    return (
      <DashboardCard icon="scale-outline" title={t('home.weight.title')}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('home.weight.empty')}
        </Text>
        <Button
          label={t('home.weight.addFirst')}
          variant="ghost"
          onPress={() => router.push('/nutrition-stats')}
        />
      </DashboardCard>
    );
  }

  // ── État : données présentes ───────────────────────────────────────────────
  const trend = weightTrend(entries);
  const trendColor =
    trend === 'down' ? colors.success : trend === 'up' ? colors.danger : colors.textMuted;
  const trendArrow = trend === 'down' ? '▼' : trend === 'up' ? '▲' : '→';

  return (
    <DashboardCard icon="scale-outline" title={t('home.weight.title')}>
      {/* Valeur + tendance + lien */}
      <View style={styles.weightRow}>
        <View style={styles.weightVal}>
          <Text style={[styles.weightBig, { color: colors.text }]}>
            {units.formatWeight(latest.weightKg)}
          </Text>
          <Text style={[styles.trend, { color: trendColor }]}>{trendArrow}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/nutrition-stats')}
          hitSlop={8}
          accessibilityRole="link"
        >
          <Text style={[styles.link, { color: colors.accent }]}>
            {t('home.weight.link')}
          </Text>
        </Pressable>
      </View>

      {/* Sous-titre */}
      <Text style={[styles.sub, { color: colors.textMuted }]}>
        {t('home.weight.sub')}
      </Text>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  weightVal: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  weightBig: { fontFamily: fontFamily.monoBold, fontSize: 26, letterSpacing: -0.5 },
  trend: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  link: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  sub: { fontFamily: fontFamily.body, fontSize: 12 },
});
