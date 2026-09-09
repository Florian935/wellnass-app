/**
 * US RUN-F4 (lot J) — assemble les signaux réels et propose une adaptation de la séance du jour.
 *
 * Ce fichier ne décide rien : toute la règle vit dans `proposeSessionAdaptation`
 * (`@wellness/shared`, pure et testée). Il se contente de **brancher les quatre entrées** que
 * l'analyse du 04/09/2026 avait identifiées comme déjà présentes dans l'app mais jamais reliées
 * à la séance du jour :
 *
 *  - **DOUL-01** — douleurs déclarées, filtrées sur les zones qui concernent la course ;
 *  - **BIEN-01** — énergie du check-in du jour ;
 *  - **RUN-18 / META-19** — charge aiguë/chronique (ACWR), sur les seules courses ;
 *  - **COLLIS-01** — grosse séance de jambes la veille.
 *
 * ⚠️ **Strictement consultatif.** Rien ici n'écrit : la séance planifiée reste la séance
 * planifiée. Même parti pris que COLLIS-01 (« informe + échange en un tap »).
 *
 * ⚠️ **Opt-in respectés.** Le journal de douleur (DOUL-01) est un opt-in strict sur une donnée
 * de santé : si le réglage est éteint, on ne lit rien — pas même des lignes restées en base
 * après une désactivation sans suppression. Même règle que `useSessionPainSignal`.
 */

import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import {
  computeAcwr,
  freshPainReports,
  isHeavyLegSession,
  localDayKey,
  proposeSessionAdaptation,
  worstRunningPain,
  type AdaptationProposal,
  type MuscleGroup,
  type ProgramSessionType,
} from '@wellness/shared';
import { usePainReports } from './pain-repository';
import { useTodayWellbeing } from './daily-wellbeing-repository';
import { useRunHistory } from './run-repository';
import { useSettings } from './settings-repository';
import { useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';

/**
 * Séries par groupe musculaire des séances de musculation TERMINÉES la veille.
 *
 * On lit le **réalisé** (`workouts` + `workout_sets`) et non le planifié : ce qui fatigue les
 * jambes, c'est la séance qu'on a faite, pas celle qu'on avait prévue. C'est aussi ce qui rend
 * la règle utilisable quand on s'entraîne sans programme.
 */
const SELECT_YESTERDAY_LEG_SETS = `
  SELECT e.muscle_primary AS muscle, COUNT(*) AS sets
  FROM workout_sets ws
  JOIN workouts w   ON w.id = ws.workout_id AND w.deleted_at IS NULL
  JOIN exercises e  ON e.id = ws.exercise_id
  WHERE ws.deleted_at IS NULL
    AND w.user_id = ?
    AND w.finished_at IS NOT NULL
    AND date(w.finished_at) = ?
  GROUP BY e.muscle_primary
`;

type LegSetsRow = { muscle: string; sets: number };

/** Clé du jour précédent, en local (`AAAA-MM-JJ`). */
function previousDayKey(todayKey: string): string {
  const d = new Date(`${todayKey}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return localDayKey(d);
}

/**
 * La proposition d'adaptation pour une séance de course d'un type donné, ou `null`.
 *
 * `null` quand aucun signal n'est actif — l'appelant n'affiche alors **rien**, surtout pas une
 * carte « tout va bien » : une surface qui parle quand il n'y a rien à dire finit ignorée quand
 * il y a quelque chose à dire.
 */
export function useSessionAdaptation(
  sessionType: ProgramSessionType | null,
  userId: string | null,
): AdaptationProposal | null {
  const todayKey = useTodayKey();
  const { settings } = useSettings();
  const { reports } = usePainReports();
  const { entry: wellbeing } = useTodayWellbeing();
  const { runs } = useRunHistory();

  const acuteStartKey = useWindowStartKey(7);
  const chronicStartKey = useWindowStartKey(28);

  const { data: legRows } = useQuery<LegSetsRow>(SELECT_YESTERDAY_LEG_SETS, [
    userId ?? '',
    previousDayKey(todayKey),
  ]);

  return useMemo(() => {
    if (sessionType === null) return null;

    // 1. Douleur — opt-in strict sur une donnée de santé.
    const painEnabled = settings?.painJournalEnabled ?? false;
    const worstPainLevel = painEnabled
      ? worstRunningPain(freshPainReports(reports, todayKey))
      : null;

    // 2. Charge — mêmes fenêtres et mêmes seuils que RUN-18, aucun nombre réinventé ici.
    const byWindow = (startKey: string) =>
      runs
        .filter((r) => r.finishedAt != null && localDayKey(new Date(r.finishedAt)) >= startKey)
        .map((r) => ({ rpe: r.rpe, durationSeconds: r.durationSeconds }));
    const acwr = computeAcwr({
      acuteSessions: byWindow(acuteStartKey),
      chronicSessions: byWindow(chronicStartKey),
    });

    // 3. Jambes de la veille — `isHeavyLegSession` (COLLIS-01) décide, pas nous.
    const setsByMuscle: Partial<Record<MuscleGroup, number>> = {};
    for (const row of legRows) {
      setsByMuscle[row.muscle as MuscleGroup] = row.sets;
    }
    const heavyLegSessionYesterday =
      legRows.length > 0 ? isHeavyLegSession(setsByMuscle) : false;

    const proposal = proposeSessionAdaptation(sessionType, {
      worstPainLevel,
      energyLevel: wellbeing?.energy ?? null,
      acwr,
      heavyLegSessionYesterday,
      // La météo n'a aucune source : RUN-F3b est bloquée sur un arbitrage de confidentialité.
      temperatureC: null,
    });

    return proposal.reasons.length > 0 ? proposal : null;
  }, [
    sessionType,
    settings?.painJournalEnabled,
    reports,
    todayKey,
    wellbeing?.energy,
    runs,
    acuteStartKey,
    chronicStartKey,
    legRows,
  ]);
}
