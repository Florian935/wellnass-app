import { create } from 'zustand';
import { MICRONUTRIENT_KEYS, type MicronutrientKey } from '@wellness/shared';
import { secureStorage } from '@/lib/secure-storage';

/**
 * Sélection des micronutriments **suivis** dans le récap du jour (US 4.35).
 *
 * Préférence **locale (device)**, persistée via `secureStorage` — volontairement
 * **non synchronisée** entre appareils pour rester cloud-free (aucune migration).
 * Promotion possible vers `user_settings` synchronisé plus tard (spec §2 / §4).
 */
const STORAGE_KEY = 'tracked_micros';

/** Filtre + réordonne selon `MICRONUTRIENT_KEYS` (ordre stable, clés inconnues ignorées). */
function sanitize(list: unknown): MicronutrientKey[] {
  if (!Array.isArray(list)) return [];
  return MICRONUTRIENT_KEYS.filter((k) => list.includes(k));
}

async function persist(tracked: MicronutrientKey[]): Promise<void> {
  try {
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(tracked));
  } catch {
    // Persistance best-effort : un échec de stockage ne doit pas casser l'UI.
  }
}

type TrackedMicrosState = {
  /** Micros suivis (ordre `MICRONUTRIENT_KEYS`). */
  tracked: MicronutrientKey[];
  /** Vrai une fois la lecture initiale du stockage terminée. */
  hydrated: boolean;
  /** Charge la sélection depuis le stockage (idempotent). */
  hydrate: () => Promise<void>;
  /** Ajoute / retire un micro du suivi et persiste. */
  toggle: (key: MicronutrientKey) => void;
};

export const useTrackedMicros = create<TrackedMicrosState>((set, get) => ({
  tracked: [],
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(STORAGE_KEY);
      set({ tracked: raw ? sanitize(JSON.parse(raw)) : [], hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  toggle: (key) => {
    const cur = get().tracked;
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : sanitize([...cur, key]);
    set({ tracked: next });
    void persist(next);
  },
}));
