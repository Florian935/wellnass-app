/**
 * US INSIGHTS-01 — carte d'un insight (écran Tier 3, ADR-007).
 *
 * ⚠️ **Aucune formulation n'est construite ici.** La carte résout une clé i18n à partir de
 * `id` (+ `variant` quand un même signal recouvre plusieurs messages) et interpole les `metrics`.
 * C'est la règle R6 de la spec : le moteur ne renvoie que des identifiants, des nombres et un
 * sujet ; les phrases se relisent d'un coup en i18n, y compris celles qui suggèrent du repos.
 *
 * ⚠️ **Les nombres sont formatés AVANT `t()`.** i18next n'a aucun formatage par défaut :
 * `t('cle', { v: 41.2 })` interpole `"41.2"` — piège n° 3 de `bonnes-pratiques.md`, à l'origine de
 * trois défauts en recette le 31/07/2026.
 *
 * Accessibilité (CONF-07 vient de solder le chantier WCAG AA, on ne le rouvre pas) : la couleur de
 * famille est **doublée** par le chip textuel — jamais d'information portée par la seule couleur —
 * et la carte est annoncée d'un bloc, titre puis corps, dans l'ordre visuel.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { InsightFamily, RecordType, SelectedInsight, SignalKind } from '@wellness/shared';

import { useUnits } from '@/hooks/useUnits';
import { resolveDecisionSubject } from '@/lib/decision-subject';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

/**
 * Sujet **affichable** d'un insight.
 *
 * ⚠️ Le moteur transporte des **clés métier**, pas du texte : `subject` vaut `'back'`, pas « Dos ».
 * Deux cartes portent un groupe musculaire et doivent donc être traduites via `muscle.*` — les
 * mêmes clés que le reste de l'app, donc un seul jeu de libellés à maintenir :
 *  - `muscle_neglected`, dont le sujet **est** un groupe ;
 *  - `weekly_decision` de nature `muscle_imbalance`, dont le sujet vient de
 *    `balance.neglected[0]` (BILAN-01).
 *
 * Exporté **exprès** : la carte de l'écran et le widget d'accueil doivent résoudre le sujet de la
 * même façon. Les avoir laissés diverger a produit « back sous-travaillé » sur l'accueil pendant
 * que l'écran affichait « Dos sous-travaillé » — trouvé en revue de code.
 */
export function resolveInsightSubject(
  insight: Pick<SelectedInsight, 'id' | 'variant' | 'subject'>,
  t: (key: string) => string,
): string | undefined {
  if (insight.subject === undefined) return undefined;
  if (insight.id === 'muscle_neglected') return t(`muscle.${insight.subject}`);
  // La décision hebdo délègue : `decision-subject.ts` est le seul endroit qui sait laquelle des six
  // natures porte une clé de muscle. Le savoir en double, c'est ce qui a laissé le défaut vivre
  // dans BILAN-01 jusqu'à ce qu'INSIGHTS-01 l'expose sur une 3ᵉ surface.
  if (insight.id === 'weekly_decision') {
    return resolveDecisionSubject(insight.variant as SignalKind, insight.subject, t);
  }
  return insight.subject;
}

/** Couleur de famille, prise dans le thème (donc correcte en clair comme en sombre). */
function useFamilyColor(family: InsightFamily): string {
  const { colors } = useTheme();
  if (family === 'alert') return colors.accent;
  if (family === 'celebration') return colors.success;
  return colors.textMuted;
}

/**
 * Clé i18n du corps de la carte. Le `variant` distingue les sous-cas d'un même signal.
 *
 * `weekly_decision` est le seul à sortir de l'arborescence `insights.cards` : il rend
 * `review.decisions.<kind>`, **la clé même de l'écran de BILAN-01**. C'est voulu — retraduire la
 * décision de la semaine dans un second jeu de clés garantirait qu'elles divergent un jour.
 */
function bodyKey(insight: SelectedInsight): string {
  if (insight.id === 'weekly_decision') return `review.decisions.${insight.variant}`;
  return insight.variant === undefined
    ? `insights.cards.${insight.id}.body`
    : `insights.cards.${insight.id}.body_${insight.variant}`;
}

export function InsightCard({ insight }: { insight: SelectedInsight }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const familyColor = useFamilyColor(insight.family);

  const number = (value: number): string =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(value);

  /**
   * Valeurs prêtes à interpoler. Deux cas demandent mieux qu'un nombre nu :
   * - un record de charge suit les unités de l'utilisateur (kg / lb), pas un volume cumulé —
   *   même distinction que `RecordRecentCard` ;
   * - un objectif de distance est stocké en mètres et se lit en km (ou en miles).
   */
  const values: Record<string, string> = Object.fromEntries(
    Object.entries(insight.metrics).map(([key, value]) => [key, number(value)]),
  );

  if (insight.id === 'record_recent') {
    const type = insight.variant as RecordType;
    values.value =
      type === 'best_volume'
        ? `${number(Math.round(insight.metrics.value ?? 0))} kg`
        : units.formatWeight(insight.metrics.value ?? 0);
  }
  if (insight.id === 'goal_achieved') {
    if (insight.variant === 'run_distance') {
      // ⚠️ `targetValue` d'un objectif de course est en **mètres** (`goals.ts`), alors que
      // `formatDistance` attend des **kilomètres**. Sans cette division, « 50 km » s'afficherait
      // « 50 000 km ».
      values.achievedValue = units.formatDistance((insight.metrics.achievedValue ?? 0) / 1000);
      values.targetValue = units.formatDistance((insight.metrics.targetValue ?? 0) / 1000);
    } else {
      values.achievedValue = units.formatWeight(insight.metrics.achievedValue ?? 0);
      values.targetValue = units.formatWeight(insight.metrics.targetValue ?? 0);
    }
  }
  const subject = resolveInsightSubject(insight, t);
  if (subject !== undefined) values.subject = subject;

  // US INSIGHTS-02 — le score de forme est la seule carte au pluriel variable (« 1 signal est »
  // vs « 2 signaux sont »). i18next choisit la forme sur `count`, qu'il faut donc lui passer
  // explicitement : sans lui, la clé `_one`/`_other` ne se résout pas.
  const count =
    insight.id === 'readiness' ? { count: insight.metrics.negativeCount ?? 0 } : undefined;

  const title = t(`insights.cards.${insight.id}.title`, values);
  const body = t(bodyKey(insight), { ...values, ...count });

  return (
    <View
      accessible
      accessibilityLabel={`${t(`insights.families.${insight.family}`)}. ${title}. ${body}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderLeftColor: familyColor,
        },
      ]}
    >
      <View style={[styles.chip, { backgroundColor: withAlpha(familyColor, 0.14) }]}>
        <Text style={[styles.chipText, { color: familyColor }]}>
          {t(`insights.families.${insight.family}`)}
        </Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pas de `height` : la carte grandit avec la police système (recette à 1,5×).
  card: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
});
