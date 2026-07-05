import { create } from 'zustand';
import type { Goal, Sex } from '@wellness/shared';

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
};

// TODO(profile-sync) : persister via la table `profiles` (PowerSync/Supabase). Pour l'instant
// en mémoire → l'onboarding se rejoue après un redémarrage complet de l'app.
export const useProfileStore = create<ProfileState>((set) => ({
  firstName: '',
  sex: 'unspecified',
  birthDate: null,
  weightKg: null,
  heightCm: null,
  goal: null,
  onboardingCompleted: false,
  update: (patch) => set(patch),
  completeOnboarding: () => set({ onboardingCompleted: true }),
}));
