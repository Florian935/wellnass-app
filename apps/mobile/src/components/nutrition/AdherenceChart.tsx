/**
 * Adhérence à l'objectif, en graphe à zone-cible (US NUTRI-UX01, R4.3 — catalogue NUTR-10/18).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * La carte empilait **quatre phrases en texte mono** : « 78 % », « 19 jours dans la cible sur
 * 25 », « marge ±10 % », « bilan +1 240 kcal », « 4 au-dessus / 5 en dessous ». Tout y était,
 * rien ne s'y lisait — alors que la question posée est visuelle : *est-ce que je tiens ma
 * trajectoire, et depuis quand ?*
 *
 * Un trait par jour, une bande pour la zone tolérée. Sous la bande, au-dessus, dedans : la
 * réponse est immédiate, et les chiffres restent en pied pour qui veut le détail.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export type AdherenceDay = {
  logDate: string;
  /** Écart relatif à l'objectif du jour : 0 = pile, +0,2 = 20 % au-dessus. */
  deviation: number;
  status: 'under' | 'in' | 'over';
};

/** Hauteur du graphe et de la bande cible, en points. */
const CHART_HEIGHT = 74;
const BAND_HEIGHT = 24;
/** Écart relatif correspondant au haut du graphe — au-delà, la barre est écrêtée. */
const MAX_DEVIATION = 0.5;

export function AdherenceChart({
  days,
  marginPct,
  inTarget,
  loggedDays,
  balanceKcal,
  daysAbove,
  daysBelow,
}: {
  days: readonly AdherenceDay[];
  marginPct: number;
  inTarget: number;
  loggedDays: number;
  /** Bilan cumulé signé sur la fenêtre (NUTR-18), déjà formaté par l'appelant. */
  balanceKcal: string;
  /**
   * Jours au-dessus / en dessous de la cible.
   *
   * 🔴 **Reçus, jamais recomptés depuis `days`.** `computeGoalAdherence` et
   * `computeCaloricBalance` les produisent déjà, et ce sont des briques pures testées. Un second
   * comptage local aurait fini par diverger du premier au premier ajustement de la marge ou de
   * la règle VIE-01 — et cette divergence-là est invisible : elle n'échoue pas, elle affiche deux
   * chiffres différents pour la même semaine. C'est exactement le motif qui a fait extraire
   * `useDailyCalorieTargets`.
   */
  daysAbove: number;
  daysBelow: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const counts = { over: daysAbove, in: inTarget, under: daysBelow };

  const colorFor = (status: AdherenceDay['status']) =>
    status === 'over' ? colors.accent : status === 'under' ? colors.amber : colors.chartGreen;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={styles.headTexts}>
          <Text style={[styles.title, { color: colors.text }]}>{t('stats.adherence.inTargetTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('stats.adherence.marginShort', { pct: marginPct })}
          </Text>
        </View>
        <View style={styles.scoreRow}>
          <Text style={[styles.score, { color: colors.text }]}>{inTarget}</Text>
          <Text style={[styles.scoreUnit, { color: colors.textMuted }]}>
            {t('stats.adherence.outOfDays', { total: loggedDays })}
          </Text>
        </View>
      </View>

      {days.length > 0 ? (
        <View>
          <View style={styles.chart}>
            {/* La bande cible est le repère : une barre qui s'y arrête est une journée tenue. */}
            <View
              style={[
                styles.band,
                {
                  top: (CHART_HEIGHT - BAND_HEIGHT) / 2,
                  height: BAND_HEIGHT,
                  backgroundColor: colors.warn,
                  borderColor: colors.chartGreen,
                },
              ]}
            />
            <View style={styles.bars}>
              {days.map((d) => {
                // Le milieu du graphe = l'objectif. Une déviation positive monte, négative descend.
                const clamped = Math.max(-MAX_DEVIATION, Math.min(MAX_DEVIATION, d.deviation));
                const half = (CHART_HEIGHT - BAND_HEIGHT) / 2;
                const height = CHART_HEIGHT / 2 + (clamped / MAX_DEVIATION) * half;
                return (
                  <View
                    key={d.logDate}
                    style={[
                      styles.bar,
                      { height: Math.max(4, height), backgroundColor: colorFor(d.status) },
                    ]}
                  />
                );
              })}
            </View>
          </View>
          <View style={styles.axis}>
            <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
              {t('stats.adherence.axisStart', { count: days.length })}
            </Text>
            <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
              {t('stats.adherence.axisEnd')}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.legend, { borderTopColor: colors.border }]}>
        {(
          [
            ['over', counts.over],
            ['in', counts.in],
            ['under', counts.under],
          ] as const
        ).map(([status, count]) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colorFor(status) }]} />
            <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
              {t(`stats.adherence.legend.${status}`, { count })}
            </Text>
          </View>
        ))}
      </View>

      {/* NUTR-18 — le bilan cumulé : une phrase, à la place d'une ligne mono de plus. */}
      <View style={[styles.balance, { backgroundColor: colors.warn, borderColor: colors.warnBorder }]}>
        <Text style={[styles.balanceText, { color: colors.warnText }]}>
          {t('stats.adherence.balanceSentence', { value: balanceKcal, days: loggedDays })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 15 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headTexts: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 12 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  score: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -1 },
  scoreUnit: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  chart: { height: CHART_HEIGHT, position: 'relative' },
  band: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderBottomWidth: 1 },
  bars: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: { flex: 1, borderRadius: 3 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisLabel: { fontFamily: fontFamily.body, fontSize: 11.5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, borderTopWidth: 1, paddingTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 3 },
  legendLabel: { fontFamily: fontFamily.body, fontSize: 11.5 },
  balance: { borderWidth: 1, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 13 },
  balanceText: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, lineHeight: 17 },
});
