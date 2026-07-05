import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { generateId } from '@/lib/id';
import { secureStateStorage } from '@/lib/zustand-secure-storage';

export type WorkoutSet = { reps: number | null; weightKg: number | null; done: boolean };
export type WorkoutEntry = { exerciseId: string; exerciseName: string; sets: WorkoutSet[] };
export type ActiveWorkout = { id: string; startedAt: string; entries: WorkoutEntry[] };
export type CompletedWorkout = ActiveWorkout & { finishedAt: string };

const emptySet = (from?: WorkoutSet): WorkoutSet => ({
  reps: from?.reps ?? null,
  weightKg: from?.weightKg ?? null,
  done: false,
});

type WorkoutState = {
  /** Séance en cours (persistée pour survivre à un kill — spec 3.36). */
  active: ActiveWorkout | null;
  /** Historique local (la synchro cloud viendra avec la table `workouts` PowerSync). */
  history: CompletedWorkout[];
  hasHydrated: boolean;
  start: () => void;
  cancel: () => void;
  addExercise: (exerciseId: string, exerciseName: string) => void;
  addSet: (entryIndex: number) => void;
  removeSet: (entryIndex: number, setIndex: number) => void;
  updateSet: (entryIndex: number, setIndex: number, patch: Partial<WorkoutSet>) => void;
  finish: () => CompletedWorkout | null;
  setHasHydrated: (value: boolean) => void;
};

function mapEntry(
  entries: WorkoutEntry[],
  index: number,
  fn: (entry: WorkoutEntry) => WorkoutEntry,
): WorkoutEntry[] {
  return entries.map((entry, i) => (i === index ? fn(entry) : entry));
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      active: null,
      history: [],
      hasHydrated: false,
      start: () =>
        set({ active: { id: generateId(), startedAt: new Date().toISOString(), entries: [] } }),
      cancel: () => set({ active: null }),
      addExercise: (exerciseId, exerciseName) =>
        set((state) =>
          state.active
            ? {
                active: {
                  ...state.active,
                  entries: [...state.active.entries, { exerciseId, exerciseName, sets: [emptySet()] }],
                },
              }
            : state,
        ),
      addSet: (entryIndex) =>
        set((state) =>
          state.active
            ? {
                active: {
                  ...state.active,
                  entries: mapEntry(state.active.entries, entryIndex, (entry) => ({
                    ...entry,
                    sets: [...entry.sets, emptySet(entry.sets[entry.sets.length - 1])],
                  })),
                },
              }
            : state,
        ),
      removeSet: (entryIndex, setIndex) =>
        set((state) =>
          state.active
            ? {
                active: {
                  ...state.active,
                  entries: mapEntry(state.active.entries, entryIndex, (entry) => ({
                    ...entry,
                    sets: entry.sets.filter((_, i) => i !== setIndex),
                  })),
                },
              }
            : state,
        ),
      updateSet: (entryIndex, setIndex, patch) =>
        set((state) =>
          state.active
            ? {
                active: {
                  ...state.active,
                  entries: mapEntry(state.active.entries, entryIndex, (entry) => ({
                    ...entry,
                    sets: entry.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
                  })),
                },
              }
            : state,
        ),
      finish: () => {
        const { active } = get();
        if (!active) {
          return null;
        }
        const completed: CompletedWorkout = { ...active, finishedAt: new Date().toISOString() };
        set((state) => ({ active: null, history: [completed, ...state.history] }));
        return completed;
      },
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'wellness.workouts',
      storage: createJSONStorage(() => secureStateStorage),
      partialize: ({ active, history }) => ({ active, history }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
