/**
 * US RUN-F4 (lot F) — le realise descend au niveau de la REPETITION.
 * Ref. : docs/product/analyse-seances-structurees-running.md (mur M10)
 *
 * `runs` stocke 12 champs globaux + la trace GPS, et `compareToTarget` (RUN-F3) ne compare que
 * la distance et la duree GLOBALES. Une seance de fractionne se lit pourtant « reps 1 a 5 a
 * 4:01, la 7e a lache a 4:40 », pas « j'ai couru 8 km ». Ce module est le pendant calcul de la
 * table `run_intervals` : il fige le prevu au moment ou la phase est franchie, mesure le
 * realise, et resume la serie.
 *
 * Entierement pur : le tracker fournit distance et duree, ce fichier ne lit ni GPS ni base.
 */

import type { ExpandedIntervalPhase } from './running-intervals';
import { normalizePaceRange, type PaceRange, type SegmentKind } from './running-paces';

/** Une ligne prete a inserer dans `run_intervals` (colonnes camelCase). */
export type RunIntervalDraft = {
  phaseIndex: number;
  phaseKind: 'fast' | 'recovery';
  segmentKind: SegmentKind;
  rep: number;
  totalReps: number;
  plannedDistanceM: number | null;
  plannedDurationSeconds: number | null;
  plannedPaceMinSPerKm: number | null;
  plannedPaceMaxSPerKm: number | null;
  /**
   * Le realise. **Nullable, et c'est important** : lors d'un rattrapage silencieux (RUN-F2d
   * R8 bis), plusieurs phases sont franchies en une seule evaluation et l'axe non borne par la
   * phase n'est PAS mesurable individuellement — on sait que la fraction faisait 400 m, on ne
   * sait pas en combien de temps elle a ete couverte. On l'ecrit `null` plutot que d'inventer
   * une repartition : une allure fausse dans le tableau serait pire qu'une case vide.
   */
  actualDistanceM: number | null;
  actualDurationSeconds: number | null;
  /** `null` si la distance realisee est nulle ou inconnue — jamais `Infinity`. */
  actualPaceSPerKm: number | null;
};

/**
 * Fige une phase franchie en ligne de realise.
 *
 * Le PREVU est recopie, pas reference : la seance planifiee peut etre modifiee ou supprimee
 * apres coup, et le realise d'une course passee ne doit jamais changer retroactivement (meme
 * raison pour laquelle `run_intervals.block_id` est sans FK).
 *
 * `plannedPace*` prend la plage EFFECTIVE de la phase, deja resolue par l'appelant via
 * `resolvePhasePace` — ce module ne connait pas le profil coureur et ne doit pas le connaitre.
 */
export function buildIntervalDraft(input: {
  phaseIndex: number;
  phase: ExpandedIntervalPhase;
  actualDistanceM: number | null;
  actualDurationSeconds: number | null;
  plannedPace?: PaceRange | null;
}): RunIntervalDraft {
  const { phase, actualDistanceM, actualDurationSeconds } = input;
  const plannedPace = input.plannedPace ?? normalizePaceRange(phase.paceMinSPerKm, phase.paceMaxSPerKm);

  return {
    phaseIndex: input.phaseIndex,
    phaseKind: phase.kind,
    segmentKind: phase.segmentKind,
    rep: phase.rep,
    totalReps: phase.totalReps,
    plannedDistanceM: phase.distanceM,
    plannedDurationSeconds: phase.durationSeconds,
    plannedPaceMinSPerKm: plannedPace?.minSPerKm ?? null,
    plannedPaceMaxSPerKm: plannedPace?.maxSPerKm ?? null,
    actualDistanceM,
    actualDurationSeconds,
    // Les DEUX axes sont requis pour une allure : un rattrapage qui ne connait que la distance
    // ne produit pas d'allure, il produit une case vide assumee.
    actualPaceSPerKm:
      actualDistanceM != null && actualDistanceM > 0 && actualDurationSeconds != null
        ? (actualDurationSeconds * 1000) / actualDistanceM
        : null,
  };
}

/** Une ligne de realise relue depuis la base, telle que l'UI la manipule. */
export type RunIntervalRow = {
  phaseIndex: number;
  phaseKind: 'fast' | 'recovery';
  segmentKind: SegmentKind;
  rep: number;
  totalReps: number;
  plannedDistanceM: number | null;
  plannedDurationSeconds: number | null;
  plannedPaceMinSPerKm: number | null;
  plannedPaceMaxSPerKm: number | null;
  actualDistanceM: number | null;
  actualDurationSeconds: number | null;
  actualPaceSPerKm: number | null;
};

export type IntervalSeriesSummary = {
  /** Nombre de fractions rapides effectivement realisees. */
  fastCount: number;
  /** Allure moyenne des fractions rapides (s/km), `null` si aucune n'est mesurable. */
  avgFastPaceSPerKm: number | null;
  /** Ecart-type des allures rapides (s/km) — la REGULARITE, le vrai sujet d'une seance de VMA. */
  paceStdDevSPerKm: number | null;
  /** Fractions dont l'allure tombe dans la plage prevue (tolerance comprise). */
  inRangeCount: number;
  /** Fractions pour lesquelles une plage prevue existait — le denominateur du « X sur Y ». */
  ratedCount: number;
  /** Index (1-based dans la serie rapide) de la fraction la plus lente, `null` si < 2. */
  slowestRep: number | null;
  /** Index (1-based) de la plus rapide, `null` si < 2. */
  fastestRep: number | null;
};

/**
 * Resume d'une serie de fractions.
 *
 * ⚠️ Ne porte QUE sur les phases rapides. Inclure les recuperations melangerait deux populations
 * (4:00/km et 6:30/km) et rendrait la moyenne comme l'ecart-type illisibles — c'est le meme
 * piege que la polarisation ponderee par les courses plutot que par les kilometres (RUN-08).
 *
 * L'ecart-type est **population** (divise par n) et non echantillon (n-1) : on decrit LA serie
 * realisee, on n'estime pas la variance d'une population dont elle serait un tirage.
 */
export function summarizeIntervalSeries(
  rows: readonly RunIntervalRow[],
  toleranceSPerKm = 0,
): IntervalSeriesSummary {
  const fast = rows.filter((r) => r.phaseKind === 'fast');
  const paced = fast.filter(
    (r): r is RunIntervalRow & { actualPaceSPerKm: number } =>
      r.actualPaceSPerKm != null && Number.isFinite(r.actualPaceSPerKm) && r.actualPaceSPerKm > 0,
  );

  let inRangeCount = 0;
  let ratedCount = 0;
  for (const row of paced) {
    const range = normalizePaceRange(row.plannedPaceMinSPerKm, row.plannedPaceMaxSPerKm);
    if (range == null) continue;
    ratedCount += 1;
    if (
      row.actualPaceSPerKm >= range.minSPerKm - toleranceSPerKm &&
      row.actualPaceSPerKm <= range.maxSPerKm + toleranceSPerKm
    ) {
      inRangeCount += 1;
    }
  }

  if (paced.length === 0) {
    return {
      fastCount: fast.length,
      avgFastPaceSPerKm: null,
      paceStdDevSPerKm: null,
      inRangeCount,
      ratedCount,
      slowestRep: null,
      fastestRep: null,
    };
  }

  const paces = paced.map((r) => r.actualPaceSPerKm);
  const avg = paces.reduce((sum, p) => sum + p, 0) / paces.length;
  const variance = paces.reduce((sum, p) => sum + (p - avg) ** 2, 0) / paces.length;

  // Moins de 2 fractions : designer « la plus lente » n'a aucun sens, il n'y a pas de serie.
  let slowestRep: number | null = null;
  let fastestRep: number | null = null;
  if (paces.length >= 2) {
    let slowIdx = 0;
    let fastIdx = 0;
    paces.forEach((p, i) => {
      if (p > paces[slowIdx]!) slowIdx = i;
      if (p < paces[fastIdx]!) fastIdx = i;
    });
    slowestRep = slowIdx + 1;
    fastestRep = fastIdx + 1;
  }

  return {
    fastCount: fast.length,
    avgFastPaceSPerKm: avg,
    paceStdDevSPerKm: Math.sqrt(variance),
    inRangeCount,
    ratedCount,
    slowestRep,
    fastestRep,
  };
}
