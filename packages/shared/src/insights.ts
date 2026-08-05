/**
 * US INSIGHTS-01 (roadmap 7.20) — moteur de sélection de l'écran « Insights » (Tier 3, ADR-007).
 *
 * Choisit les **1 à 3 analyses les plus pertinentes de l'instant** parmi les candidats que
 * l'appelant lui remet. Ce fichier ne calcule **aucune** analyse : il filtre, classe et plafonne.
 * Les candidats sont produits par `insight-adapters.ts` à partir de signaux déjà livrés.
 *
 * ⚠️ **Le classement est une table ordonnée, pas un score** (spec R2). La première rédaction
 * proposait `poidsFamille × severity × décoteFraîcheur` ; trois défauts l'ont fait abandonner :
 * `severity` n'existe dans aucune source du dépôt (il aurait fallu inventer neuf constantes), la
 * décote ne s'appliquait qu'à une minorité de sources datées, et surtout elle **s'inversait** —
 * une alerte non datée passait derrière une célébration du jour, l'exact contraire de l'intention.
 * `INSIGHT_ORDER` reprend le patron éprouvé de `SIGNAL_ORDER` (BILAN-01, `weekly-review.ts`).
 *
 * ⚠️ **Aucune lecture d'horloge ici** (spec R8) : `todayKey` entre par paramètre. Lire l'heure dans
 * un hook fait geler la valeur par React Compiler dans un slot mount-only — c'est pour cette raison
 * que `useDeficitVolumeAlert` reçoit déjà `useTodayDate()` en entrée.
 */

import { daysBetween } from './date';
import type { Pillar } from './pillar';

// ---------------------------------------------------------------------------
// Familles & identifiants
// ---------------------------------------------------------------------------

/**
 * Les trois familles d'ADR-007 §2 (« celle qui a changé / alerte / célèbre »).
 * - `alert` : quelque chose demande de l'attention maintenant ;
 * - `change` : quelque chose a bougé de façon notable ;
 * - `celebration` : quelque chose a été accompli.
 */
export const INSIGHT_FAMILIES = ['alert', 'change', 'celebration'] as const;
export type InsightFamily = (typeof INSIGHT_FAMILIES)[number];

/**
 * **L'ordre de ce tableau EST la priorité.** C'est le seul endroit du produit où elle est encodée
 * — même parti pris que `SIGNAL_ORDER` (BILAN-01), et pour la même raison : une priorité écrite
 * une fois se relit d'un coup d'œil en revue, là où un score se discute sans jamais se prouver.
 *
 * Le raisonnement, de haut en bas :
 *  1. le risque de blessure passe devant tout ;
 *  2. puis les deux autres alertes, dans l'ordre de ce qu'elles coûtent si on les ignore ;
 *  3. puis les accomplissements — une célébration fraîche vaut mieux qu'une variation tiède, et
 *     c'est le levier de rétention le mieux établi du produit ;
 *  4. puis les changements, le bilan hebdo en tête (il est **déjà** le fruit d'un arbitrage).
 */
export const INSIGHT_ORDER = [
  'overtraining_guard',
  'training_load',
  // US INSIGHTS-02 — juste après le signal de charge pur : `readiness` l'agrège avec la nutrition
  // et le bien-être, `concurrent_interference` en est une lecture plus fine (divergence entre
  // piliers). Les deux passent donc derrière lui, et devant tout le reste.
  'readiness',
  'concurrent_interference',
  'deficit_volume',
  // US INSIGHTS-02 — ferme le bloc `alert` : c'est une **suggestion de réglage**, pas un risque.
  // Elle ne doit jamais passer devant une alerte de charge.
  'activity_level',
  'record_recent',
  'goal_achieved',
  'weekly_decision',
  'muscle_neglected',
  'tonnage_change',
  'distance_change',
] as const;
export type InsightId = (typeof INSIGHT_ORDER)[number];

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/** Plafond d'ADR-007 §2 (« les 1-3 analyses les plus pertinentes »). */
export const MAX_INSIGHTS = 3;

/**
 * Quota par famille (spec R3). Trois alertes empilées transforment l'écran en réquisitoire, trois
 * célébrations en flatterie : le quota garantit qu'un troisième emplacement occupé apporte un
 * autre point de vue. Il ne force rien — une seule famille active donne 1 ou 2 cartes, pas 3.
 */
export const MAX_PER_FAMILY = 2;

/**
 * Au-delà de cet âge, un candidat **daté** est écarté (spec R2 bis). La fraîcheur est une porte,
 * pas un coefficient : elle empêche « record battu » de traîner un mois, elle ne réordonne rien.
 * Un candidat **non daté** (un état, pas un fait) n'est jamais écarté par l'âge.
 */
export const STALE_AFTER_DAYS = 14;

/**
 * Seuil de variation « notable » (spec R9), en points de pourcentage. Sans lui, toute variation
 * non nulle remonterait et l'écran dirait « ton tonnage a bougé de 0,4 % ».
 */
export const NOTABLE_CHANGE_PCT = 15;

// ---------------------------------------------------------------------------
// Le candidat
// ---------------------------------------------------------------------------

/**
 * Un signal prêt à concourir.
 *
 * `metrics` est **non optionnel et non vide**, et c'est le point du type — repris de
 * `ReviewDecision` (BILAN-01). Une carte sans chiffre serait une affirmation nue : « ta charge est
 * élevée » ne vaut rien sans « ratio 1,42 ». C'est cette contrainte, appliquée sérieusement, qui a
 * écarté quatre sources purement qualitatives au cadrage plutôt que de leur inventer des nombres.
 */
export type InsightCandidate = {
  id: InsightId;
  family: InsightFamily;
  /** Nombres à interpoler dans la clé i18n. Jamais vide. */
  metrics: Record<string, number>;
  /** Libellé de contexte déjà résolu (nom d'exercice, de muscle, d'objectif). */
  subject?: string;
  /**
   * Sous-cas du signal, quand un même identifiant recouvre plusieurs messages. Sert à choisir la
   * sous-clé i18n et, parfois, l'unité d'affichage. Trois sources en ont besoin :
   * `overtraining_guard` (deux niveaux de gravité), `record_recent` (charge / 1RM estimé / volume,
   * qui ne se formatent pas pareil) et `weekly_decision` (six natures de décision).
   *
   * C'est ce champ qui permet de **réutiliser les formulations déjà validées** plutôt que d'en
   * réécrire des variantes : la carte du bilan hebdo rend `review.decisions.<variant>`, la clé même
   * que l'écran de BILAN-01.
   */
  variant?: string;
  /** `dayKey` du fait, quand il en a un. `null` pour un **état** (une alerte n'a pas de date). */
  occurredOn: string | null;
  /** Piliers requis : un pilier inactif ne produit aucun candidat (décision H, spec R5). */
  pillars: Pillar[];
};

/** Un candidat retenu, avec son rang d'affichage (0 = en tête). */
export type SelectedInsight = InsightCandidate & { rank: number };

// ---------------------------------------------------------------------------
// Règles
// ---------------------------------------------------------------------------

/** Position dans `INSIGHT_ORDER`, ou `-1` si l'id est inconnu. */
function orderIndex(id: InsightId): number {
  return INSIGHT_ORDER.indexOf(id);
}

/**
 * Vrai si un candidat **daté** dépasse `STALE_AFTER_DAYS`. Un candidat non daté n'est jamais
 * périmé ; une date future ne l'est pas non plus (`daysBetween` renvoie alors un négatif).
 */
export function isStale(occurredOn: string | null, todayKey: string): boolean {
  if (occurredOn === null) return false;
  return daysBetween(occurredOn, todayKey) > STALE_AFTER_DAYS;
}

/**
 * Vrai si tous les nombres portés sont exploitables. Un `NaN` ou un `Infinity` affiché tel quel
 * (ou pire, arrondi à 0) donnerait une carte mensongère — précédent réel dans ce dépôt :
 * `bestSegmentTimeFromSamples` renvoyait `NaN`, ce qui rendait un record de « NaN seconde »
 * écrivable en base (corrigé le 04/08/2026).
 */
function hasUsableMetrics(metrics: Record<string, number>): boolean {
  const values = Object.values(metrics);
  if (values.length === 0) return false;
  return values.every((v) => Number.isFinite(v));
}

/** Vrai si tous les piliers requis par le candidat sont actifs. */
function isPillarActive(candidate: InsightCandidate, activePillars: ReadonlyArray<Pillar>): boolean {
  return candidate.pillars.every((p) => activePillars.includes(p));
}

/**
 * Sélectionne les insights à afficher.
 *
 * Parcourt `INSIGHT_ORDER`, retient un candidat éligible tant que sa famille n'a pas atteint son
 * quota, s'arrête à `MAX_INSIGHTS`. Entièrement déterministe : même entrée ⇒ même sortie, sans
 * arithmétique ni aléa. Retourne `[]` quand rien n'a à être dit — zéro est une réponse valable
 * (spec R4), l'écran affiche alors son état vide plutôt qu'une carte inventée.
 */
export function selectInsights(input: {
  candidates: ReadonlyArray<InsightCandidate>;
  activePillars: ReadonlyArray<Pillar>;
  todayKey: string;
}): SelectedInsight[] {
  const { candidates, activePillars, todayKey } = input;

  const eligible = candidates.filter(
    (c) =>
      orderIndex(c.id) !== -1 &&
      hasUsableMetrics(c.metrics) &&
      isPillarActive(c, activePillars) &&
      !isStale(c.occurredOn, todayKey),
  );

  // Tri par priorité déclarée. `toSorted` n'est pas utilisé : la cible Hermes du bundle mobile ne
  // le garantit pas, et `eligible` est déjà une copie produite par `filter`.
  const ordered = [...eligible].sort((a, b) => orderIndex(a.id) - orderIndex(b.id));

  const selected: SelectedInsight[] = [];
  const perFamily = new Map<InsightFamily, number>();

  for (const candidate of ordered) {
    if (selected.length >= MAX_INSIGHTS) break;
    const used = perFamily.get(candidate.family) ?? 0;
    if (used >= MAX_PER_FAMILY) continue;
    perFamily.set(candidate.family, used + 1);
    selected.push({ ...candidate, rank: selected.length });
  }

  return selected;
}
