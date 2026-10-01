/**
 * US LIENS-01 — l'assembleur du registre des liens, et son partage dans toute l'app.
 *
 * ── Pourquoi un fournisseur, et pourquoi à la racine ────────────────────────────────────────────
 * Le registre sert **quatre** lecteurs : le Labo (onglet Croiser), la fiche d'un lien, les échos des
 * piliers (ECHO-01) et le widget de l'accueil. Chacun appelant ses hooks monterait quatre fois
 * l'union d'une vingtaine de lectures — exactement la duplication que GARDE-01 puis INSIGHTS-01 ont
 * dû défaire. On calcule donc **une fois**, à la racine (les fiches, le planning et Stats nutrition
 * sont des écrans de la pile racine, hors des onglets), et on diffuse.
 *
 * ⚠️ **Aucune règle ici**, même discipline qu'`insights-repository` : ce fichier lit, convertit et
 * passe. Les états, les seuils et l'ordre vivent dans `@wellness/shared` (`cross-links.ts`).
 *
 * 🔴 **Aucune lecture d'horloge dans ces hooks** : `useTodayKey` est la seule source.
 */

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useQuery, useStatus } from '@powersync/react';
import {
  CROSS_LINK_HISTORY_WEEKS,
  addDays,
  buildCrossLinkSeries,
  buildCrossLinks,
  computeProteinPerKg,
  crossLinkWeekKey,
  crossLinkWeekWrites,
  cycleLengths,
  detectGoalConflicts,
  dispositionFor,
  dotsEightWeekDelta,
  dotsScore,
  effectiveRegime,
  firstVisibleConflict,
  learningAssociations,
  linearRegression,
  localDateFromDayKey,
  localDayKey,
  pressingLink,
  echoFor,
  resolveActivePillars,
  shouldFreezeExperiment,
  usableCycleLengths,
  type CrossLink,
  type CrossLinkId,
  type CrossLinkState,
  type CrossLinkSurface,
  type CrossLinkWeekRecord,
  type GoalConflict,
  type LabKnowledgeCard,
  type WellbeingLinksSummary,
} from '@wellness/shared';

import { guidanceSourceOf } from '@/data/guidance';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useAuthStore } from '@/stores/auth-store';
import { useDismissedRules } from '@/stores/dismissed-rules-store';
import { insertWithSyncFields, patch } from './_sql';
import { useActivities } from './activity-repository';
import {
  useActivityLevelSuggestion,
  useConcurrentTrainingInterference,
  useReadiness,
  useStreakData,
  useTrainingNutritionCross,
  useTrainingTime,
} from './dashboard-repository';
import { LAB_WRITE_READY, finishLabExperiment } from './lab-experiment-repository';
import { useLabCore, useLabObjective, type LabCore } from './lab-repository';
import { useMenstrualPeriods } from './menstrual-cycle-repository';
import { useNutritionProfile } from './nutrition-repository';
import { useProfile } from './profile-repository';
import { useRealLifeState } from './real-life-repository';
import { useRunnerProfile } from './running-profile-repository';
import { useSettings } from './settings-repository';
import { useStrengthSection } from './strength-repository';
import { useWeeklyReview } from './weekly-review-repository';
import { useWellbeingLinksSummary } from './wellbeing-pillar-repository';

// ---------------------------------------------------------------------------
// L'histoire figée des liens (décision Q5)
// ---------------------------------------------------------------------------

export const SELECT_CROSS_LINK_WEEKS = `
  SELECT id, link_id, week_start, state
  FROM cross_link_weeks
  WHERE deleted_at IS NULL AND week_start >= ?
  ORDER BY week_start
`;

/** Les semaines figées des huit dernières semaines, tous liens. */
export function useCrossLinkWeeks(todayKey: string): { records: CrossLinkWeekRecord[]; isLoading: boolean } {
  const since = localDayKey(addDays(localDateFromDayKey(crossLinkWeekKey(todayKey)), -7 * (CROSS_LINK_HISTORY_WEEKS - 1)));
  const { data, isLoading } = useQuery<{ id: string; link_id: string; week_start: string; state: string }>(SELECT_CROSS_LINK_WEEKS, [since]);
  const records = useMemo(
    () => data.map((r) => ({ id: r.id, linkId: r.link_id, weekStart: r.week_start, state: r.state })),
    [data],
  );
  return { records, isLoading };
}

/**
 * Fige l'état de la semaine en cours. La ligne de ce lien pour cette semaine, **quel que soit son
 * identifiant**, est mise à jour ; sinon une ligne est créée sous l'identifiant déterministe. Les
 * semaines passées ne sont jamais réécrites (`crossLinkWeekWrites`).
 */
export async function writeCrossLinkWeeks(
  writes: readonly { id: string; linkId: string; weekStart: string; state: string }[],
  records: readonly CrossLinkWeekRecord[],
): Promise<void> {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) return;
  for (const w of writes) {
    const existing = records.find((r) => r.linkId === w.linkId && r.weekStart === w.weekStart);
    if (existing !== undefined) await patch('cross_link_weeks', existing.id, { state: w.state });
    else await insertWithSyncFields('cross_link_weeks', { id: w.id, user_id: userId, week_start: w.weekStart, link_id: w.linkId, state: w.state });
  }
}

// ---------------------------------------------------------------------------
// Le calcul
// ---------------------------------------------------------------------------

export type CrossLinksValue = {
  links: CrossLink[];
  /** Les associations encore en apprentissage : la section « à découvrir » les montre aussi. */
  learning: LabKnowledgeCard[];
  /** Le cœur du Labo, partagé avec son écran (une seule lecture de l'historique). */
  core: LabCore;
  /** L'histoire figée des liens. */
  weeks: CrossLinkWeekRecord[];
  /** Le conflit d'objectifs visible, pour ouvrir le Conseil des trois depuis la fiche. */
  goalConflict: GoalConflict | null;
  cycleTrackingEnabled: boolean;
  /**
   * US BIEN-05 — les croisements Bien-être × piliers (et internes au pilier), calculés une fois ici :
   * l'onglet « Ce qui compte » et les bilans les relisent sans les recalculer. `null` pilier éteint.
   */
  wellbeing: WellbeingLinksSummary | null;
  isLoading: boolean;
  /**
   * Revue du 30/09/2026 — vrai quand **toutes** les lectures qui décident d'un état ont répondu
   * (profils, période « vie réelle », cycle, activités, règles rejetées) et que les réglages existent.
   * L'affichage se contente d'`isLoading` ; l'écriture de l'histoire, elle, attend ceci : figer un état
   * calculé sur une lecture incomplète inventerait une semaine (un « ça tient » avant l'arrivée d'un
   * conflit d'objectifs, trois piliers « à découvrir » avant l'arrivée des réglages).
   */
  writeReady: boolean;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

export function useComputeCrossLinks(): CrossLinksValue {
  const todayKey = useTodayKey();
  const core = useLabCore();
  const { settings, isLoading: settingsLoading } = useSettings();
  const { profile, isLoading: profileLoading } = useProfile();
  const { nutritionProfile, isLoading: nutritionLoading } = useNutritionProfile();
  const { runnerProfile, isLoading: runnerLoading } = useRunnerProfile();
  const objective = useLabObjective();
  const { inRealLifePeriod, isLoading: realLifeLoading } = useRealLifeState();
  const interference = useConcurrentTrainingInterference();
  const readiness = useReadiness();
  const activityLevel = useActivityLevelSuggestion();
  const apport = useTrainingNutritionCross();
  const trainingTime = useTrainingTime();
  const streak = useStreakData();
  const { review, isLoading: reviewLoading } = useWeeklyReview();
  const strength = useStrengthSection();
  const { periods, isLoading: periodsLoading } = useMenstrualPeriods();
  const { activities, isLoading: activitiesLoading } = useActivities();
  const { records: weeks, isLoading: weeksLoading } = useCrossLinkWeeks(todayKey);
  // US BIEN-05 — le pilier Bien-être n'est pas un `Pillar` : il entre par un drapeau, comme le cycle.
  const { summary: wellbeing, isLoading: wellbeingLoading } = useWellbeingLinksSummary();
  const dismissed = useDismissedRules((s) => s.dismissed);
  const dismissedHydrated = useDismissedRules((s) => s.hydrated);

  useEffect(() => {
    void useDismissedRules.getState().hydrate();
  }, []);

  const activePillars = resolveActivePillars(settings?.activePillars);
  const cycleTrackingEnabled = settings?.cycleTrackingEnabled === true;
  const wellbeingEnabled = settings?.wellbeingPillarEnabled === true;
  const history = core.history;
  const weightKg = history.input.weightKg;

  // Même règle que la carte de l'accueil (GoalConflictBanner) : le régime décide si l'on en parle,
  // et une règle rejetée ne revient pas.
  const regime = effectiveRegime(guidanceSourceOf(profile), 'nutrition');
  const conflicts =
    dispositionFor('goalConflict', regime) === 'silent' || !dismissedHydrated
      ? []
      : detectGoalConflicts({
          mainGoal: profile?.mainGoal ?? null,
          // Décision H (revue du 30/09/2026) : l'objectif d'un pilier désactivé, resté dans son
          // profil, ne se contredit avec rien — on ne le reproche pas.
          nutritionObjective: activePillars.includes('nutrition') ? (nutritionProfile?.objective ?? null) : null,
          runnerObjective: activePillars.includes('running') ? (runnerProfile?.objective ?? null) : null,
        });
  const goalConflict = firstVisibleConflict(conflicts, dismissed);

  const isLoading = core.isLoading || settingsLoading || reviewLoading || weeksLoading || apport.isLoading || strength.isLoading;
  const writeReady =
    !isLoading &&
    settings !== null &&
    !profileLoading &&
    !nutritionLoading &&
    !runnerLoading &&
    !realLifeLoading &&
    !periodsLoading &&
    !activitiesLoading &&
    !wellbeingLoading &&
    dismissedHydrated;

  // Lus hors du `useMemo` : le compilateur React prend tout `.current` pour une ref, et refuserait
  // de préserver la mémoïsation (`preserve-manual-memoization`).
  const streakDays = streak.current;
  const lastWeekActiveDays = review.isEmpty ? null : review.current.activeDays;
  const lastWeekDone = review.isEmpty ? null : review.current.workouts + review.current.runs;

  const value = useMemo((): CrossLinksValue => {
    // Protéines sur 7 jours, depuis l'historique déjà lu (MN-06, mêmes règles que la carte).
    const sevenDaysAgo = localDayKey(addDays(localDateFromDayKey(todayKey), -6));
    const week7 = history.input.nutritionDays.filter((d) => d.dayKey >= sevenDaysAgo && d.dayKey <= todayKey);
    const avgProteinG = week7.length > 0 ? week7.reduce((s, d) => s + d.proteinG, 0) / week7.length : null;
    const protein = computeProteinPerKg({ avgProteinG, weightKg, objective });

    // Poids : tendance en kg/semaine par régression sur les pesées des huit semaines (META-08).
    const weights = history.input.weights;
    const base = weights[0]?.dayKey ?? null;
    const fit =
      base === null || weights.length < 2
        ? null
        : linearRegression(weights.map((w) => ({ x: (localDateFromDayKey(w.dayKey).getTime() - localDateFromDayKey(base).getTime()) / 86_400_000, y: w.weightKg })));

    // DOTS aujourd'hui et il y a huit semaines (MUSC-27), sur le total des trois mouvements.
    const sex = strength.sex;
    const dotsNow = dotsScore(strength.total.totalKg, strength.bodyweight?.weightKg ?? weightKg, sex);
    // L'écart porte VRAIMENT sur huit semaines, au poids de ce jour-là — sinon c'est un trou
    // (revue du 30/09/2026, `dotsEightWeekDelta`).
    const dotsDelta = dotsEightWeekDelta({ todayKey, dotsNow, history: strength.history, weights, sex });

    const series = buildCrossLinkSeries({
      todayKey,
      activePillars,
      weightKg,
      nutritionDays: history.input.nutritionDays,
      weights,
      lifts: history.lifts,
      loadSessions: [
        ...history.loadSessions,
        // AUTRE-01 — une sortie vélo compte dans la charge, comme dans l'alerte (useTrainingLoadAlert).
        ...activities.map((a) => ({ dayKey: localDayKey(new Date(a.startedAt)), rpe: a.rpe, durationSeconds: a.durationSeconds })),
      ],
      qualityRuns: history.input.qualityRuns,
      heavyLegDays: history.heavyLegDays,
      runDays: history.runDays,
      strengthDays: history.strengthDays,
    });

    const links = buildCrossLinks({
      todayKey,
      activePillars,
      cycleTrackingEnabled,
      inRealLifePeriod,
      week: core.week,
      knowledge: core.cards,
      questions: core.questions,
      acwr: core.signals.acwr,
      overtraining: core.signals.overtraining,
      deficitVolume: core.signals.deficitVolume,
      interference,
      protein: protein === null ? null : { ...protein, loggedDays: week7.length },
      carbs: core.signals.carbs,
      activityLevel,
      apport: {
        energy: apport.energy,
        adherence: apport.adherence,
        lowFuelDays: apport.lowFuelDays.length,
        distribution: apport.protein,
      },
      trainingTime: { strengthSeconds: trainingTime.strengthSeconds, runningSeconds: trainingTime.runningSeconds },
      readiness,
      goalConflicts: goalConflict === null ? [] : [goalConflict],
      rhythm: {
        streakDays,
        lastWeekActiveDays,
        lastWeekDone,
        lastWeekPlanned: null,
      },
      weight: {
        latestKg: weightKg,
        kgPerWeek: fit === null ? null : round1(fit.slope * 7),
        weighIns: weights.length,
        loggedDays7: week7.length,
      },
      strength: {
        dots: dotsNow,
        dotsDelta,
        sbdTotal: strength.total.totalKg,
      },
      // Le détail par phase est calculé par la fiche elle-même (useCycleInsights lit tout
      // l'historique) : ici, seulement de quoi dire si le lien est lisible.
      cycle: cycleTrackingEnabled ? { cyclesObserved: usableCycleLengths(cycleLengths(periods)).usable.length, byMetric: null } : null,
      series,
      wellbeingEnabled,
      wellbeing,
    });

    return {
      links,
      learning: learningAssociations(core.cards),
      core,
      weeks,
      goalConflict,
      cycleTrackingEnabled,
      wellbeing,
      isLoading,
      writeReady,
    };
  }, [
    wellbeingEnabled,
    wellbeing,
    todayKey,
    core,
    history,
    weightKg,
    objective,
    activePillars,
    cycleTrackingEnabled,
    inRealLifePeriod,
    interference,
    readiness,
    activityLevel,
    apport,
    trainingTime,
    streakDays,
    lastWeekActiveDays,
    lastWeekDone,
    strength,
    periods,
    activities,
    weeks,
    goalConflict,
    isLoading,
    writeReady,
  ]);

  return value;
}

// ---------------------------------------------------------------------------
// Les écritures du fournisseur : semaine figée, expériences closes
// ---------------------------------------------------------------------------

/**
 * Deux écritures de fond, toutes deux **idempotentes** :
 *  - l'état de la semaine en cours de chaque lien (Q5) — seulement ce qui a changé ;
 *  - la clôture des expériences dont les quatre semaines sont passées, avec leur verdict figé
 *    (LABO-04) — sans quoi « vérifié » redevenait « pas assez de mesures » un mois plus tard.
 *
 * Revue du 30/09/2026 — trois gardes, chacune contre un défaut précis :
 *  1. **`hasSynced`** : avant la première synchro (nouvel appareil, réinstallation), la base locale
 *     est vide ; tout serait « à découvrir » et écraserait l'état réel écrit par l'autre appareil.
 *     Même garde que `ensureSettings` dans `_layout.tsx`.
 *  2. **`writeReady`** : toutes les lectures qui décident d'un état ont répondu, et les réglages
 *     existent (sans eux, les trois piliers passeraient pour actifs — décision H trahie).
 *  3. **Écriture par front** (`previous`) : une ligne n'est réécrite que si le calcul **de cet
 *     appareil** a changé ; sinon deux appareils qui calculent différemment (une règle rejetée sur un
 *     seul téléphone) se renverraient la ligne à l'infini.
 */
export function useCrossLinksWrites(value: CrossLinksValue): void {
  const todayKey = useTodayKey();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const { hasSynced } = useStatus();
  const busy = useRef(false);
  const previous = useRef(new Map<CrossLinkId, CrossLinkState>());

  useEffect(() => {
    if (!value.writeReady || userId === null || !hasSynced || busy.current) return;
    const writes = crossLinkWeekWrites(value.links, value.weeks, todayKey, userId, previous.current);
    previous.current = new Map(value.links.map((l) => [l.id, l.state]));
    const toFreeze = LAB_WRITE_READY ? value.core.experiments.filter((e) => shouldFreezeExperiment(e.record, todayKey)) : [];
    if (writes.length === 0 && toFreeze.length === 0) return;
    busy.current = true;
    void (async () => {
      try {
        await writeCrossLinkWeeks(writes, value.weeks);
        for (const e of toFreeze) {
          // Le verdict calculé AUJOURD'HUI (`useLabCore`), sur une fenêtre qui contient encore les
          // quatre semaines : c'est lui qui restera.
          await finishLabExperiment(e.record.id, e.verdict);
        }
      } catch (error) {
        // Écriture de fond : rien à montrer à l'écran, mais jamais en silence (même patron que le
        // connecteur). Elle se retente dès que le registre change — un nouvel état, une donnée saisie.
        console.warn('[cross-links] écriture de fond impossible', error);
        previous.current = new Map();
      } finally {
        busy.current = false;
      }
    })();
  }, [value, todayKey, userId, hasSynced]);
}

// ---------------------------------------------------------------------------
// Le partage
// ---------------------------------------------------------------------------

const CrossLinksContext = createContext<CrossLinksValue | null>(null);

export function CrossLinksProvider({ children }: { children: ReactNode }) {
  const value = useComputeCrossLinks();
  useCrossLinksWrites(value);
  return <CrossLinksContext.Provider value={value}>{children}</CrossLinksContext.Provider>;
}

/**
 * Le registre partagé, ou `null` hors d'un `CrossLinksProvider`. Rend `null` plutôt que de calculer
 * en repli : un repli silencieux rétablirait le double montage que ce fichier existe pour éviter.
 */
export function useCrossLinks(): CrossLinksValue | null {
  return useContext(CrossLinksContext);
}

/** L'écho d'un écran (ECHO-01) : le lien le plus pressant qui le concerne, ou rien. */
export function useCrossLinkEcho(surface: CrossLinkSurface): CrossLink | null {
  const value = useCrossLinks();
  return value === null || value.isLoading ? null : echoFor(value.links, surface);
}

/** Le lien que l'accueil met en avant, ou rien. */
export function usePressingLink(): { link: CrossLink | null; total: number; pressing: number } {
  const value = useCrossLinks();
  if (value === null || value.isLoading) return { link: null, total: 0, pressing: 0 };
  return {
    link: pressingLink(value.links),
    total: value.links.length,
    pressing: value.links.filter((l) => l.state === 'guard' || l.state === 'adjust').length,
  };
}
