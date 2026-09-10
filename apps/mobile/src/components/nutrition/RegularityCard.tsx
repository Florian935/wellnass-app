/**
 * Régularité du journal, en heatmap (US NUTRI-UX01, R4.2 — catalogue NUTR-17 / NUTR-21).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * NUTR-17 affichait « 83 % » et une phrase. C'est pourtant la donnée la plus **motivante** du
 * pilier — et un pourcentage ne dit ni **quand** on a décroché, ni **depuis combien de jours**
 * on tient. Trente cases le disent d'un coup d'œil.
 *
 * La couleur ne porte pas seule l'information (WCAG 1.4.1) : les trois chiffres du pied — série
 * en cours, meilleure série, jours vides — se lisent sans voir la grille.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  bestStreak,
  buildHeatmap,
  currentStreak,
  emptyDays,
  filledPct,
  localDayKey,
  type DayFill,
} from '@wellness/shared';
import { useDailyTotals, useJournalCompletion } from '@/data/repositories/journal-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Fenêtre par défaut, si l'appelant n'en impose pas. */
const DEFAULT_WINDOW_DAYS = 30;

/**
 * ⚠️ `windowDays` vient de l'appelant, et ce n'est pas un détail : la carte est affichée **à côté**
 * du graphe d'adhérence, qui suit le sélecteur de fenêtre. Une heatmap figée à 30 jours en face
 * d'une adhérence sur 7 aurait mis deux périodes différentes côte à côte, qu'on croirait
 * comparables — précisément ce qu'un seul sélecteur par écran cherche à éviter.
 */
export function RegularityCard({
  targetKcal,
  windowDays = DEFAULT_WINDOW_DAYS,
}: {
  targetKcal: number | null;
  windowDays?: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const dayKeys = useMemo(() => {
    const today = new Date();
    return Array.from({ length: windowDays }, (_, i) =>
      localDayKey(addDays(today, i - (windowDays - 1))),
    );
  }, [windowDays]);

  const { totals, isLoading } = useDailyTotals(dayKeys[0]!);
  /**
   * 🔴 Fenêtre **effective**, bornée à l'ancienneté du compte (NUTR-17).
   *
   * Sans elle, quelqu'un qui vient d'installer l'app verrait « 0 % » et trente cases vides :
   * un reproche pour une période où il n'était pas là. C'est le garde-fou que portait déjà
   * l'ancienne carte de complétude — la heatmap le reprend, elle ne le remplace pas.
   */
  const completion = useJournalCompletion(windowDays);
  const cells = useMemo(
    () => buildHeatmap(dayKeys, totals, targetKcal),
    [dayKeys, totals, targetKcal],
  );

  const fillColor: Record<DayFill, string> = {
    complete: colors.success,
    partial: colors.amber,
    empty: colors.track,
  };

  const pct = filledPct(cells);

  if (!completion.isLoading && completion.effectiveWindow === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('stats.regularity.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t('stats.completion.empty')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={styles.headTexts}>
          <Text style={[styles.title, { color: colors.text }]}>{t('stats.regularity.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('stats.regularity.window', { days: windowDays })}
          </Text>
        </View>
        <View style={styles.pctRow}>
          <Text style={[styles.pct, { color: colors.text }]}>{isLoading ? '—' : pct}</Text>
          <Text style={[styles.pctUnit, { color: colors.textMuted }]}>%</Text>
        </View>
      </View>

      <View
        style={styles.grid}
        accessible
        accessibilityLabel={t('stats.regularity.a11y', { pct, days: windowDays })}
      >
        {cells.map((cell) => (
          <View key={cell.logDate} style={[styles.cell, { backgroundColor: fillColor[cell.fill] }]} />
        ))}
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {(
          [
            ['currentStreak', currentStreak(cells)],
            ['bestStreak', bestStreak(cells)],
            ['emptyDays', emptyDays(cells)],
          ] as const
        ).map(([key, value]) => (
          <View key={key} style={styles.stat}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              {t(`stats.regularity.${key}`)}
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {key === 'emptyDays' ? value : t('stats.regularity.days', { count: value })}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headTexts: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 12 },
  pctRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  pct: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -1 },
  pctUnit: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  // 10 colonnes : `8.2%` + `gap: 5` tient sans calcul de largeur, sur toutes les tailles d'écran.
  cell: { width: '8.2%', aspectRatio: 1, borderRadius: 5 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, paddingTop: 12 },
  stat: { gap: 1 },
  statLabel: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 0.4 },
  statValue: { fontFamily: fontFamily.monoBold, fontSize: 15 },
});
