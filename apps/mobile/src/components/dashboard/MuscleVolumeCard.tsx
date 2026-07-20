/**
 * Widget 7.9 — Volume muscu de la semaine.
 *
 * Barres de volume par groupe musculaire pour la semaine courante (lundi→dimanche,
 * minuit local), réutilisant le composant `MuscleVolumeBarChart` de l'écran
 * Progression. Gardé par le pilier `strength` en amont (cf. dashboard).
 *
 * États :
 *  - `volumes` vide : état vide (`home.volumeWeek.empty`).
 *  - Sinon          : histogramme + lien « Détail → ».
 *
 * Unité : **kg** (le volume est une charge cumulée ; pas de conversion `useUnits`,
 * cohérent avec l'écran Progression — cf. spec 7.9).
 *
 * Routing : lien → `/progress` (Progression).
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MuscleGroup, WidgetSize } from '@wellness/shared';
import { DashboardCard } from '@/components/DashboardCard';
import { WidgetShell } from '@/components/widgets/WidgetShell';
import { MuscleVolumeBarChart } from '@/components/charts/MuscleVolumeBarChart';
import { useMuscleVolumeThisWeek } from '@/data/repositories/records-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function MuscleVolumeCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { volumes, isLoading } = useMuscleVolumeThisWeek();

  if (isLoading) return null;

  // ── Forme petit carré : total kg (pas de conversion), remplit la case ──────
  if (size === 'small') {
    const total = volumes.reduce((sum, v) => sum + v.volume, 0);
    return (
      <WidgetShell
        icon="barbell-outline"
        title={t('home.volumeWeek.title')}
        onPress={() => router.push('/progress')}
        value={
          volumes.length === 0
            ? t('home.volumeWeek.compactEmpty')
            : t('home.volumeWeek.compactTotal', {
                kg: new Intl.NumberFormat(i18n.language).format(Math.round(total)),
              })
        }
        valueMuted={volumes.length === 0}
      />
    );
  }

  // ── État : aucune séance cette semaine ─────────────────────────────────────
  if (volumes.length === 0) {
    return (
      <DashboardCard icon="barbell-outline" title={t('home.volumeWeek.title')}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('home.volumeWeek.empty')}
        </Text>
      </DashboardCard>
    );
  }

  // ── État : données présentes ───────────────────────────────────────────────
  // Volume en kg (pas de conversion) ; libellé du groupe musculaire traduit.
  const total = volumes.reduce((sum, v) => sum + v.volume, 0);
  const totalLabel = t('home.volumeWeek.compactTotal', {
    kg: new Intl.NumberFormat(i18n.language).format(Math.round(total)),
  });

  // ── Grand carré : chiffre + graphe par groupe musculaire (rempli, 2 unités de haut) ──
  if (size === 'large') {
    const chartData = volumes.map((v) => ({
      label: t(`muscle.${v.muscle as MuscleGroup}`),
      value: v.volume,
    }));
    return (
      <WidgetShell
        icon="barbell-outline"
        title={t('home.volumeWeek.title')}
        onPress={() => router.push('/progress')}
        showChevron
      >
        <Text style={[styles.total, { color: colors.text }]}>{totalLabel}</Text>
        <MuscleVolumeBarChart data={chartData} unit="kg" />
      </WidgetShell>
    );
  }

  // ── Rectangle : compact (total + lien), SANS graphe (tenait mal sur 1 unité) ──
  return (
    <DashboardCard icon="barbell-outline" title={t('home.volumeWeek.title')}>
      <View style={styles.wideRow}>
        <Text style={[styles.total, { color: colors.text }]}>{totalLabel}</Text>
        <Pressable onPress={() => router.push('/progress')} hitSlop={8} accessibilityRole="link">
          <Text style={[styles.link, { color: colors.accent }]}>
            {t('home.volumeWeek.link')}
          </Text>
        </Pressable>
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  wideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  total: { fontFamily: fontFamily.displaySemi, fontSize: 20, letterSpacing: -0.4 },
  link: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
});
