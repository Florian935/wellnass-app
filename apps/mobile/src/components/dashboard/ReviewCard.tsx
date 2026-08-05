/**
 * Widget BILAN-01 — bilan de la semaine, décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : les jours actifs de la semaine close ;
 *  - `wide`  : la décision de la semaine, tronquée ;
 *  - `large` : la décision + les chiffres qui la justifient.
 *
 * Widget **transverse** (`pillars: 'always'`) : le bilan agrège ce qui existe. Un utilisateur
 * « nutrition seule » y trouve ses jours journalisés et son adhérence — contrairement aux objectifs
 * (OBJ-01), dont les 2 types portent sur la course et la force.
 *
 * ⚠️ Le widget ne raconte **jamais** sans chiffrer : en forme `wide`, la décision est accompagnée des
 * jours actifs ; en `large`, du détail. C'est la règle non négociable de l'US.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';

import { Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useWeeklyReview } from '@/data/repositories/weekly-review-repository';
import { useUnits } from '@/hooks/useUnits';
import { resolveDecisionSubject } from '@/lib/decision-subject';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function ReviewCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { review, isLoading } = useWeeklyReview();

  if (isLoading) return null;

  const open = () => router.push('/review');

  // ── Semaine vide : un message de reprise, jamais un reproche (décision D4) ──────────────────
  if (review.isEmpty || review.decision === null) {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('review.title')}>
        <Eyebrow>{t('review.title')}</Eyebrow>
        <Text style={[styles.prompt, { color: colors.text }]}>{t('review.empty')}</Text>
      </WidgetFrame>
    );
  }

  const { decision, current } = review;
  // `resolveDecisionSubject` et non `decision.subject` : la décision `muscle_imbalance` porte une
  // **clé** de groupe musculaire (`back`), pas un libellé.
  const text = t(`review.decisions.${decision.kind}`, {
    ...decision.metrics,
    subject: resolveDecisionSubject(decision.kind, decision.subject, t),
  });

  // ── Petit carré : le chiffre qui résume la semaine ──────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame
        pad={16}
        onPress={open}
        accessibilityLabel={`${t('review.title')} : ${text}`}
      >
        <Eyebrow>{t('review.title')}</Eyebrow>
        <Metric value={`${current.activeDays}/7`} sub={t('review.blocks.activeDays')} />
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame
      pad={size === 'large' ? 22 : 18}
      style={styles.col}
      onPress={open}
      accessibilityLabel={`${t('review.a11yDecision')} : ${text}`}
    >
      <Eyebrow>{t('review.title')}</Eyebrow>
      <Text
        style={[styles.decision, { color: colors.text }]}
        numberOfLines={size === 'large' ? 4 : 3}
        maxFontSizeMultiplier={1.3}
      >
        {text}
      </Text>

      {/* Les chiffres accompagnent toujours la narration. */}
      <Text style={[styles.numbers, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
        {size === 'large'
          ? `${current.activeDays}/7 · ${current.workouts} × ${t('review.blocks.workouts')} · ${units.formatDistance(
              current.distanceM / 1000,
            )}`
          : `${current.activeDays}/7 ${t('review.blocks.activeDays')}`}
      </Text>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  col: { gap: 8 },
  prompt: { fontFamily: fontFamily.body, fontSize: 13.5, marginTop: 6, lineHeight: 20 },
  decision: { fontFamily: fontFamily.bodySemi, fontSize: 13.5, lineHeight: 20 },
  numbers: { fontFamily: fontFamily.body, fontSize: 12 },
});
