import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PILLARS, type Locale, type Pillar, type UnitSystem } from '@wellness/shared';

import i18n, { resolveDeviceLocale } from '@/i18n';
import { secureStateStorage } from '@/lib/zustand-secure-storage';

type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  /** Langue de l'UI. Synchronisée entre appareils (voir modele-donnees §3.1). */
  locale: Locale;
  /** Préférence de thème (indépendante de la langue et des unités). */
  theme: ThemePreference;
  /** Système d'unités d'affichage — indépendant de la langue (décision G / modele-donnees §3.1). */
  units: UnitSystem;
  /** Piliers activés — l'intégration inter-piliers est opt-in (décision H). */
  activePillars: Pillar[];
  /** Réhydratation depuis le stockage terminée (à attendre avant de router). */
  hasHydrated: boolean;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  setUnits: (units: UnitSystem) => void;
  togglePillar: (pillar: Pillar) => void;
  setHasHydrated: (value: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      locale: resolveDeviceLocale(),
      theme: 'system',
      units: 'metric',
      activePillars: [...PILLARS],
      hasHydrated: false,
      setLocale: (locale) => {
        void i18n.changeLanguage(locale);
        set({ locale });
      },
      setTheme: (theme) => set({ theme }),
      setUnits: (units) => set({ units }),
      togglePillar: (pillar) =>
        set((state) => ({
          activePillars: state.activePillars.includes(pillar)
            ? state.activePillars.filter((p) => p !== pillar)
            : [...state.activePillars, pillar],
        })),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'wellness.settings',
      storage: createJSONStorage(() => secureStateStorage),
      // Persiste uniquement les données, pas les actions.
      partialize: (state) => ({
        locale: state.locale,
        theme: state.theme,
        units: state.units,
        activePillars: state.activePillars,
      }),
      // Réapplique la langue persistée + marque la fin de réhydratation.
      onRehydrateStorage: () => (state) => {
        if (state?.locale) {
          void i18n.changeLanguage(state.locale);
        }
        state?.setHasHydrated(true);
      },
    },
  ),
);
