import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { CurrentSetCard, type SupersetLinkState } from '@/components/workout/CurrentSetCard';
import { ExerciseList } from '@/components/workout/ExerciseList';
import { RestOverlay } from '@/components/workout/RestOverlay';
import { SupersetPickerModal } from '@/components/workout/SupersetPickerModal';
import {
  addSet,
  cancelWorkout,
  finishWorkout,
  linkSupersetPair,
  removeSet,
  reorderExercise,
  sendExerciseToEnd,
  setExerciseNote,
  unlinkSupersetPair,
  updateSet,
  useActiveWorkout,
  useExerciseNote,
  useExerciseNotes,
  useLastPerformance,
  usePreviousStruggled,
  useSessionRest,
  useSupersetPairs,
  type WorkoutEntry,
  type WorkoutSetPatch,
} from '@/data/repositories/workout-repository';
import { evaluateWorkoutRecords } from '@/data/repositories/records-repository';
import { maybePushRecords } from '@/data/repositories/notification-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';
import { computeProgressionSuggestion } from '@wellness/shared';

/** Repos par défaut (s) quand l'exercice n'a ni override de session ni valeur planifiée. */
const DEFAULT_REST_SECONDS = 90;

/** Série courante résolue : l'exercice, la série et le rang (0-based) dans l'exercice. */
type CurrentSet = { entry: WorkoutEntry; set: WorkoutEntry['sets'][number]; rang: number };

/**
 * Dérogation de focus : cible un exercice (comme avant C3), et optionnellement
 * un rang précis dans cet exercice (superset — bascule sur la série JUMELLE,
 * pas la 1ʳᵉ série non validée de l'exercice partenaire, qui pourrait être un
 * échauffement antérieur non lié au couple).
 */
type FocusOverride = { exerciseId: string; rang?: number } | null;

/**
 * Résout la « série en cours » (machine à états de focus, C1 + superset C3) :
 *  - si `focusOverride.rang` cible une série précise (non validée) de l'exercice
 *    désigné, cette série exactement (bascule superset) ;
 *  - sinon, si `focusOverride` désigne un exercice ayant encore une série non
 *    validée, la 1ʳᵉ série non validée de CET exercice ;
 *  - sinon la 1ʳᵉ série `done===false` en parcourant exercices puis séries dans l'ordre ;
 *  - `null` si toutes les séries de tous les exercices sont validées (état de fin).
 */
function resolveCurrentSet(entries: WorkoutEntry[], focusOverride: FocusOverride): CurrentSet | null {
  const firstUndone = (entry: WorkoutEntry): CurrentSet | null => {
    for (let rang = 0; rang < entry.sets.length; rang += 1) {
      const set = entry.sets[rang];
      if (set && !set.done) return { entry, set, rang };
    }
    return null;
  };

  if (focusOverride) {
    const entry = entries.find((e) => e.exerciseId === focusOverride.exerciseId);
    if (entry) {
      if (focusOverride.rang != null) {
        const targetSet = entry.sets[focusOverride.rang];
        if (targetSet && !targetSet.done) {
          return { entry, set: targetSet, rang: focusOverride.rang };
        }
      }
      const found = firstUndone(entry);
      if (found) return found;
    }
  }
  for (const entry of entries) {
    const found = firstUndone(entry);
    if (found) return found;
  }
  return null;
}

/** Résultat de la recherche d'un partenaire superset : l'exercice et sa série au même rang. */
type SupersetPartner = { entry: WorkoutEntry; set: WorkoutEntry['sets'][number] };

/**
 * Cherche la série JUMELLE (même rang) de l'exercice lié en superset à
 * `exerciseId` — lien EXPLICITE (table `workout_superset_pairs`, carte
 * `exerciseId → exerciseId partenaire`), plus de contrainte d'adjacence
 * (révision recette 20/07/2026 : le mécanisme initial imposait aux 2
 * exercices d'être voisins dans la liste, jugé trop contraignant). `null` si
 * l'exercice n'est lié à personne, si le partenaire n'a pas de série à ce
 * rang (progression différente), ou si le partenaire a quitté la séance
 * (dégradation silencieuse — repos normal dans tous ces cas).
 */
function findSupersetPartnerSet(
  entries: WorkoutEntry[],
  pairs: Record<string, string>,
  exerciseId: string,
  rang: number,
): SupersetPartner | null {
  const partnerExerciseId = pairs[exerciseId];
  if (!partnerExerciseId) return null;
  const partnerEntry = entries.find((e) => e.exerciseId === partnerExerciseId);
  const partnerSet = partnerEntry?.sets[rang];
  return partnerEntry && partnerSet ? { entry: partnerEntry, set: partnerSet } : null;
}

/** État d'édition local des champs de la série courante (`null` = non modifié → repli). */
type EditState = { reps: string; weightKg: number | null; durationSeconds: number | null };

type Units = ReturnType<typeof useUnits>;

/** Formate un nombre de secondes en « m:ss » (ex. 90 → « 1:30 »). */
function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

/**
 * Parse une durée saisie en secondes, tolérant : « 90 » → 90, « 1:30 » → 90,
 * champ vide → `null`. La partie secondes est bornée aux chiffres.
 */
function parseMmSs(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  if (trimmed.includes(':')) {
    const [mPart = '', sPart = ''] = trimmed.split(':');
    const m = parseInt(mPart.replace(/[^0-9]/g, ''), 10);
    const s = parseInt(sPart.replace(/[^0-9]/g, ''), 10);
    return (Number.isNaN(m) ? 0 : m) * 60 + (Number.isNaN(s) ? 0 : s);
  }
  const n = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Formate la dernière performance d'un exercice : « 80 kg × 8/8/7 » si toutes les
 * séries ont le même poids, sinon « 80×8, 82.5×8 ». `null` si aucune donnée.
 */
function formatLastPerf(
  perf: { weightKg: number | null; reps: number | null }[],
  units: Units,
): string | null {
  const first = perf[0];
  if (!first) return null;
  const repsLabel = (r: number | null) => (r == null ? '—' : String(r));
  const allSameWeight = perf.every((p) => p.weightKg === first.weightKg);

  if (allSameWeight) {
    const w = first.weightKg;
    const prefix = w == null ? '' : `${units.weightInputValue(w)} ${units.weightSymbol} × `;
    return `${prefix}${perf.map((p) => repsLabel(p.reps)).join('/')}`;
  }
  return perf
    .map((p) => {
      const w = p.weightKg == null ? '' : units.weightInputValue(p.weightKg);
      return w === '' ? repsLabel(p.reps) : `${w}×${repsLabel(p.reps)}`;
    })
    .join(', ');
}

function useElapsed(startedAt: string | undefined): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) return '00:00';
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function WorkoutScreen() {
  useKeepAwake();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const router = useRouter();

  const { workout: active } = useActiveWorkout();
  const { profile } = useProfile();
  const displayLevel = profile?.workoutDisplayLevel ?? 'normal';

  // Tous les hooks sont appelés avant tout retour anticipé (règle des hooks) :
  // `active` peut être null, les dérivés retombent alors sur des valeurs neutres.
  const elapsed = useElapsed(active?.startedAt);
  const sessionRest = useSessionRest(active?.sessionId ?? null);

  const [focusOverride, setFocusOverride] = useState<FocusOverride>(null);
  const [restOverride, setRestOverride] = useState<Record<string, number>>({});
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [restCollapsed, setRestCollapsed] = useState(false);
  // État d'édition rattaché à l'id de la série : dès que la série courante change,
  // il cesse de correspondre et l'affichage repart des valeurs pré-remplies (pas
  // besoin d'effet de resynchronisation).
  const [edit, setEdit] = useState<{ setId: string; state: EditState } | null>(null);
  const [noteEdit, setNoteEdit] = useState<{ exerciseId: string; value: string } | null>(null);
  const [supersetPickerOpen, setSupersetPickerOpen] = useState(false);

  const entries = active?.entries ?? [];
  const current = resolveCurrentSet(entries, focusOverride);
  const currentExerciseId = current?.entry.exerciseId ?? '';

  // Dernière perf de l'exercice courant (requête stable : '' → aucune ligne).
  const lastPerf = useLastPerformance(currentExerciseId);
  // Avant-dernière séance sur cet exercice, difficile ou non (US MUSC-F7 — signal du deload).
  const previousStruggled = usePreviousStruggled(currentExerciseId);
  const { note: currentExerciseNote } = useExerciseNote(currentExerciseId);
  const allExerciseNotes = useExerciseNotes();
  // Paires superset de la séance (requête stable : '' → aucune ligne tant qu'`active` n'est pas résolu).
  const supersetPairs = useSupersetPairs(active?.id ?? '');

  // Décompte du repos : recalcule le restant chaque seconde ; à 0 → vibration + fin.
  useEffect(() => {
    if (restEndsAt === null) return;
    const tick = () => {
      const left = Math.ceil((restEndsAt - Date.now()) / 1000);
      if (left <= 0) {
        Vibration.vibrate();
        setRestEndsAt(null);
        setRestLeft(0);
      } else {
        setRestLeft(left);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [restEndsAt]);

  const currentSetId = current?.set.id;

  if (!active) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('workout.none')}</Text>
          <Button label={t('workout.backHome')} onPress={() => router.replace('/(tabs)')} />
        </View>
      </SafeAreaView>
    );
  }

  const workoutId = active.id;

  // Valeurs pré-remplies (série puis dernière perf au même rang), avant édition.
  const rang = current?.rang ?? 0;
  const prefillReps = current ? (current.set.reps ?? lastPerf[rang]?.reps ?? null) : null;
  const prefillWeightKg = current ? (current.set.weightKg ?? lastPerf[rang]?.weightKg ?? null) : null;
  const prefillDuration = current ? current.set.durationSeconds : null;

  // Suggestion de progression (C3) : basée sur les séries qualifiantes de la
  // dernière séance terminée (déjà filtrées `done=1` par `useLastPerformance`)
  // et la série de référence au même rang. `previousStruggled` (MUSC-F7) active
  // la branche deload : 2 séances d'affilée difficiles sur cet exercice.
  const referenceSet = current ? lastPerf[rang] : undefined;
  const suggestion = current
    ? computeProgressionSuggestion(
        lastPerf.map((p) => ({ setType: p.setType, rpe: p.rpe, done: true })),
        referenceSet,
        { weightIncrementKg: 2.5, durationIncrementSeconds: 10, previousStruggled },
      )
    : null;
  const suggestionLabel = (() => {
    if (!suggestion) return null;
    if (suggestion.kind === 'weightOrReps') {
      // `formatWeight` et non `weightInputValue` : ce libellé est du **texte affiché**, pas le
      // pré-remplissage d'un champ. `weightInputValue` passe par `String(Number(...))`, donc un
      // point décimal — « Essaie 82.5 kg » au milieu d'une app qui écrit « 76,0 kg » partout
      // ailleurs (constaté en recette device du 31/07/2026).
      return t('workout.suggestion.weightOrReps', {
        weight: units.formatWeight(suggestion.weightKg),
        reps: suggestion.reps,
      });
    }
    if (suggestion.kind === 'reps') return t('workout.suggestion.reps', { reps: suggestion.reps });
    if (suggestion.kind === 'deload') {
      return t('workout.suggestion.deload', {
        weight: units.formatWeight(suggestion.weightKg),
      });
    }
    return t('workout.suggestion.duration', { duration: formatMmSs(suggestion.durationSeconds) });
  })();

  // Liaison superset (C3, révision recette 20/07/2026 — lien explicite, choix
  // libre du partenaire, valable pour toute la séance) : soit l'exercice
  // courant est déjà lié à un partenaire (via `supersetPairs`), soit il ne
  // l'est pas mais d'autres exercices restent disponibles pour le lier.
  const partnerExerciseId = current ? supersetPairs[current.entry.exerciseId] : undefined;
  const supersetCandidates = current
    ? entries
        .filter((e) => e.exerciseId !== current.entry.exerciseId)
        .filter((e) => e.sets.some((s) => !s.done))
        .filter((e) => !supersetPairs[e.exerciseId])
        .map((e) => ({ exerciseId: e.exerciseId, exerciseName: e.exerciseName }))
    : [];

  const supersetLink: SupersetLinkState = (() => {
    if (!current) return null;
    if (partnerExerciseId) {
      const partnerEntry = entries.find((e) => e.exerciseId === partnerExerciseId);
      return partnerEntry ? { status: 'linked', partnerName: partnerEntry.exerciseName } : { status: 'orphaned' };
    }
    return supersetCandidates.length > 0 ? { status: 'linkable' } : null;
  })();

  const onRequestLinkSuperset = () => setSupersetPickerOpen(true);

  const onPickSupersetPartner = (partnerId: string) => {
    if (current) void linkSupersetPair(workoutId, current.entry.exerciseId, partnerId);
    setSupersetPickerOpen(false);
  };

  const onUnlinkSuperset = () => {
    if (!current) return;
    void unlinkSupersetPair(workoutId, current.entry.exerciseId);
  };

  // Édition ne valant que pour la série courante (sinon on repart du pré-remplissage).
  const activeEdit = edit && edit.setId === currentSetId ? edit.state : null;

  // Valeurs affichées : l'édition en cours prime, sinon repli sur le pré-remplissage.
  const displayReps = activeEdit ? activeEdit.reps : prefillReps == null ? '' : String(prefillReps);
  const displayWeightKg = activeEdit ? activeEdit.weightKg : prefillWeightKg;
  const displayDurationSeconds = activeEdit ? activeEdit.durationSeconds : prefillDuration;
  const durationValue = formatMmSs(displayDurationSeconds ?? 0);

  // Note d'exercice (C3) : l'édition locale prime, sinon repli sur la valeur persistée.
  const displayNote =
    noteEdit && noteEdit.exerciseId === currentExerciseId ? noteEdit.value : currentExerciseNote ?? '';
  const onChangeNote = (v: string) => setNoteEdit({ exerciseId: currentExerciseId, value: v });
  const onBlurNote = () => {
    if (!currentExerciseId) return;
    void setExerciseNote(currentExerciseId, displayNote);
  };

  // Matérialise l'état d'édition à partir des valeurs affichées puis applique le patch.
  const applyEdit = (patch: Partial<EditState>) => {
    if (!currentSetId) return;
    setEdit({
      setId: currentSetId,
      state: {
        reps: activeEdit?.reps ?? displayReps,
        weightKg: activeEdit ? activeEdit.weightKg : displayWeightKg,
        durationSeconds: activeEdit ? activeEdit.durationSeconds : displayDurationSeconds,
        ...patch,
      },
    });
  };

  const restSecondsFor = (exerciseId: string) =>
    restOverride[exerciseId] ?? sessionRest[exerciseId] ?? DEFAULT_REST_SECONDS;
  const currentRest = current ? restSecondsFor(current.entry.exerciseId) : DEFAULT_REST_SECONDS;

  const onStepRest = (delta: number) => {
    if (!current) return;
    const exerciseId = current.entry.exerciseId;
    setRestOverride((prev) => ({
      ...prev,
      [exerciseId]: Math.max(0, restSecondsFor(exerciseId) + delta),
    }));
  };

  const onSetRest = (seconds: number) => {
    if (!current) return;
    setRestOverride((prev) => ({
      ...prev,
      [current.entry.exerciseId]: Math.max(0, seconds),
    }));
  };

  const onValidate = () => {
    if (!current) return;
    const parsed = Number(displayReps);
    const reps = displayReps.trim() === '' || Number.isNaN(parsed) ? null : parsed;
    // Persistance selon le type : une série à la durée enregistre `durationSeconds`
    // (reps non pertinent → null) ; les autres enregistrent `reps` et laissent
    // `durationSeconds` inchangé pour ne pas écraser une éventuelle valeur.
    const patch: WorkoutSetPatch = { weightKg: displayWeightKg, done: true };
    if (current.set.setType === 'duration') {
      patch.reps = null;
      patch.durationSeconds = displayDurationSeconds;
    } else {
      patch.reps = reps;
    }
    void updateSet(current.set.id, patch);

    // Superset (spec §2.2, lien explicite révisé 20/07/2026) : si l'exercice a
    // un partenaire lié avec une série au même rang pas encore validée, on
    // bascule directement dessus SANS repos. `partner.set.done` reflète l'état
    // de CE rendu (avant la validation en cours, qui ne porte que sur
    // `current.set`) — donc fiable ici même si le `updateSet` ci-dessus est
    // encore en vol côté PowerSync.
    const partner = findSupersetPartnerSet(entries, supersetPairs, current.entry.exerciseId, current.rang);
    if (partner && !partner.set.done) {
      // Cible le RANG exact de la série jumelle (pas la 1ʳᵉ série non validée
      // de l'exercice partenaire, qui pourrait être un échauffement antérieur
      // sans rapport avec le couple superset).
      setFocusOverride({ exerciseId: partner.entry.exerciseId, rang: current.rang });
      return;
    }

    // Comportement standard (2ᵉ série d'un couple superset déjà validée par le
    // partenaire ci-dessus, ou série non-superset / partenaire introuvable —
    // dégradation silencieuse) : repos normal.
    setRestLeft(currentRest); // évite un flash « 0 s » avant le 1er tick
    setRestCollapsed(false); // le repos s'ouvre en plein écran
    setRestEndsAt(Date.now() + currentRest * 1000);
    setFocusOverride(null);
  };

  const confirmAbandon = () => {
    Alert.alert(t('workout.leave.abandonConfirmTitle'), t('workout.leave.abandonConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('workout.leave.abandonConfirm'),
        style: 'destructive',
        onPress: async () => {
          await cancelWorkout(workoutId);
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const onLeave = () => {
    Alert.alert(t('workout.leave.title'), undefined, [
      { text: t('workout.leave.continue'), style: 'cancel' },
      { text: t('workout.leave.pause'), onPress: () => router.replace('/(tabs)') },
      { text: t('workout.leave.abandon'), style: 'destructive', onPress: confirmAbandon },
    ]);
  };

  const doFinish = async () => {
    // 1. Clôture de la séance : doit réussir (statut 'completed').
    await finishWorkout(workoutId);
    // 2. Évaluation des records : enrichissement best-effort. Un échec ne doit
    //    jamais bloquer la navigation (le résumé lit les records de façon réactive).
    //    US MUSC-F8 : le push de record est lui aussi best-effort, dans le même `try` — un
    //    échec du push ne doit pas plus bloquer la navigation qu'un échec de l'évaluation.
    try {
      const beaten = await evaluateWorkoutRecords(workoutId);
      await maybePushRecords(workoutId, beaten);
    } catch (error) {
      console.warn('Échec du calcul des records (ignoré, best-effort) :', error);
    }
    // 3. Navigation vers le résumé, quoi qu'il advienne à l'étape 2.
    router.replace({ pathname: '/workout-summary', params: { id: workoutId } });
  };

  // Gestion des séries en direct depuis la liste dépliée (C1) : dé-validation
  // volontairement sans repos (spec §2.2 — seule la carte focus déclenche le repos).
  const onToggleSetDone = (setId: string, currentDone: boolean) => {
    void updateSet(setId, { done: !currentDone });
  };
  const onRemoveSet = (setId: string) => {
    void removeSet(setId);
  };
  const onAddSet = (exerciseId: string) => {
    void addSet(workoutId, exerciseId);
  };
  const onReorder = (exerciseId: string, direction: 'up' | 'down') => {
    void reorderExercise(workoutId, exerciseId, direction);
  };
  const onSendLater = (exerciseId: string) => {
    void sendExerciseToEnd(workoutId, exerciseId);
  };
  const onReplace = (exerciseId: string) => {
    router.push({ pathname: '/exercises', params: { replaceExerciseId: exerciseId } });
  };

  const hasAnyDone = entries.some((entry) => entry.sets.some((set) => set.done));

  const onFinish = () => {
    if (!hasAnyDone) {
      Alert.alert(t('workout.finishNoSetsTitle'), t('workout.finishNoSetsMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('workout.finishAnyway'), onPress: () => void doFinish() },
      ]);
      return;
    }
    void doFinish();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onLeave} hitSlop={10} accessibilityLabel={t('workout.leave.title')}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.timer, { color: colors.text }]}>{elapsed}</Text>
        <Pressable onPress={onFinish} hitSlop={10}>
          <Text style={[styles.finish, { color: colors.accent }]}>{t('workout.finish')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {entries.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('workout.empty')}</Text>
        ) : current ? (
          <CurrentSetCard
            key={current.set.id}
            level={displayLevel}
            exerciseName={current.entry.exerciseName}
            currentIndex={current.rang + 1}
            totalSets={current.entry.sets.length}
            lastPerfLabel={formatLastPerf(lastPerf, units)}
            suggestionLabel={suggestionLabel}
            note={displayNote}
            onChangeNote={onChangeNote}
            onBlurNote={onBlurNote}
            supersetLink={supersetLink}
            onRequestLinkSuperset={onRequestLinkSuperset}
            onUnlinkSuperset={onUnlinkSuperset}
            setType={current.set.setType}
            onSetType={(tp) => void updateSet(current.set.id, { setType: tp })}
            repsValue={displayReps}
            onChangeReps={(v) => applyEdit({ reps: v })}
            weightValue={units.weightInputValue(displayWeightKg)}
            weightSymbol={units.weightSymbol}
            weightPlaceholder={t(
              units.system === 'imperial' ? 'workout.weightPlaceholderImperial' : 'workout.weightPlaceholderMetric',
            )}
            onChangeWeight={(v) => applyEdit({ weightKg: units.parseWeightToKg(v) })}
            onStepWeight={(deltaKg) => applyEdit({ weightKg: Math.max(0, (displayWeightKg ?? 0) + deltaKg) })}
            plannedWeightKg={current.set.plannedWeightKg}
            durationValue={durationValue}
            onChangeDuration={(v) => applyEdit({ durationSeconds: parseMmSs(v) })}
            onStepDuration={(d) => applyEdit({ durationSeconds: Math.max(0, (displayDurationSeconds ?? 0) + d) })}
            rpe={current.set.rpe}
            onSetRpe={(v) => void updateSet(current.set.id, { rpe: v })}
            restSeconds={currentRest}
            onStepRest={onStepRest}
            onSetRest={onSetRest}
            onValidate={onValidate}
            colors={colors}
          />
        ) : (
          <View style={[styles.doneCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.doneTitle, { color: colors.text }]}>{t('workout.sessionDone')}</Text>
            <Text style={[styles.doneHint, { color: colors.textMuted }]}>{t('workout.sessionDoneHint')}</Text>
          </View>
        )}

        {entries.length > 0 ? (
          <ExerciseList
            entries={entries}
            currentExerciseId={currentExerciseId}
            onSelect={(exerciseId) => setFocusOverride({ exerciseId })}
            onToggleSetDone={onToggleSetDone}
            onRemoveSet={onRemoveSet}
            onAddSet={onAddSet}
            onReorder={onReorder}
            onSendLater={onSendLater}
            onReplace={onReplace}
            exerciseNotes={allExerciseNotes}
            supersetPairs={supersetPairs}
            colors={colors}
          />
        ) : null}

        <Button label={t('workout.addExercise')} onPress={() => router.push('/exercises')} />
      </ScrollView>

      {restEndsAt !== null ? (
        <RestOverlay
          secondsLeft={restLeft}
          collapsed={restCollapsed}
          onSkip={() => setRestEndsAt(null)}
          onExtend={() => setRestEndsAt((e) => (e ?? Date.now()) + 15000)}
          onToggleCollapse={() => setRestCollapsed((c) => !c)}
        />
      ) : null}

      <SupersetPickerModal
        visible={supersetPickerOpen}
        onClose={() => setSupersetPickerOpen(false)}
        candidates={supersetCandidates}
        onPick={onPickSupersetPartner}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  timer: { fontFamily: fontFamily.monoBold, fontSize: 20 },
  finish: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  content: { padding: 20, gap: 16 },
  hint: { fontFamily: fontFamily.body, fontSize: 14, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center' },
  doneCard: { borderRadius: 18, borderWidth: 1, padding: 24, gap: 8, alignItems: 'center' },
  doneTitle: { fontFamily: fontFamily.displaySemi, fontSize: 20, letterSpacing: -0.3 },
  doneHint: { fontFamily: fontFamily.body, fontSize: 14, textAlign: 'center' },
});
