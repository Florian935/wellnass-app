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

/**
 * Deep link cible des liens de **réinitialisation de mot de passe** (CONF-08).
 *
 * URL **distincte** de `AUTH_REDIRECT_URL` : c'est ce qui permet de reconnaître un flux de
 * récupération de façon **structurelle** (le chemin du lien) plutôt que via un paramètre de
 * fragment. Indispensable, car les deux flux renvoient les mêmes jetons — sans discriminant, un
 * lien de reset connecterait l'utilisateur dans l'app sans lui demander de nouveau mot de passe.
 *
 * ⚠️ À déclarer dans **Authentication → URL Configuration → Redirect URLs** du dashboard Supabase,
 * sinon le `redirectTo` est ignoré et Supabase retombe sur le Site URL (`http://localhost:3000`).
 */
export const PASSWORD_RESET_REDIRECT_URL = 'wellness://password-reset';

export type AuthTokens = { accessToken: string; refreshToken: string };

/** Résultat du classement d'un deep link d'authentification. */
export type AuthDeepLink =
  | { kind: 'tokens'; tokens: AuthTokens; isRecovery: boolean }
  | { kind: 'error'; code: string };

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

/**
 * Classe un deep link d'authentification Supabase : jetons de session, erreur, ou rien. **Pur.**
 *
 * Trois issues :
 * - `{ kind: 'tokens', … }` — le lien porte une session utilisable. `isRecovery` distingue une
 *   **réinitialisation de mot de passe** (→ écran de saisie obligatoire) d'une simple
 *   **confirmation d'inscription** (→ connexion directe).
 * - `{ kind: 'error', code }` — Supabase a refusé le lien (expiré, déjà consommé). Aucune session.
 * - `null` — n'importe quel autre deep link, ou jetons incomplets : **no-op** côté appelant.
 *
 * `isRecovery` est vrai si **le chemin** est `PASSWORD_RESET_REDIRECT_URL` **ou** si le fragment
 * porte `type=recovery` : le chemin est le discriminant principal (on ne dépend pas du contenu exact
 * du fragment), `type` sert de contrôle secondaire défensif.
 *
 * L'erreur est examinée **avant** les jetons : un fragment qui porte les deux est un refus.
 */
export function parseAuthDeepLink(url: string | null | undefined): AuthDeepLink | null {
  if (!url) return null;
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;

  const params = new URLSearchParams(url.slice(hashIndex + 1));

  // Refus explicite de Supabase (lien expiré / déjà utilisé) — prioritaire sur d'éventuels jetons.
  const error = params.get('error');
  if (error) return { kind: 'error', code: params.get('error_code') ?? error };

  const tokens = parseAuthTokensFromUrl(url); // réutilise le helper déjà recetté (confirmation)
  if (!tokens) return null;

  const isRecovery =
    url.startsWith(PASSWORD_RESET_REDIRECT_URL) || params.get('type') === 'recovery';
  return { kind: 'tokens', tokens, isRecovery };
}
