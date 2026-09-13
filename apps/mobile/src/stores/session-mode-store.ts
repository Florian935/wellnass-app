import { create } from 'zustand';
import { coerceWorkoutDisplayMode, type WorkoutDisplayMode } from '@wellness/shared';
import { secureStorage } from '@/lib/secure-storage';

/**
 * Mode d'affichage de la séance — **classique** ou **immersif** (US MUSCU-UX03).
 *
 * ── Pourquoi une préférence locale, et pas une colonne ──────────────────────────────────────────
 * Même choix que `motion-store` et `menu-accent-store` : `secureStorage`, aucune colonne, **aucune
 * migration**. La mise en scène d'une séance tient à l'appareil qu'on a en main et à l'envie du
 * moment, pas au compte. Le **niveau** d'affichage (`profiles.workout_display_level`), lui, reste
 * synchronisé : c'est une préférence de densité d'information, qui a du sens partout.
 *
 * ── `chosen`, et pourquoi il ne se déduit pas de `mode` ─────────────────────────────────────────
 * Le défaut est `classic` (décision D1 : personne ne voit son écran changer sans l'avoir demandé).
 * Impossible, donc, de distinguer « a choisi classique » de « n'a jamais choisi » par le seul mode.
 * `chosen` porte cette information : il commande l'affichage de la feuille de choix au premier
 * démarrage, et **uniquement** pour quelqu'un qui n'a pas encore d'historique (spec R-MO-3).
 */

const MODE_KEY = 'workout_display_mode';
const CHOSEN_KEY = 'workout_mode_chosen';

async function persist(key: string, value: string): Promise<void> {
  try {
    await secureStorage.setItem(key, value);
  } catch {
    // Persistance best-effort : un échec ne doit pas empêcher de lancer sa séance.
  }
}

type SessionModeState = {
  mode: WorkoutDisplayMode;
  /** L'utilisateur a-t-il déjà tranché une fois ? (voir en-tête) */
  chosen: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** `remember: false` change le mode pour cette séance sans le retenir comme choix. */
  setMode: (mode: WorkoutDisplayMode, options?: { remember?: boolean }) => void;
};

export const useSessionMode = create<SessionModeState>((set, get) => ({
  mode: 'classic',
  chosen: false,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const [rawMode, rawChosen] = await Promise.all([
        secureStorage.getItem(MODE_KEY),
        secureStorage.getItem(CHOSEN_KEY),
      ]);
      set({
        mode: coerceWorkoutDisplayMode(rawMode),
        chosen: rawChosen === 'true',
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
  setMode: (mode, options) => {
    const remember = options?.remember !== false;
    set({ mode, chosen: remember ? true : get().chosen });
    void persist(MODE_KEY, mode);
    if (remember) void persist(CHOSEN_KEY, 'true');
  },
}));
