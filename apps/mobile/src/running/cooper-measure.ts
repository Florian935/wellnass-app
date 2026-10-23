/**
 * La mesure du test de 12 minutes, lue depuis la trace de la course marquée (US CARDIO-02, R8, R11).
 *
 * Deux lecteurs : l'arrivée (« C'est fait »), qui propose l'allure, et la porte du test de
 * `/running-pace`, qui pré-remplit la distance d'un test mesuré dont l'allure n'a pas été retenue.
 * Toute la décision est dans `measureCooperTest` (`@wellness/shared`) ; ici, on relie le marqueur
 * local, la course (`useRun`, qui ignore une course supprimée) et la trace.
 */

import { decodeTrack, measureCooperTest, type CooperMeasure } from '@wellness/shared';
import { useEffect, useMemo } from 'react';
import { useRun, type RunDetail } from '@/data/repositories/run-repository';
import { useCooperTest } from '@/stores/cooper-test-store';

/** Le marqueur du test, relu au premier usage (il survit à un redémarrage de l'app). */
export function useCooperMarker() {
  const marker = useCooperTest((s) => s.marker);
  const hydrate = useCooperTest((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return marker;
}

/**
 * La mesure de la course `runId`, si elle est la course du test ; `null` sinon (autre course, course
 * supprimée, trace pas encore chargée).
 */
export function useCooperMeasure(runId: string | null | undefined): {
  run: RunDetail | null;
  measure: CooperMeasure | null;
} {
  const marker = useCooperMarker();
  const isTest = runId != null && marker?.runId === runId;
  const { run } = useRun(isTest ? runId : undefined);
  const measure = useMemo(() => {
    if (!isTest || !run || run.status !== 'completed') return null;
    return measureCooperTest(run.gpsTrack ? decodeTrack(run.gpsTrack) : [], {
      interrupted: marker?.interrupted === true,
    });
  }, [isTest, run, marker?.interrupted]);
  return { run: isTest ? run : null, measure };
}

/** Un test mesuré dont l'allure attend encore un choix : de quoi pré-remplir la porte du test. */
export function usePendingCooperTest(): { distanceM: number; date: string } | null {
  const marker = useCooperMarker();
  const { run, measure } = useCooperMeasure(marker?.runId ?? null);
  if (!run || !measure || measure.status !== 'ok') return null;
  return { distanceM: measure.distanceM, date: run.finishedAt ?? run.startedAt };
}
