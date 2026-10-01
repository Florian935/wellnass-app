/**
 * L'onglet affiché du hub Bien-être — US BIEN-02. Même rôle que `nutrition-section-store.ts` : en
 * mémoire seulement, **jamais persisté** (relancer l'app rouvre Aujourd'hui), le dernier onglet choisi
 * est rouvert quand on revient sur le pilier depuis un autre.
 */

import { create } from 'zustand';
import type { WellbeingSection } from '@wellness/shared';

type WellbeingSectionState = {
  /** `null` tant qu'aucun onglet n'a été choisi depuis le lancement. */
  section: WellbeingSection | null;
  setSection: (section: WellbeingSection) => void;
};

export const useWellbeingSection = create<WellbeingSectionState>((set) => ({
  section: null,
  setSection: (section) => set({ section }),
}));
