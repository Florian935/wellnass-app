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
import { RowLine } from '@/components/widgets/RowLine';
import { InsightCard, resolveInsightSubject } from '@/components/insights/InsightCard';
import { useSharedInsights } from '@/data/repositories/insights-context';
import { usePressingLink } from '@/data/repositories/cross-links-repository';
import { LinkLens } from '@/components/lab/LinkLens';
import { linkTexts } from '@/components/lab/link-format';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * US ECHO-01 — « Tes liens » : le lien du Labo le plus pressant, en tête du widget.
 *
 * Le registre d'accueil est plafonné à 8 (`MAX_HOME_WIDGETS`, ADR-007) et il y est déjà : plutôt qu'un
 * neuvième widget, le seul widget conditionnel « ce qui mérite d'être vu » dit d'abord **un lien à
 * régler** (les alertes croisées ont quitté Insights pour le Labo, décision Q2 du 30/09/2026), et
 * sinon un signal d'Insights. Un garde-fou de charge reste donc sur l'accueil, comme avant.
 */
function LinksContent({ size }: { size: WidgetSize }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { link, pressing } = usePressingLink();
  if (link === null) return null;
  const texts = linkTexts(t, i18n.language, link);
  const title = link.state === 'guard' ? t('home.links.titleGuard') : t('home.links.title', { count: pressing });
  const lead = t('home.links.lead', { short: texts.short });
  const open = () => router.push('/lab');
  const a11yLabel = `${t('home.links.overline')}. ${title}. ${lead}`;

  if (size === 'row') {
    return (
      <RowLine
        eyebrow={t('home.links.overline')}
        value={title}
        trailing={t('home.links.cta')}
        trailingTone="accent"
        onPress={open}
        accessibilityLabel={a11yLabel}
      />
    );
  }
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={a11yLabel}>
        <View style={styles.head}>
          <Eyebrow>{t('home.links.overline')}</Eyebrow>
          <LinkLens lens={link.lens} size={26} />
        </View>
        <Text style={[styles.smallTitle, { color: colors.text }]} numberOfLines={3}>
          {title}
        </Text>
      </WidgetFrame>
    );
  }
  return (
    <WidgetFrame pad={size === 'wide' ? 18 : 20} onPress={open} accessibilityLabel={a11yLabel} style={styles.col}>
      <View style={styles.head}>
        <Eyebrow>{t('home.links.overline')}</Eyebrow>
        <Text style={[styles.seeAll, { color: colors.pillarLab }]}>{t('home.links.cta')}</Text>
      </View>
      <View style={styles.linkRow}>
        <LinkLens lens={link.lens} size={36} />
        <View style={styles.linkBody}>
          <Text style={[styles.wideTitle, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.more, { color: colors.textMuted }]} numberOfLines={2}>
            {lead}
          </Text>
        </View>
      </View>
    </WidgetFrame>
  );
}

export function InsightsCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { link } = usePressingLink();
  // Lit la sélection **déjà calculée** par l'accueil (voir `insights-context.tsx`) plutôt que
  // d'appeler `useInsights()`, ce qui monterait une seconde fois l'union de huit hooks sur l'écran
  // le plus ouvert de l'app. `null` hors provider — le widget n'existe que dans la grille d'accueil.
  const shared = useSharedInsights();
  const insights = shared?.insights ?? [];

  // Un lien à régler passe devant un signal d'Insights (ECHO-01).
  if (link !== null) return <LinksContent size={size} />;
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

  // ── Bande ──────────────────────────────────────────────────────────────────
  if (size === 'row') {
    return (
      <RowLine
        eyebrow={t('insights.widget.title')}
        value={title}
        trailing={more > 0 ? `+${more}` : undefined}
        trailingTone="accent"
        onPress={open}
        accessibilityLabel={a11yLabel}
      />
    );
  }

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
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkBody: { flex: 1, gap: 3 },
});
