/**
 * Écran de séance en cours — recomposé par l'US MUSCU-UX01 (10/09/2026).
 *
 * ── Ce qui change, et pourquoi ───────────────────────────────────────────────────────────────────
 * L'écran empilait tout dans une seule carte : contexte, saisie, validation. Onze blocs, ~560 px au
 * niveau détaillé, et donc « Valider la série » — répété 30 à 40 fois par séance — en bas de pile,
 * sous le pli, et **sous le clavier** dès qu'on saisissait les reps.
 *
 * La composition est maintenant :
 *   · barre haute  — sortie, chrono, **avancement réel de la séance** (7/18 séries), menu
 *   · scrollable   — `CurrentSetCard` (contexte) puis la liste des exercices
 *   · barre basse  — `SetActionBar`, **fixe** : contexte court, deux champs, validation
 *
 * Trois conséquences voulues :
 *  1. le geste ne bouge jamais, quel que soit le niveau d'affichage (règle R4-1) — ce qui permet
 *     de proposer le réglage de niveau depuis la séance elle-même ;
 *  2. la validation produit enfin un **retour haptique** (spec navigation-ux §4.2, jamais tenue
 *     côté muscu : la seule vibration marquait la fin du repos) ;
 *  3. quand tout est validé, la même barre devient « Terminer la séance » — l'action naît là où le
 *     pouce est déjà, au lieu d'un texte « Séance terminée ? » sans bouton.
 *
 * Le **réglage du repos** a quitté la carte de série, où il occupait une ligne à chaque série alors
 * que c'est un réglage d'exercice : il se pose depuis le menu ou depuis l'écran de repos.
 */

import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { CurrentSetCard, type SetChip, type SupersetLinkState } from '@/components/workout/CurrentSetCard';
import { ExerciseList } from '@/components/workout/ExerciseList';
import { RestOverlay } from '@/components/workout/RestOverlay';
import { SessionMenuSheet } from '@/components/workout/SessionMenuSheet';
import { SetActionBar } from '@/components/workout/SetActionBar';
import { SupersetPickerModal } from '@/components/workout/SupersetPickerModal';
import { ImmersiveWorkout } from '@/components/workout/immersive/ImmersiveWorkout';
import { referenceDayLabel } from '@/components/workout/immersive/day-label';
import { immersivePalette } from '@/components/workout/immersive/theme';
import { useCoachVoice } from '@/components/workout/immersive/useCoachVoice';
import type {
  ImmersiveRuntime,
  SessionFeedback,
  ValidateOverride,
} from '@/components/workout/immersive/types';
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
import { upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import { usePriorWeekAdherence } from '@/data/repositories/planned-session-repository';
import {
  useExerciseBests,
  useSessionCards,
  useSessionMuscles,
  useSessionReferences,
} from '@/data/repositories/immersive-repository';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useIsAppActive } from '@/hooks/useIsAppActive';
import {
  cancelRestReminder,
  dismissRestOngoing,
  presentRestOngoing,
  scheduleRestReminder,
} from '@/lib/notifications';
import { hapticConfirm, hapticMilestone } from '@/lib/haptics';
import { useImmersivePrefs, type ImmersivePrefs } from '@/stores/immersive-prefs-store';
import { useSessionMode } from '@/stores/session-mode-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useActionLock } from '@/hooks/useActionLock';
import { useUnits } from '@/hooks/useUnits';
import {
  applyLiveSet,
  computeProgressionSuggestion,
  computeSetVerdict,
  evaluateLiveRecord,
  feelToRpe,
  pickCoachLine,
  setTonnage,
  type ExerciseBests,
  type LiveRecord,
  type SetFeel,
  type WorkoutDisplayLevel,
} from '@wellness/shared';

/** Repos par défaut (s) quand l'exercice n'a ni override de session ni valeur planifiée. */
const DEFAULT_REST_SECONDS = 90;

/** Durées proposées au réglage rapide du repos (secondes). */
const REST_PRESETS = [60, 90, 120, 180];

/**
 * ── Fonctions pures exportées **pour les tests** ────────────────────────────────────────────────
 * `resolveCurrentSet`, `findSupersetPartnerSet`, `formatMmSs`, `parseMmSs` et `formatLastPerf` sont
 * la vraie substance de cet écran : la machine à états du focus et les formats de saisie. Les
 * atteindre en rendant l'écran demanderait de monter PowerSync, le thème, l'i18n et six hooks de
 * données — pour tester des fonctions qui n'ont besoin d'aucun des six.
 */

/** Série courante résolue : l'exercice, la série et le rang (0-based) dans l'exercice. */
export type CurrentSet = { entry: WorkoutEntry; set: WorkoutEntry['sets'][number]; rang: number };

/**
 * Dérogation de focus : cible un exercice, et optionnellement un rang précis dans cet exercice
 * (superset — bascule sur la série JUMELLE, pas la 1ʳᵉ série non validée de l'exercice partenaire,
 * qui pourrait être un échauffement antérieur non lié au couple).
 */
export type FocusOverride = { exerciseId: string; rang?: number } | null;

/**
 * Résout la « série en cours » (machine à états de focus) :
 *  - si `focusOverride.rang` cible une série précise (non validée) de l'exercice désigné, cette
 *    série exactement (bascule superset) ;
 *  - sinon, si `focusOverride` désigne un exercice ayant encore une série non validée, la 1ʳᵉ
 *    série non validée de CET exercice ;
 *  - sinon la 1ʳᵉ série `done===false` en parcourant exercices puis séries dans l'ordre ;
 *  - `null` si toutes les séries de tous les exercices sont validées (état de fin).
 */
export function resolveCurrentSet(
  entries: WorkoutEntry[],
  focusOverride: FocusOverride,
): CurrentSet | null {
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
 * Cherche la série JUMELLE (même rang) de l'exercice lié en superset à `exerciseId` — lien
 * EXPLICITE (table `workout_superset_pairs`), sans contrainte d'adjacence (révision recette
 * 20/07/2026). `null` si l'exercice n'est lié à personne, si le partenaire n'a pas de série à ce
 * rang, ou s'il a quitté la séance (dégradation silencieuse — repos normal dans tous ces cas).
 */
export function findSupersetPartnerSet(
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
export function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

/**
 * Parse une durée saisie en secondes, tolérant : « 90 » → 90, « 1:30 » → 90, champ vide → `null`.
 */
export function parseMmSs(input: string): number | null {
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
 * Formate la dernière performance d'un exercice : « 80 kg × 8/8/7 » si toutes les séries ont le
 * même poids, sinon « 80×8, 82.5×8 ». `null` si aucune donnée.
 */
export function formatLastPerf(
  perf: { weightKg: number | null; reps: number | null }[],
  units: Pick<Units, 'weightInputValue' | 'weightSymbol'>,
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

  // Le clavier se superpose à l'écran depuis que l'edge-to-edge est forcé (SDK 54+) : `adjustResize`
  // est toujours au manifeste mais ne redimensionne plus rien. Sans ce décalage, la barre de saisie
  // passe SOUS le clavier — on tape une charge sans voir ce qu'on tape (recette §57.19).
  const keyboardHeight = useKeyboardHeight();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const router = useRouter();
  // `plan=1` : arrivée depuis « Modifier avant de commencer » (brief, US MUSCU-UX03).
  const { plan: openPlanParam } = useLocalSearchParams<{ plan?: string }>();

  const { workout: active } = useActiveWorkout();
  const { profile } = useProfile();
  const displayLevel: WorkoutDisplayLevel = profile?.workoutDisplayLevel ?? 'normal';

  // Tous les hooks sont appelés avant tout retour anticipé (règle des hooks) : `active` peut être
  // null, les dérivés retombent alors sur des valeurs neutres.
  const elapsed = useElapsed(active?.startedAt);
  const sessionRest = useSessionRest(active?.sessionId ?? null);

  const [focusOverride, setFocusOverride] = useState<FocusOverride>(null);
  const [restOverride, setRestOverride] = useState<Record<string, number>>({});
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  // Durée totale du repos **en cours** — dénominateur de l'anneau (MOTION-01 · M3). Distinct du
  // réglage durable de l'exercice (`currentRest`) : « + 15 s » allonge celui-ci sans toucher à
  // celui-là, et l'anneau doit suivre la durée réellement lancée, pas la durée configurée.
  const [restTotal, setRestTotal] = useState(0);
  const [restLeft, setRestLeft] = useState(0);
  const [restCollapsed, setRestCollapsed] = useState(false);
  // État d'édition rattaché à l'id de la série : dès que la série courante change, il cesse de
  // correspondre et l'affichage repart des valeurs pré-remplies (pas d'effet de resynchro).
  const [edit, setEdit] = useState<{ setId: string; state: EditState } | null>(null);
  const [noteEdit, setNoteEdit] = useState<{ exerciseId: string; value: string } | null>(null);
  const [supersetPickerOpen, setSupersetPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lockFinish = useActionLock();

  const entries = active?.entries ?? [];
  const current = resolveCurrentSet(entries, focusOverride);
  const currentExerciseId = current?.entry.exerciseId ?? '';

  const lastPerf = useLastPerformance(currentExerciseId);
  const previousStruggled = usePreviousStruggled(currentExerciseId);
  const priorWeekAdherenceOk = usePriorWeekAdherence(
    active?.programId ?? null,
    active?.weekIndex ?? null,
  );
  const { note: currentExerciseNote } = useExerciseNote(currentExerciseId);
  const allExerciseNotes = useExerciseNotes();
  const supersetPairs = useSupersetPairs(active?.id ?? '');

  // ── Mode immersif (US MUSCU-UX03) ────────────────────────────────────────────────────────────
  // Tout l'état de séance reste **ici** : le mode ne change que le rendu. C'est ce qui permet de
  // basculer classique ↔ immersif en pleine séance sans rien perdre (spec R-MO-4).
  const sessionMode = useSessionMode((s) => s.mode);
  // Le store étale les réglages à sa racine (une clé JSON, huit champs) : on le relit en entier et
  // on reconstitue l'objet que les composants attendent.
  const prefsStore = useImmersivePrefs();
  const immersivePrefs: ImmersivePrefs = {
    coach: prefsStore.coach,
    tempo: prefsStore.tempo,
    breathing: prefsStore.breathing,
    ghost: prefsStore.ghost,
    sleep: prefsStore.sleep,
    barKg: prefsStore.barKg,
    restNotificationImmersive: prefsStore.restNotificationImmersive,
    restNotificationClassic: prefsStore.restNotificationClassic,
  };
  const immersive = sessionMode === 'immersive';

  const exerciseIds = entries.map((entry) => entry.exerciseId);
  const references = useSessionReferences(exerciseIds);
  const storedBests = useExerciseBests(exerciseIds);
  const sessionMuscles = useSessionMuscles(exerciseIds);
  const sessionCards = useSessionCards(exerciseIds);
  const speak = useCoachVoice(immersive && immersivePrefs.coach !== 'muet');

  const [feedback, setFeedback] = useState<SessionFeedback | null>(null);
  /**
   * Meilleures valeurs **battues pendant la séance**, par-dessus celles lues en base. Sans ce
   * cumul, deux séries de plus en plus lourdes annonceraient toutes les deux un record.
   */
  const [liveBests, setLiveBests] = useState<Record<string, ExerciseBests>>({});
  const [recordsCount, setRecordsCount] = useState(0);
  /** Le plein écran de record ne se joue qu'**une fois par séance** (spec §5.4). */
  const [takeoverUsed, setTakeoverUsed] = useState(false);
  /**
   * Le seul ajout du mode **classique** (décision D3) : une pastille de record pendant le repos.
   * Apprendre un record à la clôture, une demi-heure plus tard, c'est l'apprendre trop tard — et
   * c'est vrai quel que soit le mode. Tout le reste de l'immersif reste hors du classique.
   */
  const [classicRecord, setClassicRecord] = useState<LiveRecord | null>(null);

  // Décompte du repos : recalcule le restant chaque seconde ; à 0 → retour haptique + fin.
  useEffect(() => {
    if (restEndsAt === null) return;
    const tick = () => {
      const left = Math.ceil((restEndsAt - Date.now()) / 1000);
      if (left <= 0) {
        hapticMilestone();
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

  /**
   * Le rappel de fin de repos — US MUSCU-UX03, spec §5.15.
   *
   * Piloté par l'échéance et non par la validation : à ce moment-là, `current` désigne déjà la
   * série **suivante**, donc la notification peut annoncer ce qui vient (« 82,5 kg × 7 »). Toute
   * modification du repos (prolongé, passé, terminé) change `restEndsAt` et **replanifie**.
   *
   * Le réglage diffère par mode : activé en immersif, désactivé en classique. Et comme un repos
   * est lancé par l'utilisateur lui-même, cette notification est **hors quota** (le plafond de 3
   * rappels quotidiens protège des notifications non sollicitées, ce qui n'est pas le cas ici).
   */
  const restReminderOn = immersive
    ? immersivePrefs.restNotificationImmersive
    : immersivePrefs.restNotificationClassic;
  const nextLabelForReminder = current
    ? `${current.entry.exerciseName} · ${
        current.set.setType === 'duration'
          ? formatMmSs(current.set.durationSeconds ?? 0)
          : `${units.formatWeight(current.set.weightKg)} × ${current.set.reps ?? '—'}`
      }`
    : null;

  useEffect(() => {
    if (restEndsAt === null || !restReminderOn) {
      void cancelRestReminder();
      return;
    }
    void scheduleRestReminder({
      at: new Date(restEndsAt),
      title: t('immersive.notification.restOverTitle'),
      body: nextLabelForReminder ?? t('immersive.notification.restOverBodyEnd'),
    });
    return () => {
      void cancelRestReminder();
    };
  }, [restEndsAt, restReminderOn, nextLabelForReminder, t]);

  /**
   * La notification **continue** du repos : elle n'existe que quand l'app est en arrière-plan —
   * c'est-à-dire exactement quand l'écran de repos ne peut plus rien dire. Au premier plan, elle
   * ferait doublon avec l'anneau. Retirée dès le retour, et dès la fin du repos.
   */
  const appActive = useIsAppActive();
  useEffect(() => {
    if (restEndsAt === null || appActive || !restReminderOn) {
      void dismissRestOngoing();
      return;
    }
    const until = new Date(restEndsAt).toLocaleTimeString(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
    });
    void presentRestOngoing({
      title: t('immersive.notification.ongoingTitle', { time: until }),
      body: nextLabelForReminder ?? t('immersive.notification.restOverBodyEnd'),
    });
  }, [appActive, restEndsAt, restReminderOn, nextLabelForReminder, i18n.language, t]);

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

  // ── Avancement réel de la séance — absent de l'écran jusqu'ici ────────────────────────────
  const totalSets = entries.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const progressRatio = totalSets > 0 ? doneSets / totalSets : 0;

  // Valeurs pré-remplies (série puis dernière perf au même rang), avant édition.
  const rang = current?.rang ?? 0;
  const prefillReps = current ? (current.set.reps ?? lastPerf[rang]?.reps ?? null) : null;
  const prefillWeightKg = current ? (current.set.weightKg ?? lastPerf[rang]?.weightKg ?? null) : null;
  const prefillDuration = current ? current.set.durationSeconds : null;

  // Suggestion de progression : basée sur les séries qualifiantes de la dernière séance terminée
  // et la série de référence au même rang. `previousStruggled` (MUSC-F7) active la branche deload.
  const referenceSet = current ? lastPerf[rang] : undefined;
  const suggestion = current
    ? computeProgressionSuggestion(
        lastPerf.map((p) => ({ setType: p.setType, rpe: p.rpe, done: true })),
        referenceSet,
        {
          weightIncrementKg: 2.5,
          durationIncrementSeconds: 10,
          previousStruggled,
          priorWeekAdherenceOk: priorWeekAdherenceOk ?? undefined,
        },
      )
    : null;
  const suggestionLabel = (() => {
    if (!suggestion) return null;
    if (suggestion.kind === 'weightOrReps') {
      // `formatWeight` et non `weightInputValue` : ce libellé est du **texte affiché**, pas le
      // pré-remplissage d'un champ — « 82.5 kg » au milieu d'une app qui écrit « 76,0 kg ».
      return t('workout.suggestion.weightOrReps', {
        weight: units.formatWeight(suggestion.weightKg),
        reps: suggestion.reps,
      });
    }
    if (suggestion.kind === 'reps') return t('workout.suggestion.reps', { reps: suggestion.reps });
    if (suggestion.kind === 'weightHold') {
      return t('workout.suggestion.weightHold', {
        weight: units.formatWeight(suggestion.weightKg),
        reps: suggestion.reps,
      });
    }
    if (suggestion.kind === 'deload') {
      return t('workout.suggestion.deload', { weight: units.formatWeight(suggestion.weightKg) });
    }
    return t('workout.suggestion.duration', { duration: formatMmSs(suggestion.durationSeconds) });
  })();

  // Liaison superset (lien explicite, choix libre du partenaire, valable pour toute la séance).
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
      return partnerEntry
        ? { status: 'linked', partnerName: partnerEntry.exerciseName }
        : { status: 'orphaned' };
    }
    return supersetCandidates.length > 0 ? { status: 'linkable' } : null;
  })();

  const onPickSupersetPartner = (partnerId: string) => {
    if (current) void linkSupersetPair(workoutId, current.entry.exerciseId, partnerId);
    setSupersetPickerOpen(false);
  };

  // Édition ne valant que pour la série courante (sinon on repart du pré-remplissage).
  const activeEdit = edit && edit.setId === currentSetId ? edit.state : null;

  const displayReps = activeEdit ? activeEdit.reps : prefillReps == null ? '' : String(prefillReps);
  const displayWeightKg = activeEdit ? activeEdit.weightKg : prefillWeightKg;
  const displayDurationSeconds = activeEdit ? activeEdit.durationSeconds : prefillDuration;
  const durationValue = formatMmSs(displayDurationSeconds ?? 0);

  const displayNote =
    noteEdit && noteEdit.exerciseId === currentExerciseId ? noteEdit.value : currentExerciseNote ?? '';
  const onChangeNote = (v: string) => setNoteEdit({ exerciseId: currentExerciseId, value: v });
  const onBlurNote = () => {
    if (!currentExerciseId) return;
    void setExerciseNote(currentExerciseId, displayNote);
  };

  /** Matérialise l'état d'édition à partir des valeurs affichées puis applique le patch. */
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

  const onSetRest = (seconds: number) => {
    if (!current) return;
    setRestOverride((prev) => ({ ...prev, [current.entry.exerciseId]: Math.max(0, seconds) }));
  };

  /** Vrai quand l'exercice se charge sur une barre : c'est le seul cas où des disques existent. */
  const showBarbellFor = (exerciseId: string) =>
    sessionCards[exerciseId]?.equipment === 'barbell';

  /** Réglage rapide du repos — ouvert depuis le menu ou l'écran de repos. */
  const openRestPicker = () => {
    Alert.alert(t('workout.menu.rest'), t('workout.restPickerMessage'), [
      ...REST_PRESETS.map((seconds) => ({
        text: t('workout.restSeconds', { count: seconds }),
        onPress: () => onSetRest(seconds),
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  /**
   * Valide la série courante.
   *
   * `override` n'est passé que par le **cadran** du mode immersif, qui valide avec ses propres
   * chiffres (reps comptées, durée mesurée, ressenti). Sans lui, le comportement est **exactement**
   * celui d'avant : les valeurs des champs, telles quelles.
   */
  const onValidate = (override?: ValidateOverride) => {
    if (!current) return;
    const parsed = Number(displayReps);
    const typedReps = displayReps.trim() === '' || Number.isNaN(parsed) ? null : parsed;
    const reps = override?.reps !== undefined ? override.reps : typedReps;
    const weightKg = override?.weightKg !== undefined ? override.weightKg : displayWeightKg;
    const durationSeconds =
      override?.durationSeconds !== undefined ? override.durationSeconds : displayDurationSeconds;
    const feel: SetFeel | null = override?.feel ?? null;

    // Persistance selon le type : une série à la durée enregistre `durationSeconds` (reps non
    // pertinent → null) ; les autres enregistrent `reps` et laissent `durationSeconds` inchangé.
    const patch: WorkoutSetPatch = { weightKg, done: true };
    if (current.set.setType === 'duration') {
      patch.reps = null;
      patch.durationSeconds = durationSeconds;
    } else {
      patch.reps = reps;
    }
    // Le ressenti s'écrit dans la colonne `rpe` **existante** — aucune migration, et l'historique,
    // la progression et le deload de MUSC-F7 continuent de le lire comme avant.
    // ⚠️ « Solide » vaut 7, jamais 8 : voir `packages/shared/src/set-feel.ts`.
    if (feel) patch.rpe = feelToRpe(feel);
    void updateSet(current.set.id, patch);

    // Le retour que la spec navigation-ux §4.2 demandait sans qu'il existe : discret, parce qu'il
    // se répète 30 à 40 fois dans l'heure.
    hapticConfirm();

    // Les records en direct valent pour **les deux modes** : le classique n'en fait qu'une
    // pastille discrète au repos (décision D3), l'immersif en fait une célébration.
    const record = evaluateRecord({ reps, weightKg });
    if (immersive) buildFeedback({ reps, weightKg, durationSeconds, feel }, record);
    else setClassicRecord(record);

    // Superset : si l'exercice a un partenaire lié avec une série au même rang pas encore validée,
    // on bascule directement dessus SANS repos. `partner.set.done` reflète l'état de CE rendu
    // (avant la validation en cours), donc fiable même si `updateSet` est encore en vol.
    const partner = findSupersetPartnerSet(
      entries,
      supersetPairs,
      current.entry.exerciseId,
      current.rang,
    );
    if (partner && !partner.set.done) {
      setFocusOverride({ exerciseId: partner.entry.exerciseId, rang: current.rang });
      return;
    }

    setRestLeft(currentRest); // évite un flash « 0 s » avant le 1er tick
    setRestCollapsed(false);
    // Forme fonctionnelle : `Date.now()` lu à l'application de la mise à jour, pas pendant le
    // rendu (règle `react-hooks/purity`). Même patron que « Prolonger » plus bas.
    setRestEndsAt(() => Date.now() + currentRest * 1000);
    setRestTotal(currentRest);
    setFocusOverride(null);
  };

  /**
   * Le record que cette série vient de battre, ou `null` — **et rien n'est écrit** : les lignes
   * `personal_records` restent produites à la clôture par `evaluateWorkoutRecords`, seule source.
   *
   * Les meilleures valeurs battues **pendant** la séance priment sur celles de la base : sans ce
   * cumul, deux séries de plus en plus lourdes annonceraient toutes les deux « plus lourd que
   * jamais ».
   */
  const evaluateRecord = (values: { reps: number | null; weightKg: number | null }) => {
    if (!current) return null;
    const exerciseId = current.entry.exerciseId;
    const bests = liveBests[exerciseId] ??
      storedBests[exerciseId] ?? { maxWeightKg: null, estimated1rm: null };
    const liveSet = {
      setType: current.set.setType,
      reps: values.reps,
      weightKg: values.weightKg,
      done: true,
    };
    const record = evaluateLiveRecord(liveSet, bests);
    setLiveBests((previous) => ({ ...previous, [exerciseId]: applyLiveSet(bests, liveSet) }));
    if (record) {
      setRecordsCount((n) => n + 1);
      hapticMilestone();
    }
    return record;
  };

  // ── Ce que la validation produit en mode immersif (verdict, coach, ajustement) ───────────────
  /**
   * Construit le retour affiché pendant le repos. Tout est calculé **en mémoire**, à partir des
   * références lues une fois au lancement : rien n'est écrit, donc dé-valider une série et la
   * revalider recalcule proprement, sans ligne parasite.
   */
  const buildFeedback = (
    values: {
      reps: number | null;
      weightKg: number | null;
      durationSeconds: number | null;
      feel: SetFeel | null;
    },
    record: ReturnType<typeof evaluateRecord>,
  ) => {
    if (!current) return;
    const exerciseId = current.entry.exerciseId;
    const reference = references[exerciseId];
    const referenceSetAtRank = reference?.sets[current.rang] ?? null;

    const verdict = computeSetVerdict({
      current: {
        setType: current.set.setType,
        reps: values.reps,
        weightKg: values.weightKg,
        durationSeconds: values.durationSeconds,
      },
      reference: referenceSetAtRank
        ? {
            setType: referenceSetAtRank.setType,
            reps: referenceSetAtRank.reps,
            weightKg: referenceSetAtRank.weightKg,
            durationSeconds: referenceSetAtRank.durationSeconds ?? null,
          }
        : null,
      finishedAt: reference?.finishedAt ?? null,
    });

    const takeover = Boolean(record && record.type === 'max_weight' && !takeoverUsed);
    if (takeover) {
      setTakeoverUsed(true);
      // Vibration double pour la seule célébration plein écran de la séance.
      setTimeout(hapticMilestone, 180);
    }

    // Exercice bouclé : cette série était-elle la dernière non validée de son exercice ?
    const remaining = current.entry.sets.filter((set, rank) => !set.done && rank !== current.rang);
    const exerciseDone =
      remaining.length === 0
        ? (() => {
            const tonnageToday =
              current.entry.sets.reduce(
                (total, set, rank) =>
                  total +
                  (rank === current.rang
                    ? setTonnage({
                        setType: current.set.setType,
                        reps: values.reps,
                        weightKg: values.weightKg,
                      })
                    : set.done
                      ? setTonnage(set)
                      : 0),
                0,
              ) ?? 0;
            const tonnageBefore = (reference?.sets ?? []).reduce(
              (total, set) => total + setTonnage(set),
              0,
            );
            return {
              name: current.entry.exerciseName,
              sets: current.entry.sets.filter((set, rank) => set.done || rank === current.rang).length,
              tonnage: tonnageToday,
              deltaPercent:
                tonnageBefore > 0
                  ? ((tonnageToday - tonnageBefore) / tonnageBefore) * 100
                  : null,
              records: record ? 1 : 0,
            };
          })()
        : null;

    // Ajustement : proposition, jamais décision (spec §5.8).
    const nextSet = current.entry.sets[current.rang + 1];
    const step = units.system === 'imperial' ? 2.26796 : 2.5;
    const adjust =
      nextSet &&
      !nextSet.done &&
      current.set.setType !== 'warmup' &&
      values.weightKg !== null &&
      (values.feel === 'limite' || values.feel === 'facile')
        ? (() => {
            const direction = values.feel === 'limite' ? ('down' as const) : ('up' as const);
            const target =
              direction === 'down'
                ? Math.round((values.weightKg! - step) * 100) / 100
                : Math.round((values.weightKg! + step) * 100) / 100;
            // Jamais sous la barre à vide, jamais sous zéro.
            const floor = showBarbellFor(exerciseId) ? immersivePrefs.barKg : 0;
            return target > floor ? { weightKg: target, direction } : null;
          })()
        : null;

    // Une réplique, par ordre d'importance : un record écrase un bilan d'exercice, qui écrase un
    // verdict de série. Un échauffement ne mérite aucune des trois.
    const coachEvent = record ? 'record' : exerciseDone ? 'exerciseDone' : 'verdict';
    const coachVariant = record
      ? record.type === 'max_weight'
        ? 'maxWeight'
        : 'estimated1rm'
      : exerciseDone
        ? null
        : verdict.kind;
    const coach = verdict.kind === 'warmup' && !record ? null : pickCoachLine({
      event: coachEvent,
      character: immersivePrefs.coach,
      variant: coachVariant,
      vars: {
        weight: units.formatWeight(values.weightKg ?? 0),
        reps: values.reps ?? 0,
        delta: units.formatWeight(Math.abs(verdict.deltaKg ?? 0)),
        count: Math.abs(verdict.deltaReps ?? 0),
        day: referenceDayLabel(reference?.finishedAt, verdict.dayKind, i18n.language) ?? '',
        exercise: current.entry.exerciseName,
      },
    });
    speak(coach);

    setFeedback({
      doneLabel:
        current.set.setType === 'duration'
          ? formatMmSs(values.durationSeconds ?? 0)
          : `${units.formatWeight(values.weightKg)} × ${values.reps ?? '—'}`,
      setIndex: current.rang + 1,
      verdict,
      dayLabel: referenceDayLabel(reference?.finishedAt, verdict.dayKind, i18n.language),
      record,
      takeover,
      exerciseName: current.entry.exerciseName,
      exerciseDone,
      adjust,
      coach,
    });
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

  /**
   * Quitter sans abandonner. Aucune confirmation : MUSC-F6 pose que la séance reste `active` et
   * reprenable jusqu'à la clôture automatique à 3 h — il n'y a rien à perdre, donc rien à confirmer.
   */
  const onLeave = () => router.replace('/(tabs)/strength');

  // Verrou de clôture — sans lui, deux appuis rapides tombent dans le même cycle de rendu :
  // la séance était clôturée deux fois, les records réévalués deux fois (donc deux notifications
  // identiques possibles) et la navigation jouée deux fois. Voir `useActionLock`.
  /**
   * @param navigate Faux en mode immersif : la **cérémonie de fin** occupe l'écran pendant que la
   *   clôture et l'évaluation des records travaillent, et c'est « Voir le bilan » qui navigue
   *   (spec MUSCU-UX03 §5.13). En classique, rien ne change : on part au résumé.
   */
  const doFinish = (navigate = true) =>
    void lockFinish(async () => {
      void cancelRestReminder();
      void dismissRestOngoing();
      // 1. Clôture de la séance : doit réussir (statut 'completed').
      await finishWorkout(workoutId);
      // 2. Records : enrichissement best-effort. Un échec ne doit jamais bloquer la navigation.
      try {
        const beaten = await evaluateWorkoutRecords(workoutId);
        await maybePushRecords(workoutId, beaten);
      } catch (error) {
        console.warn('Échec du calcul des records (ignoré, best-effort) :', error);
      }
      // 3. Navigation vers le résumé, quoi qu'il advienne à l'étape 2.
      if (navigate) router.replace({ pathname: '/workout-summary', params: { id: workoutId } });
    });

  const hasAnyDone = entries.some((entry) => entry.sets.some((set) => set.done));

  const onFinish = () => {
    if (!hasAnyDone) {
      Alert.alert(t('workout.finishNoSetsTitle'), t('workout.finishNoSetsMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('workout.finishAnyway'), onPress: () => doFinish() },
      ]);
      return;
    }
    hapticMilestone();
    // En immersif, la cérémonie prend l'écran : elle navigue elle-même, une fois lue.
    doFinish(!immersive);
  };

  // Gestion des séries depuis la liste (dé-validation volontairement sans repos : seule la barre
  // d'action déclenche le repos).
  const onToggleSetDone = (setId: string, currentDone: boolean) => {
    void updateSet(setId, { done: !currentDone });
  };

  /** Frise des séries de l'exercice courant, pour la carte de contexte. */
  const currentSetChips: SetChip[] = current
    ? current.entry.sets.map((set) => ({
        id: set.id,
        done: set.done,
        label: set.done
          ? set.setType === 'duration'
            ? formatMmSs(set.durationSeconds ?? 0)
            : `${units.weightInputValue(set.weightKg)}×${set.reps ?? '—'}`
          : null,
      }))
    : [];

  const plannedLabel =
    current?.set.plannedWeightKg != null
      ? `${units.weightInputValue(current.set.plannedWeightKg)} ${units.weightSymbol}`
      : null;
  const deltaRounded =
    current?.set.plannedWeightKg != null && displayWeightKg != null
      ? Math.round((displayWeightKg - current.set.plannedWeightKg) * 10) / 10
      : null;
  const deltaLabel =
    deltaRounded == null
      ? null
      : deltaRounded === 0
        ? '='
        : `${deltaRounded > 0 ? '▲ +' : '▼ −'}${Math.abs(deltaRounded)}`;

  const chainsToSuperset = current
    ? Boolean(
        findSupersetPartnerSet(entries, supersetPairs, current.entry.exerciseId, current.rang)
          ?.set.done === false,
      )
    : false;

  // ── Le rendu immersif ────────────────────────────────────────────────────────────────────────
  // Il ne lit ni n'écrit rien : il reçoit **l'état de cet écran** et le met en scène. C'est ce qui
  // permet de basculer de mode en pleine séance sans perdre une valeur, et ce qui garantit que le
  // mode classique — tout ce qui suit — reste strictement inchangé.
  if (immersive) {
    const runtime: ImmersiveRuntime = {
      workoutId,
      entries,
      current,
      currentExerciseId,
      level: displayLevel,
      colors: immersivePalette,
      units,

      elapsed,
      totalSets,
      doneSets,

      displayReps,
      displayWeightKg,
      displayDurationSeconds,
      durationValue,
      applyEdit,

      setChips: currentSetChips,
      lastPerfLabel: formatLastPerf(lastPerf, units),
      suggestionLabel,
      plannedLabel,
      deltaLabel,
      deltaPositive: (deltaRounded ?? 0) >= 0,
      currentSetType: current?.set.setType ?? 'normal',
      onSetType: (type) => {
        if (current) void updateSet(current.set.id, { setType: type });
      },
      rpe: current?.set.rpe ?? null,
      onSetRpe: (value) => {
        if (current) void updateSet(current.set.id, { rpe: value });
      },
      note: displayNote,
      onChangeNote,
      onBlurNote,
      supersetLink,
      chainsToSuperset,
      onRequestLinkSuperset: () => setSupersetPickerOpen(true),
      onUnlinkSuperset: () => {
        if (current) void unlinkSupersetPair(workoutId, current.entry.exerciseId);
      },

      onValidate,
      onFinish,
      onLeave,
      onOpenMenu: () => setMenuOpen(true),
      onAddSet: (exerciseId) => void addSet(workoutId, exerciseId),
      onSelectExercise: (exerciseId) => setFocusOverride({ exerciseId }),
      onToggleSetDone,
      onRemoveSet: (setId) => void removeSet(setId),
      onReorder: (exerciseId, direction) => void reorderExercise(workoutId, exerciseId, direction),
      onSendLater: (exerciseId) => void sendExerciseToEnd(workoutId, exerciseId),
      onReplace: (exerciseId) =>
        router.push({ pathname: '/exercises', params: { replaceExerciseId: exerciseId } }),
      onAddExercise: () => router.push('/exercises'),
      exerciseNotes: allExerciseNotes,
      supersetPairs,

      rest: {
        active: restEndsAt !== null,
        secondsLeft: restLeft,
        totalSeconds: restTotal,
        restSeconds: currentRest,
        collapsed: restCollapsed,
        onToggleCollapse: () => setRestCollapsed((collapsed) => !collapsed),
        onSkip: () => setRestEndsAt(null),
        onExtend: () => {
          setRestEndsAt((end) => (end ?? Date.now()) + 15000);
          setRestTotal((total) => total + 15);
        },
        onChangeRest: onSetRest,
      },

      references,
      bests: { ...storedBests, ...liveBests },
      muscles: sessionMuscles,
      feedback,
      recordsCount,
      prefs: immersivePrefs,
      speak,
      onAcceptAdjust: () => {
        // « Proposition, jamais décision » : accepter ne fait que **pré-remplir** la série
        // suivante. Rien n'est écrit en base tant qu'elle n'est pas validée.
        if (feedback?.adjust && currentSetId) {
          applyEdit({ weightKg: feedback.adjust.weightKg });
        }
        setFeedback((previous) => (previous ? { ...previous, adjust: null } : previous));
      },
      onDismissAdjust: () =>
        setFeedback((previous) => (previous ? { ...previous, adjust: null } : previous)),
      onDismissTakeover: () =>
        setFeedback((previous) => (previous ? { ...previous, takeover: false } : previous)),
      showBarbell: Boolean(current && showBarbellFor(current.entry.exerciseId)),
      cue: current ? (sessionCards[current.entry.exerciseId]?.cue ?? null) : null,
      openPlanOnMount: openPlanParam === '1',
      goToSummary: () =>
        router.replace({ pathname: '/workout-summary', params: { id: workoutId } }),
    };

    return (
      <>
        <ImmersiveWorkout runtime={runtime} />
        <SupersetPickerModal
          visible={supersetPickerOpen}
          onClose={() => setSupersetPickerOpen(false)}
          candidates={supersetCandidates}
          onPick={onPickSupersetPartner}
          colors={immersivePalette}
        />
        <SessionMenuSheet
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          level={displayLevel}
          onChangeLevel={(lvl) => void upsertProfile({ workoutDisplayLevel: lvl })}
          mode={sessionMode}
          onChangeMode={(next) => void useSessionMode.getState().setMode(next)}
          restSeconds={currentRest}
          onOpenRest={openRestPicker}
          onAddExercise={() => router.push('/exercises')}
          onFinish={onFinish}
          onLeave={onLeave}
          onAbandon={confirmAbandon}
          colors={immersivePalette}
        />
      </>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: colors.background },
        // `additive` : l'inset de safe-area s'AJOUTE au padding du style. On coupe donc l'arête
        // basse quand le clavier est là, sinon la barre flotterait à `inset + clavier` du bord.
        keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null,
      ]}
      edges={keyboardHeight > 0 ? ['top'] : ['top', 'bottom']}
    >
      {/* ── Barre haute : sortie, chrono, avancement, menu ─────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={onLeave} hitSlop={10} accessibilityLabel={t('workout.leave.later')}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={[styles.timer, { color: colors.text }]}>{elapsed}</Text>
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={10}
            accessibilityLabel={t('workout.menu.title')}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
          </Pressable>
        </View>
        {/* L'avancement réel : l'écran disait le rang dans l'exercice, jamais où on en était
            dans la séance. */}
        {totalSets > 0 ? (
          <View style={styles.progressRow}>
            <View
              style={[styles.progressTrack, { backgroundColor: colors.track }]}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: totalSets, now: doneSets }}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(progressRatio * 100)}%`,
                    backgroundColor: doneSets === totalSets ? colors.success : colors.accent,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.progressLabel,
                { color: doneSets === totalSets ? colors.success : colors.textMuted },
              ]}
            >
              {t('workout.setsProgress', { done: doneSets, total: totalSets })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Zone scrollable : le contexte, jamais l'action ─────────────────────────────────── */}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {entries.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('workout.empty')}</Text>
        ) : current ? (
          <CurrentSetCard
            key={current.entry.exerciseId}
            level={displayLevel}
            exerciseName={current.entry.exerciseName}
            sets={currentSetChips}
            currentRang={current.rang}
            restSeconds={currentRest}
            lastPerfLabel={formatLastPerf(lastPerf, units)}
            suggestionLabel={suggestionLabel}
            plannedLabel={plannedLabel}
            deltaLabel={deltaLabel}
            deltaPositive={(deltaRounded ?? 0) >= 0}
            setType={current.set.setType}
            onSetType={(tp) => void updateSet(current.set.id, { setType: tp })}
            rpe={current.set.rpe}
            onSetRpe={(v) => void updateSet(current.set.id, { rpe: v })}
            note={displayNote}
            onChangeNote={onChangeNote}
            onBlurNote={onBlurNote}
            supersetLink={supersetLink}
            onRequestLinkSuperset={() => setSupersetPickerOpen(true)}
            onUnlinkSuperset={() => {
              if (current) void unlinkSupersetPair(workoutId, current.entry.exerciseId);
            }}
            onAddSet={() => void addSet(workoutId, current.entry.exerciseId)}
            colors={colors}
          />
        ) : (
          <View
            style={[styles.doneCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.doneIcon, { backgroundColor: `${colors.success}29` }]}>
              <Ionicons name="checkmark" size={26} color={colors.success} />
            </View>
            <Text style={[styles.doneTitle, { color: colors.text }]}>
              {t('workout.sessionDone')}
            </Text>
            <Text style={[styles.doneHint, { color: colors.textMuted }]}>
              {t('workout.sessionDoneHint')}
            </Text>
          </View>
        )}

        {entries.length > 0 ? (
          <ExerciseList
            entries={entries}
            currentExerciseId={currentExerciseId}
            onSelect={(exerciseId) => setFocusOverride({ exerciseId })}
            onToggleSetDone={onToggleSetDone}
            onRemoveSet={(setId) => void removeSet(setId)}
            onAddSet={(exerciseId) => void addSet(workoutId, exerciseId)}
            onReorder={(exerciseId, direction) =>
              void reorderExercise(workoutId, exerciseId, direction)
            }
            onSendLater={(exerciseId) => void sendExerciseToEnd(workoutId, exerciseId)}
            onReplace={(exerciseId) =>
              router.push({ pathname: '/exercises', params: { replaceExerciseId: exerciseId } })
            }
            exerciseNotes={allExerciseNotes}
            supersetPairs={supersetPairs}
            colors={colors}
          />
        ) : null}
      </ScrollView>

      {/* ── Barre d'action, fixe. Devient la clôture quand tout est validé. ────────────────── */}
      {current ? (
        <SetActionBar
          exerciseName={current.entry.exerciseName}
          currentIndex={current.rang + 1}
          totalSets={current.entry.sets.length}
          setType={current.set.setType}
          repsValue={displayReps}
          onChangeReps={(v) => applyEdit({ reps: v })}
          onStepReps={(delta) => {
            const base = Number(displayReps);
            const next = Math.max(0, (Number.isNaN(base) ? 0 : base) + delta);
            applyEdit({ reps: String(next) });
          }}
          weightValue={units.weightInputValue(displayWeightKg)}
          weightSymbol={units.weightSymbol}
          onChangeWeight={(v) => applyEdit({ weightKg: units.parseWeightToKg(v) })}
          onStepWeight={(deltaKg) =>
            applyEdit({ weightKg: Math.max(0, (displayWeightKg ?? 0) + deltaKg) })
          }
          durationValue={durationValue}
          onChangeDuration={(v) => applyEdit({ durationSeconds: parseMmSs(v) })}
          onStepDuration={(d) =>
            applyEdit({ durationSeconds: Math.max(0, (displayDurationSeconds ?? 0) + d) })
          }
          onValidate={onValidate}
          chainsToSuperset={chainsToSuperset}
          colors={colors}
        />
      ) : entries.length > 0 ? (
        <View
          style={[
            styles.finishBar,
            { backgroundColor: colors.surface, borderTopColor: colors.borderStrong },
          ]}
        >
          <View style={styles.finishStats}>
            <FinishStat value={elapsed} label={t('workout.summary.duration')} colors={colors} />
            <View style={[styles.finishSep, { backgroundColor: colors.border }]} />
            <FinishStat
              value={String(doneSets)}
              label={t('workout.summary.sets')}
              colors={colors}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onFinish}
            style={({ pressed }) => [
              styles.finishBtn,
              { backgroundColor: colors.accent },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.finishLabel, { color: colors.accentText }]}>
              {t('workout.finishSession')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {restEndsAt !== null ? (
        <RestOverlay
          secondsLeft={restLeft}
          collapsed={restCollapsed}
          restSeconds={currentRest}
          totalSeconds={restTotal}
          nextLabel={current ? current.entry.exerciseName : null}
          nextDetail={
            current
              ? t('workout.setProgress', {
                  current: current.rang + 1,
                  total: current.entry.sets.length,
                })
              : null
          }
          onSkip={() => setRestEndsAt(null)}
          onExtend={() => {
            setRestEndsAt((e) => (e ?? Date.now()) + 15000);
            setRestTotal((total) => total + 15);
          }}
          onToggleCollapse={() => setRestCollapsed((c) => !c)}
          onChangeRest={onSetRest}
          recordLabel={
            classicRecord
              ? t(
                  classicRecord.type === 'max_weight'
                    ? 'immersive.record.pillWeight'
                    : 'immersive.record.pill1rm',
                  {
                    value: units.formatWeight(classicRecord.value),
                    previous: units.formatWeight(classicRecord.previous),
                  },
                )
              : null
          }
          colors={colors}
        />
      ) : null}

      <SupersetPickerModal
        visible={supersetPickerOpen}
        onClose={() => setSupersetPickerOpen(false)}
        candidates={supersetCandidates}
        onPick={onPickSupersetPartner}
        colors={colors}
      />

      <SessionMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        level={displayLevel}
        onChangeLevel={(lvl) => void upsertProfile({ workoutDisplayLevel: lvl })}
        mode={sessionMode}
        onChangeMode={(next) => void useSessionMode.getState().setMode(next)}
        restSeconds={currentRest}
        onOpenRest={openRestPicker}
        onAddExercise={() => router.push('/exercises')}
        onFinish={onFinish}
        onLeave={onLeave}
        onAbandon={confirmAbandon}
        colors={colors}
      />
    </SafeAreaView>
  );
}

/** Une statistique de la barre de clôture. */
function FinishStat({
  value,
  label,
  colors,
}: {
  value: string;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={styles.finishStat}>
      <Text style={[styles.finishStatValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.finishStatLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, gap: 9 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timer: { fontFamily: fontFamily.monoBold, fontSize: 19 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },
  progressLabel: { fontFamily: fontFamily.mono, fontSize: 11 },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24, gap: 12 },
  hint: { fontFamily: fontFamily.body, fontSize: 14, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center' },
  doneCard: { borderRadius: 18, borderWidth: 1, padding: 22, gap: 7, alignItems: 'center' },
  doneIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  doneTitle: { fontFamily: fontFamily.displaySemi, fontSize: 19, letterSpacing: -0.3 },
  doneHint: { fontFamily: fontFamily.body, fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
  finishBar: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  },
  finishStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  finishStat: { alignItems: 'center', gap: 2 },
  finishStatValue: { fontFamily: fontFamily.monoBold, fontSize: 17 },
  finishStatLabel: { fontFamily: fontFamily.bodySemi, fontSize: 9, letterSpacing: 0.5 },
  finishSep: { width: 1, height: 26 },
  finishBtn: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishLabel: { fontFamily: fontFamily.bodyBold, fontSize: 17 },
  pressed: { opacity: 0.8 },
});
