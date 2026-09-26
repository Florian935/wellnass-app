/**
 * Widget 7.7 — Poids corporel, décliné aux **4** formes de la grille.
 *
 *  - `row`   : eyebrow + poids + delta 7 j sur une ligne ;
 *  - `small` : eyebrow + poids + pastille de tendance 7 j ;
 *  - `wide`  : poids + tendance à gauche, sparkline à droite ;
 *  - `large` : poids + objectif, sparkline pleine largeur (zone), bornes de période.
 *
 * Unités : `useUnits().formatWeight`. Tendance 7 j : `weightTrend` + delta (dernière − première
 * pesée de la fenêtre). Sparkline : `useWeightEntries` sur 6 semaines (repli propre < 2 points).
 *
 * ── Rétabli le 09/09/2026 (US ACCUEIL-04) ────────────────────────────────────────────────────────
 * Ce fichier avait été supprimé par le nettoyage qui a suivi INSIGHTS-02, le widget ayant été
 * déporté vers « Muscu › Progression › Mensurations ». Il est **restauré depuis l'historique** —
 * et non réécrit — parce qu'il portait déjà les quatre états, les unités et le repli à moins de
 * deux points de mesure. Deux défauts ont été corrigés au passage, et ils n'étaient pas cosmétiques :
 *
 *  1. il calculait ses bornes de fenêtre avec `new Date()` **dans le corps du composant**, ce que
 *     `useTodayKey` interdit explicitement : sans entrée réactive, React Compiler range la valeur
 *     dans un slot mount-only et le widget interrogeait éternellement le jour de son montage. Le
 *     défaut n'apparaît qu'en build release. Remplacé par `useWindowStartKey` ;
 *  2. il rendait `null` pendant le chargement, ce qui faisait sauter la grille à chaque ouverture
 *     de l'accueil. Remplacé par un squelette qui réserve la cellule.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { weightTrend, type WidgetSize } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Sparkline } from '@/components/widgets/primitives';
import { Chip, Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { WidgetSkeleton } from '@/components/widgets/WidgetSkeleton';
import { RowLine } from '@/components/widgets/RowLine';
import { useLatestWeight, useWeightEntries } from '@/data/repositories/bodyweight-repository';
import { useUnits } from '@/hooks/useUnits';
import { useWindowStartKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Fenêtre de la sparkline : six semaines de pesées. */
const SPARK_WINDOW_DAYS = 42;
/** Fenêtre de la tendance annoncée. */
const TREND_WINDOW_DAYS = 7;

export function WeightCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  // Hooks d'horloge AVANT tout retour anticipé (règle des hooks), et réactifs au changement de
  // jour — voir la docstring ci-dessus.
  const sparkStart = useWindowStartKey(SPARK_WINDOW_DAYS);
  const trendStart = useWindowStartKey(TREND_WINDOW_DAYS);

  const { latest, isLoading: latestLoading } = useLatestWeight();
  const { entries, isLoading: entriesLoading } = useWeightEntries(sparkStart);

  if (latestLoading || entriesLoading) {
    return <WidgetSkeleton size={size} label={t('home.weight.eyebrow')} />;
  }
  const open = () => router.push('/nutrition-stats?tab=weight');

  const weightStr = latest != null ? units.formatWeight(latest.weightKg) : t('home.weight.compactEmpty');

  // ── État vide (aucune pesée) ─────────────────────────────────────────────────
  if (latest == null) {
    if (size === 'row') {
      return (
        <RowLine
          eyebrow={t('home.weight.eyebrow')}
          value={t('home.weight.compactEmpty')}
          muted
          onPress={open}
          accessibilityLabel={t('home.weight.title')}
        />
      );
    }
    if (size === 'small') {
      return (
        <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('home.weight.title')}>
          <Eyebrow>{t('home.weight.eyebrow')}</Eyebrow>
          <View style={styles.smallBottom}>
            <Metric value={t('home.weight.compactEmpty')} muted />
          </View>
        </WidgetFrame>
      );
    }
    return (
      <WidgetFrame pad={18} style={styles.center}>
        <Eyebrow>{t('home.weight.eyebrow')}</Eyebrow>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('home.weight.empty')}</Text>
        <Button label={t('home.weight.addFirst')} variant="ghost" onPress={open} />
      </WidgetFrame>
    );
  }

  // Fenêtre 7 j pour la tendance ; série (asc) pour la sparkline.
  const sorted = [...entries].sort((a, b) => a.logDate.localeCompare(b.logDate));
  const window7 = sorted.filter((e) => e.logDate >= trendStart);
  const trend = weightTrend(window7);
  const deltaKg =
    window7.length >= 2 ? window7[window7.length - 1]!.weightKg - window7[0]!.weightKg : 0;
  const arrow = trend === 'down' ? '▼' : trend === 'up' ? '▲' : '→';
  const deltaLabel = `${arrow} ${units.formatWeight(Math.abs(deltaKg))}`;
  const chipTone = trend === 'down' ? 'success' : 'neutral';
  const series = sorted.map((e) => e.weightKg);

  // ── Bande ──────────────────────────────────────────────────────────────────
  if (size === 'row') {
    return (
      <RowLine
        eyebrow={t('home.weight.eyebrow')}
        value={weightStr}
        trailing={window7.length >= 2 ? deltaLabel : undefined}
        trailingTone={trend === 'down' ? 'success' : 'muted'}
        onPress={open}
        accessibilityLabel={`${t('home.weight.title')}. ${weightStr}`}
      />
    );
  }

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('home.weight.title')}>
        <Eyebrow>{t('home.weight.eyebrow')}</Eyebrow>
        <View style={styles.smallBottom}>
          <Metric value={weightStr} />
          {window7.length >= 2 ? (
            <View style={styles.chipWrap}>
              <Chip label={deltaLabel} tone={chipTone} />
            </View>
          ) : null}
        </View>
      </WidgetFrame>
    );
  }

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} onPress={open} accessibilityLabel={t('home.weight.title')} style={styles.wideRow}>
        <View style={styles.wideLeft}>
          <Eyebrow>{t('home.weight.eyebrow')}</Eyebrow>
          <Text style={[styles.wideValue, { color: colors.text }]}>{weightStr}</Text>
          {window7.length >= 2 ? (
            <Text style={[styles.wideDelta, { color: trend === 'down' ? colors.success : colors.textMuted }]}>
              {deltaLabel} · {t('home.weight.days7')}
            </Text>
          ) : null}
        </View>
        <View style={styles.wideSpark}>
          <Sparkline values={series} height={80} showDot />
        </View>
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  const first = sorted[0];
  return (
    <WidgetFrame pad={22} onPress={open} accessibilityLabel={t('home.weight.title')} style={styles.largeCol}>
      <View style={styles.largeHead}>
        <View>
          <Eyebrow>{t('home.weight.eyebrow')}</Eyebrow>
          <Text style={[styles.largeValue, { color: colors.text }]}>{weightStr}</Text>
        </View>
        {window7.length >= 2 ? <Chip label={deltaLabel} tone={chipTone} /> : null}
      </View>
      <View style={styles.largeSpark}>
        <Sparkline values={series} height={140} area showDot strokeWidth={3.5} />
      </View>
      <View style={styles.largeFoot}>
        <Text style={[styles.footText, { color: colors.textMuted }]}>
          {first ? units.formatWeight(first.weightKg) : ''}
        </Text>
        <Text style={[styles.footText, { color: colors.textMuted }]}>
          {t('home.weight.now')} · {weightStr}
        </Text>
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', gap: 8 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  smallBottom: { marginTop: 'auto', gap: 6 },
  chipWrap: { flexDirection: 'row' },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  wideLeft: { flexShrink: 0 },
  wideValue: { fontFamily: fontFamily.displayXBold, fontSize: 32, letterSpacing: -1.2, marginTop: 4 },
  wideDelta: { fontFamily: fontFamily.bodyBold, fontSize: 12.5, marginTop: 2 },
  wideSpark: { flex: 1 },
  largeCol: { gap: 4 },
  largeHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  largeValue: { fontFamily: fontFamily.displayXBold, fontSize: 42, letterSpacing: -1.5, marginTop: 4 },
  largeSpark: { marginTop: 12, marginBottom: 6 },
  largeFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' },
  footText: { fontFamily: fontFamily.mono, fontSize: 11 },
});
