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
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MAX_ACTIVE_GOALS } from '@wellness/shared';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalFormSheet } from '@/components/goals/GoalFormSheet';
import { deleteGoal, useGoals } from '@/data/repositories/goal-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function GoalsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active, finished, isLoading } = useGoals();
  const [formOpen, setFormOpen] = useState(false);

  const atCap = active.length >= MAX_ACTIVE_GOALS;
  const isEmpty = !isLoading && active.length === 0 && finished.length === 0;

  const confirmDelete = (id: string) => {
    Alert.alert(t('goals.deleteConfirmTitle'), t('goals.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('goals.delete'),
        style: 'destructive',
        onPress: () => void deleteGoal(id),
      },
    ]);
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
                  <GoalCard key={goal.id} goal={goal} onDelete={() => confirmDelete(goal.id)} />
                ))}
              </View>
            )}

            {finished.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('goals.sectionFinished')}
                </Text>
                {finished.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} onDelete={() => confirmDelete(goal.id)} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <GoalFormSheet visible={formOpen} onClose={() => setFormOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  capNotice: { fontFamily: fontFamily.body, fontSize: 12.5, marginTop: -6 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: fontFamily.displayBold, fontSize: 16 },
});
