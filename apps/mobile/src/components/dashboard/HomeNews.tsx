/**
 * US ACCUEIL-08 — **« Du nouveau »** : deux cartes au plus, choisies dans un ordre écrit une fois
 * (`selectHomeNews`, `@wellness/shared`, testée). Remplace la pile « depuis ta dernière visite »,
 * objectif, insight, conflit d'objectifs et parcours qui s'empilait sous la carte « maintenant ».
 *
 * Chaque carte garde son composant d'origine quand il existe (conflit, parcours, depuis ta dernière
 * visite, lien du Labo, objectif) : leurs règles et leurs actions ne sont pas réécrites ici. Seuls le
 * record battu et le record à portée ont une carte neuve (`NewsCard`) — la carte record partageable
 * arrive avec ACCUEIL-09.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import {
  formatPaceMMSS,
  isFreshRecord,
  RECORD_DISTANCE_I18N_KEY,
  localDayKey,
  selectHomeNews,
  type HomeNewsKind,
  type SinceLastVisitItem,
} from '@wellness/shared';
import { ActivationPathCard } from '@/components/dashboard/ActivationPathCard';
import { GoalConflictBanner, useVisibleGoalConflict } from '@/components/dashboard/GoalConflictBanner';
import { InsightsCard } from '@/components/dashboard/InsightsCard';
import { SinceLastVisitCard, useSinceLastVisit } from '@/components/dashboard/SinceLastVisitCard';
import { GoalCard } from '@/components/goals/GoalCard';
import { useActivationPath } from '@/data/repositories/activation-path-repository';
import { useMostRecentRecord, type MostRecentRecord } from '@/data/repositories/dashboard-repository';
import { useGoals } from '@/data/repositories/goal-repository';
import { useInsights } from '@/data/repositories/insights-repository';
import { InsightsProvider } from '@/data/repositories/insights-context';
import { usePressingLink } from '@/data/repositories/cross-links-repository';
import { useNearRecords, type NearRecordItem } from '@/data/repositories/records-repository';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

type Props = {
  /** Une séance de musculation est encore à faire aujourd'hui : le record à portée a un sens. */
  strengthSessionToday: boolean;
};

export function HomeNews({ strengthSessionToday }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const todayKey = useTodayKey();

  // Une seule collecte par source : chaque carte reçoit ce qui la décide.
  const conflict = useVisibleGoalConflict();
  const activation = useActivationPath();
  const { record } = useMostRecentRecord();
  const sinceItems = useSinceLastVisit();
  const { items: nearItems } = useNearRecords(1);
  const insightsValue = useInsights();
  const { link } = usePressingLink();
  const { active: activeGoals } = useGoals();

  const near = nearItems[0];
  const recordDay = record ? localDayKey(new Date(record.achievedAt)) : null;
  const kinds = selectHomeNews({
    conflict: conflict !== null,
    // Le premier jour, le parcours est dans le ciel (« Premiers pas ») : ici, du jour 2 au jour 7.
    activation: activation.show && (activation.day ?? 0) >= 2,
    record: isFreshRecord(recordDay, todayKey),
    'since-last-visit': sinceItems.length > 0,
    'near-record': strengthSessionToday && near !== undefined && near.gapKind !== 'beaten',
    lab: insightsValue.insights.length > 0 || link !== null,
    goal: activeGoals.length > 0,
  });

  if (kinds.length === 0) return null;

  const render = (kind: HomeNewsKind) => {
    switch (kind) {
      case 'conflict':
        return <GoalConflictBanner key={kind} />;
      case 'activation':
        return <ActivationPathCard key={kind} size="wide" />;
      case 'record':
        return record ? <RecordNews key={kind} record={record} /> : null;
      case 'since-last-visit':
        return <SinceLastVisitCard key={kind} items={sinceItems as SinceLastVisitItem[]} />;
      case 'near-record':
        return near ? <NearRecordNews key={kind} item={near} /> : null;
      case 'lab':
        return (
          <InsightsProvider key={kind} value={insightsValue}>
            <InsightsCard size="wide" />
          </InsightsProvider>
        );
      case 'goal':
      default:
        return activeGoals[0] ? (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={t('goals.title')}
            onPress={() => router.push('/goals')}
          >
            <GoalCard goal={activeGoals[0]} />
          </Pressable>
        ) : null;
    }
  };

  return (
    <View style={styles.section} testID="home-news">
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.textMuted }]} accessibilityRole="header">
          {t('home.news.title')}
        </Text>
        <Pressable onPress={() => router.push('/insights')} accessibilityRole="link" hitSlop={8} style={styles.link}>
          <Text style={[styles.linkLabel, { color: colors.accent }]}>{t('home.news.all')}</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.accent} />
        </Pressable>
      </View>
      {kinds.map(render)}
    </View>
  );
}

/** Le record battu, fêté le jour même et le lendemain. */
function RecordNews({ record }: { record: MostRecentRecord }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const units = useUnits();
  const strength = record.pillar === 'strength';
  const title = strength
    ? `${record.exerciseName} · ${
        record.type === 'best_volume'
          ? `${new Intl.NumberFormat(i18n.language).format(Math.round(record.value))} kg`
          : units.formatWeight(record.value)
      }`
    : `${t(RECORD_DISTANCE_I18N_KEY[record.distanceKey])} · ${formatPaceMMSS(record.bestTimeSeconds, '—')}`;
  return (
    <Pressable
      onPress={() => router.push(strength ? '/progress' : '/running-stats')}
      accessibilityRole="button"
      accessibilityLabel={`${t('home.news.record.tag')}. ${title}`}
      testID="news-record"
    >
      <LinearGradient
        colors={strength ? ['#8e1b1b', '#4a120f', '#2b0d0b'] : ['#2a64ad', '#1d4586', '#0f2547']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={[styles.icon, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
          <Ionicons name="trophy-outline" size={20} color="#ffd9a0" />
        </View>
        <View style={styles.texts}>
          <Text style={[styles.tag, { color: strength ? '#ffb3a8' : '#d6e6fa' }]}>{t('home.news.record.tag')}</Text>
          <Text style={[styles.title, { color: '#ffffff' }]}>{title}</Text>
          <Text style={[styles.body, { color: strength ? '#f6c5bf' : '#d6e6fa' }]}>{t('home.news.record.body')}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** Le record à portée, un jour de séance : ce qui donne envie d'y aller. */
function NearRecordNews({ item }: { item: NearRecordItem }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const title =
    item.gapKind === 'kg'
      ? t('stage.strength.near.kg', { exercise: item.exerciseName, gap: item.gap })
      : t('stage.strength.near.reps', { exercise: item.exerciseName, count: item.gap, gap: item.gap });
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/strength')}
      accessibilityRole="button"
      accessibilityLabel={`${t('home.news.near.tag')}. ${title}`}
      testID="news-near-record"
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: withAlpha(colors.pillarStrength, 0.3), borderWidth: 1.5 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: withAlpha(colors.pillarStrength, 0.14) }]}>
        <Ionicons name="trophy-outline" size={20} color={colors.pillarStrength} />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.tag, { color: colors.pillarStrength }]}>{t('home.news.near.tag')}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{t('home.news.near.body')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  heading: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  card: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: 22, overflow: 'hidden' },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, minWidth: 0, gap: 3 },
  tag: { fontFamily: fontFamily.monoBold, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontFamily: fontFamily.displayBold, fontSize: 17, letterSpacing: -0.3, lineHeight: 21 },
  body: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
});
