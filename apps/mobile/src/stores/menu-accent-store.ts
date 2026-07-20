import { create } from 'zustand';
import { secureStorage } from '@/lib/secure-storage';

/**
 * Couleur d'accent **par menu** (Accueil / Muscu / Course / Alimentation).
 *
 * Chaque onglet peut avoir sa propre couleur secondaire (au lieu de l'accent orange
 * unique). Le menu actif (`activeMenu`, posé par chaque onglet au focus) détermine
 * l'accent effectif renvoyé par `useTheme`. Les couleurs sont une **préférence locale
 * (device)**, persistée via `secureStorage` — non synchronisée, **aucune migration**
 * (promotion possible vers `user_settings` plus tard).
 */

export type MenuKey = 'home' | 'strength' | 'running' | 'nutrition';
export const MENU_KEYS: readonly MenuKey[] = ['home', 'strength', 'running', 'nutrition'];

/** Couleurs par défaut (une identité par menu). */
export const DEFAULT_MENU_COLORS: Record<MenuKey, string> = {
  home: '#c0562f', // terracotta (accent historique)
  strength: '#6b0028', // bordeaux
  running: '#2f6fc0', // bleu
  nutrition: '#5c7a3f', // vert
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

type MenuAccentState = {
  /** Couleur de chaque menu (défauts fusionnés avec le stockage). */
  colors: Record<MenuKey, string>;
  /** Menu actuellement affiché (piloté par le focus des onglets). */
  activeMenu: MenuKey;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setActiveMenu: (menu: MenuKey) => void;
  setColor: (menu: MenuKey, color: string) => void;
  reset: () => void;
};

export const useMenuAccent = create<MenuAccentState>((set, get) => ({
  colors: { ...DEFAULT_MENU_COLORS },
  activeMenu: 'home',
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(STORAGE_KEY);
      const stored = raw ? sanitize(JSON.parse(raw)) : {};
      set({ colors: { ...DEFAULT_MENU_COLORS, ...stored }, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setActiveMenu: (menu) => {
    if (get().activeMenu !== menu) set({ activeMenu: menu });
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
