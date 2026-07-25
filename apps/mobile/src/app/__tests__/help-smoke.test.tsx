/**
 * help-smoke.test.tsx — Smoke test de l'écran Aide & support (US 1.22).
 *
 * Vérifie que l'écran se rend sans planter et couvre son cœur fonctionnel :
 *  1. Au moins une question de la FAQ + les deux boutons d'action.
 *  2. Accordéon : replié par défaut, ouverture au clic, mono-ouverture (une seule
 *     réponse visible à la fois), refermeture au re-clic.
 *
 * Stratégie de mock (ce test tourne AVANT que les clés i18n de la Task 4 existent) :
 *  - `react-i18next` → `useTranslation` renvoie un `t` qui retourne un tableau FAQ
 *    contrôlé pour `help.faq.items` (avec `{ returnObjects: true }`) et une sentinelle
 *    pour les autres clés. On n'importe donc PAS le vrai `@/i18n`.
 *  - `@/theme/useTheme` → palette statique (même patron que StreakCard/history-smoke).
 *  - `@expo/vector-icons` → Ionicons muet (évite les assets natifs).
 *  - `@/lib/support` → `contactSupport` stubbé : évite de charger `@/i18n` +
 *    modules natifs (expo-mail-composer, expo-application, expo-device) au montage.
 *  - `@/lib/analytics` → `track` stubbé (émet `help_opened` au montage, US 9.10) : évite
 *    de charger la chaîne `settings-repository` → `@/i18n` + PowerSync au montage.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import HelpScreen from '../help';

// ---------------------------------------------------------------------------
// Mock react-i18next — t renvoie le tableau FAQ pour help.faq.items, sinon la clé.
// Questions/réponses identifiables pour tester l'accordéon.
// ---------------------------------------------------------------------------

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { returnObjects?: boolean }) => {
      if (key === 'help.faq.items') {
        return opts?.returnObjects
          ? [
              { q: 'Q1', a: 'Réponse 1' },
              { q: 'Q2', a: 'Réponse 2' },
            ]
          : key;
      }
      return key;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mock useTheme — palette statique (évite useSettings → PowerSync)
// ---------------------------------------------------------------------------

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
      danger: '#b23b2e',
    },
  })),
}));

// ---------------------------------------------------------------------------
// Mock @expo/vector-icons — Ionicons muet (pas d'assets natifs)
// ---------------------------------------------------------------------------

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// ---------------------------------------------------------------------------
// Mock @/lib/support — évite de charger @/i18n + modules natifs au montage
// ---------------------------------------------------------------------------

jest.mock('@/lib/support', () => ({
  contactSupport: jest.fn().mockResolvedValue({ ok: true }),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/analytics — track muet (évite settings-repository → @/i18n + PowerSync)
// ---------------------------------------------------------------------------

jest.mock('@/lib/analytics', () => ({
  track: jest.fn(),
  ANALYTICS_EVENTS: { helpOpened: 'help_opened' },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Écran Aide & support — smoke test', () => {
  it('rend la FAQ et les deux boutons de contact', async () => {
    const { getByText } = await render(<HelpScreen />);

    // Au moins une question de la FAQ est rendue.
    expect(getByText('Q1')).toBeTruthy();

    // Les deux boutons d'action (libellés = clés i18n via la sentinelle pass-through).
    expect(getByText('help.contact.contactButton')).toBeTruthy();
    expect(getByText('help.contact.bugButton')).toBeTruthy();
  });

  it('accordéon mono-ouverture : replié par défaut, ouverture, une seule réponse visible', async () => {
    const { getByText, queryByText } = await render(<HelpScreen />);

    // Replié par défaut (openIndex initial = null) : aucune réponse rendue.
    expect(queryByText('Réponse 1')).toBeNull();
    expect(queryByText('Réponse 2')).toBeNull();

    // Ouverture de Q1 → sa réponse devient visible.
    await fireEvent.press(getByText('Q1'));
    expect(queryByText('Réponse 1')).toBeTruthy();
    expect(queryByText('Réponse 2')).toBeNull();

    // Ouverture de Q2 → Réponse 2 visible ET Réponse 1 masquée (mono-ouverture).
    await fireEvent.press(getByText('Q2'));
    expect(queryByText('Réponse 2')).toBeTruthy();
    expect(queryByText('Réponse 1')).toBeNull();

    // Re-presser la question ouverte la referme.
    await fireEvent.press(getByText('Q2'));
    expect(queryByText('Réponse 2')).toBeNull();
  });
});
