/**
 * US MUSC-F14 — suggestion de substitution d'exercice (roadmap 3.52).
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── Ce que cette brique ne prétend PAS faire (décision D1) ────────────────────────────────────────
 * Le backlog évoquait deux motifs de substitution : « matériel pris » **ou** « zone douloureuse ».
 * Seul le premier est traitable ici. Nous n'avons **ni information articulaire, ni schéma de
 * mouvement** (poussée / tirage, dominance hanche ou genou) : rien dans la base ne permet d'affirmer
 * qu'un exercice « ménage l'épaule ».
 *
 * Les suggestions sont donc **neutres** : des alternatives qui travaillent le même groupe musculaire.
 * L'utilisateur décide. Prétendre répondre à une douleur produirait un conseil de santé sans
 * fondement, présenté comme fiable — c'est précisément ce qu'on refuse de livrer.
 *
 * ── L'ordre de priorité, et pourquoi ─────────────────────────────────────────────────────────────
 * Une **variante déclarée** passe toujours devant une suggestion calculée : c'est une donnée saisie
 * par un humain (éditeur ou utilisateur), donc plus fiable que n'importe quel score. Le calcul ne
 * sert qu'à compléter quand les variantes manquent.
 */

import type { Equipment, MuscleGroup } from './exercise';

/** Un exercice candidat, réduit à ce dont le classement a besoin. */
export type SubstitutionCandidate = {
  id: string;
  name: string;
  muscle: MuscleGroup;
  /** `null` = exercice sans matériel. */
  equipment: Equipment | string | null;
  /** Muscles secondaires déclarés (MUSC-F10c-1). Vide si non renseignés. */
  musclesSecondary?: readonly MuscleGroup[];
};

/** L'exercice qu'on cherche à remplacer. */
export type SubstitutionSource = SubstitutionCandidate;

/** Une suggestion classée, prête à afficher. */
export type Substitution = SubstitutionCandidate & {
  /** Vrai si l'exercice est une **variante déclarée** de la source (et non un simple calcul). */
  isDeclaredVariant: boolean;
  /** Vrai si le matériel diffère — c'est ce qui répond au cas « matériel pris ». */
  differentEquipment: boolean;
  /** Score de pertinence, décroissant. Exposé pour les tests et le débogage, pas pour l'UI. */
  score: number;
};

/** Nombre de suggestions affichées par défaut. Au-delà, la liste complète prend le relais. */
export const MAX_SUBSTITUTIONS = 4;

/** Poids d'une variante déclarée : domine tout le reste, par construction. */
const SCORE_DECLARED_VARIANT = 1000;
/** Poids du groupe musculaire principal identique — le critère de base. */
const SCORE_SAME_MUSCLE = 100;
/** Bonus « matériel différent » : répond au motif majoritaire (machine occupée). */
const SCORE_DIFFERENT_EQUIPMENT = 20;
/** Bonus par muscle secondaire commun : profil de sollicitation proche. */
const SCORE_SHARED_SECONDARY = 5;

/** Nombre de muscles secondaires communs entre deux exercices. */
function sharedSecondaryCount(
  a: readonly MuscleGroup[] | undefined,
  b: readonly MuscleGroup[] | undefined,
): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  return a.filter((muscle) => setB.has(muscle)).length;
}

/**
 * Classe des candidats à la substitution d'un exercice.
 *
 * Règles, dans l'ordre où elles s'appliquent :
 *  1. **exclusions** — l'exercice lui-même et tout ce qui est déjà dans la séance (le proposer
 *     n'aurait aucun sens : il est déjà là) ;
 *  2. **variantes déclarées** — retenues quel que soit leur groupe musculaire. Si un humain a lié
 *     deux exercices, c'est une information qu'on ne remet pas en cause ;
 *  3. **même groupe musculaire principal** — le seul critère calculé qui fonde une alternative.
 *     Un exercice d'un autre groupe n'est pas une substitution, c'est un autre exercice.
 *
 * Le tri final est **déterministe** : à score égal, l'ordre alphabétique tranche. Sans cela, deux
 * appels successifs pourraient proposer un ordre différent, ce qui donnerait une impression
 * d'instabilité pour un résultat identique.
 */
export function rankSubstitutions(params: {
  source: SubstitutionSource;
  candidates: readonly SubstitutionCandidate[];
  /** Ids des variantes déclarées de la source (`exercise_variants`). */
  declaredVariantIds?: readonly string[];
  /** Ids déjà présents dans la séance / la session en cours d'édition. */
  excludeIds?: readonly string[];
  limit?: number;
}): Substitution[] {
  const {
    source,
    candidates,
    declaredVariantIds = [],
    excludeIds = [],
    limit = MAX_SUBSTITUTIONS,
  } = params;

  const declared = new Set(declaredVariantIds);
  const excluded = new Set([...excludeIds, source.id]);

  const scored: Substitution[] = [];

  for (const candidate of candidates) {
    if (excluded.has(candidate.id)) continue;

    const isDeclaredVariant = declared.has(candidate.id);
    const sameMuscle = candidate.muscle === source.muscle;

    // Ni variante déclarée, ni même groupe musculaire → ce n'est pas une substitution.
    if (!isDeclaredVariant && !sameMuscle) continue;

    const differentEquipment = candidate.equipment !== source.equipment;

    let score = 0;
    if (isDeclaredVariant) score += SCORE_DECLARED_VARIANT;
    if (sameMuscle) score += SCORE_SAME_MUSCLE;
    if (differentEquipment) score += SCORE_DIFFERENT_EQUIPMENT;
    score +=
      SCORE_SHARED_SECONDARY *
      sharedSecondaryCount(candidate.musclesSecondary, source.musclesSecondary);

    scored.push({ ...candidate, isDeclaredVariant, differentEquipment, score });
  }

  return scored
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name)))
    .slice(0, Math.max(0, limit));
}
