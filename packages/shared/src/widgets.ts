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
] as const;

/** Muscu : les 4 modules-aperçu du hub, widgetisés. Ordre = disposition par défaut (maquette validée). */
export const STRENGTH_WIDGET_IDS = [
  'strength-programs',
  'strength-history',
  'strength-planning',
  'strength-progress',
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

/** Définition d'un hub : IDs ordonnés + garde pilier + forme par défaut, par widget. */
interface ScreenRegistry {
  ids: readonly WidgetId[];
  /** `'always'` = widget transverse, jamais filtré par pilier (cf. accueil). */
  pillars: Record<string, Pillar[] | 'always'>;
  defaultSize: Record<string, WidgetSize>;
}

/** Toutes les entrées d'un hub à la même forme (helper de construction du registre). */
function uniformSize(ids: readonly string[], size: WidgetSize): Record<string, WidgetSize> {
  return Object.fromEntries(ids.map((id) => [id, size]));
}

/** Toutes les entrées d'un hub gardées par un unique pilier (muscu / course). */
function uniformPillar(
  ids: readonly string[],
  pillar: Pillar,
): Record<string, Pillar[] | 'always'> {
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
 * Résout les chevauchements après un déplacement : le widget `movedId` est **fixe** (prioritaire),
 * tout widget qui le chevauche (ou en chevauche un autre) est **poussé vers le bas**. Les lignes ne
 * font qu'augmenter → terminaison garantie (borne de sécurité). Mutation en place du tableau fourni.
 */
function resolveCollisions(widgets: WidgetLayoutEntry[], movedId: WidgetId): void {
  const guard = widgets.length * widgets.length + widgets.length + 20;
  for (let k = 0; k < guard; k += 1) {
    // `moved` toujours en tête → jamais poussé ; les autres par ligne puis colonne croissantes.
    const ordered = [...widgets].sort((a, b) => {
      if (a.id === movedId) return -1;
      if (b.id === movedId) return 1;
      return a.row - b.row || a.col - b.col;
    });
    let pushed = false;
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const A = ordered[i]!;
        const B = ordered[j]!;
        if (rectsOverlap(entryRect(A), entryRect(B))) {
          B.row = A.row + sizeSpan(A.size).h; // pousse B juste sous A
          pushed = true;
        }
      }
    }
    if (!pushed) break;
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

/** Vrai si le widget doit être affiché compte tenu des piliers actifs. */
function isWidgetAllowed(
  screen: WidgetScreen,
  id: string,
  activePillars: readonly Pillar[],
): boolean {
  const pillars = WIDGET_REGISTRY[screen].pillars[id];
  if (pillars === 'always') return true;
  if (!pillars) return true;
  return pillars.some((p) => activePillars.includes(p));
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

  // Filtrage pilier AVANT placement (évite les trous laissés par des widgets de pilier inactif).
  const filtered = raw.filter((w) => isWidgetAllowed(screen, w.id, activePillars));
  const missing = WIDGET_REGISTRY[screen].ids.filter(
    (id) => !seen.has(id) && isWidgetAllowed(screen, id, activePillars),
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
 * Déplace le widget `id` vers la case cible (`col`, `row`) puis **résout les collisions**
 * en poussant vers le bas les widgets chevauchés (trous autorisés). Pur / immuable. La
 * colonne est bornée pour que l'empreinte tienne dans la grille. Id inconnu → inchangé.
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
  resolveCollisions(widgets, id);
  return { widgets };
}

/** Nombre de lignes occupées par la disposition (hauteur de grille, pour le rendu). */
export function gridRowCount(entries: WidgetLayoutEntry[]): number {
  return entries.reduce((max, e) => Math.max(max, e.row + sizeSpan(e.size).h), 0);
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
