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

/** Couleurs par défaut (une identité par menu). */
export const DEFAULT_MENU_COLORS: Record<MenuKey, string> = {
  home: '#c0562f', // terracotta (accent historique)
  strength: '#6b0028', // bordeaux
  running: '#2f6fc0', // bleu
  nutrition: '#5c7a3f', // vert
  lab: '#a8712a', // doré — US LABO-01
};

/** Palette de choix proposée dans les réglages. */
export const MENU_COLOR_SWATCHES: readonly string[] = [
  '#c0562f',
  '#6b0028',
  '#2f6fc0',
  '#5c7a3f',
  '#6a4c93',
  '#b5761f',
  '#0f766e',
  '#9d174d',
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
