/**
 * Widget 7.9bis — Alerte déficit calorique + fort volume muscu (US 4.32).
 *
 * Widget **conditionnel** : ne s'affiche que si `useDeficitVolumeAlert().show`
 * est vrai (déficit calorique marqué sur la semaine loggée, combiné à un volume
 * muscu élevé). Pas de bouton « ignorer » — l'alerte réapparaît tant que les
 * conditions sont réunies (cf. spec 4.32).
 *
 * Gardé par pilier en amont dans le hook lui-même (nécessite `strength` ET
 * `nutrition` actifs, cf. `useDeficitVolumeAlert`).
 */

import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { DashboardCard } from '@/components/DashboardCard';
import { WidgetShell } from '@/components/widgets/WidgetShell';
import { useDeficitVolumeAlert } from '@/data/repositories/dashboard-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function DeficitVolumeAlertCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const alert = useDeficitVolumeAlert();

  if (!alert.show) return null;

  // ── Forme petit carré : déficit en % (remplit la case) ─────────────────────
  if (size === 'small') {
    return (
      <WidgetShell
        icon="warning-outline"
        title={t('home.deficitVolume.title')}
        value={`−${alert.deficitPct} %`}
      />
    );
  }

  const message = (
    <Text style={[styles.message, { color: colors.textMuted }]}>
      {t('home.deficitVolume.message', { pct: alert.deficitPct })}
    </Text>
  );

  if (size === 'large') {
    return (
      <WidgetShell icon="warning-outline" title={t('home.deficitVolume.title')}>
        {message}
      </WidgetShell>
    );
  }

  return (
    <DashboardCard icon="warning-outline" title={t('home.deficitVolume.title')}>
      {message}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  message: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
});
