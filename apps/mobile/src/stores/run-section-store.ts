/**
 * L'onglet affiché du hub Course — US CARDIO-UX03, décision D1.
 *
 * En mémoire seulement, **jamais persisté** : relancer l'app rouvre Courir, revenir sur l'onglet
 * Course depuis un autre pilier rouvre le dernier onglet choisi. Même règle que
 * `strength-section-store` (MUSCU-UX07), dupliquée exprès le temps que les chantiers parallèles
 * atterrissent (spec §11).
 */

import { create } from 'zustand';
import type { RunHubSection } from '@wellness/shared';

type RunSectionState = {
  /** `null` tant qu'aucun onglet n'a été choisi depuis le lancement. */
  section: RunHubSection | null;
  setSection: (section: RunHubSection) => void;
};

export const useRunSection = create<RunSectionState>((set) => ({
  section: null,
  setSection: (section) => set({ section }),
}));
