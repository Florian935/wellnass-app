/**
 * Widget 7.9 — Volume muscu, décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : eyebrow + tonnage 7 j + pastille de variation ;
 *  - `wide`  : tonnage + variation à gauche, mini-barres par groupe à droite ;
 *  - `large` : tonnage + variation + barres par groupe (tonnage) + bandeau groupe délaissé.
 *
 * Tonnage headline & variation : `useWeeklyVolumeComparison` (kg, 7 j glissants vs 7 j précédents).
 * Répartition & équilibre par groupe : `useMuscleBalance`. Volume = charge cumulée (unité tonne).
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MuscleGroup, WidgetSize } from '@wellness/shared';
import { HBars, MiniBars } from '@/components/widgets/primitives';
import { Chip, Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useMuscleBalance, useWeeklyVolumeComparison } from '@/data/repositories/records-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function MuscleVolumeCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { current, previous, isLoading } = useWeeklyVolumeComparison();
  const { balance, volumes, isLoading: balanceLoading } = useMuscleBalance();

  if (isLoading || balanceLoading) return null;
  const open = () => router.push('/progress');

  const isEmpty = current <= 0 && volumes.length === 0;
  const ton = (kg: number) =>
    new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
      kg / 1000,
    );
  const totalTon = ton(current);
  const deltaKg = current - previous;
  const hasDelta = previous > 0 && Math.abs(deltaKg) >= 50;
  const deltaLabel = `${deltaKg >= 0 ? '▲ +' : '▼ '}${ton(Math.abs(deltaKg))} ${t('home.volumeWeek.unitTon')}`;

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('home.volumeWeek.title')}>
        <Eyebrow>{t('home.volumeWeek.eyebrow')}</Eyebrow>
        <View style={styles.smallBottom}>
          {isEmpty ? (
            <Metric value={t('home.volumeWeek.compactEmpty')} muted />
          ) : (
            <>
              <Metric value={totalTon} unit={t('home.volumeWeek.unitTon')} />
              {hasDelta ? (
                <View style={styles.chipWrap}>
                  <Chip label={deltaLabel} tone={deltaKg >= 0 ? 'success' : 'neutral'} />
                </View>
              ) : null}
            </>
          )}
        </View>
      </WidgetFrame>
    );
  }

  const groupBars = [...volumes].sort((a, b) => b.tonnage - a.tonnage);

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} onPress={open} accessibilityLabel={t('home.volumeWeek.title')} style={styles.wideRow}>
        <View style={styles.wideLeft}>
          <Eyebrow>{t('home.volumeWeek.eyebrow')}</Eyebrow>
          <Text style={[styles.wideValue, { color: colors.text }]}>
            {isEmpty ? '—' : totalTon}
            {!isEmpty ? <Text style={[styles.wideUnit, { color: colors.textMuted }]}> {t('home.volumeWeek.unitTon')}</Text> : null}
          </Text>
          {hasDelta ? (
            <Text style={[styles.wideDelta, { color: deltaKg >= 0 ? colors.success : colors.textMuted }]}>
              {deltaLabel} {t('home.volumeWeek.vsPrev')}
            </Text>
          ) : null}
        </View>
        {groupBars.length > 0 ? (
          <View style={styles.wideBars}>
            <MiniBars values={groupBars.map((g) => g.tonnage)} height={80} highlightIndex="max" />
          </View>
        ) : null}
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  const maxTon = Math.max(1, ...groupBars.map((g) => g.tonnage));
  const neglected = balance.neglected[0] as MuscleGroup | undefined;
  const rows = groupBars.slice(0, 5).map((g) => ({
    label: t(`muscle.${g.muscle}`),
    pct: (g.tonnage / maxTon) * 100,
    value: String(g.sets),
    color: neglected === g.muscle ? colors.amber : colors.accent,
  }));

  return (
    <WidgetFrame pad={22} onPress={open} accessibilityLabel={t('home.volumeWeek.title')} style={styles.largeCol}>
      <Eyebrow>{t('home.volumeWeek.byGroupEyebrow')}</Eyebrow>
      <Text style={[styles.largeValue, { color: colors.text }]}>
        {isEmpty ? '—' : totalTon}
        <Text style={[styles.wideUnit, { color: colors.textMuted }]}> {t('home.volumeWeek.unitTon')}</Text>
        {hasDelta ? (
          <Text style={[styles.largeDelta, { color: deltaKg >= 0 ? colors.success : colors.textMuted }]}>
            {'  '}
            {deltaLabel}
          </Text>
        ) : null}
      </Text>
      {rows.length > 0 ? (
        <View style={styles.bars}>
          <HBars rows={rows} />
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('home.volumeWeek.empty')}</Text>
      )}
      {neglected ? (
        <View style={[styles.banner, { backgroundColor: colors.warn, borderColor: colors.warnBorder }]}>
          <Text style={[styles.bannerText, { color: colors.warnText }]}>
            {t('home.volumeWeek.neglected', { group: t(`muscle.${neglected}`) })}
          </Text>
        </View>
      ) : null}
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  smallBottom: { marginTop: 'auto', gap: 6 },
  chipWrap: { flexDirection: 'row' },
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  wideLeft: { flexShrink: 0 },
  wideValue: { fontFamily: fontFamily.displayXBold, fontSize: 32, letterSpacing: -1.2, marginTop: 4 },
  wideUnit: { fontFamily: fontFamily.displaySemi, fontSize: 15, letterSpacing: 0 },
  wideDelta: { fontFamily: fontFamily.bodyBold, fontSize: 12.5, marginTop: 2 },
  wideBars: { flex: 1, height: 88, justifyContent: 'flex-end' },
  largeCol: { gap: 0 },
  largeValue: { fontFamily: fontFamily.displayXBold, fontSize: 40, letterSpacing: -1.5, marginTop: 6, marginBottom: 20 },
  largeDelta: { fontFamily: fontFamily.bodyBold, fontSize: 14, letterSpacing: 0 },
  bars: { marginBottom: 16 },
  banner: { marginTop: 'auto', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  bannerText: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
});
