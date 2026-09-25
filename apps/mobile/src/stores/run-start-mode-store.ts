/**
 * Le dernier mode de départ d'une course — GPS ou sans GPS (US CARDIO-UX03, D5, R6 ; Q5).
 *
 * CARDIO-UX01 (F4) l'avait promis : l'écran de départ repartait chaque fois sur « Suivi GPS », et le
 * coureur de tapis devait rebasculer à chaque séance. Le mode retenu est celui **effectivement
 * démarré** — y compris le repli sur « sans GPS » après un refus de permission.
 *
 * ── Pourquoi une préférence locale, et pas une colonne ──────────────────────────────────────────
 * Même choix que `session-mode-store` : `secureStorage`, aucune colonne, **aucune migration**. Le
 * mode tient au téléphone qu'on a en main (le GPS d'un appareil, le tapis de la salle), pas au compte.
 */

import { create } from 'zustand';
import type { RunSource } from '@wellness/shared';
import { secureStorage } from '@/lib/secure-storage';

const SOURCE_KEY = 'run_start_source';

function coerceSource(raw: string | null | undefined): RunSource {
  return raw === 'manual' ? 'manual' : 'gps';
}

async function persist(value: RunSource): Promise<void> {
  try {
    await secureStorage.setItem(SOURCE_KEY, value);
  } catch {
    // Persistance best-effort : un échec ne doit pas empêcher de partir courir.
  }
}

type RunStartModeState = {
  source: RunSource;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSource: (source: RunSource) => void;
};

export const useRunStartMode = create<RunStartModeState>((set, get) => ({
  source: 'gps',
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(SOURCE_KEY);
      set({ source: coerceSource(raw), hydrated: true });
    } catch {
      // Best-effort : sans lecture, on part en GPS, le défaut d'avant.
      set({ hydrated: true });
    }
  },
  setSource: (source) => {
    set({ source });
    void persist(source);
  },
}));
