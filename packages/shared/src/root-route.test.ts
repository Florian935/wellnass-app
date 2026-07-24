import { describe, it, expect } from 'vitest';
import { resolveRootRoute } from './root-route';

// Cas de référence : session ouverte, profil onboardé, tout chargé et synchronisé.
const base = {
  fontsReady: true,
  authInitializing: false,
  hasSession: true,
  profileLoading: false,
  hasProfile: true,
  onboardingCompletedAt: '2026-07-16T10:00:00.000Z',
  settingsLoading: false,
  hasSynced: true,
};

describe('resolveRootRoute', () => {
  it('wait tant que les polices ne sont pas prêtes ou que l\'auth s\'initialise', () => {
    expect(resolveRootRoute({ ...base, fontsReady: false })).toBe('wait');
    expect(resolveRootRoute({ ...base, authInitializing: true })).toBe('wait');
  });

  it('auth si pas de session', () => {
    expect(resolveRootRoute({ ...base, hasSession: false })).toBe('auth');
  });

  it('wait si session + profil ou réglages encore en chargement (local)', () => {
    expect(resolveRootRoute({ ...base, profileLoading: true })).toBe('wait');
    expect(resolveRootRoute({ ...base, settingsLoading: true })).toBe('wait');
  });

  it('FIX réinstall : session + profil local null + synchro non terminée → wait (jamais onboarding)', () => {
    expect(
      resolveRootRoute({ ...base, hasProfile: false, onboardingCompletedAt: null, hasSynced: false }),
    ).toBe('wait');
  });

  it('nouveau compte : profil null + synchro terminée → onboarding', () => {
    expect(
      resolveRootRoute({ ...base, hasProfile: false, onboardingCompletedAt: null, hasSynced: true }),
    ).toBe('onboarding');
  });

  it('profil présent mais onboarding non terminé → onboarding', () => {
    expect(resolveRootRoute({ ...base, onboardingCompletedAt: null })).toBe('onboarding');
  });

  it('profil onboardé → app', () => {
    expect(resolveRootRoute(base)).toBe('app');
  });

  it('non-régression réinstall : null+non-synchronisé → wait, puis profil onboardé → app', () => {
    expect(
      resolveRootRoute({ ...base, hasProfile: false, onboardingCompletedAt: null, hasSynced: false }),
    ).toBe('wait');
    expect(resolveRootRoute(base)).toBe('app'); // après redescente du profil
  });
});

describe('resolveRootRoute — gate suppression de compte (CONF-02)', () => {
  it('compte en suppression → deletion-pending, prioritaire sur onboarding', () => {
    expect(
      resolveRootRoute({
        ...base,
        hasSession: true,
        hasProfile: false,
        onboardingCompletedAt: null,
        hasSynced: true,
        deletionPending: true,
      }),
    ).toBe('deletion-pending');
  });

  it('check suppression en cours → wait', () => {
    expect(resolveRootRoute({ ...base, hasSession: true, deletionCheckLoading: true })).toBe('wait');
  });

  it('pas de demande de suppression → route normale inchangée', () => {
    expect(
      resolveRootRoute({
        ...base,
        hasSession: true,
        hasProfile: true,
        onboardingCompletedAt: '2026-01-01T00:00:00Z',
        hasSynced: true,
      }),
    ).toBe('app');
  });
});

describe('resolveRootRoute — gate réinitialisation de mot de passe (CONF-08)', () => {
  it('récupération en cours → password-recovery', () => {
    expect(resolveRootRoute({ ...base, recoveryPending: true })).toBe('password-recovery');
  });

  it('prioritaire sur onboarding (profil absent ou onboarding non terminé)', () => {
    expect(
      resolveRootRoute({ ...base, recoveryPending: true, onboardingCompletedAt: null }),
    ).toBe('password-recovery');
    expect(
      resolveRootRoute({ ...base, recoveryPending: true, hasProfile: false, hasSynced: true }),
    ).toBe('password-recovery');
  });

  it("n'attend ni le profil ni les réglages (l'écran n'en a pas besoin)", () => {
    expect(
      resolveRootRoute({ ...base, recoveryPending: true, profileLoading: true }),
    ).toBe('password-recovery');
    expect(
      resolveRootRoute({ ...base, recoveryPending: true, settingsLoading: true }),
    ).toBe('password-recovery');
  });

  it('la gate de suppression reste prioritaire sur la récupération', () => {
    expect(
      resolveRootRoute({ ...base, recoveryPending: true, deletionPending: true }),
    ).toBe('deletion-pending');
    expect(
      resolveRootRoute({ ...base, recoveryPending: true, deletionCheckLoading: true }),
    ).toBe('wait');
  });

  it('sans session, la récupération ne s\'applique pas (retour auth)', () => {
    expect(resolveRootRoute({ ...base, hasSession: false, recoveryPending: true })).toBe('auth');
  });

  it('le socle non prêt reste prioritaire (splash)', () => {
    expect(resolveRootRoute({ ...base, recoveryPending: true, fontsReady: false })).toBe('wait');
    expect(
      resolveRootRoute({ ...base, recoveryPending: true, authInitializing: true }),
    ).toBe('wait');
  });

  it('non-régression : sans recoveryPending, comportement inchangé', () => {
    expect(resolveRootRoute({ ...base })).toBe('app');
    expect(resolveRootRoute({ ...base, recoveryPending: false })).toBe('app');
  });
});
