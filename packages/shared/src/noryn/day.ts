/**
 * US NORYN-01 — `context/day` : la journée, telle que Noryn la lit (spec §4.1).
 *
 * Pur : aucune lecture d'horloge (`now` entre par paramètre), aucune requête. Les cibles caloriques
 * et le verdict de forme valent `null` en v1 (D1) : leur calcul est composé dans des hooks du mobile,
 * et NORYN-02 l'en sortira sans le changer — le recopier ici serait la duplication interdite.
 */

import { DEFAULT_WATER_TARGET_ML } from '../hydration';
import { normalizeStepGoal } from '../steps';
import type { NorynDay } from './contract';
import { buildNorynSessions } from './sessions';
import {
  boundedInt,
  refPaceOf,
  sessionInputsFor,
  syncedAtOf,
  trackedDomains,
  type OwnerSnapshot,
  type StepsRow,
  type WellbeingRow,
} from './snapshot';

/** Total de pas d'un jour : le plus grand s'il y en a plusieurs (règle 7 de PAS-01), `null` sinon. */
export function stepsOn(rows: readonly StepsRow[], date: string): number | null {
  const totals = rows.filter((r) => r.log_date === date).map((r) => r.steps);
  return totals.length === 0 ? null : boundedInt(Math.max(...totals), 0, 200_000);
}

/** L'objectif de pas, normalisé comme l'app (`normalizeStepGoal`). */
export function stepGoalOf(snapshot: OwnerSnapshot): number {
  return normalizeStepGoal(snapshot.profile?.daily_step_goal);
}

/** L'objectif d'eau, comme `HydrationCard` ; repli sur le défaut hors des bornes du contrat (DD6). */
function waterTargetOf(snapshot: OwnerSnapshot): number {
  return boundedInt(snapshot.nutritionProfile?.water_target_ml, 1, 10_000) ?? DEFAULT_WATER_TARGET_ML;
}

/** Consommé du jour : les deux sommes arrondies, **nulles ensemble** (sans entrée, ou l'une hors bornes). */
function consumedOn(snapshot: OwnerSnapshot, date: string): { kcal: number | null; protein: number | null } {
  const rows = snapshot.food.filter((r) => r.log_date === date);
  if (rows.length === 0) return { kcal: null, protein: null };
  const kcal = boundedInt(Math.round(rows.reduce((sum, r) => sum + r.kcal, 0)), 0, 20_000);
  const protein = boundedInt(Math.round(rows.reduce((sum, r) => sum + r.protein_g, 0)), 0, 2_000);
  return kcal === null || protein === null ? { kcal: null, protein: null } : { kcal, protein };
}

function waterOn(snapshot: OwnerSnapshot, date: string): number | null {
  const rows = snapshot.water.filter((r) => r.log_date === date);
  return rows.length === 0 ? null : boundedInt(rows.reduce((sum, r) => sum + r.volume_ml, 0), 0, 20_000);
}

/** Le check-in du matin : quatre champs, **rien d'autre de la ligne** (minimisation). */
function recoveryOf(row: WellbeingRow | null): NonNullable<NorynDay['recovery']> {
  return {
    sleep_minutes: boundedInt(row?.sleep_minutes, 0, 840),
    sleep_quality: boundedInt(row?.sleep_quality, 1, 5),
    energy: boundedInt(row?.energy, 1, 5),
    motivation: boundedInt(row?.motivation, 1, 5),
  };
}

export function buildNorynDay(snapshot: OwnerSnapshot, query: { date: string; now: Date }): NorynDay {
  const { date, now } = query;
  const syncedAt = syncedAtOf(snapshot.receivedAt, now);
  // Jamais synchronisé : aucune valeur mesurée ni saisie, aucune séance, pas de veille (contrat).
  const synced = syncedAt !== null;
  const tracked = trackedDomains(snapshot.settings);
  const wellbeing = synced ? (snapshot.wellbeing.find((r) => r.log_date === date) ?? null) : null;
  const consumed = synced ? consumedOn(snapshot, date) : { kcal: null, protein: null };

  return {
    date,
    generated_at: now.toISOString(),
    synced_at: syncedAt,
    steps: tracked.steps
      ? { count: synced ? stepsOn(snapshot.steps, date) : null, daily_target: stepGoalOf(snapshot) }
      : null,
    nutrition: tracked.nutrition
      ? {
          energy_kcal: consumed.kcal,
          energy_target_kcal: null,
          protein_g: consumed.protein,
          protein_target_g: null,
        }
      : null,
    hydration: tracked.nutrition
      ? { volume_ml: synced ? waterOn(snapshot, date) : null, target_ml: waterTargetOf(snapshot) }
      : null,
    // D5 : le check-in est au socle, il est toujours suivi.
    recovery: recoveryOf(wellbeing),
    readiness: null,
    // D4 : « malade » met l'intensité en veille (BIEN-04), pilier Bien-être allumé. Jamais le motif.
    intensity_on_hold: tracked.wellbeingPillar && wellbeing?.sick === true,
    training: synced ? buildNorynSessions(sessionInputsFor(snapshot, [date]), refPaceOf(snapshot)) : [],
  };
}
