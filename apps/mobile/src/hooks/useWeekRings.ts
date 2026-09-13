/**
 * US DASH-01 (§4.1) — **les anneaux de la semaine**, un par pilier actif.
 *
 * Chaque anneau compare ce qui a été fait à ce qui était **prévu** : séances planifiées de la
 * semaine côté muscu et course, jours saisis côté nutrition. Sans plan, l'anneau reste vide et son
 * libellé ne dit qu'un compte — un pourcentage supposerait un objectif que personne n'a fixé (R7,
 * « aucun chiffre qui n'a pas de quoi être calculé »).
 *
 * Un pilier désactivé n'a pas d'anneau (décision H : l'intégration ne s'impose pas).
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  localDateFromDayKey,
  localDayKey,
  resolveActivePillars,
  startOfWeek,
} from '@wellness/shared';
import type { Ring } from '@/components/stage/matter/BreathRings';
import { useDailyTotals } from '@/data/repositories/journal-repository';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useRunHistory } from '@/data/repositories/run-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useTheme } from '@/theme/useTheme';

const WEEK_DAYS = 7;

export function useWeekRings(): Ring[] {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const todayKey = useTodayKey();
  const { settings } = useSettings();

  const weekStartKey = useMemo(
    () => localDayKey(startOfWeek(localDateFromDayKey(todayKey))),
    [todayKey],
  );
  const weekEndKey = useMemo(
    () => localDayKey(addDays(localDateFromDayKey(weekStartKey), WEEK_DAYS - 1)),
    [weekStartKey],
  );

  const { items: planned } = useWeekPlan(weekStartKey);
  const { workouts } = useWorkoutHistory();
  const { runs } = useRunHistory();
  const { totals } = useDailyTotals(weekStartKey);

  const active = resolveActivePillars(settings?.activePillars);

  /** Un jour local de la semaine courante ? (les deux bornes sont des clés, la comparaison est sûre) */
  const inWeek = (iso: string | null): boolean => {
    if (!iso) return false;
    const key = localDayKey(new Date(iso));
    return key >= weekStartKey && key <= weekEndKey;
  };

  const ring = (key: string, done: number, target: number, color: string, label: string): Ring => ({
    key,
    progress: target > 0 ? Math.min(1, done / target) : 0,
    color,
    label,
  });

  const rings: Ring[] = [];

  if (active.includes('strength')) {
    const done = workouts.filter((w) => inWeek(w.finishedAt)).length;
    const target = planned.filter((i) => i.pillar === 'strength').length;
    rings.push(
      ring(
        'strength',
        done,
        target,
        colors.pillarStrength,
        target > 0
          ? t('stage.home.ring.strength', { done, target })
          : t('stage.home.ring.strengthOnly', { count: done }),
      ),
    );
  }

  if (active.includes('running')) {
    const done = runs.filter((r) => inWeek(r.finishedAt)).length;
    const target = planned.filter((i) => i.pillar === 'running').length;
    rings.push(
      ring(
        'running',
        done,
        target,
        colors.pillarRunning,
        target > 0
          ? t('stage.home.ring.running', { done, target })
          : t('stage.home.ring.runningOnly', { count: done }),
      ),
    );
  }

  if (active.includes('nutrition')) {
    // `useDailyTotals` ne rend que les jours saisis : leur nombre EST la valeur cherchée.
    const done = totals.filter((d) => d.logDate <= weekEndKey && d.kcal > 0).length;
    rings.push(
      ring(
        'nutrition',
        done,
        WEEK_DAYS,
        colors.pillarNutrition,
        t('stage.home.ring.nutrition', { count: done }),
      ),
    );
  }

  return rings;
}
