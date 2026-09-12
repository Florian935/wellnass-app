import { create } from 'zustand';
import { secureStorage } from '@/lib/secure-storage';

/**
 * Interrupteur applicatif « Animations ».
 *
 * ── Pourquoi un réglage en plus de celui du système ─────────────────────────────────────────────
 * `navigation-ux.md` §4.2 demande « animation + son (**désactivable**) ». Le réglage système
 * Android (« supprimer les animations ») répond déjà au besoin d'accessibilité, mais il est global
 * à l'appareil : le couper pour FitTrio couperait aussi celles du lanceur et de toutes les autres
 * apps. Ce réglage-ci est **local à l'app**, pour quelqu'un qui aime les animations partout sauf ici.
 *
 * Les deux se combinent dans {@link useAppReducedMotion} — et se combinent par un **OU** : l'un des
 * deux suffit à tout couper. Le réglage système ne peut pas être contredit par une préférence
 * applicative, ce serait un défaut d'accessibilité.
 *
 * ── Défaut à `true` ─────────────────────────────────────────────────────────────────────────────
 * Contrairement à `menu-accent-store` (couleurs par menu, `enabled: false` par défaut), les
 * animations sont **actives par défaut** : c'est le comportement attendu d'une app, et le réglage
 * système reste là pour ceux qui en ont besoin sans avoir à connaître ce panneau.
 *
 * ── Préférence locale, non synchronisée ─────────────────────────────────────────────────────────
 * Même choix que `menu_accent_enabled` : `secureStorage`, aucune colonne, **aucune migration**.
 * Le rythme d'une interface tient à l'appareil qu'on a en main (un vieux téléphone, un écran à
 * 60 Hz), pas au compte. Promotion possible vers `user_settings` plus tard si le besoin apparaît.
 */

const STORAGE_KEY = 'motion_enabled';

async function persist(enabled: boolean): Promise<void> {
  try {
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    // Persistance best-effort : un échec ne doit pas casser l'UI.
  }
}

type MotionState = {
  /** Animations actives ? Défaut `true`. */
  enabled: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
};

export const useMotionPreference = create<MotionState>((set, get) => ({
  enabled: true,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(STORAGE_KEY);
      // Seul un `false` explicitement stocké coupe les animations : une valeur absente, illisible
      // ou corrompue retombe sur le défaut actif, jamais sur une app figée sans explication.
      const enabled = raw ? JSON.parse(raw) !== false : true;
      set({ enabled, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setEnabled: (enabled) => {
    set({ enabled });
    void persist(enabled);
  },
}));
