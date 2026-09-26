/**
 * L'onglet affiché du hub Nutrition et l'état de son Historique — US NUTRI-UX03, D3 et §4.3.
 *
 * En mémoire seulement, **jamais persisté** : relancer l'app rouvre Aujourd'hui (NUTRI-UX02 R3.2
 * tenue), revenir sur Alim depuis un autre pilier rouvre le dernier onglet choisi. L'Historique
 * garde son mois, son sous-onglet et son repas choisi pendant la vie de l'app : revenir d'une page
 * de jour, ou d'un autre onglet, retrouve la même vue.
 *
 * Même rôle que `strength-section-store.ts` (muscu), écrit à part pendant que les deux chantiers
 * avançaient en parallèle (§11 de la spec).
 */

import { create } from 'zustand';
import type { NutritionSection, YearMonth } from '@wellness/shared';

export type NutritionHistoryTab = 'days' | 'habits';

type NutritionSectionState = {
  /** `null` tant qu'aucun onglet n'a été choisi depuis le lancement. */
  section: NutritionSection | null;
  setSection: (section: NutritionSection) => void;
  /** Mois affiché par le calendrier ; `null` = le mois courant. */
  historyMonth: YearMonth | null;
  setHistoryMonth: (month: YearMonth) => void;
  historyTab: NutritionHistoryTab;
  setHistoryTab: (tab: NutritionHistoryTab) => void;
  /** Repas choisi dans « Repas habituels » ; `null` = le repas de l'heure. */
  habitsMeal: string | null;
  setHabitsMeal: (mealKey: string) => void;
  /** « Tous tes repas habituels » (R3) : Historique › Repas habituels, sur ce repas. */
  openHabits: (mealKey: string) => void;
};

export const useNutritionSection = create<NutritionSectionState>((set) => ({
  section: null,
  setSection: (section) => set({ section }),
  historyMonth: null,
  setHistoryMonth: (historyMonth) => set({ historyMonth }),
  historyTab: 'days',
  setHistoryTab: (historyTab) => set({ historyTab }),
  habitsMeal: null,
  setHabitsMeal: (habitsMeal) => set({ habitsMeal }),
  openHabits: (mealKey) => set({ section: 'history', historyTab: 'habits', habitsMeal: mealKey }),
}));
