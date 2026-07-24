import { statusCodes } from '@react-native-google-signin/google-signin';

import { mapGoogleSignInError } from '../google-auth-errors';

// Le module Google Sign-In s'appuie sur un TurboModule natif (`RNGoogleSignin`)
// indisponible sous Jest : importer `statusCodes` sans mock lève une
// « Invariant Violation ». On mocke donc le module au niveau du test (l'appel
// `jest.mock` est hoisté par Babel au-dessus des imports). Comme le helper
// importe `statusCodes` depuis ce même module, test et implémentation partagent
// exactement les mêmes constantes (mapping déterministe garanti).
jest.mock('@react-native-google-signin/google-signin', () => ({
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
    NULL_PRESENTER: 'NULL_PRESENTER',
  },
}));

describe('mapGoogleSignInError', () => {
  it('Play Services indisponible → clé dédiée', () => {
    expect(mapGoogleSignInError({ code: statusCodes.PLAY_SERVICES_NOT_AVAILABLE })).toBe(
      'auth.google.errors.playServices',
    );
  });

  it('erreur Supabase e-mail non vérifié → clé liaison', () => {
    expect(mapGoogleSignInError({ message: 'Email not confirmed' })).toBe(
      'auth.google.errors.linkUnverified',
    );
  });

  it('erreur réseau → clé hors-ligne', () => {
    expect(mapGoogleSignInError({ message: 'Network request failed' })).toBe(
      'auth.google.errors.offline',
    );
  });

  it('réseau prioritaire même si « email » présent dans le message', () => {
    expect(mapGoogleSignInError({ message: 'Network request failed (email sync)' })).toBe(
      'auth.google.errors.offline',
    );
  });

  it('vrai cas de liaison co-occurrent (email + verif) → clé liaison', () => {
    expect(mapGoogleSignInError({ message: 'Email not verified' })).toBe(
      'auth.google.errors.linkUnverified',
    );
  });

  it('erreur GoTrue courante non liée (« email » nu) → clé générique, pas de faux positif', () => {
    expect(mapGoogleSignInError({ message: 'Email rate limit exceeded' })).toBe(
      'auth.google.errors.generic',
    );
  });

  it('cas inconnu (objet vide) → clé générique', () => {
    expect(mapGoogleSignInError({})).toBe('auth.google.errors.generic');
  });

  it("robustesse : entrée non-objet (null / undefined / string) → clé générique", () => {
    expect(mapGoogleSignInError(null)).toBe('auth.google.errors.generic');
    expect(mapGoogleSignInError(undefined)).toBe('auth.google.errors.generic');
    expect(mapGoogleSignInError('boom')).toBe('auth.google.errors.generic');
  });

  it("SIGN_IN_CANCELLED n'est pas mappé ici (géré en amont) → clé générique", () => {
    expect(mapGoogleSignInError({ code: statusCodes.SIGN_IN_CANCELLED })).toBe(
      'auth.google.errors.generic',
    );
  });
});
