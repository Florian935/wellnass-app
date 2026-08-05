/**
 * US INSIGHTS-02 (roadmap 7.21) — où va chacun des widgets retirés de l'accueil.
 *
 * ⚠️ **Ce fichier existe pour rendre R1 exécutable.** « Aucun signal ne disparaît » est
 * l'affirmation qui rend un dégonflage de 21 à 7 acceptable ; tant qu'elle n'est qu'une phrase de
 * spec, rien ne l'empêche de devenir fausse au premier oubli. Ici, elle échoue en CI.
 *
 * ⚠️ **Une carte d'insight n'est PAS une destination.** C'est la confusion que la relecture du
 * cadrage a relevée, et le type l'interdit désormais : `alert-insight` est réservé aux signaux qui
 * sont **conditionnels par nature** (des alertes — elles n'ont jamais rien à dire en temps normal).
 * Pour tout le reste, une carte d'insight ne garantit rien : au plus 3 s'affichent, avec un quota
 * par famille et une porte de fraîcheur à 14 jours. Un utilisateur peut ne jamais voir sa carte
 * « record » pendant des semaines — ce n'est donc pas un endroit où *ranger* les records.
 */

import type { InsightId } from './insights';

// ---------------------------------------------------------------------------
// Le registre d'avant
// ---------------------------------------------------------------------------

/**
 * `HOME_WIDGET_IDS` **tel qu'il était avant le dégonflage**, figé ici.
 *
 * Sans cette copie, le test s'auto-viderait : retirer un id du registre le retirerait aussi de la
 * table des destinations, et l'assertion « tout le monde a une destination » passerait au vert en
 * ayant cessé de vérifier quoi que ce soit. C'est le genre de test qui rassure sans protéger.
 */
export const HOME_WIDGET_IDS_V1 = [
  'today-session',
  'nutrition-summary',
  'streak',
  'weight',
  'record-recent',
  'muscle-volume',
  'running-week',
  'deficit-volume',
  'training-time',
  'steps',
  'wellbeing',
  'goals',
  'review',
  'cycle',
  'training-load',
  'overtraining-guard',
  'activation-path',
  'readiness',
  'activity-level-suggestion',
  'concurrent-training-interference',
  'insights',
] as const;

export type HomeWidgetIdV1 = (typeof HOME_WIDGET_IDS_V1)[number];

// ---------------------------------------------------------------------------
// Les destinations
// ---------------------------------------------------------------------------

export type WidgetDestination =
  /** Conservé sur l'accueil. */
  | { kind: 'home' }
  /**
   * Devenu une carte de l'écran « Insights ». **Réservé aux alertes** : un signal qui ne se
   * déclenche qu'en cas de problème n'a jamais eu de présence permanente à préserver.
   */
  | { kind: 'alert-insight'; id: InsightId }
  /**
   * Rangé sur un écran atteignable. `path` décrit le chemin **réel** depuis l'accueil, en clair :
   * c'est ce que la recette suit, geste par geste (critère 4). Un « oui, c'est quelque part » ne
   * vaut rien — la première rédaction de la spec en a classé deux « déjà atteignable » à tort.
   */
  | { kind: 'screen'; route: string; path: string };

/**
 * La destination de chacun des 21 widgets d'avant.
 *
 * Les chemins ont été **vérifiés dans le code** le 05/08/2026, pas supposés. Trois surprises à
 * l'occasion : `/progress` › Records est par exercice sélectionné (donc pas l'équivalent du widget
 * de records), le hub course montre la *dernière course* et non la semaine, et `/review` n'avait
 * **aucun** autre point d'entrée — la notification hebdomadaire n'y mène pas, faute de handler de
 * réponse dans l'app.
 */
export const WIDGET_DESTINATIONS: Record<HomeWidgetIdV1, WidgetDestination> = {
  // ── Conservés (7) ─────────────────────────────────────────────────────────
  'today-session': { kind: 'home' },
  'nutrition-summary': { kind: 'home' },
  streak: { kind: 'home' },
  // Conservé aussi parce qu'il est le seul accès à `/steps` : le retirer créait un 4ᵉ orphelin.
  steps: { kind: 'home' },
  insights: { kind: 'home' },
  'activation-path': { kind: 'home' },
  cycle: { kind: 'home' },

  // ── Devenus des cartes d'insight (6) ──────────────────────────────────────
  'deficit-volume': { kind: 'alert-insight', id: 'deficit_volume' },
  'training-load': { kind: 'alert-insight', id: 'training_load' },
  'overtraining-guard': { kind: 'alert-insight', id: 'overtraining_guard' },
  'activity-level-suggestion': { kind: 'alert-insight', id: 'activity_level' },
  'concurrent-training-interference': { kind: 'alert-insight', id: 'concurrent_interference' },
  readiness: { kind: 'alert-insight', id: 'readiness' },

  // ── Rangés sur un écran (8) ───────────────────────────────────────────────
  'muscle-volume': {
    kind: 'screen',
    route: '/progress',
    // Deux sections, pas une : le tonnage 7 j et sa variation d'un côté, la ventilation par groupe
    // de l'autre.
    path: 'Muscu › Progression › « Volume hebdomadaire » et « Équilibre »',
  },
  'running-week': {
    kind: 'screen',
    route: '/running-history',
    // Et non le hub course, qui montre la *dernière course*.
    path: 'Course › Historique › Stats (période « semaine » par défaut)',
  },
  weight: {
    kind: 'screen',
    route: '/measurements',
    path: 'Muscu › Progression › Mensurations',
  },
  'record-recent': {
    kind: 'screen',
    route: '/strength',
    // Destination **créée** par cette US : `/progress` › Records est par exercice sélectionné,
    // donc ni le même contenu ni le même coût (4 gestes).
    path: 'Muscu › widget « Records récents » du hub',
  },
  'training-time': {
    kind: 'screen',
    route: '/strength',
    // Destination **créée**, et présente sur les **deux** hubs : la carte se rend pilier par pilier
    // (`tt.strengthActive ? … : null`), donc la placer seulement côté muscu la retirerait aux
    // coureurs — les onglets étant gatés par pilier.
    path: 'Muscu ou Course › widget « Temps d’entraînement » du hub',
  },
  goals: {
    kind: 'screen',
    route: '/goals',
    path: 'Réglages › Suivi › Objectifs',
  },
  wellbeing: {
    kind: 'screen',
    route: '/wellbeing',
    path: 'Réglages › Suivi › Bien-être',
  },
  review: {
    kind: 'screen',
    route: '/review',
    // ⚠️ Seul point d'entrée après cette US. La notification hebdomadaire **n'y mène pas** : l'app
    // n'a aucun handler de réponse aux notifications, et la notification ne transporte aucun
    // routage — l'ouvrir affiche l'accueil.
    path: 'Réglages › Suivi › Bilan de la semaine',
  },
};

/** Les widgets conservés sur l'accueil, dérivés de la table (jamais recopiés à la main). */
export const KEPT_ON_HOME: HomeWidgetIdV1[] = HOME_WIDGET_IDS_V1.filter(
  (id) => WIDGET_DESTINATIONS[id].kind === 'home',
);

/**
 * Les signaux dont la présence est **conditionnelle par nature** et qui peuvent donc légitimement
 * vivre en carte d'insight. Toute autre entrée `alert-insight` est un abus, et le test le refuse.
 */
export const CONDITIONAL_BY_NATURE: ReadonlyArray<HomeWidgetIdV1> = [
  'deficit-volume',
  'training-load',
  'overtraining-guard',
  'activity-level-suggestion',
  'concurrent-training-interference',
  'readiness',
];
