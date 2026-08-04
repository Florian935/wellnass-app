/**
 * Widget conditionnel Tier 2 — Jours consécutifs sans repos (US MR-14), 3 formes.
 *
 * Widget **conditionnel** : rendu seulement si `useLoadStreakAlert().show` (streak de charge
 * combinée muscu ∪ course ≥ 6 jours, **et** TRI-12 pas déjà affiché — spec R3/D1, appliqué dans le
 * hook). Ton « alerte douce » (warn), même patron que `OvertrainingGuardCard`/`TrainingLoadAlertCard`
 * — un streak sans repos est un signal de récupération, pas un simple constat comme MR-08.
 *  - `small` : eyebrow + ⚠️ + titre ;
 *  - `wide`  : tuile ⚠️ + titre + message ;
 *  - `large` : eyebrow + titre + message + bandeau recommandation.
 *
 * Le titre interpole le **nombre réel** de jours (spec §6). Gardé par pilier dans le hook
 * (`strength` ET `running` — 2 piliers, contrairement aux 3 de TRI-12 : c'est précisément ce qui
 * distingue cette US, spec §0). Accessibilité : un seul bloc `accessible`, pas des `Text` disjoints.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useLoadStreakAlert } from '@/data/repositories/dashboard-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

export function LoadStreakAlertCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const alert = useLoadStreakAlert();

  if (!alert.show) return null;

  const title = t('home.loadStreakAlert.title', { days: alert.streakDays });
  const message = t('home.loadStreakAlert.message');
  const recommend = t('home.loadStreakAlert.recommend');
  const a11yLabel = `${title}. ${message} ${recommend}`;

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} tone="warn">
        <View accessible accessibilityLabel={a11yLabel} style={styles.smallCol}>
          <View style={styles.head}>
            <Eyebrow tone="warn">{t('home.loadStreakAlert.eyebrow')}</Eyebrow>
            <Text style={styles.warnEmoji}>⚠️</Text>
          </View>
          <Text style={[styles.smallTitle, { color: colors.warnText }]} numberOfLines={3}>
            {title}
          </Text>
        </View>
      </WidgetFrame>
    );
  }

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} tone="warn">
        <View accessible accessibilityLabel={a11yLabel} style={styles.wideRow}>
          <View style={[styles.tile, { backgroundColor: withAlpha(colors.accent, 0.14) }]}>
            <Text style={styles.warnEmojiLg}>⚠️</Text>
          </View>
          <View style={styles.wideText}>
            <Text style={[styles.wideTitle, { color: colors.warnText }]}>{title}</Text>
            <Text style={[styles.wideMessage, { color: colors.warnText }]} numberOfLines={3}>
              {message}
            </Text>
          </View>
        </View>
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  return (
    <WidgetFrame pad={22} tone="warn">
      <View accessible accessibilityLabel={a11yLabel} style={styles.largeCol}>
        <View style={styles.head}>
          <Eyebrow tone="warn">{t('home.loadStreakAlert.eyebrow')}</Eyebrow>
          <Text style={styles.warnEmojiLg}>⚠️</Text>
        </View>
        <Text style={[styles.largeTitle, { color: colors.warnText }]}>{title}</Text>
        <Text style={[styles.largeMessage, { color: colors.warnText }]}>{message}</Text>
        <View
          style={[styles.banner, { backgroundColor: withAlpha(colors.warnText, 0.1), borderColor: colors.warnBorder }]}
        >
          <Text style={[styles.bannerText, { color: colors.warnText }]}>{recommend}</Text>
        </View>
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  warnEmoji: { fontSize: 15 },
  warnEmojiLg: { fontSize: 22 },
  smallCol: { flex: 1, justifyContent: 'space-between' },
  smallTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 19, marginTop: 'auto' },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  wideText: { flex: 1, gap: 2 },
  wideTitle: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  wideMessage: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  largeCol: { gap: 8, flex: 1 },
  largeTitle: { fontFamily: fontFamily.bodyBold, fontSize: 18, marginTop: 4 },
  largeMessage: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  banner: { marginTop: 'auto', borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12 },
  bannerText: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
});
