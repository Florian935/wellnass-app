/**
 * Le fantôme de la dernière fois — US MUSCU-UX03, spec §5.10 et §5.12.
 *
 * Ta séance d'aujourd'hui court à côté de la dernière fois, en **tonnage cumulé**, série après
 * série. Ni points, ni niveaux, ni badges : une comparaison avec soi-même, qui donne surtout à la
 * **dernière série** un objectif chiffré — le moment où l'on a le plus envie de s'arrêter.
 *
 * Le tonnage retenu est celui que le reste de l'app utilise déjà (`reps × charge`, séries validées
 * hors échauffement) : une série à la durée ou une série au poids du corps sans lest pèse 0, comme
 * dans l'historique et le bilan.
 */

import type { SetFeel } from './set-feel';
import type { SetType } from './workout';

/** Une série d'aujourd'hui, validée. `rank` est son rang dans son exercice (0-based). */
export type GhostDoneSet = {
  exerciseId: string;
  rank: number;
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
};

/**
 * Les séries de référence d'un exercice (dernière séance terminée où il a été fait).
 *
 * `durationSeconds` est porté ici alors que le tonnage l'ignore : c'est la **même** référence qui
 * sert au verdict (§5.3), et lui en a besoin pour une série à la durée. Une seule lecture, deux
 * usages — plutôt que deux requêtes qui pourraient diverger.
 */
export type GhostReference = {
  sets: ReadonlyArray<{
    setType: SetType;
    reps: number | null;
    weightKg: number | null;
    durationSeconds?: number | null;
  }>;
  /** Date de fin de cette séance (UTC ISO), pour nommer le jour. */
  finishedAt: string | null;
};

export type GhostState = {
  /** Tonnage cumulé aujourd'hui. */
  you: number;
  /** Tonnage cumulé de la référence, **aux mêmes rangs** que les séries déjà faites. */
  ghost: number;
  /** `you − ghost`. Positif = en avance. */
  delta: number;
  /** Tonnage total de la référence sur toute la séance — la cible à dépasser pour « battre mardi ». */
  ghostTotal: number;
  /** Courbe : un point par série validée, plus l'origine. */
  points: { you: number; ghost: number }[];
  /** Faux quand aucun exercice de la séance n'a d'historique : pas de fantôme, rien à afficher. */
  hasGhost: boolean;
};

/** Tonnage d'une série, avec les mêmes exclusions que l'historique (échauffement, durée, nuls). */
export function setTonnage(set: {
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
}): number {
  if (set.setType === 'warmup' || set.setType === 'duration') return 0;
  if (set.reps === null || set.weightKg === null) return 0;
  return set.reps * set.weightKg;
}

/**
 * État du fantôme après les séries validées.
 *
 * @param done       Séries validées aujourd'hui, **dans l'ordre de validation**.
 * @param references Séries de référence par exercice.
 */
export function computeGhost({
  done,
  references,
}: {
  done: ReadonlyArray<GhostDoneSet>;
  references: Readonly<Record<string, GhostReference>>;
}): GhostState {
  const hasGhost = Object.values(references).some((reference) => reference.sets.length > 0);

  let you = 0;
  let ghost = 0;
  const points: { you: number; ghost: number }[] = [{ you: 0, ghost: 0 }];

  for (const set of done) {
    you += setTonnage(set);
    const reference = references[set.exerciseId]?.sets[set.rank];
    // Rang sans référence (série ajoutée en séance, exercice jamais fait) : le fantôme n'avance pas.
    if (reference) ghost += setTonnage(reference);
    points.push({ you, ghost });
  }

  const ghostTotal = Object.values(references).reduce(
    (total, reference) => total + reference.sets.reduce((sum, set) => sum + setTonnage(set), 0),
    0,
  );

  return { you, ghost, delta: you - ghost, ghostTotal, points, hasGhost };
}

export type FinalChallenge =
  /** Déjà devant : on le dit, on ne demande rien. */
  | { kind: 'ahead'; aheadKg: number }
  /** Objectif atteignable sur la dernière série. */
  | { kind: 'challenge'; reps: number }
  /** Rien à proposer (hors de portée, charge inconnue, ou série précédente « limite »). */
  | { kind: 'none' };

/**
 * Défi de la dernière série (spec §5.12).
 *
 * Volontairement **prudent** : on ne le propose que s'il tient en `prévu + 2` répétitions, et jamais
 * après un ressenti « Limite » — pousser quelqu'un qui vient de dire qu'il était à bout n'est pas le
 * rôle de l'app.
 */
export function computeFinalChallenge({
  you,
  ghostTotal,
  weightKg,
  plannedReps,
  lastFeel = null,
}: {
  you: number;
  ghostTotal: number;
  weightKg: number | null;
  plannedReps: number | null;
  lastFeel?: SetFeel | null;
}): FinalChallenge {
  if (ghostTotal <= 0) return { kind: 'none' };
  if (you >= ghostTotal) return { kind: 'ahead', aheadKg: Math.round(you - ghostTotal) };
  if (lastFeel === 'limite') return { kind: 'none' };
  if (weightKg === null || weightKg <= 0) return { kind: 'none' };

  const reps = Math.ceil((ghostTotal - you) / weightKg);
  const ceiling = (plannedReps ?? 0) + 2;
  if (reps <= 0 || reps > ceiling) return { kind: 'none' };
  return { kind: 'challenge', reps };
}
