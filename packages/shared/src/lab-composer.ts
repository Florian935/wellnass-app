/**
 * US LABO-01 (roadmap 7.30) — le Labo, onglet « Composer » : régler ses piliers ensemble et voir ce
 * que chaque dose change, avant de l'appliquer.
 *
 * ── D'où viennent les chiffres ─────────────────────────────────────────────────────────────────
 * **D'aucun coefficient neuf.** La projection de force et la charge viennent du moteur « Et si… »
 * de DASH-01 (`projectWhatIf`, `whatIfConsequences`), lui-même posé sur la pente réelle de
 * `projectSbd` (MUSCPWR-01). Les protéines viennent des fourchettes de MN-06, les calories de
 * l'objectif (`objectiveCalorieDelta`), les glucides du niveau de charge de FUEL-01. Le poids à
 * 8 semaines est la seule dérivée : le delta calorique de l'objectif × 56 jours ÷ 7 700 kcal/kg,
 * l'ordre de grandeur physiologique standard — l'écran le présente comme tel.
 *
 * ⚠️ **Pas de projection d'allure.** Le prototype affichait « 10 km −25 s » : c'était un coefficient
 * inventé. Aucun calcul validé ne relie aujourd'hui une dose à un chrono ; l'écran ne le prétend pas.
 *
 * ── Ce qui s'applique, et ce qui ne s'applique pas ─────────────────────────────────────────────
 * Trois leviers ont un réglage dans l'app et s'écrivent (fréquence de course, cible de protéines,
 * objectif nutritionnel). Les séances de musculation dépendent du programme : on renvoie vers lui.
 * Le sommeil est une habitude : il se simule, il ne s'écrit nulle part.
 */

import type { CarbTarget } from './carb-target';
import { CARB_TARGETS_G_PER_KG, computeCarbLoadLevel } from './carb-target';
import type { LabPair } from './lab-week';
import { objectiveCalorieDelta, targetCalories, type NutritionObjective } from './nutrition';
import type { Pillar } from './pillar';
import { PROTEIN_TARGETS_G_PER_KG } from './protein-target';
import { projectWhatIf, whatIfConsequences } from './what-if';

// ---------------------------------------------------------------------------
// Doses
// ---------------------------------------------------------------------------

export type LabDoses = {
  strengthSessions: number;
  runningFrequency: number;
  proteinGPerKg: number;
  objective: NutritionObjective;
  sleep: 'short' | 'long';
};

export type LabLever = keyof LabDoses;

/** L'ordre des objectifs, du plus restrictif au plus généreux : « + » ajoute des calories. */
export const LAB_OBJECTIVE_ORDER: readonly NutritionObjective[] = ['cut', 'weightloss', 'maintain', 'bulk'];

export const LAB_DOSE_BOUNDS = {
  strengthSessions: { min: 0, max: 6, step: 1 },
  runningFrequency: { min: 0, max: 7, step: 1 },
  proteinGPerKg: { min: 1.2, max: 2.4, step: 0.2 },
} as const;

/** Les leviers qui ont un réglage dans l'app et s'écrivent depuis le Labo. */
export const LAB_WRITABLE_LEVERS: readonly LabLever[] = ['runningFrequency', 'proteinGPerKg', 'objective'];

/** Horizon de projection, en semaines (borné ailleurs à 12 par `projectSbd`). */
export const LAB_PROJECTION_WEEKS = 8;

/** Au-delà, une semaine d'entraînement est « chargée » pour un déficit (même esprit que MN-02). */
export const LAB_HEAVY_WEEK = { strengthSessions: 4, runningFrequency: 5 } as const;

/** Un cran de plus ou de moins sur un levier ; `null` hors bornes. */
export function stepDose(doses: LabDoses, lever: LabLever, direction: 1 | -1): LabDoses | null {
  if (lever === 'objective') {
    const next = LAB_OBJECTIVE_ORDER[LAB_OBJECTIVE_ORDER.indexOf(doses.objective) + direction];
    return next ? { ...doses, objective: next } : null;
  }
  if (lever === 'sleep') {
    const next = direction === 1 ? 'long' : 'short';
    return next === doses.sleep ? null : { ...doses, sleep: next };
  }
  const { min, max, step } = LAB_DOSE_BOUNDS[lever];
  const value = Math.round((doses[lever] + direction * step) * 10) / 10;
  return value < min || value > max ? null : { ...doses, [lever]: value };
}

// ---------------------------------------------------------------------------
// Conséquences
// ---------------------------------------------------------------------------

export type LabComposerContext = {
  activePillars: readonly Pillar[];
  /** Les doses appliquées aujourd'hui : la référence de chaque écart. */
  baseline: LabDoses;
  weightKg: number | null;
  tdeeKcal: number | null;
  /** Pente et dernier total réels (`projectSbd` ok), `null` sans historique suffisant. */
  sbd: { lastTotalKg: number; slopePerWeek: number } | null;
  /** Ratio de charge actuel (META-19), `null` sans historique. */
  loadRatio: number | null;
  /** Durée moyenne d'une course (heures), pour estimer la charge hebdomadaire de FUEL-01. */
  hoursPerRun: number | null;
  ruleWeights?: { sleep?: number; protein?: number };
};

export type LabCrossingKind =
  | 'overreach'
  | 'loadRisk'
  | 'loadWatch'
  | 'deficitHeavyWeek'
  | 'proteinLow'
  | 'proteinStrength'
  | 'sleepSupports';

export type LabCrossing = {
  kind: LabCrossingKind;
  tone: 'guard' | 'tension' | 'syn';
  pair: LabPair;
  values: Record<string, number>;
};

export type LabChange = { lever: LabLever; from: number | string; to: number | string; writable: boolean };

export type LabComposerResult = {
  sbd: { projectedKg: number; lowKg: number; highKg: number; deltaKg: number } | null;
  load: { ratio: number; zone: 'safe' | 'watch' | 'risk'; delta: number } | null;
  kcalTarget: number | null;
  /** Variation de poids attendue sur l'horizon, d'après le seul delta de l'objectif. */
  weightChangeKg: number;
  proteinGPerDay: number | null;
  proteinStatus: 'low' | 'in' | 'high';
  carbTarget: CarbTarget | null;
  crossings: LabCrossing[];
  changes: LabChange[];
};

const CROSSING_ORDER: readonly LabCrossingKind[] = ['overreach', 'loadRisk', 'loadWatch', 'deficitHeavyWeek', 'proteinLow', 'proteinStrength', 'sleepSupports'];

function project(ctx: LabComposerContext, doses: LabDoses) {
  const training = doses.strengthSessions + doses.runningFrequency;
  const baseline = ctx.baseline.strengthSessions + ctx.baseline.runningFrequency;
  const protein: 'base' | 'high' = doses.proteinGPerKg >= PROTEIN_TARGETS_G_PER_KG[doses.objective].min ? 'high' : 'base';
  const whatIf = ctx.sbd
    ? projectWhatIf({
        lastTotalKg: ctx.sbd.lastTotalKg,
        slopePerWeek: ctx.sbd.slopePerWeek,
        weeks: LAB_PROJECTION_WEEKS,
        levers: { sessionsPerWeek: doses.strengthSessions, baselineSessions: ctx.baseline.strengthSessions, sleep: doses.sleep, protein },
        ruleWeights: ctx.ruleWeights,
      })
    : null;
  const consequences = whatIfConsequences({
    sessionsPerWeek: training,
    baselineSessions: baseline,
    loadRatio: ctx.loadRatio,
    baseKcalTarget: ctx.tdeeKcal === null ? 0 : targetCalories(ctx.tdeeKcal, doses.objective),
    // Le levier protéines est une CIBLE, déjà comprise dans les calories de l’objectif : pas de
    // supplément « protéines hautes » ici (celui de DASH-01 modélise un ajout, pas une cible).
    protein: 'base',
    weightKg: ctx.weightKg,
  });
  return { whatIf, consequences, extra: training - baseline };
}

export function composeLab(ctx: LabComposerContext, doses: LabDoses): LabComposerResult {
  const has = (p: Pillar) => ctx.activePillars.includes(p);
  const now = project(ctx, doses);
  const ref = project(ctx, ctx.baseline);
  const proteinTarget = PROTEIN_TARGETS_G_PER_KG[doses.objective];
  const proteinStatus: LabComposerResult['proteinStatus'] =
    doses.proteinGPerKg < proteinTarget.min ? 'low' : doses.proteinGPerKg > proteinTarget.max ? 'high' : 'in';
  const level = ctx.hoursPerRun === null ? null : computeCarbLoadLevel(ctx.hoursPerRun * doses.runningFrequency);

  const crossings: LabCrossing[] = [];
  const push = (c: LabCrossing) => crossings.push(c);
  if (has('strength') && now.whatIf?.overreach) {
    push({ kind: 'overreach', tone: 'guard', pair: ['sleep', 'strength'], values: { extraSessions: doses.strengthSessions - ctx.baseline.strengthSessions } });
  }
  const zone = now.consequences.loadZone;
  if (zone === 'risk') push({ kind: 'loadRisk', tone: 'guard', pair: ['strength', 'running'], values: { ratio: now.consequences.loadRatio! } });
  if (zone === 'watch') push({ kind: 'loadWatch', tone: 'tension', pair: ['strength', 'running'], values: { ratio: now.consequences.loadRatio! } });
  const deficit = objectiveCalorieDelta(doses.objective) < 0;
  const heavyWeek = doses.strengthSessions >= LAB_HEAVY_WEEK.strengthSessions || doses.runningFrequency >= LAB_HEAVY_WEEK.runningFrequency;
  if (has('nutrition') && deficit && heavyWeek) {
    push({ kind: 'deficitHeavyWeek', tone: 'tension', pair: ['nutrition', has('strength') ? 'strength' : 'running'], values: { kcalDelta: objectiveCalorieDelta(doses.objective) } });
  }
  if (has('nutrition') && has('strength') && doses.strengthSessions >= 2) {
    push(
      proteinStatus === 'low'
        ? { kind: 'proteinLow', tone: 'tension', pair: ['nutrition', 'strength'], values: { gPerKg: doses.proteinGPerKg, targetMin: proteinTarget.min } }
        : { kind: 'proteinStrength', tone: 'syn', pair: ['nutrition', 'strength'], values: { gPerKg: doses.proteinGPerKg } },
    );
  }
  if (doses.sleep === 'long' && (doses.strengthSessions >= 3 || doses.runningFrequency >= 4)) {
    push({ kind: 'sleepSupports', tone: 'syn', pair: ['sleep', has('strength') ? 'strength' : 'running'], values: {} });
  }
  crossings.sort((a, b) => CROSSING_ORDER.indexOf(a.kind) - CROSSING_ORDER.indexOf(b.kind));

  const changes: LabChange[] = (Object.keys(ctx.baseline) as LabLever[])
    .filter((lever) => ctx.baseline[lever] !== doses[lever])
    .map((lever) => ({ lever, from: ctx.baseline[lever], to: doses[lever], writable: LAB_WRITABLE_LEVERS.includes(lever) }));

  return {
    sbd:
      has('strength') && now.whatIf && ref.whatIf
        ? {
            projectedKg: Math.round(now.whatIf.projectedKg),
            lowKg: Math.round(now.whatIf.lowKg),
            highKg: Math.round(now.whatIf.highKg),
            deltaKg: Math.round(now.whatIf.projectedKg - ref.whatIf.projectedKg),
          }
        : null,
    load:
      now.consequences.loadRatio === null
        ? null
        : { ratio: now.consequences.loadRatio, zone: now.consequences.loadZone!, delta: Math.round((now.consequences.loadRatio - ref.consequences.loadRatio!) * 100) / 100 },
    kcalTarget: ctx.tdeeKcal === null ? null : now.consequences.kcalTarget,
    weightChangeKg: Math.round(((objectiveCalorieDelta(doses.objective) * LAB_PROJECTION_WEEKS * 7) / 7700) * 10) / 10,
    proteinGPerDay: ctx.weightKg === null ? null : Math.round(doses.proteinGPerKg * ctx.weightKg),
    proteinStatus,
    carbTarget: has('running') && level !== null ? CARB_TARGETS_G_PER_KG[level] : null,
    crossings,
    changes,
  };
}

/**
 * Le réglage le plus rentable : chaque cran possible, essayé sur la projection de force, retenu
 * s'il fait gagner **sans ouvrir de garde-fou ni de tension**. Jamais un objectif plus restrictif,
 * jamais un sommeil plus court : ce ne sont pas des leviers qu'on « optimise ».
 */
export function bestLabSteps(ctx: LabComposerContext, doses: LabDoses): { lever: LabLever; direction: 1 | -1; deltaKg: number }[] {
  const current = composeLab(ctx, doses);
  if (current.sbd === null) return [];
  const blocking = (r: LabComposerResult) => r.crossings.filter((c) => c.tone !== 'syn').length;
  const out: { lever: LabLever; direction: 1 | -1; deltaKg: number }[] = [];
  for (const lever of ['strengthSessions', 'proteinGPerKg', 'sleep'] as const) {
    for (const direction of [1, -1] as const) {
      if (lever === 'sleep' && direction === -1) continue;
      const next = stepDose(doses, lever, direction);
      if (next === null) continue;
      const result = composeLab(ctx, next);
      const deltaKg = result.sbd!.projectedKg - current.sbd.projectedKg;
      if (deltaKg > 0 && blocking(result) <= blocking(current)) out.push({ lever, direction, deltaKg });
    }
  }
  return out.sort((a, b) => b.deltaKg - a.deltaKg).slice(0, 2);
}
