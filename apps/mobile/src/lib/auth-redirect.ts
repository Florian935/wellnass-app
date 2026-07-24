/**
 * Redirection (deep link) des liens d'e-mail Supabase — confirmation d'inscription, etc.
 *
 * Par défaut Supabase redirige vers le **Site URL** du projet (`http://localhost:3000`),
 * inadapté au mobile : on force donc une redirection vers le **scheme de l'app** (`wellness://`)
 * pour rouvrir l'app au retour. Cette URL doit être présente dans la liste blanche
 * **Authentication → URL Configuration → Redirect URLs** du dashboard Supabase.
 *
 * Flux **implicite** (client Supabase `detectSessionInUrl: false`) : le lien renvoie les
 * jetons dans le **fragment** d'URL (`#access_token=...&refresh_token=...`), que l'on parse
 * ici puis que l'on passe à `supabase.auth.setSession` (voir `useAuthDeepLink`).
 */

/** Deep link cible des liens d'e-mail (à déclarer dans les Redirect URLs Supabase). */
export const AUTH_REDIRECT_URL = 'wellness://auth-callback';

export type AuthTokens = { accessToken: string; refreshToken: string };

/**
 * Extrait les jetons d'auth du fragment d'un deep link Supabase (flux implicite). **Pur.**
 * Renvoie `null` si l'URL est absente, sans fragment, ou si l'un des deux jetons manque.
 */
export function parseAuthTokensFromUrl(url: string | null | undefined): AuthTokens | null {
  if (!url) return null;
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;

  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}
