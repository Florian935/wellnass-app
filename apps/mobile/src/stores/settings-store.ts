import { create } from 'zustand';
import { PILLARS, type Locale, type Pillar } from '@wellness/shared';

import i18n, { resolveDeviceLocale } from '@/i18n';

type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  /** Langue de l'UI. Synchronisée entre appareils (voir modele-donnees §3.1). */
  locale: Locale;
  /** Préférence de thème (indépendante de la langue et des unités). */
  theme: ThemePreference;
  /** Piliers activés — l'intégration inter-piliers est opt-in (décision H). */
  activePillars: Pillar[];
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  togglePillar: (pillar: Pillar) => void;
};

// TODO(scaffolding) : persister via PowerSync/SQLite une fois le spike figé.
export const useSettingsStore = create<SettingsState>((set) => ({
  locale: resolveDeviceLocale(),
  theme: 'system',
  activePillars: [...PILLARS],
  setLocale: (locale) => {
    void i18n.changeLanguage(locale);
    set({ locale });
  },
  setTheme: (theme) => set({ theme }),
  togglePillar: (pillar) =>
    set((state) => ({
      activePillars: state.activePillars.includes(pillar)
        ? state.activePillars.filter((p) => p !== pillar)
        : [...state.activePillars, pillar],
    })),
}));
