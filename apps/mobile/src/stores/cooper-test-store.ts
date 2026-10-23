/**
 * Le marqueur du test de 12 minutes guidé (US CARDIO-02, R8).
 *
 * Une course de test est une course ordinaire : rien dans `runs` ne la distingue. Ce marqueur dit
 * laquelle est le test, pour l'écran de course (le bandeau, les deux annonces) et pour l'arrivée (la
 * mesure, « Retenir cette allure »). Il dit aussi si une pause l'a interrompu.
 *
 * ── Pourquoi une préférence locale, et pas une colonne ──────────────────────────────────────────
 * Même choix que `run-start-mode-store` : `secureStorage`, **aucune migration**. On lance et on finit
 * un test sur le même téléphone ; le marqueur survit à un redémarrage de l'app.
 *
 * ── Quand il s'efface ───────────────────────────────────────────────────────────────────────────
 * **Au choix seulement** (« Retenir » ou « Pas cette fois »), ou au lancement d'un nouveau test.
 * Quitter l'arrivée sans choisir ne perd rien : la porte du test pré-remplit la mesure. Un marqueur
 * qui désigne une course supprimée ou introuvable est ignoré à la lecture, pas nettoyé ailleurs.
 */

import { create } from 'zustand';
import { secureStorage } from '@/lib/secure-storage';

const MARKER_KEY = 'cooper_test';

export type CooperTestMarker = { runId: string; interrupted: boolean };

/** Relit le marqueur stocké ; toute valeur illisible vaut « pas de test ». */
export function parseCooperMarker(raw: string | null | undefined): CooperTestMarker | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { runId?: unknown }).runId === 'string' &&
      (value as { runId: string }).runId !== ''
    ) {
      return {
        runId: (value as { runId: string }).runId,
        interrupted: (value as { interrupted?: unknown }).interrupted === true,
      };
    }
  } catch {
    // Valeur corrompue : on l'ignore.
  }
  return null;
}

async function persist(marker: CooperTestMarker | null): Promise<void> {
  try {
    if (marker) await secureStorage.setItem(MARKER_KEY, JSON.stringify(marker));
    else await secureStorage.removeItem(MARKER_KEY);
  } catch {
    // Persistance best-effort : un échec ne doit jamais empêcher de courir.
  }
}

type CooperTestState = {
  marker: CooperTestMarker | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Pose le marqueur sur la course qui vient de démarrer (remplace un test précédent). */
  mark: (runId: string) => void;
  /** Une pause avant 12:00 interrompt le test de cette course. */
  interrupt: (runId: string) => void;
  clear: () => void;
};

export const useCooperTest = create<CooperTestState>((set, get) => ({
  marker: null,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(MARKER_KEY);
      // Un marqueur posé entre-temps (départ pendant la lecture) l'emporte sur l'ancien.
      set((state) => ({ marker: state.marker ?? parseCooperMarker(raw), hydrated: true }));
    } catch {
      set({ hydrated: true });
    }
  },
  mark: (runId) => {
    const marker = { runId, interrupted: false };
    set({ marker });
    void persist(marker);
  },
  interrupt: (runId) => {
    const current = get().marker;
    if (!current || current.runId !== runId || current.interrupted) return;
    const marker = { ...current, interrupted: true };
    set({ marker });
    void persist(marker);
  },
  clear: () => {
    set({ marker: null });
    void persist(null);
  },
}));
