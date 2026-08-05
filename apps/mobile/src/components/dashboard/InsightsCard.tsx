/**
 * US INSIGHTS-01 — widget **conditionnel** d'accueil, porte d'entrée de l'écran « Insights »
 * (Tier 3, ADR-007), 3 formes.
 *
 * Rend l'insight de tête, ou `null` quand le moteur n'en retient aucun. Conséquence assumée
 * (spec D3-A) : quand il n'y a rien à dire, la porte disparaît — on n'ouvre pas une porte sur une
 * pièce vide. L'état vide de l'écran couvre le cas où la sélection se vide entre l'appui et
 * l'arrivée.
 *
 * ⚠️ **Ce widget rend `null`, il est donc déclaré dans `isWidgetActive`** (`(tabs)/index.tsx`).
 * Sans cette déclaration, `WidgetGrid` réserverait sa cellule même vide et laisserait un trou dans
 * la grille — défaut qui s'est produit quatre fois sur ce dashboard.
 *
 * Le titre et le corps sont résolus **exactement comme sur l'écran**, via `InsightCard` pour la
 * forme `large` : pas de seconde mise en forme du même message.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';

import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { InsightCard, resolveInsightSubject } from '@/components/insights/InsightCard';
import { useSharedInsights } from '@/data/repositories/insights-context';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function InsightsCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  // Lit la sélection **déjà calculée** par l'accueil (voir `insights-context.tsx`) plutôt que
  // d'appeler `useInsights()`, ce qui monterait une seconde fois l'union de huit hooks sur l'écran
  // le plus ouvert de l'app. `null` hors provider — le widget n'existe que dans la grille d'accueil.
  const shared = useSharedInsights();
  const insights = shared?.insights ?? [];

  if (shared === null || shared.isLoading || insights.length === 0) return null;

  const top = insights[0]!;
  // ⚠️ `resolveInsightSubject` et non `top.subject` : le moteur transporte des **clés** métier
  // (`back`), pas du texte. Interpoler la clé brute affichait « back sous-travaillé » sur l'accueil
  // pendant que l'écran affichait « Dos sous-travaillé ».
  const title = t(`insights.cards.${top.id}.title`, {
    subject: resolveInsightSubject(top, t) ?? '',
  });
  const open = () => router.push('/insights');
  const a11yLabel = `${t('insights.widget.title')}. ${title}`;
  const more = insights.length - 1;

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={a11yLabel}>
        <View style={styles.head}>
          <Eyebrow>{t('insights.widget.title')}</Eyebrow>
          <Text style={styles.emoji}>💡</Text>
        </View>
        <Text style={[styles.smallTitle, { color: colors.text }]} numberOfLines={3}>
          {title}
        </Text>
      </WidgetFrame>
    );
  }

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} onPress={open} accessibilityLabel={a11yLabel} style={styles.col}>
        <View style={styles.head}>
          <Eyebrow>{t('insights.widget.title')}</Eyebrow>
          <Text style={[styles.seeAll, { color: colors.accent }]}>
            {t('insights.widget.seeAll')}
          </Text>
        </View>
        <Text style={[styles.wideTitle, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        {more > 0 ? (
          <Text style={[styles.more, { color: colors.textMuted }]}>
            {t('insights.widget.more', { count: more })}
          </Text>
        ) : null}
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  return (
    <WidgetFrame pad={20} onPress={open} accessibilityLabel={a11yLabel} style={styles.col}>
      <View style={styles.head}>
        <Eyebrow>{t('insights.widget.title')}</Eyebrow>
        <Text style={[styles.seeAll, { color: colors.accent }]}>{t('insights.widget.seeAll')}</Text>
      </View>
      <InsightCard insight={top} />
      {more > 0 ? (
        <Text style={[styles.more, { color: colors.textMuted }]}>
          {t('insights.widget.more', { count: more })}
        </Text>
      ) : null}
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  col: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emoji: { fontSize: 15 },
  seeAll: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  smallTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 19, marginTop: 'auto' },
  wideTitle: { fontFamily: fontFamily.bodyBold, fontSize: 16, lineHeight: 21 },
  more: { fontFamily: fontFamily.body, fontSize: 12.5 },
});
