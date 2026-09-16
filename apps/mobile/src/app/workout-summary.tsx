/**
 * Écran de fin de séance — l'un des **deux montages** du bilan (US MUSCU-UX02).
 *
 * Tout le contenu vit dans `<WorkoutReport>`, partagé avec `history/[id].tsx`. Cet écran ne garde
 * que ce qui lui est propre : son en-tête, l'enregistrement en modèle, le partage et le retour à
 * l'accueil. C'est ce découpage qui rend l'iso structurel plutôt que déclaratif — avant lui, les
 * deux écrans affichaient la même séance de deux façons incompatibles.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { computeSessionHeat, formatDayFull, type SetType } from '@wellness/shared';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ShareCardSheet } from '@/components/share/ShareCardSheet';
import { TextField } from '@/components/TextField';
import { WorkoutReport } from '@/components/workout/report/WorkoutReport';
import { WorkoutEnergySection } from '@/components/energy/WorkoutEnergySection';
import { useWorkoutReport } from '@/data/repositories/workout-report-repository';
import { useSessionMuscles } from '@/data/repositories/immersive-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { createTemplateFromWorkout } from '@/data/repositories/workout-template-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const workoutId = typeof id === 'string' ? id : '';

  const { workouts } = useWorkoutHistory();
  const workout = workouts.find((w) => w.id === workoutId) ?? null;

  // 🔴 **Une seule lecture pour tout l'écran.** Le bilan est lu ici et passé en prop à
  // `<WorkoutReport>` : chaque `useQuery` ouvre une surveillance PowerSync, et rien n'est
  // dédupliqué entre deux instances du hook — le laisser relire doublait les 9 requêtes (spec R11).
  // Il alimente aussi la carte de partage et la garde du bouton « modèle ».
  const { report, isLoading } = useWorkoutReport(workoutId);

  // Le corps travaillé, pour la carte à partager (US MUSCU-UX03, §5.13). Une image vaut mieux
  // que trois chiffres pour dire ce qu'on vient de faire — et elle ne contient aucune donnée
  // de santé, ce qui la rend partageable sans y réfléchir.
  const reportExercises = report?.exercises ?? [];
  const sessionMuscles = useSessionMuscles(reportExercises.map((e) => e.exerciseId));
  const sessionHeat = computeSessionHeat(
    reportExercises.flatMap((exercise) =>
      exercise.sets.map((set) => ({
        exerciseId: exercise.exerciseId,
        // `ReportSet.setType` est une chaîne libre (le bilan relit des lignes historiques qui
        // peuvent porter un type disparu du code) ; seule la valeur `warmup` compte ici.
        setType: set.setType as SetType,
        done: set.done,
      })),
    ),
    sessionMuscles,
  );

  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const hasContent = report !== null && report.totals.exercises > 0;
  const canSaveAsTemplate =
    workout?.sessionId === null && workout?.programId === null && hasContent;

  function handleStartSaveAsTemplate() {
    if (workout) {
      // Date LOCALE (pas un slice de la chaîne ISO UTC, qui décalerait le jour affiché selon le
      // fuseau de l'utilisateur — patron `history/index.tsx`).
      const startedLocal = new Date(workout.startedAt);
      const dd = String(startedLocal.getDate()).padStart(2, '0');
      const mm = String(startedLocal.getMonth() + 1).padStart(2, '0');
      setTemplateName(t('workout.summary.saveAsTemplateDefaultName', { date: `${dd}/${mm}` }));
    }
    setSavingAsTemplate(true);
  }

  async function handleConfirmSaveAsTemplate() {
    const trimmed = templateName.trim();
    if (!workout || trimmed === '' || submittingTemplate) return;
    setSubmittingTemplate(true);
    try {
      await createTemplateFromWorkout(workout.id, trimmed);
      Alert.alert(t('workout.summary.templateSaved'), trimmed);
      setSavingAsTemplate(false);
    } catch {
      // Écriture locale (offline-first) : un échec est très improbable. On réactive le formulaire
      // pour permettre une nouvelle tentative.
    } finally {
      setSubmittingTemplate(false);
    }
  }

  return (
    <FormScreen>
      <ScreenHeader title={t('workout.summary.title')} subtitle={t('workout.summary.subtitle')} />

      {report !== null ? <WorkoutReport report={report} context="post-session" /> : null}

      {/*
        US DEPENSE-02 — ce que la séance a coûté, et ce que ça change dans la journée.
        Placée APRÈS le bilan : la dépense est un complément, pas le sujet de l'écran (une séance
        se juge à ses charges et à ses records, pas à ses calories). Masquable par réglage.
      */}
      {report !== null && workout !== null ? (
        <WorkoutEnergySection
          workoutId={workoutId}
          finishedAt={workout.finishedAt}
          durationSeconds={report.totals.durationMin * 60}
          totalSets={report.totals.workingSets + report.totals.warmupSets}
          rpe={report.feelingRpe ?? (report.totals.averageRpe != null ? Math.round(report.totals.averageRpe) : null)}
        />
      ) : null}

      {canSaveAsTemplate ? (
        <View style={styles.saveAsTemplateSection}>
          {savingAsTemplate ? (
            <>
              <TextField
                label={t('workout.summary.templateNameLabel')}
                value={templateName}
                onChangeText={setTemplateName}
              />
              <View style={styles.saveAsTemplateActions}>
                <View style={styles.saveAsTemplateActionFlex}>
                  <Button
                    variant="ghost"
                    label={t('common.cancel')}
                    onPress={() => setSavingAsTemplate(false)}
                    disabled={submittingTemplate}
                  />
                </View>
                <View style={styles.saveAsTemplateActionFlex}>
                  <Button
                    label={t('workout.summary.saveAsTemplateConfirm')}
                    onPress={() => void handleConfirmSaveAsTemplate()}
                    loading={submittingTemplate}
                    disabled={submittingTemplate || templateName.trim() === ''}
                  />
                </View>
              </View>
            </>
          ) : (
            <Button
              variant="ghost"
              label={t('workout.summary.saveAsTemplate')}
              onPress={handleStartSaveAsTemplate}
            />
          )}
        </View>
      ) : null}

      {/* Carte partageable (US PARTAGE-01) — seulement quand il y a quelque chose à montrer : une
          séance sans exercice ne produirait qu'une carte vide. */}
      {hasContent && workout !== null ? (
        <Button variant="ghost" label={t('share.cta')} onPress={() => setShareOpen(true)} />
      ) : null}

      {/* ⚠️ La garde attend la fin du chargement. Sans elle, « Aucune séance » clignotait pendant
          la requête locale — juste après avoir terminé sa séance, au moment le plus valorisant de
          l'app. C'est la garde que `history/[id].tsx` avait déjà et que cet écran n'avait pas. */}
      {report === null && !isLoading ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>{t('workout.none')}</Text>
      ) : null}

      <View style={styles.footer}>
        <Button label={t('workout.backHome')} onPress={() => router.replace('/(tabs)')} />
      </View>

      {hasContent && workout !== null ? (
        <ShareCardSheet
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          data={{
            kind: 'workout',
            startedAtMs: Date.parse(workout.startedAt),
            stats: {
              exercises: report.totals.exercises,
              sets: report.totals.workingSets,
              volume: units.formatWeight(report.totals.volumeKg),
              duration: t('workout.summary.minutes', { count: report.totals.durationMin }),
            },
            // Un libellé par record, déjà résolu et traduit : la carte ne fait aucune mise en forme
            // métier, elle affiche des chaînes.
            records: report.records.map(
              (record) =>
                `${record.exerciseName} · ${
                  record.type === 'best_volume'
                    ? String(Math.round(record.value))
                    : units.formatWeight(record.value)
                }`,
            ),
            heat: sessionHeat,
          }}
          accessibilityLabel={t('share.workout.a11y', {
            date: formatDayFull(workout.startedAt),
            exercises: report.totals.exercises,
            sets: report.totals.workingSets,
            volume: units.formatWeight(report.totals.volumeKg),
          })}
        />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: 'auto' },
  saveAsTemplateSection: { gap: 10 },
  saveAsTemplateActions: { flexDirection: 'row', gap: 10 },
  saveAsTemplateActionFlex: { flex: 1 },
  empty: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center' },
});
