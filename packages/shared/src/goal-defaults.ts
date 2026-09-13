import type { Goal } from './profile';
import type { NutritionObjective } from './nutrition';

/**
 * US GUID-01 volet A — ce que l'objectif principal décide, pilier par pilier.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────────────────────────────
 * L'écran d'onboarding promet que l'objectif « oriente les recommandations ». Cartographie du
 * 12/09/2026 : `main_goal` était lu à **huit endroits**, et les huit étaient le même appel
 * `objectiveFromGoal(...)` — le repli de l'objectif nutritionnel. Musculation : zéro lecture.
 * Course : zéro lecture. Pire, `performance` et `health` tombaient tous deux dans le même
 * `default → maintain` : deux options sur quatre donnaient une application **identique** à celle de
 * quelqu'un qui avait appuyé sur « Passer ».
 *
 * Ce module est le fil manquant entre l'objectif et les moteurs déjà livrés. Il ne calcule rien
 * lui-même : il **déclare** ce que chaque objectif attend de chaque pilier, et les moteurs existants
 * viennent y lire leur consigne.
 *
 * ── Ce que ce n'est pas ──────────────────────────────────────────────────────────────────────────
 * Ce ne sont pas des valeurs imposées : ce sont des **défauts**. Un choix explicite de
 * l'utilisateur (objectif nutritionnel réglé à la main, macros manuelles, programme choisi) reste
 * toujours prioritaire. C'est la règle « appliqué ≠ choisi » du module `guidance`.
 */

// ---------------------------------------------------------------------------
// Les formes
// ---------------------------------------------------------------------------

/** Ce que l'objectif cherche à faire monter en musculation. */
export type StrengthProgression =
  /** La charge — on vise plus lourd (masse, performance). */
  | 'load'
  /** Le maintien — on protège l'existant, une stagnation est **attendue** (sèche). */
  | 'maintain'
  /** Le volume et la régularité avant la charge (santé). */
  | 'volume';

export type StrengthDefaults = {
  progression: StrengthProgression;
  /**
   * `true` si une stagnation doit armer la proposition de deload (MUSC-F7).
   *
   * 🔴 **`false` en perte de poids, et ce n'est pas un oubli.** En déficit, ne plus progresser est
   * le comportement normal et même souhaité : proposer un deload à chaque plateau reviendrait à
   * traiter un succès comme une panne, toutes les trois séances.
   */
  deloadOnStagnation: boolean;
  /** `true` si le garde-fou charge/récupération (GARDE-01) doit être plus prudent. */
  conservativeGuardrail: boolean;
};

/** Ce que l'objectif attend du pilier Course. */
export type CardioEmphasis =
  /** Endurance fondamentale, allure basse. */
  | 'endurance'
  /** La fréquence avant l'intensité — sortir souvent compte plus que sortir fort. */
  | 'frequency'
  /** Séances structurées, avec des blocs et des allures cibles (RUN-F4). */
  | 'structured';

export type CardioDefaults = {
  emphasis: CardioEmphasis;
  /**
   * `true` si le volume de course doit être **plafonné** — c'est l'interférence documentée par
   * MR-08 : au-delà d'un certain volume d'endurance, le gain de masse est contrarié.
   */
  capVolume: boolean;
  /** `false` si le fractionné ne doit pas être proposé par défaut. */
  allowIntervals: boolean;
};

/** Ce que l'objectif attend du pilier Nutrition. */
export type NutritionDefaults = {
  objective: NutritionObjective;
  /** Plancher de protéines, en g/kg de poids corporel (MN-06). */
  minProteinGPerKg: number;
  /** `true` si les glucides péri-séance doivent être ajustés les jours d'entraînement (MN-04). */
  periWorkoutCarbs: boolean;
  /**
   * Ce que le pilier met en avant. `micros` est le cas « santé générale » : c'est le seul objectif
   * pour lequel la couverture en micronutriments dit plus que le compte de macros — et c'est aussi
   * le différenciateur que NUTRI-UX01 a rendu visible.
   */
  emphasis: 'macros' | 'micros';
};

export type PillarDefaults = {
  strength: StrengthDefaults;
  cardio: CardioDefaults;
  nutrition: NutritionDefaults;
};

// ---------------------------------------------------------------------------
// La matrice
// ---------------------------------------------------------------------------

const MUSCLE: PillarDefaults = {
  strength: { progression: 'load', deloadOnStagnation: true, conservativeGuardrail: false },
  cardio: { emphasis: 'endurance', capVolume: true, allowIntervals: false },
  nutrition: {
    objective: 'bulk',
    minProteinGPerKg: 1.8,
    periWorkoutCarbs: true,
    emphasis: 'macros',
  },
};

const WEIGHTLOSS: PillarDefaults = {
  strength: { progression: 'maintain', deloadOnStagnation: false, conservativeGuardrail: false },
  cardio: { emphasis: 'frequency', capVolume: false, allowIntervals: true },
  nutrition: {
    objective: 'weightloss',
    minProteinGPerKg: 2.0,
    periWorkoutCarbs: false,
    emphasis: 'macros',
  },
};

const PERFORMANCE: PillarDefaults = {
  strength: { progression: 'load', deloadOnStagnation: true, conservativeGuardrail: false },
  cardio: { emphasis: 'structured', capVolume: false, allowIntervals: true },
  nutrition: {
    objective: 'maintain',
    minProteinGPerKg: 1.6,
    // Socle glucidique périodisé selon la charge (FUEL-01) : c'est le cas d'usage qui a motivé
    // cette US côté course.
    periWorkoutCarbs: true,
    emphasis: 'macros',
  },
};

const HEALTH: PillarDefaults = {
  // Régularité avant charge, et garde-fou plus prudent : quelqu'un qui vient pour « la santé » n'a
  // aucune raison d'encaisser une progression forcée.
  strength: { progression: 'volume', deloadOnStagnation: false, conservativeGuardrail: true },
  cardio: { emphasis: 'endurance', capVolume: false, allowIntervals: false },
  nutrition: {
    objective: 'maintain',
    minProteinGPerKg: 1.4,
    periWorkoutCarbs: false,
    emphasis: 'micros',
  },
};

/**
 * Objectif absent — la question n'a pas été posée, ou a été passée.
 *
 * Volontairement **distinct de `health`** : ne rien avoir répondu n'est pas la même chose que
 * d'avoir choisi « santé générale ». Le repli est neutre (aucun plafond, aucun garde-fou renforcé,
 * aucune emphase), là où « santé » est un vrai choix qui engage des comportements.
 */
const UNSET: PillarDefaults = {
  strength: { progression: 'maintain', deloadOnStagnation: true, conservativeGuardrail: false },
  cardio: { emphasis: 'endurance', capVolume: false, allowIntervals: true },
  nutrition: {
    objective: 'maintain',
    minProteinGPerKg: 1.6,
    periWorkoutCarbs: false,
    emphasis: 'macros',
  },
};

/**
 * Ce que l'objectif décide, pilier par pilier. Source de vérité **unique** : tout site qui veut
 * savoir « que fait-on quand l'objectif est X ? » passe par ici, et nulle part ailleurs.
 */
export function pillarDefaults(goal: Goal | null | undefined): PillarDefaults {
  switch (goal) {
    case 'muscle':
      return MUSCLE;
    case 'weightloss':
      return WEIGHTLOSS;
    case 'performance':
      return PERFORMANCE;
    case 'health':
      return HEALTH;
    default:
      return UNSET;
  }
}
