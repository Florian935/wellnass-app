/**
 * US INSIGHTS-01 (roadmap 7.20) — agrégateur de l'écran « Insights » (Tier 3, ADR-007).
 *
 * ⚠️ **Ce fichier ne contient que du câblage, et c'est délibéré.** Toute la règle — quels chiffres
 * porte un candidat, quelle date, quel pilier, et dans quel ordre les cartes sortent — vit dans
 * `@wellness/shared` (`insight-adapters.ts` et `insights.ts`), où elle est testée à 100 % sans
 * React ni base. Si vous vous apprêtez à écrire une condition métier ici, elle est au mauvais
 * endroit.
 *
 * ⚠️ **Aucune requête SQL neuve.** Les huit hooks composés portent déjà les leurs, et plusieurs
 * partagent leurs dépendances (`useWorkoutHistory`, `useRunHistory`, `useDailyTotals`). GARDE-01 a
 * dû défaire un appel imbriqué qui instanciait une seconde fois les mêmes requêtes : ne pas
 * rejouer ça. Toute duplication constatée se mutualise, elle ne s'ignore pas.
 */

import { useMemo } from 'react';
import {
  buildInsightCandidates,
  localDayKey,
  resolveActivePillars,
  selectInsights,
  type GoalCandidateInput,
  type RecordCandidateInput,
  type SelectedInsight,
} from '@wellness/shared';

import {
  useActivityLevelSuggestion,
  useConcurrentTrainingInterference,
  useDeficitVolumeAlert,
  useOvertrainingGuardAlert,
  useReadiness,
  useRecentStrengthRecords,
  useTrainingLoadAlert,
} from '@/data/repositories/dashboard-repository';
import { useGoals } from '@/data/repositories/goal-repository';
import { useMuscleBalance } from '@/data/repositories/records-repository';
import { useRealLifeState } from '@/data/repositories/real-life-repository';
import { useWeeklyReview } from '@/data/repositories/weekly-review-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useTodayKey } from '@/hooks/useTodayKey';

/**
 * Point de gating **unique** de l'écran (spec D1).
 *
 * ADR-007 §2 rangeait le Tier 3 derrière le paywall ; l'US le livre **gratuit** parce que
 * SOCLE-01 (câblage RevenueCat) est différée — aucun entitlement, aucun produit configurable,
 * donc un écran gaté serait un écran invisible. L'amendement daté est en tête d'ADR-007 §2.
 *
 * Quand la première US premium arrivera, c'est **la seule ligne à changer** : brancher ici la
 * lecture de l'entitlement RevenueCat suffit à fermer l'accès, sans toucher ni au moteur, ni à
 * l'écran, ni au widget.
 */
export function canAccessInsights(): boolean {
  return true;
}

/**
 * Les 1 à 3 insights à afficher maintenant. Tableau vide = rien à signaler, l'écran montre alors
 * son état vide (spec R4) — on n'invente jamais une carte pour remplir la page.
 */
export function useInsights(): { insights: SelectedInsight[]; isLoading: boolean } {
  const { settings } = useSettings();
  // US VIE-01 (R6) : une période déclarée fait taire les signaux de reproche.
  const { inRealLifePeriod } = useRealLifeState();

  // 🔴 `todayKey` vient du hook dédié, JAMAIS d'une lecture d'horloge dans ce corps : React
  // Compiler gèlerait la valeur dans un slot mount-only et la sélection resterait figée jusqu'au
  // redémarrage de l'app. Même raison que l'injection de `useTodayDate()` dans
  // `useDeficitVolumeAlert` (dashboard-repository.ts).
  const todayKey = useTodayKey();

  // Tous les hooks sont appelés **inconditionnellement** (règle des hooks + React Compiler).
  const overtrainingGuard = useOvertrainingGuardAlert();
  const trainingLoad = useTrainingLoadAlert();
  // US INSIGHTS-02 : ces trois signaux avaient leur propre widget d'accueil jusqu'au 05/08/2026.
  // Ils vivent désormais ici — c'est ce qui a permis de ramener le registre de 21 à 7.
  const readiness = useReadiness();
  const interference = useConcurrentTrainingInterference();
  const activityLevel = useActivityLevelSuggestion();
  const deficitVolume = useDeficitVolumeAlert();
  const { records, isLoading: recordsLoading } = useRecentStrengthRecords(4);
  const { finished, isLoading: goalsLoading } = useGoals();
  const { review, isLoading: reviewLoading } = useWeeklyReview();
  const { balance, isLoading: balanceLoading } = useMuscleBalance();

  const isLoading = recordsLoading || goalsLoading || reviewLoading || balanceLoading;

  const insights = useMemo(() => {
    if (isLoading) return [];

    // `achievedAt` est un timestamp ISO ; le moteur raisonne en **clés de jour locales**. La
    // conversion se fait ici, comme `useGoals` le fait déjà pour les courses — un adaptateur pur
    // ne doit pas dépendre du fuseau de la machine.
    const recordInputs: RecordCandidateInput[] = records.map((r) => ({
      type: r.type,
      value: r.value,
      exerciseName: r.exerciseName,
      achievedOn: localDayKey(new Date(r.achievedAt)),
    }));

    // Libellé résolu selon le même repli que BILAN-01 (`weekly-review-repository.ts`) : nom
    // d'exercice s'il existe, sinon le type d'objectif.
    const goalInputs: GoalCandidateInput[] = finished.map((g) => ({
      label: g.exerciseName ?? g.kind,
      kind: g.kind,
      targetValue: g.targetValue,
      currentValue: g.progress.currentValue,
      deadline: g.deadline,
      status: g.progress.status,
    }));

    const candidates = buildInsightCandidates({
      overtrainingGuard,
      trainingLoad,
      readiness,
      interference,
      activityLevel,
      deficitVolume,
      records: recordInputs,
      goals: goalInputs,
      weeklyReview: review,
      muscleBalance: balance,
    });

    return selectInsights({
      candidates,
      activePillars: resolveActivePillars(settings?.activePillars),
      todayKey,
      // US VIE-01 (R6) : pendant une période déclarée, les signaux qui reprochent d'avoir fait moins
      // se taisent. Les garde-fous de charge, eux, restent armés — `selectInsights` ne les filtre
      // jamais, y compris ici.
      inRealLifePeriod,
    });
    // Pas de `i18n.language` en dépendance : `useGoals` et `useRecentStrengthRecords` passent déjà
    // la langue en **paramètre SQL**, donc `finished` et `records` changent d'identité à la bascule
    // — le mémo se recalcule de lui-même. L'ajouter serait une dépendance morte que le lint signale.
  }, [
    isLoading,
    overtrainingGuard,
    trainingLoad,
    readiness,
    interference,
    activityLevel,
    deficitVolume,
    records,
    finished,
    review,
    balance,
    settings?.activePillars,
    todayKey,
    inRealLifePeriod,
  ]);

  return { insights, isLoading };
}
