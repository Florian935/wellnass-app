/**
 * Widget OBJ-01 — objectifs à échéance, décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : l'objectif le plus urgent, anneau + pourcentage ;
 *  - `wide`  : idem + valeur atteinte / cible et jours restants ;
 *  - `large` : jusqu'à 3 objectifs en cours.
 *
 * Gardé par `['strength', 'running']` et **non** `'always'` (voir le registre) : les 2 types
 * d'objectif portent sur la course et la force, un utilisateur « nutrition seule » n'aurait qu'un
 * vide permanent.
 *
 * ── L'ordre d'affichage ───────────────────────────────────────────────────────────────────────
 * Le plus **urgent** d'abord — `useGoals` trie par échéance croissante. Pas le plus avancé : un
 * objectif à 90 % avec trois semaines devant lui est moins pressant qu'un à 40 % qui se joue demain.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { daysBetween, GOAL_MILESTONES, localDayKey, type WidgetSize } from '@wellness/shared';

import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { RingGauge } from '@/components/widgets/primitives';
import { useGoals, type GoalWithProgress } from '@/data/repositories/goal-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function GoalsCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { active, isLoading } = useGoals();

  if (isLoading) return null;

  const open = () => router.push('/goals');

  /** Cible et valeur atteinte dans l'unité de l'utilisateur (mètres stockés → km affichés). */
  const format = (goal: GoalWithProgress, value: number | null): string =>
    goal.kind === 'run_distance'
      ? units.formatDistance(value == null ? null : value / 1000)
      : units.formatWeight(value);

  const titleOf = (goal: GoalWithProgress): string =>
    goal.kind === 'run_distance'
      ? t('goals.kinds.run_distance')
      : (goal.exerciseName ?? t('goals.kinds.exercise_1rm'));

  // ── Aucun objectif en cours : une invitation, pas une carte morte ───────────────────────────
  // Garde sur l'ÉLÉMENT et non sur la longueur : `noUncheckedIndexedAccess` est actif, et c'est
  // ainsi que `first` est typé non-undefined dans tout ce qui suit.
  const first = active[0];
  if (first === undefined) {
    return (
      <WidgetFrame pad={16} onPress={open} accessibilityLabel={t('goals.cta')}>
        <Eyebrow>{t('goals.title')}</Eyebrow>
        <Text style={[styles.prompt, { color: colors.text }]}>{t('goals.widgetEmpty')}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('goals.cta')}</Text>
      </WidgetFrame>
    );
  }

  const rowFor = (goal: GoalWithProgress) => {
    const pct = goal.progress.ratio === null ? null : Math.round(goal.progress.ratio * 100);
    const daysLeft = daysBetween(localDayKey(new Date()), goal.deadline);
    const deadlineLabel =
      daysLeft <= 0 ? t('goals.lastDay') : t('goals.remaining', { count: daysLeft });

    return (
      <View key={goal.id} style={styles.row}>
        <RingGauge
          size={52}
          stroke={7}
          pct={goal.progress.ratio ?? 0}
          milestones={GOAL_MILESTONES}
        >
          <Text style={[styles.ringPct, { color: colors.text }]} maxFontSizeMultiplier={1.2}>
            {pct === null ? '—' : `${pct}%`}
          </Text>
        </RingGauge>
        <View style={styles.texts}>
          <Text
            style={[styles.goalTitle, { color: colors.text }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {titleOf(goal)}
          </Text>
          {/* La valeur en texte : l'anneau ne porte jamais seul l'information. */}
          <Text style={[styles.hint, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
            {goal.progress.unavailable
              ? t('goals.unavailable')
              : `${t('goals.progress', {
                  current: format(goal, goal.progress.currentValue),
                  target: format(goal, goal.targetValue),
                })} · ${deadlineLabel}`}
          </Text>
        </View>
      </View>
    );
  };

  const pctFirst = first.progress.ratio === null ? null : Math.round(first.progress.ratio * 100);

  // ── Petit carré : le plus urgent, réduit à l'anneau et au pourcentage ──────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame
        pad={16}
        onPress={open}
        accessibilityLabel={`${titleOf(first)}. ${t('goals.a11yRing', {
          pct: pctFirst ?? 0,
          current: format(first, first.progress.currentValue),
          target: format(first, first.targetValue),
        })}`}
      >
        <Eyebrow>{t('goals.title')}</Eyebrow>
        <View style={styles.smallBody}>
          <RingGauge
            size={54}
            stroke={7}
            pct={first.progress.ratio ?? 0}
            milestones={GOAL_MILESTONES}
          >
            <Text style={[styles.ringPct, { color: colors.text }]} maxFontSizeMultiplier={1.2}>
              {pctFirst === null ? '—' : `${pctFirst}%`}
            </Text>
          </RingGauge>
        </View>
      </WidgetFrame>
    );
  }

  // ── Grand carré : jusqu'à 3 objectifs ; rectangle : le plus urgent seul ────────────────────
  const shown = size === 'large' ? active.slice(0, 3) : active.slice(0, 1);

  return (
    <WidgetFrame
      pad={size === 'large' ? 22 : 18}
      style={styles.col}
      onPress={open}
      accessibilityLabel={t('goals.seeAll')}
    >
      <Eyebrow>{t('goals.title')}</Eyebrow>
      {shown.map(rowFor)}
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  col: { gap: 12 },
  prompt: { fontFamily: fontFamily.bodySemi, fontSize: 15, marginTop: 6 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, gap: 1 },
  goalTitle: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  ringPct: { fontFamily: fontFamily.displayBold, fontSize: 13 },
  smallBody: { alignItems: 'center', marginTop: 8 },
});
