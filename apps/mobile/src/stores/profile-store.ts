import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Goal, Sex } from '@wellness/shared';
import { secureStateStorage } from '@/lib/zustand-secure-storage';

export type ProfileData = {
  firstName: string;
  sex: Sex;
  birthDate: string | null; // ISO (YYYY-MM-DD)
  weightKg: number | null; // stockage SI ; conversion à l'affichage
  heightCm: number | null;
  goal: Goal | null;
};

type ProfileState = ProfileData & {
  /** Onboarding terminé (ou passé). Voir compte-profil-onboarding §3. */
  onboardingCompleted: boolean;
  update: (patch: Partial<ProfileData>) => void;
  completeOnboarding: () => void;
  restartOnboarding: () => void;
};

// Persisté (chiffré) via SecureStore. TODO(profile-sync) : à terme, source de vérité dans la
// table `profiles` (PowerSync/Supabase) pour la synchro multi-appareils.
export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      firstName: '',
      sex: 'unspecified',
      birthDate: null,
      weightKg: null,
      heightCm: null,
      goal: null,
      onboardingCompleted: false,
      update: (patch) => set(patch),
      completeOnboarding: () => set({ onboardingCompleted: true }),
      restartOnboarding: () => set({ onboardingCompleted: false }),
    }),
    {
      name: 'wellness.profile',
      storage: createJSONStorage(() => secureStateStorage),
    },
  ),
);
