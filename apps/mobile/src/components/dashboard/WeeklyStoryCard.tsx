/**
 * US DASH-01 (§4.1) — le **bilan de la semaine, raconté** sur l'accueil.
 *
 * BILAN-01 produit déjà tout : volume, records, régularité, assiette et la décision de la semaine.
 * Mais il ne se voyait que dans un écran qu'il fallait ouvrir, via une notification hebdomadaire.
 * Ici, les deux premiers jours de la semaine, l'accueil en raconte les cartes — `buildWeeklyStory`
 * décide de l'ordre et retire celles qui n'ont rien à dire (brique pure, testée).
 *
 * ⚠️ Elle ne se rend **que** les deux premiers jours de la semaine, et jamais sur une semaine vide :
 * un bilan affiché en permanence cesse d'être un rendez-vous et devient du décor.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { buildWeeklyStory, type StoryCard } from '@wellness/shared';
import { StaggerIn } from '@/components/motion/StaggerIn';
import { DenseTile } from '@/components/stage/DenseTile';
import { useWeeklyReview } from '@/data/repositories/weekly-review-repository';
import { resolveDecisionSubject } from '@/lib/decision-subject';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** Jour de la semaine, 1 = lundi (le bilan porte sur la semaine **close**). */
  weekday: number;
  onOpen: () => void;
};

/** Lundi et mardi : au-delà, la semaine en cours a pris le dessus et le bilan devient du passé. */
const STORY_LAST_WEEKDAY = 2;

export function WeeklyStoryCard({ weekday, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { review } = useWeeklyReview();

  const cards = buildWeeklyStory(review);
  if (weekday > STORY_LAST_WEEKDAY || cards.length === 0) return null;

  return (
    <DenseTile
      title={t('stage.home.weeklyStory.title')}
      meta={t('stage.home.weeklyStory.cta')}
      onPress={onOpen}
      testID="weekly-story-card"
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {cards.map((card, index) => (
          <StaggerIn key={card.kind} index={index}>
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.headline, { color: colors.text }]} numberOfLines={3}>
                {headline(card, t)}
              </Text>
              {sub(card, t, units) ? (
                <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={2}>
                  {sub(card, t, units)}
                </Text>
              ) : null}
            </View>
          </StaggerIn>
        ))}
      </ScrollView>
    </DenseTile>
  );
}

type T = (k: string, o?: Record<string, unknown>) => string;
type Units = ReturnType<typeof useUnits>;

/** Le chiffre de la carte — c'est lui qu'on lit en premier. */
function headline(card: StoryCard, t: T): string {
  switch (card.kind) {
    case 'volume':
      return t('stage.home.weeklyStory.volume', { workouts: card.workouts, runs: card.runs });
    case 'records':
      return t('stage.home.weeklyStory.records', { count: card.count });
    case 'regularity':
      return t('stage.home.weeklyStory.regularity', { count: card.activeDays });
    case 'nutrition':
      return t('stage.home.weeklyStory.nutrition', {
        days: card.daysInTarget,
        logged: card.loggedDays,
      });
    default:
      return t(`review.decisions.${card.decision.kind}`, {
        ...card.decision.metrics,
        subject: resolveDecisionSubject(card.decision.kind, card.decision.subject, t),
      });
  }
}

/**
 * La ligne sous le chiffre : la matière de la semaine (tonnage ou distance), puis l'écart avec la
 * semaine d'avant quand il est calculable — `pct: null` signifie « rien à comparer », pas « 0 % ».
 */
function sub(card: StoryCard, t: T, units: Units): string | null {
  const change = (c: StoryCard): string | null => {
    const pct = c.kind === 'volume' || c.kind === 'regularity' ? (c.change?.pct ?? null) : null;
    return pct === null ? null : t('stage.home.weeklyStory.change', { percent: pct });
  };

  switch (card.kind) {
    case 'volume': {
      const matter =
        card.workouts > 0
          ? t('stage.home.weeklyStory.tonnage', { tonnage: Math.round(card.tonnageKg) })
          : t('stage.home.weeklyStory.distance', { distance: units.formatDistance(card.distanceM / 1000) });
      return [matter, change(card)].filter(Boolean).join(' · ');
    }
    case 'regularity':
      return change(card);
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 4 },
  card: { width: 190, borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 },
  headline: { fontFamily: fontFamily.displayBold, fontSize: 15, letterSpacing: -0.3, lineHeight: 20 },
  sub: { fontFamily: fontFamily.bodyMedium, fontSize: 12 },
});
