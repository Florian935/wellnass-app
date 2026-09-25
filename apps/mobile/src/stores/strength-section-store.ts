/**
 * L'onglet affiché du hub Musculation — US MUSCU-UX07, décision D3.
 *
 * En mémoire seulement, **jamais persisté** : relancer l'app rouvre S'entraîner, revenir sur
 * l'onglet Muscu depuis un autre pilier rouvre le dernier onglet choisi.
 */

import { create } from 'zustand';
import type { HubSection } from '@wellness/shared';

type StrengthSectionState = {
  /** `null` tant qu'aucun onglet n'a été choisi depuis le lancement. */
  section: HubSection | null;
  setSection: (section: HubSection) => void;
};

export const useStrengthSection = create<StrengthSectionState>((set) => ({
  section: null,
  setSection: (section) => set({ section }),
}));
