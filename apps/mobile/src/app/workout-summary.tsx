import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { computeTrainingDensity, computeVolume, formatDayFull } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CelebrationCard } from '@/components/CelebrationCard';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ShareCardSheet } from '@/components/share/ShareCardSheet';
import { TextField } from '@/components/TextField';
import {
  getWorkoutSets,
  setWorkoutFeedback,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import {
  useWorkoutRecords,
  type BeatenRecord,
} from '@/data/repositories/records-repository';
import { createTemplateFromWorkout } from '@/data/repositories/workout-template-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Récapitulatif calculé à partir de la séance terminée et de ses séries. */
type Summary = {
  exercises: number;
  doneSets: number;
  warmupSets: number;
  volume: number;
  durationMin: number;
  density: number;
};

async function buildSummary(
  workoutId: string,
  durationSeconds: number | null,
): Promise<Summary> {
  const sets = await getWorkoutSets(workoutId);
  // Les échauffements sont exclus du volume (déjà via computeVolume), des records
  // et — ici — du décompte de séries et d'exercices (spec C2 §2.5). Un exercice
  // qui n'a que des échauffements ne compte pas.
  const doneSets = sets.filter((s) => s.done && s.setType !== 'warmup').length;
  const warmupSets = sets.filter((s) => s.done && s.setType === 'warmup').length;
  const volume = Math.round(computeVolume(sets));
  const durationMin = Math.max(1, Math.round((durationSeconds ?? 0) / 60));
  const density = computeTrainingDensity(volume, durationMin);
  const exercises = new Set(
    sets.filter((s) => s.setType !== 'warmup').map((s) => s.exerciseId),
  ).size;
  return { exercises, doneSets, warmupSets, volume, durationMin, density };
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.rowValueWrap}>
        {hint ? <Text style={[styles.rowHint, { color: colors.textMuted }]}>{hint}</Text> : null}
        <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

/** Carte de célébration pour un record personnel battu. */
function RecordCard({ record }: { record: BeatenRecord }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const typeLabel = t(`workout.summary.records.type.${record.type}`, record.type);
  const valueLabel =
    record.type === 'best_volume'
      ? `${record.value}`
      : units.formatWeight(record.value);
  return (
    <View
      style={[
        styles.recordCard,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.recordIcon]}>🏆</Text>
      <View style={styles.recordBody}>
        <Text style={[styles.recordExercise, { color: colors.text }]} numberOfLines={1}>
          {record.exerciseName}
        </Text>
        <Text style={[styles.recordMeta, { color: colors.textMuted }]}>
          {typeLabel} · {valueLabel}
        </Text>
      </View>
    </View>
  );
}

/**
 * Section "Ressenti" — 5 étoiles tappables (RPE borné 1-5) + note de séance,
 * éditables a posteriori. Ne monte qu'une fois la séance chargée (`workout`
 * non nul) : l'état local est initialisé une seule fois depuis `workout.rpe` /
 * `workout.notes` (le composant est démonté/remonté via sa `key` si l'id de
 * séance change côté parent), puis reste la source de vérité pour l'affichage
 * pendant que l'utilisateur édite.
 */
function FeelingSection({
  workoutId,
  initialRpe,
  initialNotes,
}: {
  workoutId: string;
  initialRpe: number | null;
  initialNotes: string | null;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [rpe, setRpe] = useState(initialRpe);
  const [notes, setNotes] = useState(initialNotes ?? '');

  // Ressenti affiché borné 1-5 (0/absent = aucune étoile pleine) — voir spec.
  const displayRpe = Math.min(5, Math.max(0, rpe ?? 0));

  function handleRate(value: number) {
    setRpe(value);
    void setWorkoutFeedback(workoutId, { rpe: value });
  }

  function handleNotesBlur() {
    const trimmed = notes.trim();
    void setWorkoutFeedback(workoutId, { notes: trimmed.length > 0 ? notes : null });
  }

  return (
    <View style={styles.feelingSection}>
      <Text style={[styles.recordsSectionTitle, { color: colors.text }]}>
        {t('workout.summary.feeling')}
      </Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((value) => {
          const filled = displayRpe >= value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={t('workout.summary.starLabel', { count: value })}
              onPress={() => handleRate(value)}
              hitSlop={8}
            >
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={30}
                color={filled ? colors.accent : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
      <TextField
        label={t('workout.summary.note')}
        placeholder={t('workout.summary.notePlaceholder')}
        value={notes}
        onChangeText={setNotes}
        onBlur={handleNotesBlur}
        multiline
        numberOfLines={4}
        style={styles.noteInput}
      />
    </View>
  );
}

/** Section "Records battus" — rendu uniquement si des records existent. */
function RecordsSection({ workoutId }: { workoutId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { records, isLoading } = useWorkoutRecords(workoutId);

  // Ne rien afficher pendant le chargement (évite le flash "section vide").
  if (isLoading) return null;
  if (records.length === 0) return null;

  return (
    <View style={styles.recordsSection}>
      <Text style={[styles.recordsSectionTitle, { color: colors.text }]}>
        {t('workout.summary.records.sectionTitle')}
      </Text>
      {records.map((record) => (
        <RecordCard key={`${record.exerciseId}-${record.type}`} record={record} />
      ))}
    </View>
  );
}

/**
 * Bannière de célébration animée — US MUSC-F8 (roadmap 3.42, partie animation).
 *
 * Montée **juste après `ScreenHeader`**, pas au-dessus de `RecordsSection` (qui est ~60 lignes de
 * JSX plus bas) : `CelebrationCard` démarre son animation au montage, et une bannière montée trop
 * bas serait déjà à son état final quand l'utilisateur y arrive en scrollant.
 *
 * Purement décorative : le décompte qu'elle affiche est redondant avec `RecordsSection`, qui reste
 * la source d'information. Dédoublonne par exercice (`exerciseId`), comme le fait le push de
 * `buildRecordPushContent` — même règle, deux lectures indépendantes du même `useWorkoutRecords`.
 */
function WorkoutCelebrationBanner({ workoutId }: { workoutId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { records, isLoading } = useWorkoutRecords(workoutId);

  if (isLoading || records.length === 0) return null;

  const exerciseCount = new Set(records.map((r) => r.exerciseId)).size;

  return (
    <CelebrationCard style={[styles.celebration, { backgroundColor: colors.accent }]}>
      <Text style={styles.celebrationSpark}>🏆</Text>
      <Text style={[styles.celebrationTitle, { color: colors.accentText }]}>
        {exerciseCount === 1
          ? t('workout.summary.celebration.titleOne')
          : t('workout.summary.celebration.titleMany', { count: exerciseCount })}
      </Text>
    </CelebrationCard>
  );
}

export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const { workouts } = useWorkoutHistory();
  const workout = workouts.find((w) => w.id === id) ?? null;
  const durationSeconds = workout?.durationSeconds ?? null;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  // US PARTAGE-01 : aperçu de la carte partageable.
  const [shareOpen, setShareOpen] = useState(false);

  // Records de la séance, pour les porter sur la carte. `RecordsSection` fait le même appel — les
  // deux requêtes sont locales et identiques, donc PowerSync sert la même donnée.
  const { records } = useWorkoutRecords(id ?? '');

  useEffect(() => {
    if (!id || !workout) {
      return;
    }
    let cancelled = false;
    void buildSummary(id, durationSeconds).then((result) => {
      if (!cancelled) {
        setSummary(result);
      }
    });
    return () => {
      cancelled = true;
    };
    // On dépend de primitives stables (id, durée) plutôt que de l'objet `workout`,
    // dont l'identité change à chaque rendu de `useWorkoutHistory`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, durationSeconds]);

  const canSaveAsTemplate =
    workout?.sessionId === null && workout?.programId === null && summary !== null && summary.exercises > 0;

  function handleStartSaveAsTemplate() {
    if (workout) {
      // Date LOCALE (pas un slice de la chaîne ISO UTC, qui décalerait le jour
      // affiché selon le fuseau de l'utilisateur — patron `history/index.tsx`).
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
      // Écriture locale (offline-first) : un échec est très improbable. On
      // réactive le formulaire pour permettre une nouvelle tentative.
    } finally {
      setSubmittingTemplate(false);
    }
  }

  function handleCancelSaveAsTemplate() {
    setSavingAsTemplate(false);
  }

  return (
    <FormScreen>
      <ScreenHeader title={t('workout.summary.title')} subtitle={t('workout.summary.subtitle')} />
      {id ? <WorkoutCelebrationBanner workoutId={id} /> : null}
      {summary ? (
        <Card>
          <Row
            label={t('workout.summary.duration')}
            value={t('workout.summary.minutes', { count: summary.durationMin })}
          />
          <Row label={t('workout.summary.exercises')} value={String(summary.exercises)} />
          <Row
            label={t('workout.summary.sets')}
            value={String(summary.doneSets)}
            hint={summary.warmupSets > 0 ? t('workout.summary.warmupCount', { count: summary.warmupSets }) : undefined}
          />
          <Row label={t('workout.summary.volume')} value={units.formatWeight(summary.volume)} />
          <Row
            label={t('workout.summary.density')}
            value={`${units.formatWeight(summary.density)}/min`}
          />
        </Card>
      ) : (
        <Text style={[styles.empty, { color: colors.textMuted }]}>{t('workout.none')}</Text>
      )}
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
                    onPress={handleCancelSaveAsTemplate}
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
      {workout ? (
        <FeelingSection
          key={workout.id}
          workoutId={workout.id}
          initialRpe={workout.rpe}
          initialNotes={workout.notes}
        />
      ) : null}
      {id ? <RecordsSection workoutId={id} /> : null}

      {/* Carte partageable (US PARTAGE-01) — seulement quand il y a quelque chose à montrer :
          une séance sans exercice ne produirait qu'une carte vide. */}
      {summary !== null && summary.exercises > 0 && workout !== null ? (
        <Button variant="ghost" label={t('share.cta')} onPress={() => setShareOpen(true)} />
      ) : null}

      <View style={styles.footer}>
        <Button label={t('workout.backHome')} onPress={() => router.replace('/(tabs)')} />
      </View>

      {summary !== null && workout !== null ? (
        <ShareCardSheet
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          data={{
            kind: 'workout',
            startedAtMs: Date.parse(workout.startedAt),
            stats: {
              exercises: summary.exercises,
              sets: summary.doneSets,
              volume: units.formatWeight(summary.volume),
              duration: t('workout.summary.minutes', { count: summary.durationMin }),
            },
            // Un libellé par record, déjà résolu et traduit : la carte ne fait aucune mise en forme
            // métier, elle affiche des chaînes.
            records: records.map(
              (record) =>
                `${record.exerciseName} · ${
                  record.type === 'best_volume'
                    ? String(record.value)
                    : units.formatWeight(record.value)
                }`,
            ),
          }}
          accessibilityLabel={t('share.workout.a11y', {
            date: formatDayFull(workout.startedAt),
            exercises: summary.exercises,
            sets: summary.doneSets,
            volume: units.formatWeight(summary.volume),
          })}
        />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontFamily: fontFamily.body, fontSize: 15 },
  rowValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowHint: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  rowValue: { fontFamily: fontFamily.displaySemi, fontSize: 17 },
  empty: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center' },
  footer: { marginTop: 'auto' },
  saveAsTemplateSection: { gap: 10 },
  saveAsTemplateActions: { flexDirection: 'row', gap: 10 },
  saveAsTemplateActionFlex: { flex: 1 },
  // Célébration (US MUSC-F8)
  celebration: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  celebrationSpark: { fontSize: 28 },
  celebrationTitle: { fontFamily: fontFamily.displayBold, fontSize: 17, textAlign: 'center' },
  // Records section
  recordsSection: { gap: 10 },
  recordsSectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 16,
    marginBottom: 2,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  recordIcon: { fontSize: 22 },
  recordBody: { flex: 1, gap: 2 },
  recordExercise: { fontFamily: fontFamily.displaySemi, fontSize: 15 },
  recordMeta: { fontFamily: fontFamily.body, fontSize: 13 },
  // Feeling section (ressenti + note)
  feelingSection: { gap: 10 },
  starsRow: { flexDirection: 'row', gap: 8 },
  noteInput: { minHeight: 90, textAlignVertical: 'top', paddingTop: 14 },
});
