/**
 * Verdict d'une série validée — US MUSCU-UX03 (mode immersif), spec §5.3.
 *
 * « Ce que valait la série », comparé à **la même série (même rang)** de la dernière séance terminée
 * où l'exercice a été fait. Répété 30 à 40 fois par séance : le calcul est pur, sans accès données,
 * et ne produit **que** des faits (écarts) — le ton et les mots vivent dans l'i18n.
 *
 * ⚠️ **Quatre écarts « depuis la dernière fois » cohabitent** dans l'app, et ils ne mesurent pas la
 * même chose : la **meilleure série** (`compareExercisePerformance`, R5-1 de MUSCU-UX01, au bilan),
 * la **même série** (ici), le **% de tonnage d'un exercice** (bilan d'exercice) et le **cumul du
 * fantôme** (`ghost.ts`). Ce module n'utilise donc **jamais** `compareExercisePerformance` : ce
 * serait mélanger « ta meilleure série » et « la même série que mardi ».
 */

import type { SetType } from './workout';

/** Une série, réduite à ce que le verdict regarde. */
export type VerdictSet = {
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
};

export type VerdictKind =
  /** Plus lourd qu'à la même série la dernière fois. */
  | 'heavier'
  /** Même charge, plus de répétitions. */
  | 'moreReps'
  /** Série à la durée : plus longtemps. */
  | 'longer'
  /** Exactement pareil. */
  | 'equal'
  /** En dessous — jamais présenté en rouge (spec §5.3). */
  | 'below'
  /** Aucune série de référence à ce rang (exercice jamais fait, ou série ajoutée). */
  | 'first'
  /** Échauffement : pas de verdict du tout. */
  | 'warmup';

/** Comment nommer la séance de référence : par son jour, par sa date, ou pas du tout. */
export type ReferenceDayKind = 'named' | 'date' | 'none';

export type SetVerdict = {
  kind: VerdictKind;
  /** Écart de charge, dans l'unité d'entrée. Présent pour `heavier` et `below` (charge). */
  deltaKg: number | null;
  /** Écart de répétitions. Présent pour `moreReps` et `below` (reps). */
  deltaReps: number | null;
  /** Écart de durée en secondes, pour une série à la durée. */
  deltaSeconds: number | null;
  /** Valeurs de la série de référence, pour les libellés « mardi 8 ». */
  reference: { reps: number | null; weightKg: number | null; durationSeconds: number | null } | null;
  dayKind: ReferenceDayKind;
};

/** Une référence de moins de 7 jours se nomme par son jour (« mardi »), au-delà par sa date. */
const NAMED_DAY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function dayKindFor(finishedAt: string | null | undefined, now: Date): ReferenceDayKind {
  if (!finishedAt) return 'none';
  const time = new Date(finishedAt).getTime();
  if (!Number.isFinite(time)) return 'none';
  return now.getTime() - time < NAMED_DAY_LIMIT_MS ? 'named' : 'date';
}

/**
 * Verdict d'une série validée face à sa référence.
 *
 * @param current     La série qu'on vient de valider.
 * @param reference   La série de **même rang** de la dernière séance terminée, ou `null`.
 * @param finishedAt  Date de fin (UTC ISO) de cette séance de référence — sert au jour nommé.
 * @param now         Maintenant (injecté pour être testable).
 */
export function computeSetVerdict({
  current,
  reference,
  finishedAt = null,
  now = new Date(),
}: {
  current: VerdictSet;
  reference: VerdictSet | null;
  finishedAt?: string | null;
  now?: Date;
}): SetVerdict {
  const empty: SetVerdict = {
    kind: 'first',
    deltaKg: null,
    deltaReps: null,
    deltaSeconds: null,
    reference: null,
    dayKind: 'none',
  };

  if (current.setType === 'warmup') return { ...empty, kind: 'warmup' };
  if (!reference) return empty;

  const dayKind = dayKindFor(finishedAt, now);
  const ref = {
    reps: reference.reps,
    weightKg: reference.weightKg,
    durationSeconds: reference.durationSeconds,
  };
  const base: SetVerdict = { ...empty, reference: ref, dayKind };

  // Série à la durée : la charge n'est qu'un lest, c'est le temps qui compte.
  if (current.setType === 'duration') {
    const nowSeconds = current.durationSeconds;
    const refSeconds = reference.durationSeconds;
    if (nowSeconds === null || refSeconds === null) return { ...base, kind: 'first' };
    const delta = nowSeconds - refSeconds;
    if (delta > 0) return { ...base, kind: 'longer', deltaSeconds: delta };
    if (delta === 0) return { ...base, kind: 'equal', deltaSeconds: 0 };
    return { ...base, kind: 'below', deltaSeconds: delta };
  }

  const weight = current.weightKg;
  const refWeight = reference.weightKg;
  const reps = current.reps;
  const refReps = reference.reps;

  // Charge d'abord : c'est elle qu'on cherche à monter.
  if (weight !== null && refWeight !== null && weight !== refWeight) {
    const delta = round2(weight - refWeight);
    return { ...base, kind: delta > 0 ? 'heavier' : 'below', deltaKg: delta, deltaReps: null };
  }

  if (reps !== null && refReps !== null && reps !== refReps) {
    const delta = reps - refReps;
    return { ...base, kind: delta > 0 ? 'moreReps' : 'below', deltaReps: delta };
  }

  // Ni charge ni reps exploitables (valeurs manquantes des deux côtés) : rien à dire.
  if ((weight === null || refWeight === null) && (reps === null || refReps === null)) {
    return { ...base, kind: 'first' };
  }

  return { ...base, kind: 'equal', deltaKg: 0, deltaReps: 0 };
}
