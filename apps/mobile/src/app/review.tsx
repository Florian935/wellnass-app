/**
 * US BILAN-01 — écran du bilan hebdomadaire.
 *
 * ── La règle qui gouverne cet écran ───────────────────────────────────────────────────────────────
 * **Aucune narration sans les chiffres à côté.** La décision de la semaine est affichée en premier
 * parce que c'est ce qui sert à agir — mais elle est immédiatement suivie du bloc « Les chiffres »,
 * qui la rend vérifiable. Le texte vient de clés i18n avec des nombres interpolés : **aucun texte
 * libre, aucune IA**.
 *
 * ── Recalculé à l'affichage (décision D1) ────────────────────────────────────────────────────────
 * Rien n'est stocké : chaque ouverture recalcule tout depuis la base locale. C'est ce qui garantit
 * que les chiffres sont exacts même si la notification est arrivée avec six heures de retard.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDayFull, type ReviewChange } from '@wellness/shared';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useWeeklyReview } from '@/data/repositories/weekly-review-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function ReviewScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { review, isLoading } = useWeeklyReview();

  /** Variation en **mots**, jamais seulement en couleur ou en flèche (accessibilité). */
  const changeLabel = (change: ReviewChange): string | null => {
    if (change === null || change.pct === null || change.direction === 'flat') {
      return change?.direction === 'flat' ? t('review.changeFlat') : null;
    }
    return change.pct > 0
      ? t('review.changeUp', { pct: Math.abs(change.pct) })
      : t('review.changeDown', { pct: Math.abs(change.pct) });
  };

  const { current, changes, decision } = review;

  /**
   * Lignes de chiffres. Construites en **données** plutôt qu'en JSX pour que la bordure ne s'applique
   * qu'*entre* les lignes — et pour qu'une ligne omise (aucune cible calorique) ne laisse pas un
   * séparateur orphelin.
   */
  const rows: { label: string; value: string; change?: ReviewChange }[] = [
    {
      label: t('review.blocks.activeDays'),
      value: `${current.activeDays} / 7`,
      change: changes.activeDays,
    },
    { label: t('review.blocks.workouts'), value: String(current.workouts) },
    {
      label: t('review.blocks.tonnage'),
      value: units.formatWeight(current.tonnageKg),
      change: changes.tonnage,
    },
    { label: t('review.blocks.runs'), value: String(current.runs) },
    {
      label: t('review.blocks.distance'),
      value: units.formatDistance(current.distanceM / 1000),
      change: changes.distance,
    },
    {
      label: t('review.blocks.loggedDays'),
      value: String(current.loggedDays),
      change: changes.loggedDays,
    },
    // Omise, et non affichée à 0, quand aucune cible calorique n'est définie.
    ...(current.daysInTarget !== null
      ? [
          {
            label: t('review.blocks.daysInTarget'),
            value: `${current.daysInTarget} / ${current.loggedDays}`,
          },
        ]
      : []),
    { label: t('review.blocks.records'), value: String(review.recordsBeaten) },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={t('review.title')} />

        <Text style={[styles.period, { color: colors.textMuted }]}>
          {t('review.period', {
            start: formatDayFull(review.period.start),
            end: formatDayFull(review.period.end),
          })}
        </Text>

        {isLoading ? null : review.isEmpty ? (
          <Card>
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t('review.empty')}</Text>
          </Card>
        ) : (
          <>
            {/* La décision d'abord : c'est ce qui sert à agir. */}
            {decision !== null && (
              <Card>
                <Text style={[styles.decisionTitle, { color: colors.textMuted }]}>
                  {t('review.decisionTitle')}
                </Text>
                <Text
                  style={[styles.decision, { color: colors.text }]}
                  accessibilityRole="text"
                  accessibilityLabel={`${t('review.a11yDecision')} : ${t(
                    `review.decisions.${decision.kind}`,
                    { ...decision.metrics, subject: decision.subject ?? '' },
                  )}`}
                >
                  {t(`review.decisions.${decision.kind}`, {
                    ...decision.metrics,
                    subject: decision.subject ?? '',
                  })}
                </Text>
              </Card>
            )}

            {/* Puis les chiffres, qui rendent la décision vérifiable. */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('review.sectionNumbers')}
            </Text>
            <Card>
              {rows.map((item, index) => {
                const spoken = item.change === undefined ? null : changeLabel(item.change);
                return (
                  <View
                    key={item.label}
                    style={[
                      styles.row,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    ]}
                    accessible
                    accessibilityLabel={`${item.label} : ${item.value}${spoken === null ? '' : `, ${spoken}`}`}
                  >
                    <Text
                      style={[styles.rowLabel, { color: colors.textMuted }]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.rowValue, { color: colors.text }]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {item.value}
                    </Text>
                    {spoken !== null && (
                      <Text
                        style={[styles.rowChange, { color: colors.textMuted }]}
                        maxFontSizeMultiplier={1.3}
                      >
                        {spoken}
                      </Text>
                    )}
                  </View>
                );
              })}
            </Card>

            {review.previous === null && (
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                {t('review.noComparison')}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  period: { fontFamily: fontFamily.body, fontSize: 13, marginTop: -8 },
  empty: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21 },
  decisionTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  decision: { fontFamily: fontFamily.bodySemi, fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontFamily: fontFamily.displayBold, fontSize: 16, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    minHeight: 48,
  },
  rowLabel: { fontFamily: fontFamily.body, fontSize: 13.5, flex: 1 },
  rowValue: { fontFamily: fontFamily.bodySemi, fontSize: 14.5 },
  rowChange: { fontFamily: fontFamily.body, fontSize: 12, minWidth: 96, textAlign: 'right' },
  hint: { fontFamily: fontFamily.body, fontSize: 12 },
});
