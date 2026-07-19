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
// Types de disposition
// ---------------------------------------------------------------------------

/** Entrée de disposition pour un widget (ordre + visibilité + forme). */
export interface WidgetLayoutEntry {
  id: WidgetId;
  visible: boolean;
  order: number;
  size: WidgetSize;
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
// Disposition par défaut
// ---------------------------------------------------------------------------

/**
 * Disposition par défaut d'un hub : tous les widgets, ordre canonique, visibles,
 * chacun à sa forme par défaut. Nouvelle instance à chaque appel (immuable côté appelant).
 */
export function defaultScreenLayout(screen: WidgetScreen): ScreenLayout {
  return {
    widgets: WIDGET_REGISTRY[screen].ids.map((id, order) => ({
      id,
      order,
      visible: true,
      size: defaultSizeOf(screen, id),
    })),
  };
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

/** Réécrit les `order` en 0..n-1 selon l'ordre courant du tableau (immuable). */
function recompact(widgets: WidgetLayoutEntry[]): WidgetLayoutEntry[] {
  return widgets.map((w, order) => ({ ...w, order }));
}

/**
 * Résout la disposition stockée d'un hub en liste ordonnée, filtrée par piliers, prête
 * à rendre. Mêmes garanties que l'ancien `resolveDashboardLayout`, scopées au hub :
 * ignore les IDs inconnus, ajoute en fin les IDs connus manquants (forward-compat),
 * filtre par pilier, trie par `order`, recompacte.
 */
export function resolveScreenLayout(
  stored: ScreenLayout | null | undefined,
  screen: WidgetScreen,
  activePillars: readonly Pillar[],
): ScreenLayout {
  const base = stored ?? defaultScreenLayout(screen);
  const known = knownIds(screen);

  const seen = new Set<string>();
  const entries: WidgetLayoutEntry[] = [];
  for (const entry of base.widgets) {
    if (!entry || !known.has(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push({
      id: entry.id,
      visible: entry.visible !== false,
      order: typeof entry.order === 'number' ? entry.order : entries.length,
      size: coerceSize(entry.size, defaultSizeOf(screen, entry.id)),
    });
  }

  const sorted = [...entries].sort((a, b) => a.order - b.order);

  // Forward-compat : widgets connus absents → ajoutés en fin, visibles, forme par défaut.
  for (const id of WIDGET_REGISTRY[screen].ids) {
    if (!seen.has(id)) {
      sorted.push({ id, visible: true, order: sorted.length, size: defaultSizeOf(screen, id) });
    }
  }

  const filtered = sorted.filter((w) => isWidgetAllowed(screen, w.id, activePillars));
  return { widgets: recompact(filtered) };
}

// ---------------------------------------------------------------------------
// Déplacement
// ---------------------------------------------------------------------------

/**
 * Déplace le widget `id` à l'index cible `toIndex` (borné à [0, n-1]) et recompacte
 * les `order`. Pur / immuable. Id inconnu → layout recompacté inchangé.
 */
export function moveWidget(
  layout: ScreenLayout,
  id: WidgetId,
  toIndex: number,
): ScreenLayout {
  const widgets = [...layout.widgets];
  const from = widgets.findIndex((w) => w.id === id);
  if (from === -1) {
    return { widgets: recompact(widgets) };
  }
  const clamped = Math.max(0, Math.min(toIndex, widgets.length - 1));
  const [moved] = widgets.splice(from, 1);
  widgets.splice(clamped, 0, moved!);
  return { widgets: recompact(widgets) };
}

// ---------------------------------------------------------------------------
// Packing de la grille 2 colonnes
// ---------------------------------------------------------------------------

/** Une ligne de la grille : 1 cellule pleine largeur, ou 1-2 petits carrés. */
export interface WidgetRow {
  cells: WidgetLayoutEntry[];
  /** Vrai si la ligne occupe toute la largeur (`wide`/`large`). */
  full: boolean;
}

/**
 * Coule une liste ordonnée de widgets en lignes de grille 2 colonnes :
 *  - deux `small` **consécutifs** → même ligne (2 cellules) ;
 *  - `wide` / `large` → ligne pleine largeur (1 cellule) ;
 *  - `small` isolé → ligne à 1 cellule (colonne gauche, droite vide).
 *
 * Déterministe : dérive du seul **ordre** (aucune position stockée).
 */
export function packWidgets(entries: WidgetLayoutEntry[]): WidgetRow[] {
  const rows: WidgetRow[] = [];
  let i = 0;
  while (i < entries.length) {
    const e = entries[i]!;
    if (e.size === 'small') {
      const next = entries[i + 1];
      if (next && next.size === 'small') {
        rows.push({ cells: [e, next], full: false });
        i += 2;
      } else {
        rows.push({ cells: [e], full: false });
        i += 1;
      }
    } else {
      rows.push({ cells: [e], full: true });
      i += 1;
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Parsing tolérant + rétro-compatibilité
// ---------------------------------------------------------------------------

/** Vrai si la valeur est un objet non-null (hors tableau). */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Normalise une entrée brute en `WidgetLayoutEntry` pour un hub, ou `null` si invalide. */
function parseEntry(raw: unknown, screen: WidgetScreen): WidgetLayoutEntry | null {
  if (!isRecord(raw)) return null;
  const id = raw['id'];
  if (typeof id !== 'string' || !knownIds(screen).has(id)) return null;
  const order = raw['order'];
  return {
    id: id as WidgetId,
    visible: raw['visible'] !== false,
    order: typeof order === 'number' && Number.isFinite(order) ? order : 0,
    size: coerceSize(raw['size'], defaultSizeOf(screen, id)),
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
