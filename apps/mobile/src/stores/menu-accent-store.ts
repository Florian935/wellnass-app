import { create } from 'zustand';
import { secureStorage } from '@/lib/secure-storage';

/**
 * Couleur d'accent **par menu** (Accueil / Muscu / Course / Alimentation).
 *
 * Contrôlé par le réglage `enabled` (off par défaut → accent unique orange, comme le
 * reste de l'app). Quand activé, chaque onglet peut avoir sa propre couleur secondaire ;
 * le menu actif (`activeMenu`, posé par chaque onglet au focus) détermine l'accent
 * effectif renvoyé par `useTheme`. `enabled` + les couleurs sont une **préférence locale
 * (device)**, persistée via `secureStorage` — non synchronisée, **aucune migration**
 * (promotion possible vers `user_settings` plus tard).
 */

export type MenuKey = 'home' | 'strength' | 'running' | 'nutrition' | 'lab';
export const MENU_KEYS: readonly MenuKey[] = ['home', 'strength', 'running', 'nutrition', 'lab'];

/**
 * Couleurs par défaut de la **préférence** — une par menu.
 *
 * ⚠️ Ce ne sont PAS les couleurs d'identité des piliers : celles-là vivent dans `theme/pillar.ts`
 * et s'appliquent toujours. Ici on ne décrit que le point de départ de la surcharge volontaire.
 *
 * Alignées sur les accents lisibles le 19/09/2026 (US MUSCU-UX04). Avant, ce tableau portait les
 * teintes **profondes** des scènes — pensées pour un fond clair. Activer le réglage posait donc
 * `#6b0028` comme accent sur les cartes sombres, où il mesure **1,15:1** : libellés et icônes
 * devenaient illisibles d'un simple appui sur un interrupteur de réglages, sans qu'aucun garde-fou
 * ne le signale. Les valeurs ci-dessous sont mesurées par `theme/__tests__/contrast.test.ts`.
 */
export const DEFAULT_MENU_COLORS: Record<MenuKey, string> = {
  home: '#e07a4d', // = pillarHome (sombre)
  // = pillarStrength (sombre) — rouge fonte depuis MUSCU-UX06 (23/09/2026). Avant : le rose
  // #e07a98, et encore avant #6b0028 (1,15:1 sur une carte).
  strength: '#ff6b5e',
  running: '#6fa8ef', // = pillarRunning (sombre)
  nutrition: '#9ed16a', // = pillarNutrition (sombre) — US NUTRI-UX02, l'ancien #a9ba7e : chroma 60
  lab: '#e0b155', // = pillarLab (sombre)
};

/** Palette de choix proposée dans les réglages. */
export const MENU_COLOR_SWATCHES: readonly string[] = [
  '#e07a4d',
  '#ff6b5e',
  // `#e07a98` reste proposé, comme `#a9ba7e` plus bas : c'est l'ancien rose du pilier muscu, et
  // quelqu'un qui l'avait choisi doit pouvoir le retrouver. Seul le **défaut** change (MUSCU-UX06).
  '#e07a98',
  '#6fa8ef',
  '#9ed16a',
  // `#a9ba7e` reste proposé : c'est l'ancien vert du pilier, et quelqu'un qui l'avait choisi doit
  // pouvoir le retrouver. Seul le **défaut** change (US NUTRI-UX02).
  '#a9ba7e',
  '#e0b155',
  '#b99be0',
  '#5fc8bd',
  '#e08aa8',
];

const STORAGE_KEY = 'menu_accent_colors';
const ENABLED_STORAGE_KEY = 'menu_accent_enabled';
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Ne garde que les couleurs valides (#RRGGBB) pour des clés de menu connues. */
function sanitize(raw: unknown): Partial<Record<MenuKey, string>> {
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  const out: Partial<Record<MenuKey, string>> = {};
  for (const k of MENU_KEYS) {
    const v = rec[k];
    if (typeof v === 'string' && HEX.test(v)) out[k] = v;
  }
  return out;
}

async function persist(colors: Record<MenuKey, string>): Promise<void> {
  try {
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Persistance best-effort : un échec ne doit pas casser l'UI.
  }
}

async function persistEnabled(enabled: boolean): Promise<void> {
  try {
    await secureStorage.setItem(ENABLED_STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    // Persistance best-effort : un échec ne doit pas casser l'UI.
  }
}

type MenuAccentState = {
  /** Couleurs par menu activées ? Off par défaut → accent unique (orange) partout. */
  enabled: boolean;
  /** Couleur de chaque menu (défauts fusionnés avec le stockage). */
  colors: Record<MenuKey, string>;
  /** Menu actuellement affiché (piloté par le focus des onglets). */
  activeMenu: MenuKey;
  /**
   * US DASH-01 (R4) — l'onglet **réellement au premier plan**, `null` quand un écran empilé le recouvre.
   *
   * Distinct de `activeMenu`, qui garde le dernier menu pour ne pas faire clignoter l'accent : c'est
   * ce champ-ci que lisent les boucles décoratives pour s'arrêter quand on quitte un pilier.
   */
  focusedMenu: MenuKey | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setActiveMenu: (menu: MenuKey) => void;
  setFocusedMenu: (menu: MenuKey | null) => void;
  /** Libère le focus **seulement** s'il appartient encore à ce menu (un autre a pu le prendre entre-temps). */
  clearFocusedMenu: (menu: MenuKey) => void;
  setColor: (menu: MenuKey, color: string) => void;
  reset: () => void;
};

export const useMenuAccent = create<MenuAccentState>((set, get) => ({
  enabled: false,
  colors: { ...DEFAULT_MENU_COLORS },
  activeMenu: 'home',
  focusedMenu: null,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const [rawColors, rawEnabled] = await Promise.all([
        secureStorage.getItem(STORAGE_KEY),
        secureStorage.getItem(ENABLED_STORAGE_KEY),
      ]);
      const stored = rawColors ? sanitize(JSON.parse(rawColors)) : {};
      const enabled = rawEnabled ? JSON.parse(rawEnabled) === true : false;
      set({ colors: { ...DEFAULT_MENU_COLORS, ...stored }, enabled, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setEnabled: (enabled) => {
    set({ enabled });
    void persistEnabled(enabled);
  },
  setActiveMenu: (menu) => {
    if (get().activeMenu !== menu) set({ activeMenu: menu });
  },
  setFocusedMenu: (menu) => {
    if (get().focusedMenu !== menu) set({ focusedMenu: menu });
  },
  clearFocusedMenu: (menu) => {
    if (get().focusedMenu === menu) set({ focusedMenu: null });
  },
  setColor: (menu, color) => {
    if (!HEX.test(color)) return;
    const next = { ...get().colors, [menu]: color };
    set({ colors: next });
    void persist(next);
  },
  reset: () => {
    const next = { ...DEFAULT_MENU_COLORS };
    set({ colors: next });
    void persist(next);
  },
}));
