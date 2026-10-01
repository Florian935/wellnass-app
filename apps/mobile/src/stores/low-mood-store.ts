/**
 * US BIEN-02 (décision D7) — la mémoire de la carte « ça ne va pas fort ces jours-ci ».
 *
 * Une préférence **locale à l'appareil**, persistée comme les couleurs de menu (`secureStorage`), et
 * non synchronisée : c'est l'appareil qui l'a montrée. Deux dates suffisent :
 *  - `shownOn` — le jour où la carte est apparue : elle reste visible ce jour-là, puis ne revient pas
 *    avant 14 jours (`shouldShowLowMoodCard`) ;
 *  - `dismissedOn` — le jour où elle a été fermée : fermée, elle ne revient pas le même jour.
 */

import { create } from 'zustand';
import { secureStorage } from '@/lib/secure-storage';

const STORAGE_KEY = 'wellbeing_low_mood_card';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

type LowMoodState = {
  shownOn: string | null;
  dismissedOn: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  markShown: (dayKey: string) => void;
  dismiss: (dayKey: string) => void;
};

async function persist(state: { shownOn: string | null; dismissedOn: string | null }): Promise<void> {
  try {
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort : au pire, la carte réapparaît une fois de trop — jamais une fois de moins.
  }
}

export const useLowMoodCard = create<LowMoodState>((set, get) => ({
  shownOn: null,
  dismissedOn: null,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as { shownOn?: unknown; dismissedOn?: unknown }) : {};
      set({
        shownOn: typeof parsed.shownOn === 'string' && DAY.test(parsed.shownOn) ? parsed.shownOn : null,
        dismissedOn: typeof parsed.dismissedOn === 'string' && DAY.test(parsed.dismissedOn) ? parsed.dismissedOn : null,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
  markShown: (dayKey) => {
    if (get().shownOn === dayKey) return;
    set({ shownOn: dayKey });
    void persist({ shownOn: dayKey, dismissedOn: get().dismissedOn });
  },
  dismiss: (dayKey) => {
    set({ dismissedOn: dayKey });
    void persist({ shownOn: get().shownOn, dismissedOn: dayKey });
  },
}));
