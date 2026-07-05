import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MuscleGroup } from '@/data/exercises';
import { generateId } from '@/lib/id';
import { secureStateStorage } from '@/lib/zustand-secure-storage';

export type CustomExercise = { id: string; name: string; muscle: MuscleGroup };

type ExerciseState = {
  /** Exercices créés par l'utilisateur (jamais traduits — langue de saisie). */
  customExercises: CustomExercise[];
  /** Ids d'exercices épinglés (seed ou perso). */
  favoriteIds: string[];
  hasHydrated: boolean;
  addCustom: (name: string, muscle: MuscleGroup) => void;
  toggleFavorite: (id: string) => void;
  setHasHydrated: (value: boolean) => void;
};

export const useExerciseStore = create<ExerciseState>()(
  persist(
    (set) => ({
      customExercises: [],
      favoriteIds: [],
      hasHydrated: false,
      addCustom: (name, muscle) =>
        set((state) => ({
          customExercises: [
            ...state.customExercises,
            { id: generateId(), name: name.trim(), muscle },
          ],
        })),
      toggleFavorite: (id) =>
        set((state) => ({
          favoriteIds: state.favoriteIds.includes(id)
            ? state.favoriteIds.filter((fid) => fid !== id)
            : [...state.favoriteIds, id],
        })),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'wellness.exercises',
      storage: createJSONStorage(() => secureStateStorage),
      partialize: ({ customExercises, favoriteIds }) => ({ customExercises, favoriteIds }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
