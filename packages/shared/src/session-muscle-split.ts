/**
 * US MUSCU-UX02 (catalogue MUSC-05 décliné à la séance) — **ce que la séance a réellement
 * travaillé**, groupe musculaire par groupe musculaire.
 *
 * ── Pourquoi ce module existe alors que `muscle-balance.ts` est déjà là ──────────────────────────
 * `computeMuscleBalance` répond à « suis-je équilibré sur 14 jours ? » : il compare des parts à une
 * cible uniforme et qualifie chaque groupe de délaissé / équilibré / sur-représenté. Ici la question
 * est autre — « qu'est-ce que je viens de faire ? » — et n'a **pas de cible** : une séance Haut du
 * corps *doit* ignorer les jambes, ce n'est pas un déséquilibre. Réutiliser le module de l'équilibre
 * aurait donc affiché une alerte de déséquilibre à la fin de chaque séance correctement construite.
 *
 * On partage le vocabulaire (`MuscleGroup`), pas le jugement.
 *
 * ── Les séries dures ─────────────────────────────────────────────────────────────────────────────
 * Le compte de séries dures (RPE ≥ 8, spec R6) est le proxy assumé des repères de volume
 * d'hypertrophie (MEV/MAV, catalogue MUSC-32, non cadrée). ⚠️ Une série **sans RPE** n'est pas
 * « pas dure » : elle est **inconnue**. Elle compte donc dans `sets` et pas dans `hardSets`, ce qui
 * fait de `hardSets` un **plancher** — jamais un pourcentage à présenter comme exact.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 */

import type { MuscleGroup } from './exercise';

/** Seuil de « série dure » sur l'échelle RPE 1-10 (spec R6). */
export const HARD_SET_RPE = 8;

/** Une série telle que la répartition en a besoin. */
export type MuscleSplitSet = {
  exerciseId: string;
  setType: string;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  done: boolean;
};

export type MuscleGroupSessionSplit = {
  group: MuscleGroup;
  /** Séries de travail validées (échauffements exclus, spec R4). */
  sets: number;
  /** Sous-ensemble de `sets` noté RPE ≥ 8. **Plancher** : voir l'en-tête du module. */
  hardSets: number;
  /** Tonnage du groupe, en kg·reps. */
  volumeKg: number;
};

/**
 * Répartition de la séance par groupe musculaire **primaire**, du plus travaillé au moins travaillé.
 *
 * Seul le muscle primaire compte : ventiler aussi les secondaires demanderait une pondération
 * (un développé couché vaut-il 0,5 triceps ?) que rien dans le dépôt ne justifie, et le total des
 * séries cesserait d'être celui de la séance — un utilisateur qui recompte à la main trouverait
 * plus de séries que ce qu'il a faites.
 *
 * Rend `null` quand aucune série de travail n'est exploitable : l'écran se tait plutôt que
 * d'afficher un bloc vide (spec R2).
 *
 * ⚠️ Un exercice **absent** de `exerciseMuscle` est ignoré, pas rangé dans un groupe « autre » :
 * inventer un groupe fausserait le total. Le cas se produit si l'exercice a été supprimé de la
 * bibliothèque après la séance.
 */
export function computeSessionMuscleSplit(input: {
  sets: ReadonlyArray<MuscleSplitSet>;
  /** `exerciseId` → groupe primaire. Résolu par l'appelant (jointure locale). */
  exerciseMuscle: ReadonlyMap<string, MuscleGroup>;
}): MuscleGroupSessionSplit[] | null {
  const byGroup = new Map<MuscleGroup, MuscleGroupSessionSplit>();

  for (const set of input.sets) {
    if (!set.done || set.setType === 'warmup') continue;
    const group = input.exerciseMuscle.get(set.exerciseId);
    if (group === undefined) continue;

    const entry = byGroup.get(group) ?? { group, sets: 0, hardSets: 0, volumeKg: 0 };
    entry.sets += 1;
    if (set.rpe !== null && set.rpe >= HARD_SET_RPE) entry.hardSets += 1;
    entry.volumeKg += (set.reps ?? 0) * (set.weightKg ?? 0);
    byGroup.set(group, entry);
  }

  if (byGroup.size === 0) return null;

  // Départage alphabétique à nombre de séries égal : sans lui, deux rendus successifs pourraient
  // intervertir deux groupes identiques — un scintillement sans cause apparente (même précaution
  // que `sharesOf`).
  return [...byGroup.values()].sort((a, b) => b.sets - a.sets || a.group.localeCompare(b.group));
}
