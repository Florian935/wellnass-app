/**
 * US ACCUEIL-08 — **« Ta journée »**, le fil du jour (référence : `renderVals()` de la toile).
 *
 * Les gestes du jour, horodatés, tous piliers (`buildDayTimeline`, `@wellness/shared`, testée) :
 *  - ce qui est **fait se replie** en une ligne (« 3 faits · check-in · pesée · petit-déj »),
 *    touchable pour déplier ;
 *  - **l'action du moment** est dépliée en carte sombre (`NowCard`, passée en `nowCard`) à la place
 *    du geste qu'elle porte ;
 *  - la **suite** tient en trois lignes, puis « +n plus tard » ;
 *  - un repas ou une pesée à venir porte un « + » : le noter tout de suite, sans passer par la carte.
 *
 * Le composant ne décide rien : il range ce qu'on lui donne et peint chaque ligne.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { clockLabel, type DayTimeline, type TimelineItem } from '@wellness/shared';
import { useMealName } from '@/components/dashboard/NowCard';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

/** La suite tient en trois lignes ; au-delà, « +n plus tard ». */
const UPCOMING_SHOWN = 3;
/** On replie ce qui est fait dès deux gestes : une seule ligne ne gagnerait rien à se replier. */
const COLLAPSE_FROM = 2;

type Props = {
  timeline: DayTimeline;
  /** La carte de l'action du moment, déjà peinte. */
  nowCard: ReactNode;
  /** La carte se pose en tête de la suite, quel que soit le fil (série en jeu ce soir). */
  nowFirst?: boolean;
  mealTotals: ReadonlyMap<string, { kcal: number; proteinG: number }>;
  checkinEnergy: number | null;
  weightKgToday: number | null;
  formatKcal: (n: number) => string;
  onPlanning: () => void;
  /** Noter tout de suite un repas ou une pesée (le « + » d'une ligne). */
  onQuick: (item: TimelineItem) => void;
};

export function HomeDayTimeline({
  timeline,
  nowCard,
  nowFirst = false,
  mealTotals,
  checkinEnergy,
  weightKgToday,
  formatKcal,
  onPlanning,
  onQuick,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const mealName = useMealName();
  const [showDone, setShowDone] = useState(false);
  const [showAll, setShowAll] = useState(false);

  /** La couleur d'un pilier, lisible sur la carte. */
  const pillarColor = (item: TimelineItem): string => {
    switch (item.pillar) {
      case 'strength':
        return colors.pillarStrength;
      case 'running':
        return colors.pillarRunning;
      case 'nutrition':
        return colors.pillarNutrition;
      case 'wellbeing':
        return colors.pillarWellbeing;
      default:
        return colors.pillarHome;
    }
  };

  const title = (item: TimelineItem): string => {
    switch (item.kind) {
      case 'checkin':
        return t('home.fil.checkin.title');
      case 'weigh':
        return t('home.fil.weigh.title');
      case 'meal':
        return item.meal ? mealName(item.meal) : t('home.now.meal.nameFallback');
      case 'training': {
        const name = item.training?.name || item.doneTraining?.name;
        return name || t(`home.fil.training.fallback.${item.pillar === 'running' ? 'running' : 'strength'}`);
      }
      case 'activity':
        return item.activity
          ? t(`activity.types.${item.activity.activityType}`, { defaultValue: t('home.fil.activity.title') })
          : t('home.fil.activity.title');
      case 'walk':
        return t('home.fil.walk.title');
      case 'evening':
      default:
        return t('home.fil.evening.title');
    }
  };

  const short = (item: TimelineItem): string => {
    switch (item.kind) {
      case 'meal':
        return item.meal ? mealName(item.meal).toLocaleLowerCase() : t('home.fil.short.meal');
      case 'training':
        return t(`home.fil.short.${item.pillar === 'running' ? 'run' : 'session'}`);
      default:
        return t(`home.fil.short.${item.kind}`);
    }
  };

  const sub = (item: TimelineItem): string => {
    if (item.live) return t('home.fil.live');
    if (item.done) {
      switch (item.kind) {
        case 'checkin':
          return checkinEnergy != null
            ? t('home.fil.checkin.done', {
                level: checkinEnergy,
                label: t(`wellbeing.levels.energy.${checkinEnergy}`),
              })
            : t('home.fil.doneGeneric');
        case 'weigh':
          return weightKgToday != null ? units.formatWeight(weightKgToday) : t('home.fil.doneGeneric');
        case 'meal': {
          const total = item.meal ? mealTotals.get(item.meal.key) : undefined;
          return total
            ? t('home.fil.meal.done', { kcal: formatKcal(total.kcal), protein: total.proteinG })
            : t('home.fil.doneGeneric');
        }
        case 'training': {
          const d = item.doneTraining;
          if (!d) return t('home.fil.doneGeneric');
          const parts = [
            d.distanceM != null ? units.formatDistance(d.distanceM / 1000) : null,
            d.durationMinutes != null ? t('home.fil.minutes', { count: d.durationMinutes }) : null,
          ].filter(Boolean);
          return [t('home.fil.training.done'), ...parts].join(' · ');
        }
        case 'activity':
          return item.activity ? t('home.fil.minutes', { count: item.activity.durationMinutes }) : '';
        case 'walk':
          return t('home.fil.walk.done');
        default:
          return t('home.fil.doneGeneric');
      }
    }
    if (item.missed) return t(`home.fil.missed.${item.kind === 'meal' ? 'meal' : 'other'}`);
    switch (item.kind) {
      case 'checkin':
        return t('home.fil.checkin.todo');
      case 'weigh':
        return t('home.fil.weigh.todo');
      case 'meal':
        return item.meal?.learned
          ? t('home.fil.meal.usually', { time: clockLabel(item.meal.hour) })
          : t('home.fil.meal.around', { time: clockLabel(item.meal?.hour ?? item.hour) });
      case 'training': {
        const tr = item.training;
        if (!tr) return '';
        const detail =
          tr.pillar === 'strength'
            ? tr.exerciseCount
              ? t('home.today.exercises', { count: tr.exerciseCount })
              : null
            : tr.targetDistanceM != null
              ? units.formatDistance(tr.targetDistanceM / 1000)
              : null;
        return [t(`home.fil.training.kind.${tr.pillar}`), detail, item.timeKnown ? null : t('home.fil.noTime')]
          .filter(Boolean)
          .join(' · ');
      }
      case 'walk':
        return t('home.fil.walk.todo', { steps: formatKcal(item.stepsLeft ?? 0) });
      case 'evening':
      default:
        return t('home.fil.evening.todo');
    }
  };

  const doneItems = timeline.items.filter((it) => it.done);
  const collapse = !showDone && doneItems.length >= COLLAPSE_FROM;
  const rows: ReactNode[] = [];

  if (doneItems.length >= COLLAPSE_FROM) {
    rows.push(
      <Pressable
        key="summary"
        onPress={() => setShowDone((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={
          collapse ? t('home.fil.showDone', { count: doneItems.length }) : t('home.fil.hideDone')
        }
        style={styles.summary}
      >
        <View style={styles.timeCol} />
        <View style={[styles.node, { backgroundColor: colors.text }]}>
          <Ionicons name="checkmark" size={11} color={colors.surface} />
        </View>
        <View style={styles.texts}>
          <Text style={[styles.title, { color: colors.text }]}>
            {collapse ? t('home.fil.doneCount', { count: doneItems.length }) : t('home.fil.fold')}
          </Text>
          <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
            {collapse ? doneItems.map(short).join(' · ') : t('home.fil.doneCount', { count: doneItems.length })}
          </Text>
        </View>
        {collapse ? <Text style={[styles.action, { color: colors.accent }]}>{t('home.fil.see')}</Text> : null}
      </Pressable>,
    );
  }

  const renderRow = (item: TimelineItem) => {
    const color = pillarColor(item);
    const quick = !item.done && !item.live && (item.kind === 'meal' || item.kind === 'weigh');
    return (
      <View key={item.id} style={styles.row} testID={`fil-${item.id}`}>
        <Text style={[styles.time, { color: item.done ? colors.textMuted : colors.text }]}>
          {item.timeKnown ? clockLabel(item.hour) : '—'}
        </Text>
        <View
          style={[
            styles.node,
            item.done
              ? { backgroundColor: color, borderColor: color, borderWidth: 2 }
              : {
                  backgroundColor: colors.surface,
                  borderColor: item.live || item.suggested ? color : colors.borderStrong,
                  borderWidth: 2,
                  borderStyle: item.suggested ? 'dashed' : 'solid',
                },
          ]}
        >
          {item.done ? <Ionicons name="checkmark" size={11} color={colors.accentText} /> : null}
          {item.live ? <View style={[styles.liveDot, { backgroundColor: color }]} /> : null}
        </View>
        <View style={styles.texts}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: item.done ? colors.textMuted : colors.text }]}>
              {title(item)}
            </Text>
            {item.live || (item.suggested && !item.done) ? (
              <Text style={[styles.tag, { color, backgroundColor: withAlpha(color, 0.14) }]}>
                {item.live ? t('home.fil.tagLive') : t('home.fil.tagIdea')}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.sub, { color: colors.textMuted }]}>{sub(item)}</Text>
        </View>
        {quick ? (
          <Pressable
            onPress={() => onQuick(item)}
            accessibilityRole="button"
            accessibilityLabel={t('home.fil.quick', { title: title(item) })}
            hitSlop={6}
            style={styles.quick}
            testID={`fil-quick-${item.id}`}
          >
            <View style={[styles.quickRing, { borderColor: colors.borderStrong }]}>
              <Ionicons name="add" size={15} color={colors.text} />
            </View>
          </Pressable>
        ) : null}
      </View>
    );
  };

  let placed = false;
  let shown = 0;
  const hidden: TimelineItem[] = [];
  const nowNode = (
    <View key="now" style={styles.now} testID="fil-now">
      {nowCard}
    </View>
  );

  for (const item of timeline.items) {
    if (item.done) {
      if (!collapse) rows.push(renderRow(item));
      continue;
    }
    if (!placed && (nowFirst || item.id === timeline.nowItemId)) {
      rows.push(nowNode);
      placed = true;
      if (!nowFirst) continue;
    }
    if (showAll || shown < UPCOMING_SHOWN) {
      rows.push(renderRow(item));
      shown += 1;
    } else {
      hidden.push(item);
    }
  }
  if (!placed) rows.push(nowNode);

  if (hidden.length > 0) {
    rows.push(
      <Pressable
        key="more"
        onPress={() => setShowAll(true)}
        accessibilityRole="button"
        accessibilityLabel={t('home.fil.showMoreA11y')}
        style={styles.summary}
      >
        <View style={styles.timeCol} />
        <View style={[styles.node, { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 2, borderStyle: 'dotted' }]} />
        <View style={styles.texts}>
          <Text style={[styles.title, { color: colors.text }]}>{t('home.fil.more', { count: hidden.length })}</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
            {hidden.map(short).join(' · ')}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </Pressable>,
    );
  }

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={t('home.fil.title')}
      testID="home-day-timeline"
    >
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.textMuted }]} accessibilityRole="header">
          {t('home.fil.title')}
        </Text>
        <Pressable onPress={onPlanning} accessibilityRole="link" hitSlop={8} style={styles.link}>
          <Text style={[styles.linkLabel, { color: colors.accent }]}>
            {t('home.fil.progress', { done: timeline.progress.done, total: timeline.progress.total })}
          </Text>
          <Ionicons name="chevron-forward" size={12} color={colors.accent} />
        </Pressable>
      </View>
      <View>
        <View style={[styles.line, { backgroundColor: colors.border }]} pointerEvents="none" />
        {rows}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, paddingTop: 8, paddingBottom: 8, paddingHorizontal: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heading: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  line: { position: 'absolute', left: 58, top: 14, bottom: 18, width: 2, borderRadius: 1 },
  summary: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  timeCol: { width: 40 },
  time: { width: 40, textAlign: 'right', paddingTop: 2, fontFamily: fontFamily.monoBold, fontSize: 11 },
  node: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  tag: {
    fontFamily: fontFamily.monoBold,
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  sub: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  action: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  quick: { width: 44, height: 44, marginVertical: -8, marginRight: -6, alignItems: 'center', justifyContent: 'center' },
  quickRing: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  now: { marginTop: 6, marginBottom: 10 },
});
