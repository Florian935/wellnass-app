/**
 * US PAS-01 — écran d'historique des pas quotidiens.
 *
 * Trois blocs : l'histogramme des 30 derniers jours (barres teintées selon l'atteinte de
 * l'objectif), les statistiques de la période, et le réglage de l'objectif quotidien.
 *
 * L'histogramme réutilise `MuscleVolumeBarChart` : l'**infobulle au tap** (US UX-01) et la gestion
 * de largeur viennent donc gratuitement, plutôt que d'écrire un troisième graphique maison.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  MAX_STEP_GOAL,
  MIN_STEP_GOAL,
  STEP_GOAL_INCREMENT,
  averageSteps,
  bestSteps,
  formatDayFull,
  isGoalReached,
  localDayKey,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { MuscleVolumeBarChart } from '@/components/charts/MuscleVolumeBarChart';
import {
  useDailySteps,
  useStepGoal,
  useTodaySteps,
} from '@/data/repositories/daily-steps-repository';
import { upsertProfile } from '@/data/repositories/profile-repository';
import { useHealthConnectState } from '@/hooks/useHealthConnectState';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const HISTORY_DAYS = 30;

/** Étiquette courte JJ/MM pour l'axe de l'histogramme. */
function shortLabel(logDate: string): string {
  const [, m, d] = logDate.split('-');
  return `${d}/${m}`;
}

/** Séparateur de milliers selon la langue courante (cf. `StepsCard`). */
function formatSteps(value: number, language: string): string {
  return new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'fr-FR').format(value);
}

export default function StepsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { state } = useHealthConnectState();

  const since = new Date();
  since.setDate(since.getDate() - (HISTORY_DAYS - 1));
  const { rows, isLoading } = useDailySteps(localDayKey(since));
  const { goal } = useStepGoal();
  const { steps: todaySteps, reached: todayReached } = useTodaySteps();

  // Objectif en cours d'édition : l'écriture est immédiate (offline-first), mais on garde une
  // valeur locale pour que les taps successifs sur +/− restent fluides sans attendre la synchro.
  const [draftGoal, setDraftGoal] = useState<number | null>(null);
  const shownGoal = draftGoal ?? goal;

  const setGoal = (next: number) => {
    const bounded = Math.min(MAX_STEP_GOAL, Math.max(MIN_STEP_GOAL, next));
    setDraftGoal(bounded);
    void upsertProfile({ dailyStepGoal: bounded });
  };

  const chartData = rows.map((r) => ({
    label: shortLabel(r.logDate),
    value: r.steps,
    detail: formatDayFull(r.logDate),
    // Objectif atteint = couleur de succès. L'histogramme reste lisible sans la couleur grâce à
    // l'infobulle (valeur exacte au tap) et au récapitulatif chiffré juste en dessous.
    color: isGoalReached(r.steps, shownGoal) ? colors.success : colors.accent,
  }));

  const reachedCount = rows.filter((r) => isGoalReached(r.steps, shownGoal)).length;

  const header = (
    <ScreenHeader
      title={t('steps.title')}
      subtitle={
        state === 'ready'
          ? t('steps.goalProgress', {
              steps: formatSteps(todaySteps, i18n.language),
              goal: formatSteps(shownGoal, i18n.language),
            })
          : undefined
      }
    />
  );

  // États non nominaux : on affiche l'écran mais on explique, plutôt qu'un graphique vide.
  const notice =
    state === 'off'
      ? t('steps.enableCta')
      : state === 'permissions_missing'
        ? t('steps.permissionCta')
        : state === 'provider_missing' || state === 'provider_update_required'
          ? t('steps.unsupported')
          : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {header}

        {notice !== null ? (
          <Card>
            <Text style={[styles.notice, { color: colors.text }]}>{notice}</Text>
          </Card>
        ) : null}

        {!isLoading && rows.length === 0 && notice === null ? (
          <Card>
            <Text style={[styles.notice, { color: colors.textMuted }]}>{t('steps.empty')}</Text>
          </Card>
        ) : null}

        {rows.length > 0 ? (
          <>
            <Card>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('steps.historyRange', { count: HISTORY_DAYS })}
              </Text>
              <MuscleVolumeBarChart data={chartData} unit={t('steps.unit')} />
            </Card>

            <View style={styles.stats}>
              <Card style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatSteps(averageSteps(rows), i18n.language)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  {t('steps.average')}
                </Text>
              </Card>
              <Card style={styles.statCard}>
                <View accessible accessibilityLabel={t('steps.daysReached', { count: reachedCount })}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{reachedCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    {t('steps.daysReachedShort')}
                  </Text>
                </View>
              </Card>
              <Card style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatSteps(bestSteps(rows), i18n.language)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  {t('steps.bestDay')}
                </Text>
              </Card>
            </View>
          </>
        ) : null}

        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('steps.goal')}</Text>
          <View style={styles.goalRow}>
            <Button
              label="−"
              variant="ghost"
              onPress={() => setGoal(shownGoal - STEP_GOAL_INCREMENT)}
              accessibilityLabel={t('steps.goalDecrease')}
            />
            <Text
              style={[styles.goalValue, { color: colors.text }]}
              accessibilityLabel={t('steps.goalValueA11y', { goal: formatSteps(shownGoal, i18n.language) })}
            >
              {formatSteps(shownGoal, i18n.language)}
            </Text>
            <Button
              label="+"
              variant="ghost"
              onPress={() => setGoal(shownGoal + STEP_GOAL_INCREMENT)}
              accessibilityLabel={t('steps.goalIncrease')}
            />
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('steps.goalHint', {
              min: formatSteps(MIN_STEP_GOAL, i18n.language),
              max: formatSteps(MAX_STEP_GOAL, i18n.language),
            })}
          </Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('steps.countsForStreak')}
          </Text>
          {todayReached ? (
            <Text style={[styles.hint, { color: colors.success }]}>{t('steps.goalReached')}</Text>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 32 },
  cardTitle: { fontFamily: fontFamily.bodySemi, fontSize: 15, marginBottom: 10 },
  notice: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  statLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 11, marginTop: 2, textAlign: 'center' },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  goalValue: { fontFamily: fontFamily.displayBold, fontSize: 24, minWidth: 96, textAlign: 'center' },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5, marginTop: 8, lineHeight: 17 },
});
