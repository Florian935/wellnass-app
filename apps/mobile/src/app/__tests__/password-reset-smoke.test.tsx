/**
 * password-reset-smoke.test.tsx — écran-gate « nouveau mot de passe » (US CONF-08).
 *
 * Couvre le rendu et les **validations locales** (qui ne doivent déclencher aucun appel réseau).
 * Le parcours réel (deep link → session de récupération → updateUser → signOut global) est couvert
 * en recette device : ici on isole l'écran.
 *
 * Mocks : react-i18next (renvoie la clé), useTheme, auth-store. `@wellness/shared` est utilisé
 * pour de vrai (helper pur).
 */
import { fireEvent, render } from '@testing-library/react-native';
import PasswordResetScreen from '../password-reset';

// Préfixe `mock` obligatoire : les factories jest.mock sont hoistées et ne peuvent référencer que
// des variables ainsi nommées.
const mockCompletePasswordRecovery = jest.fn(async () => ({ error: null }));
const mockClearRecovery = jest.fn();
const mockSignOut = jest.fn(async () => undefined);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#000', textMuted: '#888', background: '#fff', surface: '#f5f5f5',
      border: '#ddd', accent: '#6b0028', accentText: '#fff', danger: '#b23b2e',
      success: '#5c7a3f',
    },
  })),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({
      completePasswordRecovery: (...args: unknown[]) => mockCompletePasswordRecovery(...args),
      clearRecovery: () => mockClearRecovery(),
      signOut: () => mockSignOut(),
    }),
}));

describe('Écran nouveau mot de passe (CONF-08)', () => {
  beforeEach(() => {
    mockCompletePasswordRecovery.mockClear();
    mockClearRecovery.mockClear();
    mockSignOut.mockClear();
  });

  it('rend les deux champs, le bouton d\'enregistrement et Annuler', async () => {
    const { getByText } = await render(<PasswordResetScreen />);
    expect(getByText('auth.newPassword.title')).toBeTruthy();
    expect(getByText('auth.newPassword.field')).toBeTruthy();
    expect(getByText('auth.newPassword.confirmField')).toBeTruthy();
    expect(getByText('auth.newPassword.cta')).toBeTruthy();
    expect(getByText('auth.newPassword.cancel')).toBeTruthy();
  });

  it('mot de passe trop court → message, aucun appel au store', async () => {
    const { getByText, getByLabelText } = await render(<PasswordResetScreen />);
    await fireEvent.changeText(getByLabelText('auth.newPassword.field'), 'court');
    await fireEvent.changeText(getByLabelText('auth.newPassword.confirmField'), 'court');
    await fireEvent.press(getByText('auth.newPassword.cta'));

    expect(getByText('auth.newPassword.tooShort')).toBeTruthy();
    expect(mockCompletePasswordRecovery).not.toHaveBeenCalled();
    // La saisie est conservée : l'utilisateur corrige sans tout retaper.
    expect(getByLabelText('auth.newPassword.field').props.value).toBe('court');
  });

  it('mots de passe non concordants → message, aucun appel au store', async () => {
    const { getByText, getByLabelText } = await render(<PasswordResetScreen />);
    await fireEvent.changeText(getByLabelText('auth.newPassword.field'), 'motdepasse1');
    await fireEvent.changeText(getByLabelText('auth.newPassword.confirmField'), 'motdepasse2');
    await fireEvent.press(getByText('auth.newPassword.cta'));

    expect(getByText('auth.newPassword.mismatch')).toBeTruthy();
    expect(mockCompletePasswordRecovery).not.toHaveBeenCalled();
  });

  it('couple valide → appelle le store avec le nouveau mot de passe', async () => {
    const { getByText, getByLabelText } = await render(<PasswordResetScreen />);
    await fireEvent.changeText(getByLabelText('auth.newPassword.field'), 'motdepasse1');
    await fireEvent.changeText(getByLabelText('auth.newPassword.confirmField'), 'motdepasse1');
    await fireEvent.press(getByText('auth.newPassword.cta'));

    expect(mockCompletePasswordRecovery).toHaveBeenCalledWith('motdepasse1');
  });

  it('Annuler → sort du mode récupération puis déconnecte', async () => {
    const { getByText } = await render(<PasswordResetScreen />);
    await fireEvent.press(getByText('auth.newPassword.cancel'));

    expect(mockClearRecovery).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockCompletePasswordRecovery).not.toHaveBeenCalled();
  });
});
