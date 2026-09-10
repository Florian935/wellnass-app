/**
 * Moteur de widgets multi-formes, partagé par les 3 hubs (accueil, muscu, course).
 *
 * Généralise l'ancien `dashboard.ts` (US 7.x) :
 *  - **3 formes** `small` (petit carré ½ largeur) / `wide` (rectangle pleine largeur) /
 *    `large` (grand carré pleine largeur), en remplacement de `full | compact` ;
 *  - **registre par hub** (`home` / `strength` / `running`) : IDs canoniques, gardes par
 *    pilier, forme par défaut ;
 *  - **layout multi-écrans** `{ screens: { home, strength, running } }` persisté dans
 *    `user_settings.dashboard_layout`, avec parseur **rétro-compatible** (ancien
 *    `{ widgets:[…] }` → `screens.home`, tailles migrées `full→wide` / `compact→small`) ;
 *  - **packing pur** : une liste ordonnée de widgets → lignes de grille 2 colonnes
 *    (deux `small` consécutifs sur la même ligne ; `wide`/`large` pleine largeur).
 *
 * Zéro dépendance native / React : uniquement des types et des fonctions pures (Vitest).
 */

import type { Pillar } from './pillar';

// ---------------------------------------------------------------------------
// Formes & hubs
// ---------------------------------------------------------------------------

/**
 * Forme d'un widget : bande (pleine largeur, demi-hauteur) / petit carré (½ largeur) /
 * rectangle / grand carré (pleine largeur).
 *
 * ⚠️ **`row` est arrivée avec ACCUEIL-04** et c'est la seule forme qui ne fasse pas une hauteur
 * entière de case. Motif : la carte « vie réelle » hors période affiche **une ligne de texte** et
 * occupait une cellule `wide` remplie à 26 %. Il n'existait aucune forme pour « ce qui tient en une
 * ligne », donc personne ne pouvait la demander.
 */
export type WidgetSize = 'row' | 'small' | 'wide' | 'large';

/** Hubs qui hébergent une grille de widgets. */
export const WIDGET_SCREENS = ['home', 'strength', 'running'] as const;
export type WidgetScreen = (typeof WIDGET_SCREENS)[number];

// ---------------------------------------------------------------------------
// Registres par hub — IDs canoniques (ordre par défaut), gardes pilier, forme par défaut
// ---------------------------------------------------------------------------

/**
 * Accueil : reprend les 9 IDs historiques (compat des layouts stockés). Ordre et
 * gardes pilier identiques à l'ancien `dashboard.ts`. Forme par défaut = `wide`
 * (migration `full → wide`).
 */
export const HOME_WIDGET_IDS = [
  // ── US INSIGHTS-02 (roadmap 7.21) — registre ramené de 21 à 7 le 05/08/2026 ──────────────────
  // ADR-007 §2 plafonne le Tier 0 à 4-6 widgets et pose qu'« ajouter un widget **coûte** un
  // arbitrage ». L'arbitrage n'avait jamais eu lieu : le registre avait atteint **21**, soit 3,5 ×
  // le plafond. Chacun des 14 retirés a une destination vérifiée par test
  // (`widget-destinations.ts`) — aucun signal n'a disparu du produit.
  //
  // ⚠️ **Le plafond est désormais appliqué par un test** (`MAX_HOME_WIDGETS`) : le dépasser reste
  // possible, mais impose de modifier ce test — donc d'en faire un arbitrage conscient, ce que
  // l'ADR demandait depuis le 16/07/2026 sans disposer du moyen de l'imposer.
  //
  // Les 4 premiers sont **permanents** ; parmi les 4 derniers, `insights`, `activation-path` et
  // `cycle` ne s'affichent jamais tous ensemble par défaut. Le compte **visible** typique est donc de
  // 5 (les 4 permanents + `real-life`) à 6 (quand `insights` a quelque chose à dire) — dans la
  // fourchette 4-6 de l'ADR.
  // ── US ACCUEIL-01/04 (09/09/2026) — `today-session` n'est plus un widget ─────────────────────────
  // Il est devenu la **zone 1 épinglée** de l'accueil (`NowCard`), hors grille : la séance du jour
  // est l'action du moment, pas une tuile qu'on peut masquer ou reléguer en bas. Sa destination le
  // déclare (`{ kind: 'home-pinned' }`) et un test le vérifie — il n'a donc pas disparu, il a été
  // promu. La place ainsi libérée accueille le retour de `weight` : le registre **reste à 8**, et
  // `MAX_HOME_WIDGETS` n'a pas eu à bouger.
  'nutrition-summary',
  'streak',
  // Conservé bien qu'il ne soit pas au cœur des 3 piliers : c'est du live du jour, **et** son
  // widget est le seul point d'entrée de `/steps` — le retirer créait un écran orphelin.
  'steps',
  // ── Revenu le 09/09/2026 (US ACCUEIL-04) ────────────────────────────────────────────────────────
  // INSIGHTS-02 l'avait déporté vers `/measurements`. Mais le poids figure comme l'un des quatre
  // blocs de l'accueil dans `navigation-ux.md` §3.1 **et** dans la maquette validée : son absence
  // était un écart à la spec, pas une décision. En `small`, il partage sa ligne avec les pas et ne
  // coûte donc aucune hauteur d'écran supplémentaire.
  'weight',
  // Conditionnel : rendu `null` quand le moteur ne retient aucune carte (US INSIGHTS-01).
  'insights',
  // Conditionnel et temporaire : 7 jours après l'onboarding (US ACTIV-01).
  'activation-path',
  // Conditionnel : la carte de période « vie réelle », **plus** son point d'entrée hors période
  // (US VIE-01). Un seul id pour les deux états — deux widgets auraient regonflé le registre que
  // INSIGHTS-02 vient de dégonfler, alors qu'ils ne s'affichent jamais ensemble.
  'real-life',
  // Gardé par un réglage, invisible par défaut : opt-in strict sur une donnée de santé (CYCLE-01).
  'cycle',
] as const;

/**
 * Muscu : la **zone Suivre** du hub — 3 widgets, tous porteurs de données.
 *
 * ── Registre ramené de 7 à 3 le 10/09/2026 (US MUSCU-UX01) ───────────────────────────────────────
 * L'accueil avait un plafond opposable depuis INSIGHTS-02 ; le hub muscu n'en avait **aucun**, et
 * c'est exactement pour ça qu'il a dérivé pendant que l'accueil se dégonflait. Avec la carte
 * d'action et la ligne d'annuaire, il affichait 9 blocs sans hiérarchie — et, faute de prédicat
 * `isActive`, ses 7 tuiles se rendaient **même vides** : environ 2,4 écrans de scroll sur un
 * compte neuf.
 *
 * Chacun des 4 retirés a une destination, et aucune n'est une régression :
 *  - `strength-programs`   → la **barre de progression du programme** (zone Agir) mène au même
 *    endroit en disant enfin quelque chose d'utile : « semaine 3 sur 8 · 14/24 séances ».
 *  - `strength-templates`  → la ligne d'annuaire « Exercices, programmes, templates » en pied de
 *    hub. ⚠️ Ce point d'entrée avait été créé par **US Refonte-D** (22/07/2026) précisément pour
 *    être permanent : le déplacer est un arbitrage assumé, validé par Florian le 10/09/2026, pas
 *    un oubli.
 *  - `strength-records`    → `/progress` › Vue d'ensemble, section « Records récents ».
 *  - `strength-training-time` → `/progress` › Vue d'ensemble.
 *
 * Les deux derniers étaient d'ailleurs arrivés ici par INSIGHTS-02 faute de meilleure destination ;
 * l'onglet « Vue d'ensemble » de Progression, créé par cette US, en est une vraie.
 */
export const STRENGTH_WIDGET_IDS = [
  'strength-planning',
  'strength-progress',
  'strength-history',
] as const;

/** Course : les 3 modules-aperçu du hub, widgetisés. Ordre = disposition par défaut (maquette validée). */
export const RUNNING_WIDGET_IDS = [
  'running-history',
  'running-programs',
  'running-planning',
  // US INSIGHTS-02 — `training-time` se rend **pilier par pilier** (`tt.strengthActive ? … : null`)
  // et les onglets sont gatés : le placer seulement côté muscu l'aurait retiré aux coureurs.
  'running-training-time',
] as const;

/**
 * Plafond du Tier 0 (US INSIGHTS-02, roadmap 7.21), **appliqué par un test** dans `widgets.test.ts`.
 *
 * ADR-007 §2 fixe 4-6 widgets *visibles*. Le registre est plafonné à **7** parce que ses 3 dernières
 * entrées ne s'affichent jamais toutes ensemble par défaut : `cycle` exige un opt-in,
 * `activation-path` s'auto-détruit à J+7, `insights` ne paraît que s'il a quelque chose à dire. Le
 * compte visible reste donc dans la fourchette de l'ADR.
 *
 * ⚠️ **Le dépasser reste possible — mais il faut modifier le test.** C'est exactement ce que l'ADR
 * demandait depuis le 16/07/2026 (« ajouter un widget **coûte** un arbitrage, pas un simple `+1` »)
 * sans jamais disposer du moyen de l'imposer. Le registre avait atteint **21**.
 *
 * ── 7 → 8 le 05/08/2026 (US VIE-01) : le premier arbitrage que ce cliquet a provoqué ──────────────
 * Le cliquet a fonctionné comme prévu : ajouter `real-life` a **cassé la CI**, ce qui a forcé la
 * décision au lieu de la laisser passer en `+1` silencieux. Le raisonnement, pour qu'il soit
 * relisible :
 *
 *  - le plafond de l'ADR porte sur les widgets **visibles**, pas sur les entrées **déclarées** ;
 *  - `real-life` porte **deux états dans un seul id** (point d'entrée hors période, carte active
 *    pendant) — deux ids auraient consommé deux places pour deux affichages mutuellement exclusifs ;
 *  - compte visible réel : **4 permanents + `real-life` = 5**, et **6** quand `insights` a quelque
 *    chose à dire. On reste donc **dans la fourchette 4-6** de l'ADR.
 *
 * 🟠 **À confirmer par Florian/Damien** : c'est un arbitrage de charte d'accueil, et INSIGHTS-02
 * vient tout juste de ramener le registre de 21 à 7. Si la réponse est non, le repli est de rendre
 * `real-life` **conditionnel** (visible seulement pendant une période) et de déplacer son point
 * d'entrée — au prix de la découvrabilité, qui est pourtant tout l'enjeu d'une fonctionnalité qu'on
 * cherche au moment où la vie déborde.
 */
export const MAX_HOME_WIDGETS = 8;

/**
 * Plafond de la zone Suivre du hub muscu (US MUSCU-UX01), **appliqué par un test**.
 *
 * Même cliquet que `MAX_HOME_WIDGETS`, et pour la même raison : sans lui, le registre muscu est
 * passé de 4 à 7 sans qu'aucun arbitrage n'ait eu lieu. Ce n'est pas une limite technique, c'est
 * le moyen de rendre un `+1` **conscient** — le dépasser reste possible, mais impose de modifier
 * le test, donc d'en discuter.
 *
 * Pourquoi 3, et pas 4-6 comme l'accueil : le hub muscu porte déjà une **zone Agir épinglée** au-
 * dessus de la grille (la carte du jour, qui occupe presque un demi-écran) et une ligne d'annuaire
 * en pied. Le budget vertical restant ne vaut pas celui de l'accueil.
 */
export const MAX_STRENGTH_WIDGETS = 3;

/**
 * Plafond de la grille du hub course (US CARDIO-UX01, R3-2), **appliqué par un test**.
 *
 * Même cliquet que `MAX_HOME_WIDGETS` et `MAX_STRENGTH_WIDGETS` : ajouter une tuile doit coûter
 * un arbitrage, pas un `+1` silencieux.
 *
 * Pourquoi 4 et pas 3 comme la muscu : le hub course garde ses quatre destinations (historique,
 * programmes, planning, temps d'entraînement) et sa zone Agir est plus compacte — une carte de
 * séance de course tient en moins de place qu'une carte de séance de muscu, qui liste ses
 * exercices. Le budget vertical restant vaut donc une tuile de plus.
 *
 * ⚠️ Le vrai gain du hub course n'est pas le nombre de tuiles mais le prédicat `isActive` : sans
 * lui, les quatre se rendaient **même vides** sur un compte neuf, exactement comme les sept du
 * hub muscu avant MUSCU-UX01.
 */
export const MAX_RUNNING_WIDGETS = 4;

export type HomeWidgetId = (typeof HOME_WIDGET_IDS)[number];
export type StrengthWidgetId = (typeof STRENGTH_WIDGET_IDS)[number];
export type RunningWidgetId = (typeof RUNNING_WIDGET_IDS)[number];

/** Identifiant d'un widget, tous hubs confondus (scopé par préfixe pour muscu/course). */
export type WidgetId = HomeWidgetId | StrengthWidgetId | RunningWidgetId;

/**
 * Réglages **booléens** capables de garder un widget. Volontairement une liste fermée et courte :
 * ce n'est pas un mécanisme de feature-flags générique, seulement le moyen d'exprimer « ce widget
 * dépend d'un opt-in ».
 */
export const WIDGET_SETTING_KEYS = ['cycleTrackingEnabled'] as const;
export type WidgetSettingKey = (typeof WIDGET_SETTING_KEYS)[number];
export type WidgetSettingFlags = Partial<Record<WidgetSettingKey, boolean>>;

/**
 * Condition d'affichage d'un widget. **Trois formes**, et il a fallu les trois :
 *  - `Pillar[]`             — visible si l'un de ces piliers est actif (le cas courant) ;
 *  - `'always'`             — transverse, jamais filtré (`streak`, `steps`, `wellbeing`, `review`) ;
 *  - `{ setting: … }`       — dépend d'un **opt-in**, ni pilier ni universel (US CYCLE-01).
 *
 * La troisième forme a été ajoutée le 31/07/2026 pour le suivi de cycle, qui n'appartient à aucun
 * pilier (donc pas de liste) **mais** ne doit pas s'afficher pour tout le monde (donc pas
 * `'always'`). Sans elle, la seule issue aurait été une 13ᵉ copie en ligne de la décision d'accès —
 * exactement la dette que REFACTO-01 a relevée.
 */
export type WidgetGuard = readonly Pillar[] | 'always' | { readonly setting: WidgetSettingKey };

/** Définition d'un hub : IDs ordonnés + garde d'affichage + forme par défaut, par widget. */
interface ScreenRegistry {
  ids: readonly WidgetId[];
  /** Condition d'affichage par widget (voir `WidgetGuard`). */
  pillars: Record<string, WidgetGuard>;
  defaultSize: Record<string, WidgetSize>;
}

/** Toutes les entrées d'un hub à la même forme (helper de construction du registre). */
function uniformSize(ids: readonly string[], size: WidgetSize): Record<string, WidgetSize> {
  return Object.fromEntries(ids.map((id) => [id, size]));
}

/** Toutes les entrées d'un hub gardées par un unique pilier (muscu / course). */
function uniformPillar(ids: readonly string[], pillar: Pillar): Record<string, WidgetGuard> {
  return Object.fromEntries(ids.map((id) => [id, [pillar]]));
}

export const WIDGET_REGISTRY: Record<WidgetScreen, ScreenRegistry> = {
  home: {
    ids: HOME_WIDGET_IDS,
    pillars: {
      'nutrition-summary': ['nutrition'],
      streak: 'always',
      // US ACCUEIL-04 : transverse, comme `steps` et pour la même raison — le poids corporel
      // n'appartient à aucun des trois piliers, et quelqu'un qui ne suit que la musculation a
      // autant de raisons de le suivre que quelqu'un qui ne suit que l'alimentation.
      weight: 'always',
      // Transverse comme `streak` : la marche n'appartient à aucun pilier, et un utilisateur
      // « nutrition seule » doit pouvoir suivre ses pas (US PAS-01).
      steps: 'always',
      // US CYCLE-01 : **ni pilier, ni `'always'`** — le seul widget gardé par un réglage. Le cycle
      // n'appartient à aucun des trois piliers, mais c'est une donnée de santé sensible, en opt-in
      // strict et désactivée par défaut : elle ne peut donc pas être universelle non plus.
      cycle: { setting: 'cycleTrackingEnabled' },
      // US ACTIV-01 : transverse — le parcours cible n'importe quel utilisateur les 7 premiers
      // jours, quels que soient ses piliers actifs.
      'activation-path': 'always',
      // US INSIGHTS-01 : transverse — le moteur agrège des signaux des trois piliers et applique
      // lui-même le gating candidat par candidat (spec R5). Une garde par pilier ici masquerait la
      // porte d'entrée à un mono-pilier qui a pourtant des insights.
      insights: 'always',
      // US VIE-01 : transverse — la vie prend le dessus quels que soient les piliers activés, et
      // l'objectif de semaine minimal n'affiche de toute façon que les piliers actifs (règle R3).
      'real-life': 'always',
    },
    /**
     * ── Fin de `uniformSize` sur l'accueil (US ACCUEIL-04) ──────────────────────────────────────
     * Toutes les entrées valaient `'wide'`, ce qui donnait cinq à six rectangles **strictement
     * identiques** empilés : aucune hiérarchie, 47 % de remplissage moyen, et le point d'entrée
     * « vie réelle » exactement aussi lourd à l'œil que la nutrition du jour.
     *
     * Chaque forme est désormais choisie d'après **ce que la carte a à dire**, et déclarée
     * explicitement : `defaultSizeOf` retombe sur `'wide'` en l'absence d'entrée, ce qui donnerait
     * le bon rendu **par accident** pour la moitié d'entre elles.
     */
    defaultSize: {
      // Anneau calorique + les trois macros du jour : c'est la carte la plus dense de l'accueil.
      'nutrition-summary': 'wide',
      // Sept pastilles de semaine + le bandeau de récapitulatif : une ligne de grille pleine.
      streak: 'wide',
      // Un anneau et un total suffisent. En `small`, les pas partagent leur ligne avec le poids —
      // 182 px de hauteur d'écran rendus par rapport à deux `wide` empilés.
      steps: 'small',
      weight: 'small',
      // Un titre d'insight sur deux lignes, plus le compte des suivants.
      insights: 'wide',
      // Jour N/7, titre, description et action : le parcours d'activation a besoin de la place.
      'activation-path': 'wide',
      // Hors période, cette carte n'affiche **qu'une ligne** — c'est le cas qui a motivé `row`,
      // et c'est l'état de loin le plus fréquent (une période « vie réelle » dure quelques
      // semaines par an).
      //
      // ⚠️ **En période, elle ne tient pas dans une bande** : la carte active porte l'échéance, les
      // jours restants, l'objectif de semaine minimal et deux boutons. La forme stockée reste
      // `row`, mais l'accueil en calcule une **forme effective** au rendu (`sizeFor` de
      // `WidgetGrid`) qui la remonte à `wide` tant que la période court. Le layout de
      // l'utilisateur n'est pas réécrit pour autant : c'est un besoin d'affichage, pas une
      // préférence — et il redevient `row` de lui-même à la fin de la période.
      'real-life': 'row',
      // Jour du cycle, phase, prédiction : trois lignes.
      cycle: 'wide',
    },
  },
  strength: {
    ids: STRENGTH_WIDGET_IDS,
    pillars: uniformPillar(STRENGTH_WIDGET_IDS, 'strength'),
    // US MUSCU-UX01 : deux `small` sur la première ligne (planning + volume de la semaine), puis
    // la dernière séance en bande. La zone Suivre tient ainsi sous la zone Agir sans repousser
    // l'action hors de l'écran — c'était tout l'objet du dégonflage.
    defaultSize: {
      'strength-planning': 'small',
      'strength-progress': 'small',
      'strength-history': 'wide',
    },
  },
  running: {
    ids: RUNNING_WIDGET_IDS,
    pillars: uniformPillar(RUNNING_WIDGET_IDS, 'running'),
    defaultSize: {
      'running-history': 'wide',
      'running-programs': 'small',
      'running-planning': 'small',
      // US INSIGHTS-02 : idem côté course.
      'running-training-time': 'wide',
    },
  },
};

/** Ensemble (rapide) des IDs connus d'un hub. */
function knownIds(screen: WidgetScreen): Set<string> {
  return new Set<string>(WIDGET_REGISTRY[screen].ids);
}

/** Forme par défaut d'un widget dans son hub (repli `wide` si absent du registre). */
function defaultSizeOf(screen: WidgetScreen, id: string): WidgetSize {
  return WIDGET_REGISTRY[screen].defaultSize[id] ?? 'wide';
}

// ---------------------------------------------------------------------------
// Grille — colonnes fixes & empreinte des formes
// ---------------------------------------------------------------------------

/** Nombre de colonnes de la grille (fixe). */
export const GRID_COLS = 2;

/** Empreinte d'une forme en cases de grille (largeur × hauteur). */
export interface WidgetSpan {
  w: number;
  h: number;
}

/**
 * Empreinte de chaque forme, **en demi-cases de hauteur** :
 *  - `row`   = 2×1 (bande pleine largeur, une demi-case de haut) ;
 *  - `small` = 1×2 (petit carré, ½ largeur) ;
 *  - `wide`  = 2×2 (rectangle pleine largeur) ;
 *  - `large` = 2×4 (grand carré pleine largeur).
 *
 * ── Pourquoi la résolution verticale est DOUBLE (ACCUEIL-04) ──────────────────────────────────────
 * Avant, la case unité était carrée (`small` 1×1, `cellH = colW`) et la plus petite hauteur
 * exprimable valait donc une demi-largeur d'écran : ~170 px sur le cadre de référence. Une carte
 * qui affiche une ligne de texte y était remplie à 26 %.
 *
 * En comptant les hauteurs en **demi-cases**, une bande devient exprimable sans changer aucune
 * autre forme : les rapports entre `small`, `wide` et `large` sont exactement ceux d'avant
 * (1×1 → 1×2, 2×1 → 2×2, 2×2 → 2×4). Seul le rendu doit savoir qu'une ligne de grille vaut
 * désormais une demi-case — voir `cellRect` côté mobile, où `cellH` passe de `colW` à
 * `(colW - gap) / 2`. Cette division est ce qui fait que **deux `row` empilées pavent exactement
 * un `wide`** : 79 + 12 + 79 = 170.
 *
 * ── Et les dispositions déjà enregistrées ? ──────────────────────────────────────────────────────
 * Elles se migrent **toutes seules**, sans champ de version ni code dédié : `resolveScreenLayout`
 * conserve l'ordre des `row` stockées puis appelle `compactVertical`, qui **recalcule** chaque
 * ligne en repartant de zéro dans la nouvelle résolution. Un layout v1 `[0, 1, 2, 3]` de `wide`
 * ressort en `[0, 2, 4, 6]`, dans le même ordre et sans trou. C'est testé (`widgets.test.ts`,
 * « migration implicite de l'ancienne résolution ») — sans ce test, la garantie ne serait qu'une
 * intention de docstring.
 */
export function sizeSpan(size: WidgetSize): WidgetSpan {
  if (size === 'row') return { w: 2, h: 1 };
  if (size === 'small') return { w: 1, h: 2 };
  if (size === 'wide') return { w: 2, h: 2 };
  return { w: 2, h: 4 };
}

/** Borne une colonne pour qu'un widget de largeur `w` tienne dans la grille. */
export function clampCol(col: number, w: number): number {
  return Math.max(0, Math.min(col, GRID_COLS - w));
}

// ---------------------------------------------------------------------------
// Types de disposition
// ---------------------------------------------------------------------------

/**
 * Entrée de disposition pour un widget : **position en grille** (colonne, ligne) +
 * visibilité + forme. Placement libre (trous autorisés) ; l'empreinte dérive de `size`.
 */
export interface WidgetLayoutEntry {
  id: WidgetId;
  visible: boolean;
  size: WidgetSize;
  /** Colonne 0-based (bornée pour que col + span.w ≤ GRID_COLS). */
  col: number;
  /** Ligne 0-based. */
  row: number;
}

/** Disposition d'un hub. */
export interface ScreenLayout {
  widgets: WidgetLayoutEntry[];
}

/** Disposition complète des 3 hubs (JSON stocké dans `dashboard_layout`, nouveau format). */
export interface MultiScreenLayout {
  screens: Partial<Record<WidgetScreen, ScreenLayout>>;
  /**
   * Version du **schéma de formes**. Absente = disposition antérieure à ACCUEIL-04.
   *
   * ⚠️ Ne concerne **que les formes**, pas les positions : les lignes se migrent seules
   * (`compactVertical` les recalcule, voir `sizeSpan`). Les formes, elles, ne peuvent pas se
   * deviner — c'est ce que le correctif du 10/09/2026 a appris.
   */
  v?: number;
}

/** Version courante du schéma de formes. */
export const LAYOUT_VERSION = 2;

/**
 * Formes **réattribuées** au passage en v2 (US ACCUEIL-04, correctif du 10/09/2026).
 *
 * ── Le défaut que ceci corrige ───────────────────────────────────────────────────────────────────
 * ACCUEIL-04 a remplacé `uniformSize(…, 'wide')` par des formes différenciées. Mais une forme par
 * défaut ne s'applique qu'aux widgets **absents** de la disposition enregistrée : tout utilisateur
 * ayant déjà ouvert l'accueil avait les huit entrées en base, en `'wide'`. Les nouvelles valeurs
 * n'atteignaient donc **personne** — sauf un compte neuf.
 *
 * Constaté en recette le 10/09/2026 : les pas et le poids ne se plaçaient pas côte à côte. Pire
 * pour `weight`, dont l'entrée dormait en base **depuis avant INSIGHTS-02** (qui l'avait retiré du
 * registre, donc rendu inconnu, donc ignoré) : le réintroduire a **ressuscité sa vieille taille**,
 * un grand carré choisi des mois plus tôt.
 *
 * ── Pourquoi écraser est légitime ici ────────────────────────────────────────────────────────────
 * La valeur écrasée n'était pas un choix de l'utilisateur : c'était `'wide'` pour **tout le
 * monde**, faute d'alternative — la forme `row` n'existait pas et `small` n'était proposé nulle
 * part par défaut. On remplace donc un défaut système par un autre, une seule fois.
 *
 * Le risque assumé : quelqu'un qui avait délibérément mis les pas en grand carré le perd. Trois
 * widgets, une fois, contre une refonte qui n'atteindrait sinon aucun utilisateur existant.
 */
export const SIZES_MIGRATED_TO_V2: Readonly<Record<string, WidgetSize>> = {
  steps: 'small',
  weight: 'small',
  'real-life': 'row',
};

// ---------------------------------------------------------------------------
// Formes — coercition & migration
// ---------------------------------------------------------------------------

/**
 * Coerce une valeur brute en `WidgetSize`, en **migrant** l'ancien modèle :
 * `full → wide`, `compact → small`. Toute autre valeur → `fallback`.
 */
export function coerceSize(raw: unknown, fallback: WidgetSize): WidgetSize {
  if (raw === 'row' || raw === 'small' || raw === 'wide' || raw === 'large') return raw;
  if (raw === 'full') return 'wide';
  if (raw === 'compact') return 'small';
  return fallback;
}

// ---------------------------------------------------------------------------
// Placement en grille (logique pure)
// ---------------------------------------------------------------------------

interface GridRect {
  col: number;
  row: number;
  w: number;
  h: number;
}

/** Rectangle (cases) occupé par une entrée. */
function entryRect(e: WidgetLayoutEntry): GridRect {
  const s = sizeSpan(e.size);
  return { col: e.col, row: e.row, w: s.w, h: s.h };
}

/** Vrai si deux rectangles de cases se chevauchent. */
function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return (
    a.col < b.col + b.w &&
    b.col < a.col + a.w &&
    a.row < b.row + b.h &&
    b.row < a.row + a.h
  );
}

/** Première case libre (ligne asc, colonne asc) pour une forme, parmi `occupied`. */
function firstFreeCell(occupied: WidgetLayoutEntry[], size: WidgetSize): { col: number; row: number } {
  const { w, h } = sizeSpan(size);
  // Garde-fou. Relevé de ×4 à ×8 par ACCUEIL-04 : les hauteurs comptent désormais en demi-cases,
  // donc un hub entier de `large` (h=4) peut légitimement occuper deux fois plus de lignes qu'avant.
  const maxRow = occupied.length * 8 + 8;
  for (let row = 0; row <= maxRow; row += 1) {
    for (let col = 0; col + w <= GRID_COLS; col += 1) {
      const cand: GridRect = { col, row, w, h };
      if (!occupied.some((p) => rectsOverlap(cand, entryRect(p)))) return { col, row };
    }
  }
  return { col: 0, row: maxRow + 1 };
}

/** Place une liste ordonnée en grille, sans trou, par premier emplacement libre (défaut/migration). */
function firstFitAll(items: { id: WidgetId; visible: boolean; size: WidgetSize }[]): WidgetLayoutEntry[] {
  const placed: WidgetLayoutEntry[] = [];
  for (const it of items) {
    const { col, row } = firstFreeCell(placed, it.size);
    placed.push({ id: it.id, visible: it.visible, size: it.size, col, row });
  }
  return placed;
}

/**
 * **Compaction verticale** : remonte chaque widget aussi haut que possible (colonne inchangée),
 * sans chevauchement → aucune ligne vide entre les modules. Résout aussi les collisions (un widget
 * chevauché descend à la première ligne libre). Traite les widgets par ligne croissante ; à ligne
 * égale, `priorityId` (le module déplacé) est placé en premier pour « gagner » le slot le plus haut.
 * Mutation en place (seul `row` change).
 */
function compactVertical(widgets: WidgetLayoutEntry[], priorityId?: WidgetId): void {
  const ordered = [...widgets].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    if (priorityId) {
      if (a.id === priorityId) return -1;
      if (b.id === priorityId) return 1;
    }
    return a.col - b.col;
  });
  const placed: WidgetLayoutEntry[] = [];
  for (const it of ordered) {
    let row = 0;
    while (placed.some((p) => rectsOverlap({ ...entryRect(it), row }, entryRect(p)))) {
      row += 1;
    }
    it.row = row;
    placed.push(it);
  }

  // ⚠️ La compaction verticale ne suffit pas : elle conserve `col`. US INSIGHTS-02 a retiré 14
  // widgets d'un coup — si le `small` de gauche disparaît et que celui de droite reste, ce dernier
  // ne glisse pas et laisse une **demi-cellule vide** visible. Défaut trouvé en relecture de
  // cadrage, invisible tant qu'on ne retirait qu'un widget à la fois (précédent GARDE-01).
  //
  // **Jamais pendant un glisser-déposer** (`priorityId` défini) : là, la colonne choisie par
  // l'utilisateur *est* l'intention, et la rabattre à gauche annulerait son geste.
  if (priorityId === undefined) compactHorizontal(placed);
}

/**
 * Rabat vers la gauche les widgets qui ont perdu leur voisin de colonne 0.
 *
 * Volontairement minimal : on ne re-range **que** ce qui laisse un trou sur sa propre ligne, on ne
 * réorganise pas la grille. Un first-fit complet remonterait des widgets d'une ligne à l'autre et
 * détruirait des dispositions que l'utilisateur a voulues — on corrige le défaut, on ne réécrit pas
 * son écran. Idempotent : appliqué deux fois, il donne le même résultat.
 */
function compactHorizontal(widgets: WidgetLayoutEntry[]): void {
  for (const it of widgets) {
    if (it.col === 0) continue;
    const others = widgets.filter((w) => w !== it);
    const shifted = { ...entryRect(it), col: 0 };
    if (!others.some((p) => rectsOverlap(shifted, entryRect(p)))) it.col = 0;
  }
}

// ---------------------------------------------------------------------------
// Disposition par défaut
// ---------------------------------------------------------------------------

/**
 * Disposition par défaut d'un hub : tous les widgets connus, forme par défaut, placés
 * sans trou (premier emplacement libre) dans l'ordre canonique. Nouvelle instance à chaque appel.
 */
export function defaultScreenLayout(screen: WidgetScreen): ScreenLayout {
  const items = WIDGET_REGISTRY[screen].ids.map((id) => ({
    id,
    visible: true,
    size: defaultSizeOf(screen, id),
  }));
  return { widgets: firstFitAll(items) };
}

// ---------------------------------------------------------------------------
// Résolution (ordre + forward-compat + filtrage pilier + recompactage)
// ---------------------------------------------------------------------------

/**
 * Vrai si le widget doit être affiché, compte tenu des piliers actifs **et** des réglages d'opt-in.
 *
 * ⚠️ Pour une garde par réglage, l'absence de valeur vaut **non** — jamais oui. Un drapeau manquant
 * (réglages pas encore chargés, ligne locale antérieure à la migration) doit masquer le widget, pas
 * le révéler : c'est ce qui garantit qu'un opt-in de donnée sensible ne s'ouvre pas par accident.
 * C'est l'inverse du repli des piliers juste en dessous, où l'absence de garde vaut « visible ».
 */
function isWidgetAllowed(
  screen: WidgetScreen,
  id: string,
  activePillars: readonly Pillar[],
  flags: WidgetSettingFlags,
): boolean {
  const guard = WIDGET_REGISTRY[screen].pillars[id];
  if (guard === 'always') return true;
  if (!guard) return true;
  if (Array.isArray(guard)) return guard.some((p) => activePillars.includes(p));
  return flags[(guard as { setting: WidgetSettingKey }).setting] === true;
}

/** Entrée brute normalisée en interne (position grille éventuellement absente = ancien format). */
interface RawEntry {
  id: WidgetId;
  visible: boolean;
  size: WidgetSize;
  col?: number;
  row?: number;
  order?: number;
}

/**
 * Résout la disposition stockée d'un hub en liste prête à rendre (positions en grille),
 * filtrée par piliers :
 *  - ignore les IDs inconnus, déduplique ;
 *  - **filtre par pilier** ;
 *  - si toutes les entrées portent une position grille (`col`/`row`) → les conserve
 *    (bornées), et place les IDs connus manquants (forward-compat) dans une case libre ;
 *  - sinon (**ancien format** ordre/`full|compact`, ou vide) → **migration** : tri par
 *    `order` puis placement sans trou (`firstFitAll`).
 */
export function resolveScreenLayout(
  stored: ScreenLayout | null | undefined,
  screen: WidgetScreen,
  activePillars: readonly Pillar[],
  /**
   * Réglages d'opt-in gardant certains widgets. **Optionnel, et son absence masque** les widgets
   * concernés — voir `isWidgetAllowed`. Un appelant qui l'oublie ne révèle donc jamais un widget
   * sensible par inadvertance ; il le cache, ce qui est le sens sûr de l'erreur.
   */
  flags: WidgetSettingFlags = {},
): ScreenLayout {
  const base = stored ?? defaultScreenLayout(screen);
  const known = knownIds(screen);

  const seen = new Set<string>();
  const raw: RawEntry[] = [];
  for (const entry of base.widgets) {
    if (!entry || !known.has(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const col = (entry as Partial<WidgetLayoutEntry>).col;
    const row = (entry as Partial<WidgetLayoutEntry>).row;
    const order = (entry as { order?: unknown }).order;
    raw.push({
      id: entry.id,
      visible: entry.visible !== false,
      size: coerceSize(entry.size, defaultSizeOf(screen, entry.id)),
      col: typeof col === 'number' && Number.isFinite(col) ? col : undefined,
      row: typeof row === 'number' && Number.isFinite(row) ? row : undefined,
      order: typeof order === 'number' && Number.isFinite(order) ? order : undefined,
    });
  }

  // Filtrage AVANT placement (évite les trous laissés par un widget masqué : pilier inactif ou
  // opt-in désactivé).
  const filtered = raw.filter((w) => isWidgetAllowed(screen, w.id, activePillars, flags));
  const missing = WIDGET_REGISTRY[screen].ids.filter(
    (id) => !seen.has(id) && isWidgetAllowed(screen, id, activePillars, flags),
  );

  const hasGrid = filtered.length > 0 && filtered.every((w) => w.col !== undefined && w.row !== undefined);

  if (hasGrid) {
    const widgets: WidgetLayoutEntry[] = filtered.map((w) => ({
      id: w.id,
      visible: w.visible,
      size: w.size,
      col: clampCol(w.col!, sizeSpan(w.size).w),
      row: Math.max(0, w.row!),
    }));
    // Forward-compat : widgets connus manquants → placés dans une case libre.
    for (const id of missing) {
      const size = defaultSizeOf(screen, id);
      const { col, row } = firstFreeCell(widgets, size);
      widgets.push({ id, visible: true, size, col, row });
    }
    // Compaction : aucune ligne vide (colonnes conservées) — invariant « pas d'espace entre modules ».
    compactVertical(widgets);
    return { widgets };
  }

  // Ancien format / vide → migration : tri par `order` (fallback ordre du tableau) puis first-fit.
  const ordered = filtered
    .map((w, i) => ({ w, k: w.order ?? i }))
    .sort((a, b) => a.k - b.k)
    .map(({ w }) => ({ id: w.id, visible: w.visible, size: w.size }));
  for (const id of missing) {
    ordered.push({ id, visible: true, size: defaultSizeOf(screen, id) });
  }
  return { widgets: firstFitAll(ordered) };
}

// ---------------------------------------------------------------------------
// Déplacement en grille
// ---------------------------------------------------------------------------

/**
 * Déplace le widget `id` vers la case cible (`col`, `row`) puis **compacte verticalement**
 * (aucune ligne vide ; les widgets chevauchés descendent, tout le reste remonte). Le module
 * déplacé est prioritaire à ligne égale. Pur / immuable. La colonne est bornée pour que
 * l'empreinte tienne dans la grille. Id inconnu → inchangé.
 */
export function moveWidgetToCell(
  layout: ScreenLayout,
  id: WidgetId,
  col: number,
  row: number,
): ScreenLayout {
  const widgets = layout.widgets.map((w) => ({ ...w }));
  const moved = widgets.find((w) => w.id === id);
  if (!moved) return { widgets };
  moved.col = clampCol(Math.round(col), sizeSpan(moved.size).w);
  moved.row = Math.max(0, Math.round(row));
  compactVertical(widgets, id);
  return { widgets };
}

/** Nombre de lignes occupées par la disposition (hauteur de grille, pour le rendu). */
export function gridRowCount(entries: WidgetLayoutEntry[]): number {
  return entries.reduce((max, e) => Math.max(max, e.row + sizeSpan(e.size).h), 0);
}

/**
 * Copie **compactée verticalement** d'une liste de widgets (aucune ligne vide, colonnes
 * conservées). Pur. Utilisé par l'**affichage** pour compacter le sous-ensemble *visible* (les
 * widgets masqués ne doivent pas laisser de trou), indépendamment des positions stockées.
 */
export function compactLayout(entries: WidgetLayoutEntry[]): WidgetLayoutEntry[] {
  const copy = entries.map((e) => ({ ...e }));
  compactVertical(copy);
  return copy;
}

// ---------------------------------------------------------------------------
// Parsing tolérant + rétro-compatibilité
// ---------------------------------------------------------------------------

/** Vrai si la valeur est un objet non-null (hors tableau). */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Normalise une entrée brute en `WidgetLayoutEntry` pour un hub, ou `null` si invalide.
 * Conserve la position grille (`col`/`row`) si présente, et `order` (ancien format) pour la
 * migration ultérieure par `resolveScreenLayout`. Une entrée sans position est placée à
 * (0,0) provisoirement — la résolution la repositionnera (first-fit) puisqu'elle n'a pas de grille.
 */
function parseEntry(raw: unknown, screen: WidgetScreen): WidgetLayoutEntry & { order?: number } | null {
  if (!isRecord(raw)) return null;
  const id = raw['id'];
  if (typeof id !== 'string' || !knownIds(screen).has(id)) return null;
  const col = raw['col'];
  const row = raw['row'];
  const order = raw['order'];
  const hasCol = typeof col === 'number' && Number.isFinite(col);
  const hasRow = typeof row === 'number' && Number.isFinite(row);
  return {
    id: id as WidgetId,
    visible: raw['visible'] !== false,
    size: coerceSize(raw['size'], defaultSizeOf(screen, id)),
    // Sentinelle `NaN` si la position grille est absente (ancien format) → `resolveScreenLayout`
    // détecte le non-fini et migre par first-fit. Jamais persisté tel quel (toujours résolu avant).
    col: hasCol ? (col as number) : Number.NaN,
    row: hasRow ? (row as number) : Number.NaN,
    ...(typeof order === 'number' && Number.isFinite(order) ? { order: order as number } : {}),
  };
}

/** Parse un tableau brut de widgets d'un hub en `ScreenLayout` (entrées invalides ignorées). */
function parseScreenLayout(raw: unknown, screen: WidgetScreen): ScreenLayout | null {
  if (!isRecord(raw)) return null;
  const widgetsRaw = raw['widgets'];
  if (!Array.isArray(widgetsRaw)) return null;
  const widgets: WidgetLayoutEntry[] = [];
  for (const entry of widgetsRaw) {
    const parsed = parseEntry(entry, screen);
    if (parsed) widgets.push(parsed);
  }
  return { widgets };
}

/**
 * Parse tolérant d'une valeur brute (JSON désérialisé OU chaîne JSON) en
 * `MultiScreenLayout`. **Rétro-compatible** :
 *  - nouveau format `{ screens: { home, strength, running } }` → parsé par hub ;
 *  - **ancien** format `{ widgets: [...] }` → interprété comme `screens.home`
 *    (tailles migrées `full→wide` / `compact→small`).
 *
 * Retourne `null` si absent / corrompu / invalide, sans jamais lever. Les hubs / entrées
 * malformés sont ignorés individuellement.
 */
export function parseMultiScreenLayout(raw: unknown): MultiScreenLayout | null {
  if (raw == null) return null;

  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!isRecord(value)) return null;

  // Version du schéma de formes : absente ou non finie = disposition d'avant ACCUEIL-04.
  const rawV = value['v'];
  const version = typeof rawV === 'number' && Number.isFinite(rawV) ? rawV : 1;

  // Nouveau format multi-hubs.
  if (isRecord(value['screens'])) {
    const screensRaw = value['screens'];
    const screens: Partial<Record<WidgetScreen, ScreenLayout>> = {};
    for (const screen of WIDGET_SCREENS) {
      const parsed = parseScreenLayout(screensRaw[screen], screen);
      if (parsed) screens[screen] = migrateSizes(parsed, screen, version);
    }
    return { screens, v: LAYOUT_VERSION };
  }

  // Ancien format mono-hub `{ widgets:[…] }` → accueil.
  if (Array.isArray(value['widgets'])) {
    const home = parseScreenLayout(value, 'home');
    return home
      ? { screens: { home: migrateSizes(home, 'home', version) }, v: LAYOUT_VERSION }
      : null;
  }

  return null;
}

/**
 * Applique les réattributions de formes de la v2 à une disposition lue en v1.
 *
 * Volontairement **limitée aux ids de `SIZES_MIGRATED_TO_V2`** et au hub `home` : c'est le seul
 * endroit où les formes par défaut ont changé. Réappliquer partout écraserait des choix réels sur
 * les hubs muscu et course, qui n'ont pas bougé.
 *
 * Idempotente : appliquée deux fois, elle donne le même résultat — et une disposition déjà en v2
 * n'est pas touchée du tout.
 */
function migrateSizes(
  layout: ScreenLayout,
  screen: WidgetScreen,
  version: number,
): ScreenLayout {
  if (version >= LAYOUT_VERSION || screen !== 'home') return layout;
  return {
    widgets: layout.widgets.map((w) => {
      const forced = SIZES_MIGRATED_TO_V2[w.id];
      return forced && w.size !== forced ? { ...w, size: forced } : w;
    }),
  };
}
