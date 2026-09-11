import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  WORKOUT_FEELINGS,
  computeTrainingDensity,
  computeVolume,
  feelingFromStoredRpe,
  feelingToStoredRpe,
  formatDayFull,
  type WorkoutFeeling,
} from '@wellness/shared';
import { Button } from '@/components/Button';
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
  useExerciseDeltas,
  useWorkoutDetail,
  useWorkoutRecords,
  type BeatenRecord,
} from '@/data/repositories/records-repository';
import { SummaryExerciseList } from '@/components/workout/SummaryExerciseList';
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

/**
 * ⚠️ `export` **uniquement pour les tests** — personne ne l'importe ailleurs.
 *
 * La règle des échauffements ci-dessous est subtile et invisible en recette : il faudrait
 * délibérément faire un exercice qui n'a **que** des séries d'échauffement pour constater qu'il ne
 * doit pas compter. Elle mérite donc un test direct plutôt qu'un montage de tout l'écran.
 */
export async function buildSummary(
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
 * Section « Ressenti » — **cinq niveaux nommés** (Facile → Max) + note de séance, éditables
 * a posteriori.
 *
 * ── Pourquoi plus d'étoiles (US MUSCU-UX01) ─────────────────────────────────────────────────────
 * La séance vient d'être notée série par série en RPE ou en RIR (US UX-05), une échelle qui a un
 * sens ; le résumé demandait la même chose en **cinq étoiles muettes**, où rien ne dit ce que vaut
 * trois. Deux formats pour une seule question.
 *
 * Le **stockage ne change pas** : `workouts.rpe` reçoit toujours un RPE 1-10, via
 * `feelingToStoredRpe`. C'est le patron d'`intensity.ts` — la base ne change jamais de nature,
 * seule la lecture change. Les séances notées avant cette US portaient un 1-5 dans le même champ ;
 * `feelingFromStoredRpe` documente comment elles se relisent.
 *
 * Ne monte qu'une fois la séance chargée : l'état local est initialisé une seule fois depuis
 * `workout.rpe` / `workout.notes` (le composant est démonté/remonté via sa `key` si l'id de séance
 * change côté parent), puis reste la source de vérité pendant l'édition.
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
  const [feeling, setFeeling] = useState<WorkoutFeeling | null>(() =>
    feelingFromStoredRpe(initialRpe),
  );
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [noteOpen, setNoteOpen] = useState((initialNotes ?? '').trim() !== '');

  function handlePick(value: WorkoutFeeling) {
    // Retaper le niveau déjà posé l'efface : même geste que le RPE en séance.
    const next = value === feeling ? null : value;
    setFeeling(next);
    void setWorkoutFeedback(workoutId, { rpe: next ? feelingToStoredRpe(next) : null });
  }

  function handleNotesBlur() {
    const trimmed = notes.trim();
    void setWorkoutFeedback(workoutId, { notes: trimmed.length > 0 ? notes : null });
  }

  return (
    <View style={styles.feelingSection}>
      <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>
        {t('workout.summary.feelingQuestion')}
      </Text>

      {/* Cinq niveaux **nommés**. Les étoiles ne disaient pas ce que valait trois — et la séance
          venait pourtant d'être notée en RPE ou en RIR, une échelle qui, elle, a un sens. */}
      <View style={styles.feelingRow}>
        {WORKOUT_FEELINGS.map((value) => {
          const selected = feeling === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`workout.summary.feeling.${value}`)}
              onPress={() => handlePick(value)}
              style={({ pressed }) => [
                styles.feelingChip,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.feelingLabel,
                  { color: selected ? colors.accentText : colors.textMuted },
                ]}
              >
                {t(`workout.summary.feeling.${value}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {noteOpen ? (
        <TextField
          label={t('workout.summary.note')}
          placeholder={t('workout.summary.notePlaceholder')}
          value={notes}
          onChangeText={setNotes}
          onBlur={handleNotesBlur}
          multiline
          numberOfLines={3}
          style={styles.noteInput}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setNoteOpen(true)}
          style={({ pressed }) => [
            styles.noteTrigger,
            { borderColor: colors.border, backgroundColor: colors.surface },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="create-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.noteTriggerLabel, { color: colors.textMuted }]}>
            {t('workout.summary.addNote')}
          </Text>
        </Pressable>
      )}
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

/** Une statistique de la bande : la valeur d'abord, son nom en dessous. */
function Stat({
  value,
  label,
  colors,
}: {
  value: string;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={styles.statCell}>
      {/* `adjustsFontSizeToFit` + `numberOfLines` : un tonnage à quatre chiffres (« 4 108,0 kg »)
          et sa densité débordaient de la bande, poussant la dernière cellule hors de l'écran —
          valeur tronquée, libellé coupé. La valeur rétrécit maintenant dans sa colonne plutôt que
          de pousser ses voisines. */}
      <Text
        style={[styles.statValue, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text
        style={[styles.statLabel, { color: colors.textMuted }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label.toUpperCase()}
      </Text>
    </View>
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
  // Détail par exercice + écart depuis le passage précédent (US MUSCU-UX01, règle R5-1).
  const { detail } = useWorkoutDetail(id ?? '');
  const { deltas } = useExerciseDeltas(id ?? '');

  useEffect(() => {
    if (!id || !workout) {
      return;
    }
    let cancelled = false;
    void buildSummary(id, durationSeconds)
      .then((result) => {
        if (!cancelled) {
          setSummary(result);
        }
      })
      // L'écran reste sur son état de chargement si le résumé ne se construit pas — c'est déjà le
      // cas aujourd'hui. Le `catch` ne change que le rejet non capturé.
      .catch(() => undefined);
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
      {/* Les agrégats en **une bande**, pas cinq lignes de tableau : ils situent la séance, ils
          ne la racontent pas. Ce qui la raconte vient juste après. */}
      {summary ? (
        <View
          style={[styles.statBand, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Stat
            value={t('workout.summary.minutes', { count: summary.durationMin })}
            label={t('workout.summary.duration')}
            colors={colors}
          />
          <View style={[styles.statSep, { backgroundColor: colors.border }]} />
          <Stat
            value={String(summary.doneSets)}
            label={t('workout.summary.sets')}
            colors={colors}
          />
          <View style={[styles.statSep, { backgroundColor: colors.border }]} />
          <Stat
            value={units.formatWeight(summary.volume)}
            label={t('workout.summary.volume')}
            colors={colors}
          />
          <View style={[styles.statSep, { backgroundColor: colors.border }]} />
          <Stat
            value={`${units.formatWeight(summary.density)}/min`}
            label={t('workout.summary.density')}
            colors={colors}
          />
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.textMuted }]}>{t('workout.none')}</Text>
      )}

      {/* Les échauffements sortent du compte de séries et du volume (règle métier §8). Sans cette
          mention, le total paraît simplement trop bas, et rien ne l'explique. */}
      {summary && summary.warmupSets > 0 ? (
        <Text style={[styles.warmupNote, { color: colors.textMuted }]}>
          {t('workout.summary.warmupCount', { count: summary.warmupSets })}
        </Text>
      ) : null}

      {/* Ce que l'utilisateur vient de faire, avec l'écart depuis la fois d'avant. Le résumé n'en
          disait rien : il fallait rouvrir l'historique pour revoir ses propres charges. */}
      {detail ? <SummaryExerciseList entries={detail.entries} deltas={deltas} /> : null}
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
  sectionEyebrow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  feelingRow: { flexDirection: 'row', gap: 7 },
  feelingChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderRadius: 12,
  },
  feelingLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  noteTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  noteTriggerLabel: { fontFamily: fontFamily.body, fontSize: 13.5 },
  statBand: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 8,
  },
  // `flex: 1` + `minWidth: 0` : sans eux, chaque cellule se dimensionne sur son contenu et la
  // bande déborde dès que le tonnage passe les quatre chiffres. Les quatre colonnes se partagent
  // maintenant la largeur à parts égales, quoi qu'elles contiennent.
  statCell: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingHorizontal: 2 },
  statValue: { fontFamily: fontFamily.monoBold, fontSize: 17 },
  statLabel: { fontFamily: fontFamily.bodySemi, fontSize: 9.5, letterSpacing: 0.5 },
  statSep: { width: 1, height: 30 },
  warmupNote: { fontFamily: fontFamily.body, fontSize: 12.5, textAlign: 'center' },
  pressed: { opacity: 0.8 },
  noteInput: { minHeight: 90, textAlignVertical: 'top', paddingTop: 14 },
});
