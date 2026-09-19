/**
 * US CONS-01 — le Conseil des trois : les deux issues d'une contradiction, chiffrées.
 * Réf. : docs/specs/functional/us/cons01-conseil-des-trois.md
 *
 * ── Ce que ce module ajoute, et ce qu'il ne refait pas ────────────────────────────────────────
 * GUID-01 **détecte** la contradiction et propose deux issues ; LABO-01 sait **projeter** une
 * combinaison de doses (force avec fourchette, calories, poids à 8 semaines, protéines, charge,
 * tensions). Il ne manquait que le fil entre les deux. Ce module le tend : il traduit chaque issue
 * en doses, appelle `composeLab`, et rend les deux projections côte à côte.
 *
 * 🔴 **Aucun coefficient neuf, aucun calcul propre.** Tout vient de `lab-composer`, donc de
 * `projectWhatIf` (DASH-01), `projectSbd` (MUSCPWR-01), `targetCalories` (MN-04), MN-06 et META-19.
 * C'est ce qui permet d'afficher ces chiffres à côté de ceux du reste de l'app sans qu'ils se
 * contredisent.
 *
 * ⚠️ **Aucune projection d'allure ni de chrono** (spec R4). La maquette du 13/09 en montrait ; le
 * dépôt a déjà refusé ça une fois (coefficient inventé du prototype Labo, 15/09).
 *
 * ── Le module ne formule rien ────────────────────────────────────────────────────────────────
 * Il rend des **identifiants** et des nombres. L'i18n est obligatoire (décision G) et le ton d'un
 * arbitrage est le point dur de l'écran, pas du moteur.
 */

import type { GoalConflict } from './goal-conflicts';
import { composeLab, type LabComposerContext, type LabComposerResult, type LabDoses } from './lab-composer';
import type { Pillar } from './pillar';

/** Les deux issues de la carte de GUID-01, dans un ordre stable. */
export const COUNCIL_OPTIONS = ['keepMainGoal', 'keepPillarGoal'] as const;
export type CouncilOptionId = (typeof COUNCIL_OPTIONS)[number];

/**
 * Ce que chaque pilier a à dire. L'identifiant décide de la phrase ; les valeurs, des chiffres
 * qu'elle contient.
 */
export type CouncilVoiceId =
  /** Muscu : la force progresse (ou non) à la pente actuelle. */
  | 'strengthSlope'
  /** Muscu : pas assez d'historique pour dire quoi que ce soit. */
  | 'strengthUnknown'
  /** Assiette : la cible calorique actuelle et son écart au maintien. */
  | 'nutritionTarget'
  /** Course : le volume hebdomadaire déclaré, qui pèse sur les deux autres. */
  | 'runningVolume';

export type CouncilVoice = {
  pillar: Pillar;
  id: CouncilVoiceId;
  values: Record<string, number>;
};

export type CouncilOption = {
  id: CouncilOptionId;
  /** Les doses correspondant à cette issue — ce que l'écriture de GUID-01 produit réellement. */
  doses: LabDoses;
  projection: LabComposerResult;
};

export type Council = {
  rule: GoalConflict['rule'];
  voices: CouncilVoice[];
  /** Toujours deux, dans l'ordre de `COUNCIL_OPTIONS`. */
  options: CouncilOption[];
};

/**
 * Le Conseil, ou `null` quand il n'y a rien d'honnête à chiffrer.
 *
 * Deux refus, et ce sont des décisions de produit, pas des garde-fous techniques :
 *
 * 1. **`enduranceVsMass`** — ses deux issues changent l'objectif de course ou l'objectif principal,
 *    sans conséquence calculable : il faudrait RN-17 (volume de course croisé au déficit), que le
 *    catalogue donne « non construit ». Chiffrer quand même reviendrait à inventer un seuil, et
 *    `goal-conflicts.ts` a déjà refusé exactement ça en écrivant la règle.
 * 2. **Sans poids ni TDEE** — sans eux, ni calories ni poids projeté : il resterait deux colonnes
 *    vides et une page de plus à lire.
 */
export function buildCouncil(conflict: GoalConflict, ctx: LabComposerContext): Council | null {
  if (conflict.rule !== 'bulkVsCut') return null;
  if (ctx.weightKg === null || ctx.tdeeKcal === null) return null;

  return {
    rule: conflict.rule,
    voices: buildVoices(ctx),
    options: COUNCIL_OPTIONS.map((id) => {
      // `keepMainGoal` : l'objectif global (prise de masse) gagne, la nutrition passe en surplus.
      // `keepPillarGoal` : le réglage du pilier gagne, donc les doses **ne bougent pas** — c'est
      // l'objectif principal qui s'aligne, et il n'entre dans aucun calcul du composeur.
      const doses: LabDoses =
        id === 'keepMainGoal' ? { ...ctx.baseline, objective: 'bulk' } : { ...ctx.baseline };
      return { id, doses, projection: composeLab(ctx, doses) };
    }),
  };
}

/** Une voix par pilier actif, avec les chiffres que ce pilier connaît déjà. */
function buildVoices(ctx: LabComposerContext): CouncilVoice[] {
  const voices: CouncilVoice[] = [];

  if (ctx.activePillars.includes('strength')) {
    voices.push(
      ctx.sbd === null
        ? { pillar: 'strength', id: 'strengthUnknown', values: {} }
        : {
            pillar: 'strength',
            id: 'strengthSlope',
            values: {
              totalKg: Math.round(ctx.sbd.lastTotalKg),
              // Par semaine, arrondi au dixième : une pente au centième donnerait une fausse
              // précision sur une régression de quelques séances.
              perWeekKg: Math.round(ctx.sbd.slopePerWeek * 10) / 10,
            },
          },
    );
  }

  if (ctx.activePillars.includes('nutrition')) {
    const current = composeLab(ctx, ctx.baseline);
    if (current.kcalTarget !== null) {
      voices.push({
        pillar: 'nutrition',
        id: 'nutritionTarget',
        values: { kcal: current.kcalTarget, tdee: Math.round(ctx.tdeeKcal ?? 0) },
      });
    }
  }

  if (ctx.activePillars.includes('running') && ctx.baseline.runningFrequency > 0) {
    voices.push({
      pillar: 'running',
      id: 'runningVolume',
      values: { perWeek: ctx.baseline.runningFrequency },
    });
  }

  return voices;
}

/**
 * Tous les nombres d'un Conseil — la liste de référence du garde-fou de NARR-01 quand le modèle
 * résume cette page.
 */
export function councilNumbers(council: Council): number[] {
  const values = council.voices.flatMap((voice) => Object.values(voice.values));

  for (const option of council.options) {
    const { projection } = option;
    if (projection.kcalTarget !== null) values.push(projection.kcalTarget);
    values.push(projection.weightChangeKg);
    if (projection.proteinGPerDay !== null) values.push(projection.proteinGPerDay);
    if (projection.sbd !== null) {
      values.push(projection.sbd.projectedKg, projection.sbd.lowKg, projection.sbd.highKg, projection.sbd.deltaKg);
    }
    if (projection.load !== null) values.push(projection.load.ratio);
  }

  return values;
}
