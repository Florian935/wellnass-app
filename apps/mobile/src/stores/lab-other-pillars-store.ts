/**
 * US LABO-02 (décision Q4 du 30/09/2026) — la ligne « avec d'autres piliers, le Labo croiserait… »,
 * masquée une fois pour toutes.
 *
 * Décision H : un pilier désactivé ne produit ni lien ni reproche. La seule concession est cette
 * ligne discrète, affichée tant qu'elle n'a pas été masquée — et masquée, elle ne revient pas.
 * Même patron que `dismissed-rules-store` : stockage local, lecture avant affichage.
 */

import { create } from 'zustand';
import { secureStorage } from '@/lib/secure-storage';

const STORAGE_KEY = 'lab_other_pillars_hidden';

type State = {
  hidden: boolean;
  /** Vrai une fois la lecture initiale faite : avant, on n'affiche pas la ligne (elle a pu être masquée). */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  hide: () => void;
};

export const useLabOtherPillars = create<State>((set, get) => ({
  hidden: false,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(STORAGE_KEY);
      set({ hidden: raw === '1', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  hide: () => {
    set({ hidden: true });
    void (async () => {
      try {
        await secureStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // Persistance best-effort : la ligne reste masquée pour la session.
      }
    })();
  },
}));
