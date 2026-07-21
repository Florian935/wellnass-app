/**
 * Widget 7.9bis — Alerte déficit calorique + fort volume muscu (US 4.32), décliné aux 3 formes.
 *
 * Widget **conditionnel** : rendu seulement si `useDeficitVolumeAlert().show`. Ton « alerte
 * douce » (warn) sur les 3 formes.
 *  - `small` : eyebrow + ⚠️ + « −N % » + sous-titre ;
 *  - `wide`  : tuile ⚠️ + titre + message ;
 *  - `large` : eyebrow + « −N % » + message + bandeau recommandation.
 *
 * Gardé par pilier dans le hook (`strength` ET `nutrition` actifs).
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useDeficitVolumeAlert } from '@/data/repositories/dashboard-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

export function DeficitVolumeAlertCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const alert = useDeficitVolumeAlert();

  if (!alert.show) return null;

  const pctLabel = `−${alert.deficitPct} %`;
  const message = t('home.deficitVolume.message', { pct: alert.deficitPct });

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} tone="warn">
        <View style={styles.head}>
          <Eyebrow tone="warn">{t('home.deficitVolume.eyebrow')}</Eyebrow>
          <Text style={styles.warnEmoji}>⚠️</Text>
        </View>
        <View style={styles.smallBottom}>
          <Metric value={pctLabel} color={colors.warnText} sub={t('home.deficitVolume.sub')} />
        </View>
      </WidgetFrame>
    );
  }

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} tone="warn" style={styles.wideRow}>
        <View style={[styles.tile, { backgroundColor: withAlpha(colors.accent, 0.14) }]}>
          <Text style={styles.warnEmojiLg}>⚠️</Text>
        </View>
        <View style={styles.wideText}>
          <Text style={[styles.wideTitle, { color: colors.warnText }]}>{t('home.deficitVolume.title')}</Text>
          <Text style={[styles.wideMessage, { color: colors.warnText }]} numberOfLines={3}>
            {message}
          </Text>
        </View>
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  return (
    <WidgetFrame pad={22} tone="warn" style={styles.largeCol}>
      <View style={styles.head}>
        <Eyebrow tone="warn">{t('home.deficitVolume.balanceEyebrow')}</Eyebrow>
        <Text style={styles.warnEmojiLg}>⚠️</Text>
      </View>
      <Text style={[styles.largePct, { color: colors.warnText }]}>{pctLabel}</Text>
      <Text style={[styles.largeMessage, { color: colors.warnText }]}>{message}</Text>
      <View style={[styles.banner, { backgroundColor: withAlpha(colors.warnText, 0.1), borderColor: colors.warnBorder }]}>
        <Text style={[styles.bannerText, { color: colors.warnText }]}>{t('home.deficitVolume.recommend')}</Text>
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  warnEmoji: { fontSize: 15 },
  warnEmojiLg: { fontSize: 22 },
  smallBottom: { marginTop: 'auto' },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  wideText: { flex: 1, gap: 2 },
  wideTitle: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  wideMessage: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  largeCol: { gap: 8 },
  largePct: { fontFamily: fontFamily.displayXBold, fontSize: 44, letterSpacing: -1.6, marginTop: 4 },
  largeMessage: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  banner: { marginTop: 'auto', borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12 },
  bannerText: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
});
