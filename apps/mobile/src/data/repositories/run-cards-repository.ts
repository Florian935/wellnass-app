/**
 * US CARDIO-UX02 — les données des **cartes neuves du hub Course**.
 *
 * Trois lectures qui n'existaient nulle part, parce que le hub n'avait jamais eu à les poser :
 *
 *  1. `usePaceProgress` → « Ton allure », la carte dominante (brique `pace-progress.ts`).
 *  2. `useRunLifetime`  → la ligne de bas de page : tout ce qui a été couru depuis le début.
 *  3. `useRunningThread` → « Le fil du jour », la seule ligne de l'écran qui change tous les jours.
 *
 * ── Pourquoi le fil ne réutilise PAS `useInsights()` ─────────────────────────────────────────────
 * Même raison que côté muscu (`strength-cards-repository.ts`) : l'accueil agrège huit hooks pour
 * nourrir `selectInsights`, et le remonter sur un second écran doublerait l'union. Or
 * `selectInsights` ne calcule rien — il **filtre, classe et plafonne** des candidats que l'appelant
 * lui remet. Le hub course lui remet donc les siens, bâtis sur ce qu'il monte déjà (allure,
 * polarisation, records de distance). Même moteur de classement, sans le coût de l'agrégateur.
 *
 * ⚠️ Aucun calcul d'analyse ici : les trois sources sont des briques déjà livrées et testées
 * (RUN-05, RUN-08, RUN-03). Le repository ne fait que du câblage — règle §1.2 d'INSIGHTS-01.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAX_INSIGHTS,
  PACE_WINDOW_DAYS,
  aggregateRunStats,
  candidateFromPaceProgress,
  candidateFromPolarisation,
  candidateFromRunningRecord,
  computePaceProgress,
  localDayKey,
  selectInsights,
  type InsightCandidate,
  type PaceProgress,
  type RecordDistanceKey,
  type RunRecordCandidateInput,
  type SelectedInsight,
} from '@wellness/shared';
import { useTodayKey } from '@/hooks/useTodayKey';
import { usePaceTrend, useRunHistory, usePolarisation } from './run-repository';
import { useRunningRecords } from './running-record-repository';

// ---------------------------------------------------------------------------
// « Ton allure »
// ---------------------------------------------------------------------------

/**
 * Fenêtre de la **tendance longue** (RUN-05), en jours.
 *
 * Distincte des deux fenêtres de comparaison de `computePaceProgress` (30 j chacune) et plus large
 * qu'elles : la tendance répond à « dans quel sens ça va depuis trois mois », l'écart à « est-ce
 * que le mois qui vient de passer a été plus rapide que le précédent ». Les deux cohabitent sur la
 * carte, et c'est voulu — un écart mensuel favorable dans une tendance trimestrielle défavorable
 * est exactement l'information qu'un coureur veut voir.
 *
 * 90 j est la fenêtre haute déjà proposée par `/running-history` : on ne crée pas une troisième
 * durée de référence dans le produit.
 */
export const RUN_TREND_WINDOW_DAYS = 90;

/** L'état de la carte « Ton allure », plus les points qui la dessinent. */
export function usePaceProgress(): {
  progress: PaceProgress;
  /** Allures des 90 derniers jours, du plus ancien au plus récent — la ligne de la carte. */
  series: number[];
  isLoading: boolean;
} {
  const todayKey = useTodayKey();
  const { runs, isLoading } = useRunHistory();
  const { points, trend, isLoading: trendLoading } = usePaceTrend(RUN_TREND_WINDOW_DAYS);

  const progress = useMemo(
    () =>
      computePaceProgress({
        runs: runs
          .filter((r) => r.finishedAt !== null && r.avgPaceSPerKm !== null)
          .map((r) => ({
            dayKey: localDayKey(new Date(r.finishedAt as string)),
            paceSPerKm: r.avgPaceSPerKm as number,
            distanceM: r.distanceM ?? 0,
          })),
        todayKey,
        trend,
      }),
    [runs, todayKey, trend],
  );

  return {
    progress,
    series: useMemo(() => points.map((p) => p.paceSPerKm), [points]),
    isLoading: isLoading || trendLoading,
  };
}

// ---------------------------------------------------------------------------
// Le cumul de toujours
// ---------------------------------------------------------------------------

/** Tout ce qui a été couru depuis le début — la ligne qui ferme la page. */
export function useRunLifetime(): {
  totalDistanceM: number;
  totalDurationS: number;
  count: number;
  isLoading: boolean;
} {
  const todayKey = useTodayKey();
  const { runs, isLoading } = useRunHistory();

  const stats = useMemo(
    () =>
      aggregateRunStats(
        runs.map((r) => ({
          finishedAtDayKey: localDayKey(new Date((r.finishedAt ?? r.startedAt) as string)),
          distanceM: r.distanceM,
          durationS: r.durationSeconds,
          paceSPerKm: r.avgPaceSPerKm,
          elevationGainM: r.elevationGainM,
          elevationLossM: r.elevationLossM,
        })),
        'all',
        todayKey,
      ),
    [runs, todayKey],
  );

  return {
    totalDistanceM: stats.totalDistanceM,
    totalDurationS: stats.totalDurationS,
    count: stats.count,
    isLoading,
  };
}

// ---------------------------------------------------------------------------
// « Le fil du jour »
// ---------------------------------------------------------------------------

/** Clés i18n des distances de record — les mêmes que partout ailleurs dans le pilier. */
const RECORD_DISTANCE_KEY: Record<RecordDistanceKey, string> = {
  '1k': 'running.records.distance1k',
  '5k': 'running.records.distance5k',
  '10k': 'running.records.distance10k',
  semi: 'running.records.distanceSemi',
  marathon: 'running.records.distanceMarathon',
};

/**
 * Le fil retient **un** insight, pas trois : c'est une bande d'une ligne, pas une pile de cartes.
 * `selectInsights` en rend jusqu'à `MAX_INSIGHTS` ; on prend la tête de son classement.
 */
export function useRunningThread(): { thread: SelectedInsight | null; isLoading: boolean } {
  const { t } = useTranslation();
  const todayKey = useTodayKey();
  const { progress, isLoading: paceLoading } = usePaceProgress();
  const { polarisation, isLoading: polarisationLoading } = usePolarisation();
  const { records, isLoading: recordsLoading } = useRunningRecords();

  // Les candidats passent par les MÊMES adaptateurs que l'accueil : les règles (quels chiffres,
  // quelle date, quel pilier) vivent dans `shared`, pas ici.
  const candidates: InsightCandidate[] = useMemo(() => {
    const out: InsightCandidate[] = [];

    const recordInputs: RunRecordCandidateInput[] = records.map((r) => ({
      distanceKey: r.distanceKey,
      label: t(RECORD_DISTANCE_KEY[r.distanceKey]),
      bestTimeSeconds: r.bestTimeSeconds,
      // `achieved_at` est un ISO complet ; le moteur compare des **clés de jour**. Sans cette
      // conversion, `daysBetween` recevrait « 2026-09-17T18:42:11.000Z » et la porte des 14 jours
      // ne fermerait jamais au bon moment.
      achievedOn: localDayKey(new Date(r.achievedAt)),
    }));

    const record = candidateFromRunningRecord(recordInputs);
    if (record) out.push(record);
    const pace = candidateFromPaceProgress(progress);
    if (pace) out.push(pace);
    const mix = candidateFromPolarisation(polarisation);
    if (mix) out.push(mix);
    return out;
  }, [records, progress, polarisation, t]);

  const thread = useMemo(() => {
    const selected = selectInsights({
      candidates,
      activePillars: ['running'],
      todayKey,
    });
    return selected[0] ?? null;
  }, [candidates, todayKey]);

  return {
    thread,
    isLoading: paceLoading || polarisationLoading || recordsLoading,
  };
}

/** Exposé pour le test de plafond : le fil ne montre jamais plus d'une ligne. */
export const RUNNING_THREAD_MAX = Math.min(1, MAX_INSIGHTS);

/** Ré-exporté pour que les libellés de la carte n'aient pas à réimporter `@wellness/shared`. */
export { PACE_WINDOW_DAYS };
