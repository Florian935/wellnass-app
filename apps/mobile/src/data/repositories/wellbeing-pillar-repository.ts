/**
 * US BIEN-02 → BIEN-07 — ce que le pilier Bien-être lit.
 *
 * Aucune règle ici : les décisions vivent dans `@wellness/shared` (`wellbeing-day.ts`,
 * `wellbeing-links.ts`, testées sous Vitest). Ce fichier **branche** les entrées réelles :
 * réglages, check-ins, séances prévues, séances faites, courses, journal nutrition.
 *
 * ⚠️ **Opt-in respectés.** Pilier éteint, rien de ce qui suit n'est calculé (`enabled === false`
 * rend `null`) : le check-in de base continue de servir BIEN-01, TRI-03 et le Labo comme avant, mais
 * les signaux du pilier (qualité, envie, étiquettes, modules) ne sortent pas.
 */

import { useMemo } from 'react';
import {
  addDays,
  buildWellbeingDay,
  buildWellbeingLinks,
  localDateFromDayKey,
  localDayKey,
  recentPoorNights,
  resolveActivePillars,
  startOfWeek,
  WELLBEING_LINKS_WINDOW_DAYS,
  type Pillar,
  type WellbeingDay,
  type WellbeingDaySession,
  type WellbeingLinksSummary,
} from '@wellness/shared';

import { useActivities } from './activity-repository';
import { useWellbeingForDay, useWellbeingRows } from './daily-wellbeing-repository';
import { useDailyTotals } from './journal-repository';
import { useWeekPlan } from './planned-session-repository';
import { useRunHistory } from './run-repository';
import { useSettings } from './settings-repository';
import { useWorkoutHistory } from './workout-repository';
import { useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';

export type WellbeingPillarState = {
  /** Le pilier est activé (décision D1). `false` tant que les réglages ne sont pas chargés. */
  enabled: boolean;
  modules: { alcohol: boolean; caffeine: boolean; nap: boolean; cravings: boolean };
  /** La nuit est lue dans Health Connect (décision D3). */
  sleepFromHealthConnect: boolean;
  activePillars: Pillar[];
  isLoading: boolean;
};

/** Les réglages du pilier, lus une fois. Défauts **éteints** : donnée de santé, l'absence n'est pas un oui. */
export function useWellbeingPillar(): WellbeingPillarState {
  const { settings, isLoading } = useSettings();
  return {
    enabled: settings?.wellbeingPillarEnabled === true,
    modules: {
      alcohol: settings?.wellbeingAlcoholEnabled === true,
      caffeine: settings?.wellbeingCaffeineEnabled === true,
      nap: settings?.wellbeingNapEnabled === true,
      cravings: settings?.wellbeingCravingsEnabled === true,
    },
    sleepFromHealthConnect: settings?.sleepHealthConnectEnabled === true,
    activePillars: resolveActivePillars(settings?.activePillars),
    isLoading,
  };
}

function shiftDay(dayKey: string, n: number): string {
  return localDayKey(addDays(localDateFromDayKey(dayKey), n));
}

function dayKeyOf(iso: string | null): string | null {
  return iso ? localDayKey(new Date(iso)) : null;
}

/**
 * US BIEN-04 — ce que l'état du jour change à la séance et à l'assiette (onglet Aujourd'hui).
 * `null` pilier éteint.
 */
export function useWellbeingDay(): { day: WellbeingDay | null; isLoading: boolean } {
  const pillar = useWellbeingPillar();
  const todayKey = useTodayKey();
  const weekStartKey = localDayKey(startOfWeek(localDateFromDayKey(todayKey)));
  const { entry: today, isLoading: todayLoading } = useWellbeingForDay(todayKey);
  const { entry: yesterday, isLoading: yesterdayLoading } = useWellbeingForDay(shiftDay(todayKey, -1));
  const { items, isLoading: planLoading } = useWeekPlan(weekStartKey);

  const day = useMemo(() => {
    if (!pillar.enabled) return null;
    const sessions: WellbeingDaySession[] = items
      .filter((item) => item.scheduledDate === todayKey)
      .map((item) => ({
        id: item.id,
        pillar: item.pillar,
        name: item.sessionName,
        sessionType: item.sessionType,
        status: item.status === 'done' || item.status === 'skipped' ? item.status : 'planned',
        adapted: item.adapted === true,
      }));
    return buildWellbeingDay({ today, yesterday, sessions, activePillars: pillar.activePillars });
  }, [pillar.enabled, pillar.activePillars, items, todayKey, today, yesterday]);

  return { day, isLoading: pillar.isLoading || todayLoading || yesterdayLoading || planLoading };
}

/**
 * US BIEN-05 — les croisements Bien-être × piliers, sur les 90 derniers jours.
 *
 * Calculé **une fois** par le fournisseur des liens du Labo (`CrossLinksProvider`), qui le transmet
 * au registre et l'expose aux échos : l'onglet « Ce qui compte » et les bilans le relisent depuis le
 * contexte, ils ne le recalculent pas. `null` pilier éteint.
 */
export function useWellbeingLinksSummary(): { summary: WellbeingLinksSummary | null; isLoading: boolean } {
  const pillar = useWellbeingPillar();
  const todayKey = useTodayKey();
  const sinceKey = useWindowStartKey(WELLBEING_LINKS_WINDOW_DAYS);
  const { rows, isLoading: rowsLoading } = useWellbeingRows(sinceKey);
  const { workouts, isLoading: workoutsLoading } = useWorkoutHistory();
  const { runs, isLoading: runsLoading } = useRunHistory();
  const { activities, isLoading: activitiesLoading } = useActivities();
  const { totals, isLoading: totalsLoading } = useDailyTotals(sinceKey);

  const summary = useMemo<WellbeingLinksSummary | null>(() => {
    if (!pillar.enabled) return null;
    const strength = workouts
      .map((w) => {
        const dayKey = dayKeyOf(w.finishedAt);
        if (dayKey === null || dayKey < sinceKey) return null;
        // On compare une séance à celles du MÊME gabarit ; une séance libre, à celles qui commencent
        // par les mêmes exercices (MUSCU-UX07, D9).
        const groupKey = w.sessionId ?? `free:${w.firstExercises.slice(0, 2).join('|')}`;
        return { dayKey, tonnage: w.volumeKg, groupKey };
      })
      .filter((s): s is { dayKey: string; tonnage: number; groupKey: string } => s !== null);
    const runRows = runs
      .map((r) => {
        const dayKey = dayKeyOf(r.finishedAt);
        if (dayKey === null || dayKey < sinceKey || r.avgPaceSPerKm === null) return null;
        return { dayKey, paceSPerKm: r.avgPaceSPerKm, rpe: r.rpe };
      })
      .filter((r): r is { dayKey: string; paceSPerKm: number; rpe: number | null } => r !== null);
    const trainingDays = new Set<string>();
    for (const s of strength) trainingDays.add(s.dayKey);
    for (const r of runRows) trainingDays.add(r.dayKey);
    for (const a of activities) {
      const k = dayKeyOf(a.startedAt);
      if (k !== null && k >= sinceKey) trainingDays.add(k);
    }
    const links = buildWellbeingLinks({
      todayKey,
      checkins: rows,
      strength,
      runs: runRows,
      intake: totals.map((t) => ({ dayKey: t.logDate, kcal: t.kcal })),
      trainingDays: [...trainingDays],
      activePillars: pillar.activePillars,
      modules: { alcohol: pillar.modules.alcohol, caffeine: pillar.modules.caffeine },
    });
    return { links, recentPoorNights: recentPoorNights(rows, todayKey).poor };
  }, [pillar.enabled, pillar.activePillars, pillar.modules.alcohol, pillar.modules.caffeine, workouts, runs, activities, totals, rows, todayKey, sinceKey]);

  return {
    summary,
    isLoading: pillar.isLoading || rowsLoading || workoutsLoading || runsLoading || activitiesLoading || totalsLoading,
  };
}
