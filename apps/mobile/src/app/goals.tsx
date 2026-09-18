/**
 * US OBJ-01 — écran des objectifs à échéance : en cours, puis terminés avec leur verdict.
 *
 * ── Pourquoi les terminés restent affichés (décision D3) ───────────────────────────────────────
 * Un objectif manqué qu'on efface n'apprend rien. Il quitte la liste active à l'échéance, garde son
 * verdict — atteint / non atteint — et reste consultable. La suppression existe, mais c'est un geste
 * de l'utilisateur, pas un ménage automatique.
 *
 * Aucune progression n'est stockée : tout est recalculé à l'affichage (décision D5), donc l'écran
 * fonctionne hors ligne à l'identique.
 */

import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, type AlertButton } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MAX_ACTIVE_GOALS } from '@wellness/shared';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalFormSheet } from '@/components/goals/GoalFormSheet';
import { GoalLetterSheet } from '@/components/goals/GoalLetterSheet';
import {
  deleteGoal,
  markGoalLetterOpened,
  useGoals,
  type GoalWithProgress,
} from '@/data/repositories/goal-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function GoalsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active, finished, isLoading } = useGoals();
  const [formOpen, setFormOpen] = useState(false);
  // US LETTRE-01 — on retient l'ID, pas l'objectif : la feuille suit ainsi les modifications du
  // texte sans rouvrir, et se referme d'elle-même si l'objectif disparaît.
  const [letterGoalId, setLetterGoalId] = useState<string | null>(null);

  const atCap = active.length >= MAX_ACTIVE_GOALS;
  const isEmpty = !isLoading && active.length === 0 && finished.length === 0;

  const letterGoal =
    letterGoalId === null
      ? null
      : ([...active, ...finished].find((goal) => goal.id === letterGoalId) ?? null);

  /**
   * Ouvre le mot (US LETTRE-01). `triggered` = ouverture par un des trois déclencheurs (R3) : ce
   * n'est que dans ce cas que la lettre est marquée comme ouverte. Une relecture volontaire (D3)
   * ne consomme pas le déclencheur — sinon la proposition disparaîtrait avant d'avoir servi.
   */
  const openLetter = (goal: GoalWithProgress, triggered: boolean) => {
    setLetterGoalId(goal.id);
    if (triggered) void markGoalLetterOpened(goal.id, goal.letterOpenedAt !== null);
  };

  const confirmDelete = (goal: GoalWithProgress) => {
    /*
     * Troisième déclencheur (R3-c) : la lettre est proposée **avant** la confirmation, sur la même
     * alerte. C'est le moment où elle sert le plus — et relire renonce à supprimer : rien n'est
     * détruit tant que « Supprimer » n'a pas été touché une seconde fois.
     */
    const hasLetter = goal.letterText !== null;
    const buttons: AlertButton[] = [
      { text: t('common.cancel'), style: 'cancel' },
      ...(hasLetter
        ? [{ text: t('goals.letter.open'), onPress: () => openLetter(goal, true) }]
        : []),
      {
        text: t('goals.delete'),
        style: 'destructive',
        onPress: () => void deleteGoal(goal.id),
      },
    ];

    const body = hasLetter
      ? [t('goals.deleteConfirmBody'), t('goals.letter.onDelete')].join('\n\n')
      : t('goals.deleteConfirmBody');

    Alert.alert(t('goals.deleteConfirmTitle'), body, buttons);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={t('goals.title')} />

        {/*
          Un seul appel à l'action à la fois : quand la liste est vide, c'est l'`EmptyState` qui le
          porte. Afficher les deux annonçait « Nouvel objectif » deux fois de suite — et TalkBack
          lisait deux fois la même action (constaté le 30/07/2026 en passe device).
        */}
        {!isEmpty && (
          <Button label={t('goals.cta')} onPress={() => setFormOpen(true)} disabled={atCap} />
        )}
        {atCap && (
          <Text style={[styles.capNotice, { color: colors.textMuted }]}>
            {t('goals.errors.limitReached', { count: MAX_ACTIVE_GOALS })}
          </Text>
        )}

        {isEmpty ? (
          <EmptyState
            icon="flag-outline"
            title={t('goals.title')}
            message={t('goals.empty')}
            cta={{ label: t('goals.cta'), onPress: () => setFormOpen(true) }}
          />
        ) : (
          <>
            {active.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('goals.sectionActive')}
                </Text>
                {active.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onDelete={() => confirmDelete(goal)}
                    onOpenLetter={(triggered) => openLetter(goal, triggered)}
                  />
                ))}
              </View>
            )}

            {finished.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('goals.sectionFinished')}
                </Text>
                {finished.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onDelete={() => confirmDelete(goal)}
                    onOpenLetter={(triggered) => openLetter(goal, triggered)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <GoalFormSheet visible={formOpen} onClose={() => setFormOpen(false)} />
      <GoalLetterSheet goal={letterGoal} onClose={() => setLetterGoalId(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  capNotice: { fontFamily: fontFamily.body, fontSize: 12.5, marginTop: -6 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: fontFamily.displayBold, fontSize: 16 },
});
