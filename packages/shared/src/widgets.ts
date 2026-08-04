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

/** Forme d'un widget : petit carré (½ largeur) / rectangle / grand carré (pleine largeur). */
export type WidgetSize = 'small' | 'wide' | 'large';

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
  'today-session',
  'nutrition-summary',
  'streak',
  'weight',
  'record-recent',
  'muscle-volume',
  'running-week',
  'deficit-volume',
  'training-time',
  // US PAS-01 — ajouté en fin de registre : `resolveScreenLayout` complète les layouts déjà
  // stockés avec les IDs manquants, donc aucune migration de `dashboard_layout` n'est nécessaire.
  'steps',
  // US BIEN-01 — même raison, même place : en fin de registre.
  'wellbeing',
  // US OBJ-01 — même raison, même place : en fin de registre.
  'goals',
  // US BILAN-01 — idem.
  'review',
  // US CYCLE-01 — idem. **Pas d'onglet de navigation** (arbitrage du 31/07/2026) : ce widget est
  // le seul point d'entrée du suivi de cycle, l'écran de détail s'ouvre en appuyant dessus.
  'cycle',
  // US META-19 — idem. **Widget conditionnel** (Tier 2, ADR-007) : rendu `null` hors de la zone de
  // risque ACWR, comme `deficit-volume` — pas un ajout permanent au plafond Tier 0.
  'training-load',
  // US TRI-12 — idem. **Widget conditionnel** (Tier 2, ADR-007) : rendu `null` hors des deux
  // signaux réunis (charge sans repos + déficit persistant) — même logique que `training-load`.
  'overtraining-guard',
  // US ACTIV-01 — idem. **Widget conditionnel temporel** : visible seulement les 7 jours suivant
  // la fin de l'onboarding (ou jusqu'à une fermeture explicite). Contrairement à `training-load`/
  // `overtraining-guard`, sa condition doit être déclarée dans `isWidgetActive` côté écran —
  // sans ça, il laisserait un trou dans la grille après le jour 7 (bug déjà constaté sur ces deux
  // widgets, voir BACKLOG.md dette technique).
  'activation-path',
  // US TRI-03 — idem. **Transverse comme `wellbeing`/`review`**, pas conditionnel par pilier
  // (contrairement à `training-load`/`overtraining-guard`) : la dégradation se fait par composante
  // à l'intérieur du hook (spec D2), pas par une garde tout-ou-rien. Rendu `null` seulement si
  // aucune des 3 composantes n'a de données (spec R5).
  'readiness',
  // US RN-03 — idem. **Conditionnel Tier 2**, gardé par les deux piliers `running`+`nutrition` (la
  // fréquence de course vient de l'un, le niveau d'activité déclaré à comparer de l'autre) — rendu
  // `null` si le palier suggéré est déjà celui déclaré (spec R3).
  'activity-level-suggestion',
  // US MR-08 — idem. **Conditionnel Tier 2**, gardé par les deux piliers `strength`+`running`
  // (même garde tout-ou-rien que `training-load`) — rendu `null` hors divergence détectée entre
  // les deux piliers (spec R2).
  'concurrent-training-interference',
  // US GARDE-01 : `load-streak-alert` (MR-14) **retiré** ici — fusionné dans `overtraining-guard`,
  // qui porte désormais 2 niveaux de sévérité. Aucune migration de `dashboard_layout` nécessaire :
  // `resolveScreenLayout` ignore les ids inconnus d'un layout stocké (voir son filtre `known.has`).
] as const;

/**
 * Muscu : les 4 modules-aperçu du hub (maquette validée), **plus** `strength-templates`
 * (US Refonte-D, 22/07/2026) — point d'entrée permanent vers « Mes templates »,
 * indépendant du flux « Séance libre », ajouté en fin de registre.
 */
export const STRENGTH_WIDGET_IDS = [
  'strength-programs',
  'strength-history',
  'strength-planning',
  'strength-progress',
  'strength-templates',
] as const;

/** Course : les 3 modules-aperçu du hub, widgetisés. Ordre = disposition par défaut (maquette validée). */
export const RUNNING_WIDGET_IDS = [
  'running-history',
  'running-programs',
  'running-planning',
] as const;

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
      'today-session': ['strength'],
      'nutrition-summary': ['nutrition'],
      streak: 'always',
      weight: ['nutrition'],
      'record-recent': ['strength', 'running'],
      'muscle-volume': ['strength'],
      'running-week': ['running'],
      'deficit-volume': ['strength', 'nutrition'],
      'training-time': ['strength', 'running'],
      // Transverse comme `streak` : la marche n'appartient à aucun pilier, et un utilisateur
      // « nutrition seule » doit pouvoir suivre ses pas (US PAS-01).
      steps: 'always',
      // Transverse aussi (US BIEN-01) : le bien-être est une 4ᵉ dimension, **pas** un 4ᵉ pilier
      // activable — aucune entrée dans `active_pillars`, donc jamais filtré.
      wellbeing: 'always',
      // US OBJ-01 : **pas** `'always'`, contrairement à `steps` et `wellbeing`. Les 2 types
      // d'objectif au lancement portent sur la course et la force ; un utilisateur « nutrition
      // seule » n'en créerait aucun, le widget serait un vide permanent. Même garde que
      // `record-recent` et `training-time`.
      goals: ['strength', 'running'],
      // US BILAN-01 : transverse, contrairement à `goals` juste au-dessus. Le bilan **agrège ce qui
      // existe** — un utilisateur « nutrition seule » y trouve ses jours journalisés et son
      // adhérence, donc la carte a du contenu quel que soit le pilier activé.
      review: 'always',
      // US CYCLE-01 : **ni pilier, ni `'always'`** — le seul widget gardé par un réglage.
      // Pas une liste de piliers : le cycle n'appartient à aucun des trois. Pas `'always'` non
      // plus : c'est une donnée de santé sensible, en opt-in strict, désactivé par défaut.
      cycle: { setting: 'cycleTrackingEnabled' },
      // US META-19 : même garde que `training-time` — l'ACWR combine muscu et course, un seul
      // pilier actif ne donnerait qu'une moitié du calcul.
      'training-load': ['strength', 'running'],
      // US GARDE-01 (ex-TRI-12) : garde ramenée de 3 à **2 piliers**. Le garde-fou combine toujours
      // charge et déficit, mais le déficit ne décide plus que du **niveau** de sévérité : la
      // nutrition dégrade sa composante dans le hook au lieu de masquer le widget (spec D2, même
      // patron que `readiness`). Sans ça, un utilisateur muscu+course ne voyait jamais l'alerte —
      // c'était toute la raison d'être de feu MR-14, désormais fusionnée ici.
      'overtraining-guard': ['strength', 'running'],
      // US ACTIV-01 : transverse comme `streak`/`steps`/`wellbeing`/`review` — le parcours cible
      // n'importe quel utilisateur les 7 premiers jours, quels que soient ses piliers actifs.
      'activation-path': 'always',
      // US TRI-03 : transverse — la dégradation par composante (charge / nutrition / bien-être)
      // vit dans le hook, pas dans cette garde. Un utilisateur mono-pilier avec des check-ins doit
      // pouvoir avoir un verdict partiel, comme `wellbeing`.
      readiness: 'always',
      // US RN-03 : garde à 2 piliers, comme `training-load` — contrairement à `readiness`, cette
      // suggestion a strictement besoin des deux données à la fois (pas de dégradation partielle
      // possible : sans `running`, aucune fréquence ; sans `nutrition`, aucun niveau à comparer).
      'activity-level-suggestion': ['running', 'nutrition'],
      // US MR-08 : même garde que `training-load` — la divergence compare les deux piliers, un
      // seul actif ne donnerait qu'une moitié de la comparaison.
      'concurrent-training-interference': ['strength', 'running'],
    },
    defaultSize: uniformSize(HOME_WIDGET_IDS, 'wide'),
  },
  strength: {
    ids: STRENGTH_WIDGET_IDS,
    pillars: uniformPillar(STRENGTH_WIDGET_IDS, 'strength'),
    defaultSize: {
      'strength-programs': 'small',
      'strength-history': 'small',
      'strength-planning': 'wide',
      'strength-progress': 'large',
      'strength-templates': 'small',
    },
  },
  running: {
    ids: RUNNING_WIDGET_IDS,
    pillars: uniformPillar(RUNNING_WIDGET_IDS, 'running'),
    defaultSize: {
      'running-history': 'wide',
      'running-programs': 'small',
      'running-planning': 'small',
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
 * Empreinte de chaque forme (case unité = 1 petit carré) :
 *  - `small` = 1×1 (petit carré) ;
 *  - `wide`  = 2×1 (rectangle pleine largeur, mi-hauteur) ;
 *  - `large` = 2×2 (grand carré pleine largeur).
 */
export function sizeSpan(size: WidgetSize): WidgetSpan {
  if (size === 'small') return { w: 1, h: 1 };
  if (size === 'wide') return { w: 2, h: 1 };
  return { w: 2, h: 2 };
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
}

// ---------------------------------------------------------------------------
// Formes — coercition & migration
// ---------------------------------------------------------------------------

/**
 * Coerce une valeur brute en `WidgetSize`, en **migrant** l'ancien modèle :
 * `full → wide`, `compact → small`. Toute autre valeur → `fallback`.
 */
export function coerceSize(raw: unknown, fallback: WidgetSize): WidgetSize {
  if (raw === 'small' || raw === 'wide' || raw === 'large') return raw;
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
  const maxRow = occupied.length * 4 + 8; // garde-fou
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

  // Nouveau format multi-hubs.
  if (isRecord(value['screens'])) {
    const screensRaw = value['screens'];
    const screens: Partial<Record<WidgetScreen, ScreenLayout>> = {};
    for (const screen of WIDGET_SCREENS) {
      const parsed = parseScreenLayout(screensRaw[screen], screen);
      if (parsed) screens[screen] = parsed;
    }
    return { screens };
  }

  // Ancien format mono-hub `{ widgets:[…] }` → accueil.
  if (Array.isArray(value['widgets'])) {
    const home = parseScreenLayout(value, 'home');
    return home ? { screens: { home } } : null;
  }

  return null;
}
