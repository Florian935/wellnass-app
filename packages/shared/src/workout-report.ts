/**
 * US MUSCU-UX02 — le **bilan de séance**, en un seul objet.
 *
 * ── Ce que ce module remplace ────────────────────────────────────────────────────────────────────
 * Deux écrans racontaient la même séance différemment : `workout-summary.tsx` (623 l) montrait
 * quatre agrégats et l'écart par exercice, `history/[id].tsx` (484 l) montrait le détail série par
 * série et l'écart au planifié — et le **ressenti** s'y lisait « 8/10 » quand le récap affichait
 * « Difficile », deux lectures contradictoires de la même colonne.
 *
 * `computeWorkoutReport` produit ce que les **deux** écrans affichent. L'iso cesse d'être une
 * discipline à tenir pour devenir une propriété du code : il n'y a plus qu'un calcul, plus qu'un
 * rendu, et la route ne choisit que son en-tête.
 *
 * ── La règle qui gouverne tout le module ─────────────────────────────────────────────────────────
 * **Un bloc sans donnée rend `null` ; il ne rend jamais zéro** (spec R2). Une première séance n'a
 * pas « progressé de 0 % », elle n'a rien à comparer ; un exercice sans 1RM connu n'est pas « à
 * 0 % du max ». C'est la discipline déjà tenue par `compareExercisePerformance`, généralisée ici.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 */

import type { MuscleGroup } from './exercise';
import { parseTargetReps } from './execution-compliance';
import { estimate1RM } from './records';
import { computeRepRangeSplit, type RepRangeShare } from './rep-ranges';
import {
  computeSessionComparison,
  type ReferenceSession,
  type SessionComparison,
} from './session-comparison';
import {
  computeSessionMuscleSplit,
  HARD_SET_RPE,
  type MuscleGroupSessionSplit,
} from './session-muscle-split';
import { computeSetTypeMix, type SetTypeShare } from './set-type-mix';
import {
  bestKnownOneRm,
  sessionRelativeIntensity,
  type OneRmRecord,
} from './strength-intensity';
import { compareExercisePerformance, type ComparableSet, type ExerciseDelta } from './workout-comparison';
import type { WorkoutDisplayLevel } from './workout-display';
import { computeTrainingDensity, computeVolume } from './workout';

// ---------------------------------------------------------------------------
// Visibilité des blocs selon le niveau
// ---------------------------------------------------------------------------

/**
 * Ce que chaque niveau montre. **Calque délibéré de `workoutFieldVisibility`** (US MUSC-F13) : même
 * forme, même patron, même discipline — un seul endroit décide, l'écran ne fait qu'obéir.
 *
 * Les blocs **toujours** présents (verdict, bande de stats principale, liste des exercices,
 * ressenti, actions) sont hors de cet objet, exactement comme les champs cœur de la carte de séance.
 */
export type WorkoutReportBlockVisibility = {
  /** Deuxième rangée de stats : densité, %1RM, RPE moyen. */
  secondaryStats: boolean;
  /** Troisième rangée : charge sRPE, séries dures, meilleur 1RM. */
  advancedStats: boolean;
  habitComparison: boolean;
  muscleSplit: boolean;
  /** Colonne « dont séries dures » dans la répartition musculaire. */
  hardSets: boolean;
  programCompliance: boolean;
  relativeIntensity: boolean;
  repRanges: boolean;
  setTypes: boolean;
  recordDetail: boolean;
  sessionWeight: boolean;
  /**
   * Détail série par série. Trois états et non un booléen : en Intermédiaire il existe mais reste
   * **replié** (spec D6) — un écran de 4 000 px sans repères est illisible.
   */
  setDetail: 'hidden' | 'collapsed' | 'expanded';
};

export function workoutReportVisibility(level: WorkoutDisplayLevel): WorkoutReportBlockVisibility {
  const normalPlus = level === 'normal' || level === 'detailed';
  const detailed = level === 'detailed';
  return {
    secondaryStats: normalPlus,
    advancedStats: detailed,
    habitComparison: normalPlus,
    muscleSplit: normalPlus,
    hardSets: detailed,
    programCompliance: normalPlus,
    relativeIntensity: detailed,
    repRanges: detailed,
    setTypes: detailed,
    recordDetail: detailed,
    sessionWeight: detailed,
    setDetail: detailed ? 'expanded' : normalPlus ? 'collapsed' : 'hidden',
  };
}

// ---------------------------------------------------------------------------
// Entrées
// ---------------------------------------------------------------------------

/** Une série telle que le bilan la lit. Superset des besoins de tous les blocs. */
export type ReportSet = {
  id: string;
  exerciseId: string;
  setType: string;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  rpe: number | null;
  plannedWeightKg: number | null;
  /** Texte libre du plan (« 10 », « 8-12 », « AMRAP »…). `null` hors programme. */
  targetReps: string | null;
  done: boolean;
  orderIndex: number;
};

/** Un record battu pendant cette séance, déjà résolu par l'appelant. */
export type ReportRecord = {
  exerciseId: string;
  exerciseName: string;
  type: string;
  value: number;
  /** Meilleure valeur connue **avant** cette séance. `null` = premier record du type. */
  previousValue: number | null;
};

export type WorkoutReportInput = {
  workoutId: string;
  /** Titre de la séance (« Haut du corps »). `null` pour une séance libre sans nom. */
  title: string | null;
  startedAt: string;
  durationSeconds: number | null;
  /** Ressenti de séance, stocké en RPE 1-10. `null` = non saisi. */
  feelingRpe: number | null;
  notes: string | null;
  sets: ReadonlyArray<ReportSet>;
  /** `exerciseId` → nom affichable, déjà traduit. */
  exerciseNames: ReadonlyMap<string, string>;
  /** `exerciseId` → groupe musculaire primaire. */
  exerciseMuscle: ReadonlyMap<string, MuscleGroup>;
  /** Records personnels connus, pour l'intensité relative (%1RM). */
  oneRmRecords: ReadonlyArray<OneRmRecord>;
  records: ReadonlyArray<ReportRecord>;
  /** Séries du passage précédent, par exercice. Absent = premier passage. */
  previousSetsByExercise: ReadonlyMap<string, ReadonlyArray<ComparableSet>>;
  /** Séances de même titre, **hors courante**, du plus récent au plus ancien. */
  referenceSessions: ReadonlyArray<ReferenceSession>;
  /** Meilleur tonnage connu sur une séance de même titre, hors courante. `null` si aucune. */
  bestPreviousVolumeSameTitle: number | null;
  /** Séances (tous titres) de la semaine calendaire en cours, celle-ci comprise. */
  weekSessionCount: number;
  weekVolumeKg: number;
  lifetimeVolumeKg: number;
};

// ---------------------------------------------------------------------------
// Sorties
// ---------------------------------------------------------------------------

export type ReportExercise = {
  exerciseId: string;
  exerciseName: string;
  /**
   * **Toutes** les séries : échauffements compris, et **non validées comprises**. Le détail les
   * montre, parce qu'une séance interrompue garde ses séries prévues et que les masquer ferait
   * relire un entraînement plus propre que celui qu'on a fait.
   */
  sets: ReportSet[];
  /** Séries de travail (échauffements exclus). */
  workingSets: ReportSet[];
  volumeKg: number;
  /** Écart depuis le passage précédent. `null` = rien à comparer (spec R2). */
  delta: ExerciseDelta | null;
  /** Meilleur 1RM estimé de la séance sur cet exercice. `null` sans série chargée. */
  bestEstimated1RM: number | null;
  /** Intensité relative moyenne, pondérée par les reps. `null` sans 1RM de référence. */
  relativeIntensityPercent: number | null;
};

export type SessionTotals = {
  exercises: number;
  workingSets: number;
  warmupSets: number;
  volumeKg: number;
  densityKgPerMin: number;
  durationMin: number;
  bestEstimated1RM: number | null;
  relativeIntensityPercent: number | null;
  averageRpe: number | null;
  /** Charge sRPE = minutes × RPE de séance (spec R7). `null` sans ressenti. */
  sessionLoad: number | null;
  hardSets: number;
  /** Séries de travail effectivement notées — le dénominateur honnête de `hardSets`. */
  ratedSets: number;
};

/**
 * Ce que la séance a à dire, en une phrase. **Un cas = une clé i18n**, jamais de concaténation :
 * l'ordre des mots diffère en anglais, et « Ton meilleur {exercice} » n'est pas « Your best
 * {exercise} » assemblé à partir des mêmes morceaux.
 */
export type SessionVerdict =
  | { kind: 'record'; exerciseName: string; recordCount: number }
  | { kind: 'best_volume'; sessionTitle: string }
  | { kind: 'progress'; exerciseName: string; deltaKg: number }
  | { kind: 'weekly'; sessionCount: number }
  | { kind: 'done'; durationMin: number };

export type SessionCompliance = {
  /** Séries validées portant une prescription exploitable. */
  plannedSets: number;
  compliantSets: number;
  /** Part entière, 0-100. */
  percent: number;
  /** Les écarts, pour les nommer. Limité aux séries sous la charge prescrite. */
  deviations: Array<{ exerciseName: string; plannedWeightKg: number; weightKg: number | null }>;
};

export type WorkoutReport = {
  workoutId: string;
  title: string | null;
  startedAt: string;
  feelingRpe: number | null;
  notes: string | null;
  totals: SessionTotals;
  exercises: ReportExercise[];
  records: ReportRecord[];
  verdict: SessionVerdict;
  comparison: SessionComparison | null;
  muscleSplit: MuscleGroupSessionSplit[] | null;
  repRanges: RepRangeShare[] | null;
  setTypes: SetTypeShare[] | null;
  compliance: SessionCompliance | null;
  weight: { weekSessionCount: number; weekVolumeKg: number; lifetimeVolumeKg: number };
};

// ---------------------------------------------------------------------------
// Conformité au plan, sur CETTE séance
// ---------------------------------------------------------------------------

/**
 * Conformité de la séance à sa prescription.
 *
 * ⚠️ **Distinct de `computeExecutionCompliance`**, qui mesure une tendance sur une fenêtre de
 * plusieurs séances (MUSC-33) et se tait sous trois séances de programme. Ici la question est
 * « ai-je fait ce qui était prévu **aujourd'hui** ? », et elle a un sens dès la première séance.
 * On réutilise en revanche son `parseTargetReps` — le parsing tolérant du texte libre est
 * exactement le même problème, et deux implémentations divergeraient.
 *
 * Une série est **conforme** quand la charge réalisée atteint la charge prescrite et que les
 * répétitions atteignent le bas de la fourchette. Viser plus haut que le plan n'est pas un écart :
 * c'est le but de la surcharge progressive, et le compter comme une déviation ferait chuter le
 * taux de qui progresse.
 *
 * Rend `null` hors programme : une séance libre n'a rien à quoi se conformer, et afficher « 0 % »
 * y serait un reproche absurde.
 */
export function computeSessionCompliance(input: {
  sets: ReadonlyArray<ReportSet>;
  exerciseNames: ReadonlyMap<string, string>;
}): SessionCompliance | null {
  let plannedSets = 0;
  let compliantSets = 0;
  const deviations: SessionCompliance['deviations'] = [];

  for (const set of input.sets) {
    if (!set.done || set.setType === 'warmup') continue;
    if (set.plannedWeightKg === null || !Number.isFinite(set.plannedWeightKg)) continue;

    plannedSets += 1;

    const weightOk = set.weightKg !== null && set.weightKg >= set.plannedWeightKg;
    const target = parseTargetReps(set.targetReps);
    // Cible illisible (« AMRAP », « max », vide) → on ne juge que la charge. Inventer une
    // interprétation fabriquerait des écarts fantômes sur les programmes les mieux écrits.
    const repsOk = target === null || (set.reps !== null && set.reps >= target.min);

    if (weightOk && repsOk) {
      compliantSets += 1;
    } else if (!weightOk) {
      deviations.push({
        exerciseName: input.exerciseNames.get(set.exerciseId) ?? set.exerciseId,
        plannedWeightKg: set.plannedWeightKg,
        weightKg: set.weightKg,
      });
    }
  }

  if (plannedSets === 0) return null;

  return {
    plannedSets,
    compliantSets,
    percent: Math.round((compliantSets / plannedSets) * 100),
    deviations,
  };
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

/**
 * La phrase qui conclut le bilan — **le bloc qui manquait** : l'ancien écran ne concluait jamais,
 * on scrollait jusqu'à « Retour à l'accueil ».
 *
 * Ordre de priorité strict (spec R3), première condition qui s'applique. L'ordre n'est pas
 * esthétique : il va du plus rare au plus banal, pour qu'une vraie nouvelle ne soit jamais masquée
 * par une nouvelle tiède. Le dernier cas est un repli qui ne peut pas échouer — un bilan doit
 * toujours dire quelque chose.
 */
export function computeSessionVerdict(input: {
  title: string | null;
  durationMin: number;
  records: ReadonlyArray<ReportRecord>;
  exercises: ReadonlyArray<ReportExercise>;
  volumeKg: number;
  bestPreviousVolumeSameTitle: number | null;
  weekSessionCount: number;
}): SessionVerdict {
  // 1. Un record battu prime sur tout.
  if (input.records.length > 0) {
    // L'exercice le plus représenté parmi les records : c'est celui dont on parle.
    const byExercise = new Map<string, { name: string; count: number }>();
    for (const record of input.records) {
      const entry = byExercise.get(record.exerciseId) ?? { name: record.exerciseName, count: 0 };
      entry.count += 1;
      byExercise.set(record.exerciseId, entry);
    }
    const lead = [...byExercise.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))[0]!;
    return { kind: 'record', exerciseName: lead.name, recordCount: input.records.length };
  }

  // 2. Plus gros tonnage jamais réalisé sur ce type de séance.
  if (
    input.title !== null &&
    input.bestPreviousVolumeSameTitle !== null &&
    input.volumeKg > input.bestPreviousVolumeSameTitle
  ) {
    return { kind: 'best_volume', sessionTitle: input.title };
  }

  // 3. Progression en charge sur l'exercice qui pèse le plus lourd dans la séance — pas le premier
  //    de la liste : l'ordre de saisie ne dit rien de l'importance.
  const heaviest = [...input.exercises]
    .filter((e) => e.delta?.kind === 'weight' && e.delta.deltaKg > 0)
    .sort((a, b) => b.volumeKg - a.volumeKg)[0];
  if (heaviest && heaviest.delta?.kind === 'weight') {
    return { kind: 'progress', exerciseName: heaviest.exerciseName, deltaKg: heaviest.delta.deltaKg };
  }

  // 4. Régularité — la seule bonne nouvelle qui ne demande aucune performance.
  if (input.weekSessionCount >= 3) {
    return { kind: 'weekly', sessionCount: input.weekSessionCount };
  }

  // 5. Repli. Ne peut pas échouer.
  return { kind: 'done', durationMin: input.durationMin };
}

// ---------------------------------------------------------------------------
// Assemblage
// ---------------------------------------------------------------------------

/** Meilleur 1RM estimé sur un lot de séries. `null` si aucune n'est chargée et comptée. */
function bestEstimated1RM(sets: ReadonlyArray<ReportSet>): number | null {
  let best: number | null = null;
  for (const set of sets) {
    if (set.reps === null || set.weightKg === null || set.weightKg <= 0) continue;
    const value = estimate1RM(set.weightKg, set.reps);
    if (best === null || value > best) best = value;
  }
  return best;
}

/**
 * Le bilan complet d'une séance.
 *
 * Tout est calculé en une fois, sur des données déjà en mémoire : l'écran ne doit pas rouvrir la
 * base bloc par bloc. L'ancien récap interrogeait les records **trois fois** (bandeau, section,
 * écran) et le détail **deux fois** ; le niveau Avancé aurait multiplié ça par le nombre de blocs.
 */
export function computeWorkoutReport(input: WorkoutReportInput): WorkoutReport {
  const doneSets = input.sets.filter((s) => s.done);
  const workingSets = doneSets.filter((s) => s.setType !== 'warmup');
  const warmupSets = doneSets.filter((s) => s.setType === 'warmup');

  // ── Par exercice, dans l'ordre où ils ont été faits ──────────────────────────────────────────
  //
  // 🔴 Le regroupement porte sur **toutes** les séries, y compris celles qui n'ont pas été
  // validées. Une séance interrompue garde ses séries prévues, et les masquer ferait relire un
  // entraînement plus propre que celui qu'on a fait — c'est ce que montrait l'ancien écran
  // d'historique, et le perdre serait une régression silencieuse.
  //
  // Les totaux, eux, ne comptent que le validé : c'est `workingSets` qui porte cette distinction.
  const order: string[] = [];
  const setsByExercise = new Map<string, ReportSet[]>();
  for (const set of [...input.sets].sort((a, b) => a.orderIndex - b.orderIndex)) {
    if (!setsByExercise.has(set.exerciseId)) {
      setsByExercise.set(set.exerciseId, []);
      order.push(set.exerciseId);
    }
    setsByExercise.get(set.exerciseId)!.push(set);
  }

  const exercises: ReportExercise[] = order.flatMap((exerciseId) => {
    const sets = setsByExercise.get(exerciseId)!;
    const working = sets.filter((s) => s.done && s.setType !== 'warmup');
    // Un exercice qui n'a QUE des échauffements ne compte pas (règle métier §8, déjà tenue par
    // l'ancien `buildSummary`).
    if (working.length === 0) return [];

    const oneRm = bestKnownOneRm(input.oneRmRecords, exerciseId);

    return [
      {
        exerciseId,
        exerciseName: input.exerciseNames.get(exerciseId) ?? exerciseId,
        sets,
        workingSets: working,
        volumeKg: computeVolume(working),
        delta: compareExercisePerformance(working, input.previousSetsByExercise.get(exerciseId)),
        bestEstimated1RM: bestEstimated1RM(working),
        relativeIntensityPercent: sessionRelativeIntensity(working, oneRm),
      },
    ];
  });

  // ── Totaux ──────────────────────────────────────────────────────────────────────────────────
  const volumeKg = Math.round(computeVolume(doneSets));
  const durationMin = Math.max(1, Math.round((input.durationSeconds ?? 0) / 60));
  const rated = workingSets.filter((s) => s.rpe !== null);

  // L'intensité relative de la séance est la moyenne des intensités par exercice, pondérée par le
  // tonnage : une moyenne simple mettrait sur le même plan l'exercice principal et une isolation
  // de fin de séance. Les exercices sans 1RM connu sont exclus des deux côtés du rapport.
  const withIntensity = exercises.filter((e) => e.relativeIntensityPercent !== null && e.volumeKg > 0);
  const intensityWeight = withIntensity.reduce((sum, e) => sum + e.volumeKg, 0);
  const relativeIntensityPercent =
    intensityWeight > 0
      ? withIntensity.reduce((sum, e) => sum + e.relativeIntensityPercent! * e.volumeKg, 0) / intensityWeight
      : null;

  const totals: SessionTotals = {
    exercises: exercises.length,
    workingSets: workingSets.length,
    warmupSets: warmupSets.length,
    volumeKg,
    densityKgPerMin: computeTrainingDensity(volumeKg, durationMin),
    durationMin,
    bestEstimated1RM: bestEstimated1RM(workingSets),
    relativeIntensityPercent,
    averageRpe: rated.length > 0 ? rated.reduce((sum, s) => sum + s.rpe!, 0) / rated.length : null,
    sessionLoad: input.feelingRpe === null ? null : durationMin * input.feelingRpe,
    hardSets: workingSets.filter((s) => s.rpe !== null && s.rpe >= HARD_SET_RPE).length,
    ratedSets: rated.length,
  };

  const verdict = computeSessionVerdict({
    title: input.title,
    durationMin,
    records: input.records,
    exercises,
    volumeKg,
    bestPreviousVolumeSameTitle: input.bestPreviousVolumeSameTitle,
    weekSessionCount: input.weekSessionCount,
  });

  return {
    workoutId: input.workoutId,
    title: input.title,
    startedAt: input.startedAt,
    feelingRpe: input.feelingRpe,
    notes: input.notes,
    totals,
    exercises,
    records: [...input.records],
    verdict,
    comparison: computeSessionComparison({
      current: {
        volumeKg,
        durationSeconds: input.durationSeconds,
        rpe: input.feelingRpe,
      },
      references: input.referenceSessions,
    }),
    muscleSplit: computeSessionMuscleSplit({
      sets: input.sets,
      exerciseMuscle: input.exerciseMuscle,
    }),
    repRanges: computeRepRangeSplit({ sets: input.sets }),
    setTypes: computeSetTypeMix({ sets: input.sets }),
    compliance: computeSessionCompliance({
      sets: input.sets,
      exerciseNames: input.exerciseNames,
    }),
    weight: {
      weekSessionCount: input.weekSessionCount,
      weekVolumeKg: input.weekVolumeKg,
      lifetimeVolumeKg: input.lifetimeVolumeKg,
    },
  };
}
