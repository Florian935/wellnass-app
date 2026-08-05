/**
 * US CYCLE-01 (roadmap 1.26) — écran « Croisement ».
 *
 * ⚠️ **Homonyme, mais sans rapport avec `app/insights.tsx`** (US INSIGHTS-01), qui est l'écran
 * « Insights » transverse du Tier 3 d'ADR-007. Celui-ci porte les moyennes par phase du cycle et
 * s'affiche sous le titre « Croisement ». Cohabitation délibérée (INSIGHTS-01, décision D4) :
 * renommer un écran déjà en recette pour une question de vocabulaire aurait été disproportionné.
 *
 * ⚠️ **Des observations, jamais des conseils.** Chaque bloc affiche des **moyennes constatées** par
 * phase et le nombre de cycles réellement observés. Aucune phrase causale n'est construite ici :
 * tout vient de l'i18n, où les formulations se relisent d'un coup (critère de recette 14).
 *
 * ⚠️ **Le seuil est vérifié métrique par métrique** (R13) : un bloc peut être disponible pendant
 * qu'un autre annonce ce qui lui manque. C'est voulu — attendre que *tout* soit prêt donnerait un
 * écran vide pendant des mois.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CYCLE_PHASES, type CyclePhase, type CrossPhaseResult } from '@wellness/shared';

import { ScreenHeader } from '@/components/ScreenHeader';
import { CycleTrackingGuard } from '@/components/cycle/CycleTrackingGuard';
import {
  CYCLE_INSIGHT_METRICS,
  useCycleInsights,
  type CycleInsightMetric,
} from '@/data/repositories/cycle-insights-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Formatage d'une moyenne selon la métrique. Les 4 métriques d'origine (énergie, humeur, stress,
 * tonnage) restaient des nombres bruts ; `calories` et `pace` en ont besoin d'une mise en forme —
 * une allure en secondes brutes (ex. « 320 ») serait illisible, et respecter le système d'unités
 * (métrique/impérial) est la même règle que partout ailleurs dans l'app pour une allure.
 */
function useMetricFormatter() {
  const { t } = useTranslation();
  const units = useUnits();
  return (metric: CycleInsightMetric, value: number): string => {
    if (metric === 'pace') return units.formatPace(value);
    if (metric === 'calories') return `${Math.round(value)} ${t('nutrition.kcal')}`;
    return String(value);
  };
}

export default function CycleInsightsScreen() {
  return (
    <CycleTrackingGuard>
      <CycleInsightsContent />
    </CycleTrackingGuard>
  );
}

function CycleInsightsContent() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { byMetric, isLoading } = useCycleInsights();

  if (isLoading) return null;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader title={t('cycle.insights.title')} subtitle={t('cycle.insights.subtitle')} />

      <Text style={[styles.lead, { color: colors.textMuted }]}>{t('cycle.insights.lead')}</Text>

      {CYCLE_INSIGHT_METRICS.map((metric) => (
        <MetricBlock key={metric} metric={metric} result={byMetric[metric]} />
      ))}
    </ScrollView>
  );
}

function MetricBlock({
  metric,
  result,
}: {
  metric: CycleInsightMetric;
  result: CrossPhaseResult;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const formatValue = useMetricFormatter();

  const title = t(`cycle.insights.metrics.${metric}`);

  if (result.status === 'insufficient') {
    // On dit **ce qui manque**, phase par phase — pas un « pas assez de données » opaque.
    const worst = CYCLE_PHASES.reduce<{ phase: CyclePhase; missing: number }>(
      (acc, p) =>
        result.missingByPhase[p] > acc.missing ? { phase: p, missing: result.missingByPhase[p] } : acc,
      { phase: 'menstrual', missing: 0 },
    );
    const detail =
      worst.missing > 0
        ? t('cycle.insights.missingSamples', {
            count: worst.missing,
            phase: t(`cycle.phase.${worst.phase}`),
          })
        : t('cycle.insights.missingCycles', {
            count: result.cyclesNeeded - result.cyclesAvailable,
          });

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.badgeMuted, { color: colors.textMuted, borderColor: colors.border }]}>
            {t('cycle.insights.pending')}
          </Text>
        </View>
        <Text style={[styles.detail, { color: colors.textMuted }]}>{detail}</Text>
      </View>
    );
  }

  const values = CYCLE_PHASES.map((p) => result.byPhase[p].average);
  const max = Math.max(...values, 1);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.badge, { color: colors.accent, borderColor: colors.accent }]}>
          {t('cycle.insights.availableCycles', { count: result.cyclesObserved })}
        </Text>
      </View>

      {CYCLE_PHASES.map((phase) => {
        const cell = result.byPhase[phase];
        return (
          <View key={phase} style={styles.row}>
            <Text style={[styles.phase, { color: colors.textMuted }]} numberOfLines={1}>
              {t(`cycle.phase.${phase}`)}
            </Text>
            <View style={[styles.track, { backgroundColor: colors.track }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round((cell.average / max) * 100)}%`, backgroundColor: colors.accent },
                ]}
              />
            </View>
            <Text
              style={[styles.value, { color: colors.text }]}
              accessibilityLabel={`${t(`cycle.phase.${phase}`)} : ${formatValue(metric, cell.average)}`}
              numberOfLines={1}
            >
              {formatValue(metric, cell.average)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, gap: 12 },
  lead: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontFamily: fontFamily.displaySemi, fontSize: 16, flexShrink: 1 },
  badge: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeMuted: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  detail: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phase: { fontFamily: fontFamily.body, fontSize: 12.5, width: 92 },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  value: { fontFamily: fontFamily.mono, fontSize: 13, width: 68, textAlign: 'right' },
});
