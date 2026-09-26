/**
 * Formate un nombre entier de calories selon la langue : « 2 305 » en français, « 2,305 » en
 * anglais. US NUTRI-UX03 — l'interpolation i18next brute donnait « 2305 » (le défaut relevé par
 * NUTRI-UX02 R17 pour les décimales). Même source que `useLocaleSeparators` d'`AnimatedNumber` :
 * `Intl.NumberFormat` de la langue courante, le français en repli.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export function formatKcal(value: number, language: string | undefined): string {
  const n = Math.round(Number.isFinite(value) ? value : 0);
  try {
    return new Intl.NumberFormat(language ?? 'fr', { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}

export function useKcalFormat(): (value: number) => string {
  const { i18n } = useTranslation();
  const language = i18n?.language ?? 'fr';
  return useCallback((value: number) => formatKcal(value, language), [language]);
}
