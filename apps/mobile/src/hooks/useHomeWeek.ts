/**
 * US ACCUEIL-08 — **la semaine de l'accueil**, rassemblée une fois : la bande « Ta semaine » et les
 * séances du cadran Bouger.
 *
 * Les hooks collectent, les briques décident (`buildWeekStrip`, `@wellness/shared`, testée). Ce hook
 * remplace `useWeekRings` (les anneaux sans légende, constat 7) : mêmes sources — le plan de la
 * semaine, les séances et sorties terminées, les jours notés et leur cible effective — lues une fois.
 */

import { useMemo } from 'react';
import {
  addDays,
  buildWeekStrip,
  localDateFromDayKey,
  localDayKey,
  resolveActivePillars,
  startOfWeek,
  type WeekSession,
  type WeekStrip,
} from '@wellness/shared';
import { useDailyCalorieTargets } from '@/data/repositories/dashboard-repository';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useRealLifeState } from '@/data/repositories/real-life-repository';
import { useRunHistory } from '@/data/repositories/run-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useTodayKey } from '@/hooks/useTodayKey';

const WEEK_DAYS = 7;
const NO_PAUSE: ReadonlySet<string> = new Set();

export function useHomeWeek(): { strip: WeekStrip; weekSessions: WeekSession[] } {
  const todayKey = useTodayKey();
  const { settings } = useSettings();
  const storedPillars = settings?.activePillars;

  const weekStartKey = useMemo(
    () => localDayKey(startOfWeek(localDateFromDayKey(todayKey))),
    [todayKey],
  );
  const weekEndKey = useMemo(
    () => localDayKey(addDays(localDateFromDayKey(weekStartKey), WEEK_DAYS - 1)),
    [weekStartKey],
  );

  const { items: planItems } = useWeekPlan(weekStartKey);
  const { workouts } = useWorkoutHistory();
  const { runs } = useRunHistory();
  const { days: nutritionDays, marginPct } = useDailyCalorieTargets(weekStartKey, weekEndKey);
  const { pausedDays } = useRealLifeState();

  return useMemo(() => {
    const pillars = resolveActivePillars(storedPillars);
    const inWeek = (key: string) => key >= weekStartKey && key <= weekEndKey;
    const dayOf = (iso: string | null | undefined): string | null => {
      if (!iso) return null;
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : localDayKey(d);
    };

    // Un pilier désactivé ne compte pas (décision H) : ni marque dans la bande, ni segment au cadran.
    const counted = (pillar: string): pillar is 'strength' | 'running' =>
      (pillar === 'strength' || pillar === 'running') && pillars.includes(pillar);

    // Les séances sautées ne comptent pas : elles ne sont plus prévues.
    const planned = planItems
      .filter((i) => i.status !== 'skipped' && counted(i.pillar))
      .map((i) => ({
        dayKey: i.scheduledDate,
        pillar: i.pillar as 'strength' | 'running',
        done: i.status === 'done',
      }));

    const done: { dayKey: string; pillar: 'strength' | 'running' }[] = [];
    for (const w of counted('strength') ? workouts : []) {
      const key = dayOf(w.finishedAt);
      if (key && inWeek(key)) done.push({ dayKey: key, pillar: 'strength' });
    }
    for (const r of counted('running') ? runs : []) {
      const key = dayOf(r.finishedAt);
      if (key && inWeek(key)) done.push({ dayKey: key, pillar: 'running' });
    }

    const strip = buildWeekStrip({
      weekStartKey,
      todayKey,
      pillars,
      planned,
      done,
      nutrition: nutritionDays,
      marginPct,
      pausedDays: pausedDays ?? NO_PAUSE,
    });

    // Bouger : chaque séance prévue (faite ou non), puis celles faites hors plan.
    const doneByKey = new Map<string, number>();
    for (const d of done) doneByKey.set(`${d.pillar}|${d.dayKey}`, (doneByKey.get(`${d.pillar}|${d.dayKey}`) ?? 0) + 1);
    const weekSessions: WeekSession[] = planned.map((p) => {
      const k = `${p.pillar}|${p.dayKey}`;
      const left = doneByKey.get(k) ?? 0;
      const isDone = p.done || left > 0;
      if (left > 0) doneByKey.set(k, left - 1);
      return { pillar: p.pillar, dayKey: p.dayKey, done: isDone };
    });
    for (const [k, count] of doneByKey) {
      const [pillar, dayKey] = k.split('|') as ['strength' | 'running', string];
      for (let i = 0; i < count; i += 1) weekSessions.push({ pillar, dayKey, done: true });
    }

    return { strip, weekSessions };
  }, [planItems, workouts, runs, nutritionDays, marginPct, pausedDays, weekStartKey, weekEndKey, todayKey, storedPillars]);
}
