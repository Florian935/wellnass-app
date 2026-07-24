import {
  PASSWORD_RESET_REDIRECT_URL,
  parseAuthDeepLink,
  parseAuthTokensFromUrl,
} from '../auth-redirect';

describe('parseAuthTokensFromUrl', () => {
  it('extrait les deux jetons du fragment', () => {
    const url =
      'wellness://auth-callback#access_token=abc.def.ghi&refresh_token=r123&type=signup&expires_in=3600';
    expect(parseAuthTokensFromUrl(url)).toEqual({ accessToken: 'abc.def.ghi', refreshToken: 'r123' });
  });

  it('URL sans fragment → null', () => {
    expect(parseAuthTokensFromUrl('wellness://auth-callback')).toBeNull();
  });

  it('fragment sans refresh_token → null (jeton manquant)', () => {
    expect(parseAuthTokensFromUrl('wellness://auth-callback#access_token=abc')).toBeNull();
  });

  it('URL absente → null', () => {
    expect(parseAuthTokensFromUrl(null)).toBeNull();
    expect(parseAuthTokensFromUrl(undefined)).toBeNull();
  });
});

describe('parseAuthDeepLink', () => {
  it('lien de récupération → kind tokens + isRecovery', () => {
    const url = `${PASSWORD_RESET_REDIRECT_URL}#access_token=a&refresh_token=r&type=recovery&expires_in=3600`;
    expect(parseAuthDeepLink(url)).toEqual({
      kind: 'tokens',
      tokens: { accessToken: 'a', refreshToken: 'r' },
      isRecovery: true,
    });
  });

  it('lien de confirmation d\'inscription → kind tokens sans récupération', () => {
    const url = 'wellness://auth-callback#access_token=a&refresh_token=r&type=signup';
    expect(parseAuthDeepLink(url)).toEqual({
      kind: 'tokens',
      tokens: { accessToken: 'a', refreshToken: 'r' },
      isRecovery: false,
    });
  });

  it('récupération reconnue par le chemin même sans type=recovery', () => {
    const url = `${PASSWORD_RESET_REDIRECT_URL}#access_token=a&refresh_token=r`;
    expect(parseAuthDeepLink(url)).toMatchObject({ isRecovery: true });
  });

  it('récupération reconnue par type=recovery même sur l\'autre chemin (défense)', () => {
    const url = 'wellness://auth-callback#access_token=a&refresh_token=r&type=recovery';
    expect(parseAuthDeepLink(url)).toMatchObject({ isRecovery: true });
  });

  it('lien expiré → kind error avec le code Supabase', () => {
    const url = `${PASSWORD_RESET_REDIRECT_URL}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`;
    expect(parseAuthDeepLink(url)).toEqual({ kind: 'error', code: 'otp_expired' });
  });

  it('erreur sans error_code → repli sur error', () => {
    const url = `${PASSWORD_RESET_REDIRECT_URL}#error=access_denied`;
    expect(parseAuthDeepLink(url)).toEqual({ kind: 'error', code: 'access_denied' });
  });

  it('l\'erreur est prioritaire sur des jetons éventuels', () => {
    const url = `${PASSWORD_RESET_REDIRECT_URL}#error=access_denied&error_code=otp_expired&access_token=a&refresh_token=r`;
    expect(parseAuthDeepLink(url)).toEqual({ kind: 'error', code: 'otp_expired' });
  });

  it('deep link quelconque, sans fragment ou URL absente → null', () => {
    expect(parseAuthDeepLink('wellness://autre-chose')).toBeNull();
    expect(parseAuthDeepLink(`${PASSWORD_RESET_REDIRECT_URL}`)).toBeNull();
    expect(parseAuthDeepLink(null)).toBeNull();
    expect(parseAuthDeepLink(undefined)).toBeNull();
    expect(parseAuthDeepLink('')).toBeNull();
  });

  it('jetons incomplets → null (pas de session bancale)', () => {
    expect(parseAuthDeepLink(`${PASSWORD_RESET_REDIRECT_URL}#access_token=a`)).toBeNull();
    expect(parseAuthDeepLink(`${PASSWORD_RESET_REDIRECT_URL}#refresh_token=r`)).toBeNull();
  });
});
