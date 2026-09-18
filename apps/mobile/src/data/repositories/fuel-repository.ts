/**
 * US RESERV-01 — assemblage du Réservoir : repas + séances + poids → la courbe du jour.
 * Spec : docs/specs/functional/us/reserv01-reservoir-glucides.md
 *
 * 🔴 **Aucune dépense n'est recalculée ici** (spec D4) : les séances **réalisées** arrivent déjà
 * estimées par le moteur DEPENSE-01 (`useEnergyItemsByDay`), avec leur MET. Les séances **planifiées**
 * n'ont, elles, aucune dépense — on leur applique une convention explicite (`PLANNED_*` ci-dessous)
 * en passant par la **même** fonction `estimateMetEnergy`, plutôt qu'un second calcul maison.
 *
 * 🔴 **Rien n'est prescrit** : MN-04 reste l'autorité sur les grammes cibles du journal.
 */

import { useMemo } from 'react';
import {
  mealHour,
  capacityG as computeCapacityG,
  estimateMetEnergy,
  levelAt,
  lowestBetween,
  sessionCarbCostG,
  simulateDay,
  snackAdviceG,
  START_OF_DAY_SHARE,
  REST_DRAIN_G_PER_H,
  LOW_ZONE_SHARE,
  explainGlycogen,
  type Explanation,
  type FuelMeal,
  type FuelPoint,
  type FuelSession,
} from '@wellness/shared';

import { useDayEntries } from '@/data/repositories/journal-repository';
import {
  useEnergyItemsByDay,
  useRestingMetabolismAt,
} from '@/data/repositories/energy-repository';
import { useUpcomingSessions } from '@/data/repositories/planned-session-repository';
import { useWeightEntries } from '@/data/repositories/bodyweight-repository';

/**
 * Conventions pour une séance **planifiée**, qui n'a ni durée réalisée ni dépense (spec D5).
 *
 * ⚠️ Ce sont des **conventions assumées**, pas des mesures : une séance planifiée ne dit rien de ce
 * qu'elle coûtera. Elles ne servent qu'à la **projection**, jamais à un chiffre affiché comme réalisé,
 * et la confiance de l'explication en tient compte.
 */
export const PLANNED_DURATION_H = 1;
export const PLANNED_MET = { strength: 6, running: 8 } as const;

export type FuelTank = {
  capacityG: number;
  /** Courbe réalisée + projetée, de 0 h à 24 h. */
  curve: FuelPoint[];
  /** Courbe si la collation conseillée était prise ; `null` s'il n'y a rien à conseiller. */
  curveWithSnack: FuelPoint[] | null;
  /** Niveau à l'heure demandée (g) et sa part de la capacité. */
  nowG: number;
  nowShare: number;
  /** Point le plus bas du reste de la journée. */
  lowest: FuelPoint;
  /** Grammes de glucides conseillés avant la prochaine séance, `null` si rien à conseiller (R7). */
  snackG: number | null;
  /** Prochaine séance planifiée du jour, `null` s'il n'y en a plus. */
  nextSessionHour: number | null;
  mealsCount: number;
  sessionsCount: number;
  explanation: Explanation;
};

/** Heure locale décimale d'un horodatage ISO (12 h 30 → 12,5). */
function hourOf(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

/** Heure décimale d'un `HH:MM` local, `null` si absent ou illisible. */
function hourOfClock(clock: string | null): number | null {
  if (!clock) return null;
  const [h, m] = clock.split(':');
  const hours = Number(h);
  const minutes = Number(m ?? '0');
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours + minutes / 60;
}

/**
 * Le Réservoir d'une journée. `null` sans poids connu (spec R9) : la carte ne s'affiche pas plutôt
 * que d'inventer une capacité.
 *
 * `atHour` est une **entrée** (l'écran fournit l'heure courante) : le module de calcul reste pur et
 * testable, et une journée passée s'affiche à 24 h, sans projection (R10).
 */
export function useFuelTank(
  dayKey: string,
  atHour: number,
): { tank: FuelTank | null; isLoading: boolean } {
  const { entries, isLoading: entriesLoading } = useDayEntries(dayKey);
  const { byDay, isLoading: energyLoading } = useEnergyItemsByDay();
  const { resting, weightKg, isLoading: restingLoading } = useRestingMetabolismAt(dayKey);
  const { entries: weights } = useWeightEntries();
  const { items: planned, isLoading: plannedLoading } = useUpcomingSessions(1);

  const tank = useMemo<FuelTank | null>(() => {
    const capacity = computeCapacityG(weightKg);
    if (capacity === null) return null;

    // Lu DANS le mémo : `byDay.get(...) ?? []` construit un tableau neuf à chaque rendu, et le
    // mémo se relancerait à chaque passe — sur une simulation de 288 pas, ça se voit.
    const dayItems = byDay.get(dayKey) ?? [];

    // ── Les apports : un repas = une heure conventionnelle (D3), pas une heure réelle.
    const byMeal = new Map<string, number>();
    for (const entry of entries) {
      byMeal.set(entry.mealType, (byMeal.get(entry.mealType) ?? 0) + entry.carbsG);
    }
    const meals: FuelMeal[] = [];
    for (const [mealType, carbsG] of byMeal) {
      const atMealHour = mealHour(mealType);
      if (atMealHour === undefined || carbsG <= 0) continue;
      meals.push({ atHour: atMealHour, carbsG });
    }

    // ── Les séances réalisées : déjà estimées par DEPENSE-01.
    const doneSessions: FuelSession[] = dayItems.map((item) => ({
      startHour: hourOf(item.startedAt),
      durationH: (item.durationSeconds ?? 0) / 3600,
      kcal: item.estimate.kcal,
      met: item.estimate.met,
    }));

    // ── Les séances planifiées encore à venir : convention assumée, via le même moteur.
    const plannedSessions: FuelSession[] = [];
    if (resting !== null) {
      for (const item of planned) {
        if (item.scheduledDate !== dayKey || item.status !== 'planned') continue;
        const startHour = hourOfClock(item.scheduledTime);
        if (startHour === null || startHour < atHour) continue;
        const met = item.pillar === 'running' ? PLANNED_MET.running : PLANNED_MET.strength;
        const estimate = estimateMetEnergy({
          met,
          minutes: PLANNED_DURATION_H * 60,
          resting,
          spread: 0.25,
          confidence: 'low',
        });
        if (estimate === null) continue;
        plannedSessions.push({
          startHour,
          durationH: PLANNED_DURATION_H,
          kcal: estimate.kcal,
          met,
        });
      }
    }

    const sessions = [...doneSessions, ...plannedSessions];
    const curve = simulateDay({ capacityG: capacity, meals, sessions });
    const nowG = levelAt(curve, atHour);
    const lowest = lowestBetween(curve, atHour, 24);

    // La prochaine séance décide s'il y a quelque chose à conseiller (R7).
    const next =
      plannedSessions
        .slice()
        .sort((a, b) => a.startHour - b.startHour)
        .find((s) => s.startHour >= atHour) ?? null;

    const snackG =
      next === null
        ? null
        : snackAdviceG({
            capacityG: capacity,
            meals,
            sessions,
            nextSession: next,
            atHour: Math.min(23, atHour + 0.5),
          });

    const curveWithSnack =
      snackG === null
        ? null
        : simulateDay({
            capacityG: capacity,
            meals: [...meals, { atHour: Math.min(23, atHour + 0.5), carbsG: snackG }],
            sessions,
          });

    const mealsCarbsG = meals.reduce((sum, m) => sum + m.carbsG, 0);
    const sessionsCostG = sessions.reduce(
      (sum, s) => sum + sessionCarbCostG({ kcal: s.kcal, met: s.met }),
      0,
    );

    // Les pesées arrivent par date croissante : la dernière est la plus récente.
    const lastWeightDate = weights.length > 0 ? weights[weights.length - 1]!.logDate : null;
    const weightAgeDays =
      lastWeightDate === null
        ? null
        : Math.round(
            (new Date(`${dayKey}T00:00:00`).getTime() - new Date(`${lastWeightDate}T00:00:00`).getTime()) /
              86_400_000,
          );

    return {
      capacityG: capacity,
      curve,
      curveWithSnack,
      nowG,
      nowShare: nowG / capacity,
      lowest,
      snackG,
      nextSessionHour: next?.startHour ?? null,
      mealsCount: meals.length,
      sessionsCount: sessions.length,
      explanation: explainGlycogen({
        capacityG: capacity,
        startG: capacity * START_OF_DAY_SHARE,
        mealsCarbsG,
        mealsCount: meals.length,
        sessionsCostG,
        sessionsCount: sessions.length,
        restDrainG: REST_DRAIN_G_PER_H * Math.min(24, Math.max(0, atHour)),
        nowG,
        weightAgeDays,
      }),
    };
  }, [entries, byDay, weightKg, resting, planned, weights, atHour, dayKey]);

  return {
    tank,
    isLoading: entriesLoading || energyLoading || restingLoading || plannedLoading,
  };
}

/** Seuil de la zone basse en grammes, pour l'affichage. */
export function lowZoneG(capacityG: number): number {
  return Math.round(capacityG * LOW_ZONE_SHARE);
}
