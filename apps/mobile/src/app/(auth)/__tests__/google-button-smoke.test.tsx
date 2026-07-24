/**
 * google-button-smoke.test.tsx — présence du bouton « Continuer avec Google ».
 *
 * Vérifie que les écrans sign-in et sign-up rendent le GoogleButton (libellé +
 * mention de consentement). Le parcours OAuth réel (idToken → Supabase) est
 * couvert en recette : ici on isole le rendu.
 *
 * Mocks : react-i18next (renvoie la clé), useTheme, auth-store et expo-router
 * (Link/useRouter). On ne tire pas le vrai @/i18n.
 */
import { render } from '@testing-library/react-native';
import SignInScreen from '../sign-in';
import SignUpScreen from '../sign-up';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#000', textMuted: '#888', background: '#fff', surface: '#f5f5f5',
      border: '#ddd', accent: '#6b0028', accentText: '#fff', danger: '#b23b2e',
    },
  })),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({
      signIn: jest.fn(),
      signUp: jest.fn(),
      signInWithGoogle: jest.fn(),
    }),
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Link: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  };
});

describe('GoogleButton — présence sur les écrans auth', () => {
  it('sign-in rend le bouton Google et sa mention de consentement', async () => {
    const { getByText } = await render(<SignInScreen />);
    expect(getByText('auth.google.button')).toBeTruthy();
    expect(getByText('auth.google.orSeparator')).toBeTruthy();
    expect(getByText('auth.google.consent.terms')).toBeTruthy();
  });

  it('sign-up rend le bouton Google et sa mention de consentement', async () => {
    const { getByText } = await render(<SignUpScreen />);
    expect(getByText('auth.google.button')).toBeTruthy();
    expect(getByText('auth.google.orSeparator')).toBeTruthy();
    expect(getByText('auth.google.consent.privacy')).toBeTruthy();
  });
});
