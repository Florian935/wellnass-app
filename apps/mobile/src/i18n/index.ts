import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LOCALES, localeSchema, type Locale } from '@wellness/shared';

import en from './locales/en.json';
import fr from './locales/fr.json';

export const DEFAULT_LOCALE: Locale = 'fr';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const;

/**
 * Résout la langue de départ : première langue du terminal supportée par l'app,
 * sinon le français par défaut (décision G — FR + EN dès le lancement).
 * La langue choisie par l'utilisateur (Settings) est synchronisée et prime ;
 * elle sera appliquée via `i18n.changeLanguage` une fois les réglages chargés.
 */
export function resolveDeviceLocale(): Locale {
  for (const { languageCode } of getLocales()) {
    const parsed = localeSchema.safeParse(languageCode);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return DEFAULT_LOCALE;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveDeviceLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: LOCALES,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
