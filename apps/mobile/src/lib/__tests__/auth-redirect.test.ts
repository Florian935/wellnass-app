import { parseAuthTokensFromUrl } from '../auth-redirect';

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
