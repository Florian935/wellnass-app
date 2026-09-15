import { z } from 'zod';
import type { Pillar } from './pillar';
import type { WorkoutDisplayLevel } from './workout-display';

/**
 * US GUID-01 — le **régime de guidage**.
 *
 * ── L'axe, et pourquoi ce n'est pas celui qu'on attend ───────────────────────────────────────────
 * Le réflexe, pour « à quel point l'app m'accompagne », est de graduer le **volume** d'interventions :
 * beaucoup de notifications, moyennement, aucune. C'est un piège connu et mortel pour la rétention —
 * le mode « soutenu » devient le mode « l'app me harcèle », il est coupé en dix jours, et on a
 * construit un réglage dont la seule utilisation est de revenir en arrière.
 *
 * Ce qui varie ici, c'est **qui décide**. À volume de messages identique :
 *  - `guided` n'envoie pas *plus* de messages, il en envoie des **différents** — des annonces de
 *    décisions prises, au lieu de questions ;
 *  - `autonomous` n'en envoie presque aucun, non parce qu'on l'a rendu silencieux, mais parce qu'il
 *    n'a plus de question à poser.
 *
 * ── Ce que ce module N'EST PAS ───────────────────────────────────────────────────────────────────
 * Il ne produit **aucune** recommandation. Les ~20 moteurs qui en produisent existent déjà
 * (COLLIS-01, MUSC-F7, MN-04, META-19…). Ce module est une **couche de politique** : il répond à la
 * seule question « cette décision-là, je l'applique, je la propose, ou je me tais ? ». D'où sa
 * forme : des fonctions pures, aucun I/O, aucune dépendance React ou base.
 */

// ---------------------------------------------------------------------------
// Les régimes
// ---------------------------------------------------------------------------

export const GUIDANCE_REGIMES = ['guided', 'assisted', 'autonomous'] as const;
export const guidanceRegimeSchema = z.enum(GUIDANCE_REGIMES);
export type GuidanceRegime = z.infer<typeof guidanceRegimeSchema>;

/**
 * Régime appliqué quand la question n'a jamais été posée (onboarding passé, compte antérieur à la
 * migration). **`assisted`, et jamais autre chose** : c'est le seul des trois qui ne surprend
 * personne — il ne décide rien sans accord, et il ne prive de rien.
 */
export const DEFAULT_GUIDANCE_REGIME: GuidanceRegime = 'assisted';

// ---------------------------------------------------------------------------
// Le niveau d'expérience et la discipline visée (US GUID-01, volet B)
// ---------------------------------------------------------------------------

/**
 * Niveau d'entraînement **déclaré**. À ne pas confondre avec `WorkoutDisplayLevel`, qui règle la
 * densité de l'écran de séance : jusqu'à cette US, la muscu utilisait le second comme **proxy** du
 * premier faute de mieux (cf. l'en-tête de `SuggestedPrograms.tsx`). « Je veux voir peu
 * d'informations » n'a jamais voulu dire « je débute ».
 *
 * Mêmes valeurs que `ProgramLevel` : c'est volontaire, le tri des programmes compare les deux.
 */
export const TRAINING_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const trainingLevelSchema = z.enum(TRAINING_LEVELS);
export type TrainingLevel = z.infer<typeof trainingLevelSchema>;

/**
 * Discipline visée quand l'objectif principal est `performance` (spec §3.2, décision D2).
 *
 * Avec trois piliers, « Performance » ne dit pas *en quoi*. Plutôt que de rallonger la liste des
 * objectifs à cinq — ce qui aurait allongé un écran d'onboarding pour tout le monde —, on pose une
 * question **conditionnelle** : seulement si `performance` est choisi ET que les deux piliers
 * d'entraînement sont actifs. Un seul pilier actif ⇒ la discipline se déduit, aucune question.
 */
export const TRAINING_FOCUSES = ['strength', 'endurance'] as const;
export const trainingFocusSchema = z.enum(TRAINING_FOCUSES);
export type TrainingFocus = z.infer<typeof trainingFocusSchema>;

/** Disponibilité hebdomadaire déclarée, en jours. */
export const MIN_WEEKLY_AVAILABILITY = 1;
export const MAX_WEEKLY_AVAILABILITY = 7;

// ---------------------------------------------------------------------------
// Les décisions gouvernées
// ---------------------------------------------------------------------------

/**
 * Les décisions que la couche arbitre. Chacune correspond à un moteur **déjà livré** — on n'en
 * invente aucune ici.
 */
export const DECISION_KINDS = [
  /** COLLIS-01 — séance muscu la veille d'un fractionné. */
  'sessionConflict',
  /** MN-04 — cible glucidique des jours de séance. */
  'carbTarget',
  /** MUSCU-UX01 — les trois programmes proposés au compte neuf. */
  'programSuggestion',
  /** GUID-01 volet E — objectifs qui se contredisent. */
  'goalConflict',
  /** META-19 / GARDE-01 — ACWR en zone critique. */
  'safetyLoad',
  /** DOUL-01 — même zone douloureuse trois fois en quatorze jours. */
  'safetyPain',
  /** Alerte 4.32 — déficit calorique sévère prolongé. */
  'safetyDeficit',
] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

/**
 * Les trois signaux qui **franchissent tous les régimes**, y compris `autonomous` (décision D5).
 *
 * C'est une position produit assumée : on ne laisse pas quelqu'un se blesser parce qu'il a coché
 * « je me débrouille ». La contrepartie, non négociable elle aussi, est que l'écran de choix **le
 * dise** — un garde-fou caché serait une trahison du réglage, pas une protection.
 *
 * Ils sont **toujours `propose`, jamais `apply`** : on alerte, on ne décide pas à la place de
 * quelqu'un sur un sujet de santé.
 */
export const SAFETY_DECISIONS = ['safetyLoad', 'safetyPain', 'safetyDeficit'] as const;
export type SafetyDecision = (typeof SAFETY_DECISIONS)[number];

export function isSafetyDecision(kind: DecisionKind): kind is SafetyDecision {
  return (SAFETY_DECISIONS as readonly string[]).includes(kind);
}

/**
 * Ce que l'app fait d'une décision :
 *  - `apply`   — elle agit et **annonce** ce qu'elle a fait (avec une sortie : annuler) ;
 *  - `propose` — elle demande, deux actions de poids visuel égal ;
 *  - `silent`  — rien ne s'affiche spontanément ; l'analyse tourne et reste consultable.
 */
export const DISPOSITIONS = ['apply', 'propose', 'silent'] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

/**
 * Décisions que le régime `guided` a le droit d'**appliquer** seul.
 *
 * Liste **blanche**, et volontairement courte : une décision ne s'applique sans accord que si elle
 * est (1) réversible en un geste et (2) sans conséquence sur la santé. Tout le reste se propose,
 * même en `guided`. Ajouter une entrée ici est un arbitrage produit, pas une optimisation.
 */
const AUTO_APPLICABLE: readonly DecisionKind[] = ['sessionConflict', 'carbTarget'];

/**
 * La fonction centrale : que fait-on de cette décision, sous ce régime ?
 *
 * ⚠️ Elle ne dit **pas** si la décision doit être produite. Un réglage utilisateur qui éteint un
 * moteur (ex. `sessionConflictsEnabled`) reste **maître** : le régime module ce qui est déjà activé,
 * il ne rallume jamais rien. Un réglage qu'un autre réglage peut outrepasser n'est plus un réglage.
 */
export function dispositionFor(kind: DecisionKind, regime: GuidanceRegime): Disposition {
  // Les signaux de sécurité franchissent tout, et ne s'appliquent jamais d'office.
  if (isSafetyDecision(kind)) return 'propose';

  switch (regime) {
    case 'guided':
      return AUTO_APPLICABLE.includes(kind) ? 'apply' : 'propose';
    case 'assisted':
      return 'propose';
    case 'autonomous':
      return 'silent';
  }
}

// ---------------------------------------------------------------------------
// Appliqué ≠ choisi
// ---------------------------------------------------------------------------

/**
 * La forme minimale que la couche a besoin de lire. Volontairement **pas** `ProfileRow` : ce module
 * doit rester importable depuis n'importe où sans traîner le schéma du profil (et sans cycle).
 */
export type GuidanceSource = {
  regime: string | null | undefined;
  strength?: string | null | undefined;
  cardio?: string | null | undefined;
  nutrition?: string | null | undefined;
};

function coerce(value: string | null | undefined): GuidanceRegime | null {
  const parsed = guidanceRegimeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** La surcharge déclarée pour ce pilier, sans repli. */
function overrideFor(source: GuidanceSource, pillar: Pillar): GuidanceRegime | null {
  switch (pillar) {
    case 'strength':
      return coerce(source.strength);
    case 'running':
      return coerce(source.cardio);
    case 'nutrition':
      return coerce(source.nutrition);
  }
}

/**
 * Le régime **appliqué** à ce pilier : sa surcharge si elle existe, sinon le régime global, sinon
 * le défaut. C'est cette valeur qui gouverne le comportement.
 *
 * ⚠️ Le global ne réécrit **jamais** une surcharge : changer le régime général ne doit pas effacer
 * en silence un choix fin fait dans un pilier.
 */
export function effectiveRegime(
  source: GuidanceSource | null | undefined,
  pillar: Pillar,
): GuidanceRegime {
  if (!source) return DEFAULT_GUIDANCE_REGIME;
  return overrideFor(source, pillar) ?? coerce(source.regime) ?? DEFAULT_GUIDANCE_REGIME;
}

/** Le régime global appliqué (hors pilier). */
export function effectiveGlobalRegime(
  source: GuidanceSource | null | undefined,
): GuidanceRegime {
  return coerce(source?.regime) ?? DEFAULT_GUIDANCE_REGIME;
}

/**
 * A-t-on **choisi** ce régime, ou est-ce un repli ?
 *
 * Motif repris de NUTRI-UX01 (R1.3) et généralisé : ce qui est **appliqué** aux calculs et ce qui a
 * été **choisi** sont deux notions distinctes. Les confondre revenait à afficher « Modérément
 * actif » comme une sélection alors que personne n'avait posé la question — pour un sédentaire,
 * ~614 kcal/jour d'objectif en trop, en silence. Toute interface qui montre un régime doit pouvoir
 * afficher « déduit » au lieu de faire passer un repli pour une décision.
 */
export function hasChosenRegime(
  source: GuidanceSource | null | undefined,
  pillar: Pillar,
): boolean {
  if (!source) return false;
  return overrideFor(source, pillar) !== null || coerce(source.regime) !== null;
}

/** A-t-on choisi une surcharge **pour ce pilier précisément** (et non hérité du global) ? */
export function hasPillarOverride(
  source: GuidanceSource | null | undefined,
  pillar: Pillar,
): boolean {
  return source ? overrideFor(source, pillar) !== null : false;
}

// ---------------------------------------------------------------------------
// Ce que le régime déduit
// ---------------------------------------------------------------------------

/**
 * Densité de l'écran de séance déduite du régime (spec §5.4).
 *
 * C'est ce qui permet à l'étape 4 de l'onboarding de **changer de question sans changer de place** :
 * on demande le guidage — un vrai signal — et l'affichage s'en déduit, au lieu de demander
 * l'affichage et de s'en servir comme d'un faux signal d'expérience.
 *
 * ⚠️ Cette déduction ne vaut qu'à l'**écriture initiale**. Elle ne doit jamais réécrire le choix
 * d'un compte existant : personne ne doit voir son écran de séance changer sans l'avoir demandé.
 */
export function displayLevelForRegime(regime: GuidanceRegime): WorkoutDisplayLevel {
  switch (regime) {
    case 'guided':
      return 'simplified';
    case 'assisted':
      return 'normal';
    case 'autonomous':
      return 'detailed';
  }
}
