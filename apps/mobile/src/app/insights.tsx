/**
 * US INSIGHTS-01 (roadmap 7.20) — écran « Insights », Tier 3 d'[ADR-007].
 *
 * Affiche les **1 à 3 analyses les plus pertinentes de l'instant**, choisies par un moteur
 * déterministe (`selectInsights`, `@wellness/shared`). L'écran ne décide de rien : il rend ce que
 * le moteur lui donne, et son état vide quand il ne donne rien — zéro est une réponse valable
 * (spec R4), on n'invente jamais une carte pour remplir la page.
 *
 * ⚠️ **À ne pas confondre avec `app/cycle/insights.tsx`** (US CYCLE-01), qui s'affiche sous le
 * titre « Croisement » et porte les moyennes par phase du cycle menstruel. Les deux écrans
 * cohabitent volontairement (spec D4) : renommer un écran déjà en recette pour une question de
 * vocabulaire aurait été disproportionné.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenHeader } from '@/components/ScreenHeader';
import { InsightCard } from '@/components/insights/InsightCard';
import { useInsights } from '@/data/repositories/insights-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function InsightsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { insights, isLoading } = useInsights();

  // Rien tant que ça charge : afficher l'état vide puis trois cartes ferait un flash
  // « rien à signaler » à chaque ouverture.
  if (isLoading) return null;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader title={t('insights.title')} subtitle={t('insights.subtitle')} />

      {insights.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('insights.empty.title')}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            {t('insights.empty.body')}
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.lead, { color: colors.textMuted }]}>{t('insights.lead')}</Text>
          <View style={styles.list}>
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40 },
  lead: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19, marginBottom: 14 },
  list: { gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontFamily: fontFamily.bodyBold, fontSize: 16, textAlign: 'center' },
  emptyBody: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
});
