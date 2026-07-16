/**
 * Registre + logique pure de personnalisation du dashboard (US 7.1/7.2/7.3/7.11/7.12).
 *
 * Zéro dépendance native / React : uniquement des types et des fonctions pures
 * (testées via Vitest). Le mobile réutilise ces helpers pour résoudre la
 * disposition stockée (`user_settings.dashboard_layout`) en une liste ordonnée,
 * filtrée par piliers actifs, prête à rendre.
 */

import type { Pillar } from './pillar';

/**
 * Identifiants canoniques des widgets du dashboard, dans l'ordre par défaut
 * (celui de `(tabs)/index.tsx` du Lot A).
 */
export const DASHBOARD_WIDGET_IDS = [
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

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

/** Ensemble (rapide) des IDs connus, pour filtrer les entrées inconnues. */
const KNOWN_IDS = new Set<string>(DASHBOARD_WIDGET_IDS);

/**
 * Gardes par pilier : un widget est masqué (filtré) si AUCUN de ses piliers
 * n'est actif. `'always'` = widget transverse, jamais filtré par ce critère
 * (le flag `always` ne concerne QUE le filtrage par pilier, pas la
 * masquabilité — cf. spec §2, masquabilité uniforme).
 */
export const WIDGET_PILLARS: Record<DashboardWidgetId, Pillar[] | 'always'> = {
  'today-session': ['strength'],
  'nutrition-summary': ['nutrition'],
  streak: 'always',
  weight: ['nutrition'],
  'record-recent': ['strength', 'running'],
  'muscle-volume': ['strength'],
  'running-week': ['running'],
  'deficit-volume': ['strength', 'nutrition'],
  'training-time': ['strength', 'running'],
};

/** Taille d'affichage d'un widget : carte normale ou ligne compacte. */
export type WidgetSize = 'full' | 'compact';

/** Entrée de disposition pour un widget (ordre + visibilité + taille). */
export interface WidgetLayoutEntry {
  id: DashboardWidgetId;
  visible: boolean;
  order: number;
  size: WidgetSize;
}

/** Disposition complète du dashboard (JSON stocké dans `dashboard_layout`). */
export interface DashboardLayout {
  widgets: WidgetLayoutEntry[];
}

/**
 * Disposition par défaut : tous les widgets, ordre canonique, tous visibles en
 * taille normale. Nouvelle instance à chaque appel (immuable côté appelant).
 */
export function defaultDashboardLayout(): DashboardLayout {
  return {
    widgets: DASHBOARD_WIDGET_IDS.map((id, order) => ({
      id,
      order,
      visible: true,
      size: 'full' as WidgetSize,
    })),
  };
}

/** Vrai si le widget doit être affiché compte tenu des piliers actifs. */
function isWidgetAllowed(id: DashboardWidgetId, activePillars: readonly Pillar[]): boolean {
  const pillars = WIDGET_PILLARS[id];
  if (pillars === 'always') return true;
  return pillars.some((p) => activePillars.includes(p));
}

/** Réécrit les `order` en 0..n-1 selon l'ordre courant du tableau (immuable). */
function recompact(widgets: WidgetLayoutEntry[]): WidgetLayoutEntry[] {
  return widgets.map((w, order) => ({ ...w, order }));
}

/**
 * Résout la disposition stockée en une liste ordonnée, filtrée par piliers,
 * prête à rendre.
 *
 * 1. Part du `stored` s'il existe (sinon défaut).
 * 2. Ignore les IDs inconnus (widget retiré du code) sans planter.
 * 3. Fusion forward-compat : tout `DashboardWidgetId` connu absent du stored
 *    est ajouté en fin, `visible:true`, `size:'full'` (jamais perdu).
 * 4. Filtre les widgets dont aucun pilier n'est actif ; `always` jamais filtré.
 * 5. Trie par `order`, préserve `visible`/`size`, recompacte `order` en 0..n-1.
 */
export function resolveDashboardLayout(
  stored: DashboardLayout | null | undefined,
  activePillars: readonly Pillar[],
): DashboardLayout {
  const base = stored ?? defaultDashboardLayout();

  // Entrées connues du stored (ignore les IDs inconnus), dédupliquées.
  const seen = new Set<DashboardWidgetId>();
  const known: WidgetLayoutEntry[] = [];
  for (const entry of base.widgets) {
    if (!entry || !KNOWN_IDS.has(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    known.push({
      id: entry.id,
      visible: entry.visible !== false,
      order: typeof entry.order === 'number' ? entry.order : known.length,
      size: entry.size === 'compact' ? 'compact' : 'full',
    });
  }

  // Tri par order (stable via index de secours), puis recompactage implicite.
  const sorted = [...known].sort((a, b) => a.order - b.order);

  // Forward-compat : widgets connus absents → ajoutés en fin, visibles/full.
  for (const id of DASHBOARD_WIDGET_IDS) {
    if (!seen.has(id)) {
      sorted.push({ id, visible: true, order: sorted.length, size: 'full' });
    }
  }

  // Filtre piliers (affichage) — `always` jamais filtré.
  const filtered = sorted.filter((w) => isWidgetAllowed(w.id, activePillars));

  return { widgets: recompact(filtered) };
}

/**
 * Déplace le widget `id` à l'index cible `toIndex` (borné à [0, n-1]) et
 * recompacte les `order`. Pur / immuable. Id inconnu → layout recompacté
 * inchangé.
 */
export function moveWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  toIndex: number,
): DashboardLayout {
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

/** Vrai si la valeur est un objet non-null (hors tableau). */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Normalise une entrée brute en `WidgetLayoutEntry` ou retourne null si invalide. */
function parseEntry(raw: unknown): WidgetLayoutEntry | null {
  if (!isRecord(raw)) return null;
  const id = raw['id'];
  if (typeof id !== 'string' || !KNOWN_IDS.has(id)) return null;
  const order = raw['order'];
  const size = raw['size'];
  return {
    id: id as DashboardWidgetId,
    visible: raw['visible'] !== false,
    order: typeof order === 'number' && Number.isFinite(order) ? order : 0,
    size: size === 'compact' ? 'compact' : 'full',
  };
}

/**
 * Parse tolérant d'une valeur brute (JSON déjà désérialisé OU chaîne JSON) en
 * `DashboardLayout`. Retourne `null` si absent / corrompu / invalide, sans
 * jamais lever. Les entrées malformées sont ignorées individuellement.
 */
export function parseDashboardLayout(raw: unknown): DashboardLayout | null {
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
  const widgetsRaw = value['widgets'];
  if (!Array.isArray(widgetsRaw)) return null;

  const widgets: WidgetLayoutEntry[] = [];
  for (const entry of widgetsRaw) {
    const parsed = parseEntry(entry);
    if (parsed) widgets.push(parsed);
  }

  return { widgets };
}
