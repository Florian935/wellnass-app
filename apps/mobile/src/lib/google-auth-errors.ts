import { statusCodes } from '@react-native-google-signin/google-signin';

/**
 * Clés i18n des messages d'erreur affichés lors d'une connexion Google.
 * Les libellés FR/EN correspondants sont ajoutés en Task 4 ; ce helper ne
 * renvoie que la clé (l'écran fera `t(clé)`).
 */
const ERROR_KEY = {
  /** Google Play Services absent/obsolète sur l'appareil. */
  playServices: 'auth.google.errors.playServices',
  /** Problème réseau (hors-ligne, requête échouée, timeout). */
  offline: 'auth.google.errors.offline',
  /** Refus côté Supabase : e-mail non vérifié / liaison de compte impossible. */
  linkUnverified: 'auth.google.errors.linkUnverified',
  /** Cas inconnu — message générique par défaut. */
  generic: 'auth.google.errors.generic',
} as const;

/** Lit une propriété chaîne de façon défensive (err est `unknown`). */
function readString(source: object, key: string): string | undefined {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Mappe une erreur de connexion Google vers une clé i18n, de façon **pure et
 * déterministe**. Couvre les deux origines :
 *  - codes natifs Google (`err.code` comparé aux `statusCodes` de la lib) ;
 *  - erreurs Supabase/réseau (patterns sur `err.message`).
 *
 * Le cas `SIGN_IN_CANCELLED` n'est **pas** traité ici : l'annulation par
 * l'utilisateur est un no-op géré en amont dans `signInWithGoogle`.
 *
 * @returns une clé i18n ; `auth.google.errors.generic` par défaut.
 */
export function mapGoogleSignInError(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return ERROR_KEY.generic;
  }

  // 1) Origine Google — codes natifs (issus de NativeModule.getConstants()).
  const code = readString(err, 'code');
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return ERROR_KEY.playServices;
  }

  // 2) Origine Supabase / réseau — patterns sur le message (insensible à la casse).
  const message = readString(err, 'message');
  if (message) {
    const normalized = message.toLowerCase();

    // Réseau d'abord : « Network request failed », fetch, hors-ligne, timeout.
    if (
      normalized.includes('network') ||
      normalized.includes('fetch') ||
      normalized.includes('offline') ||
      normalized.includes('timeout')
    ) {
      return ERROR_KEY.offline;
    }

    // Liaison refusée : e-mail non confirmé/vérifié côté Supabase. On exige une
    // co-occurrence (« email » + verif/link/confirm) pour éviter les faux positifs
    // avec d'autres erreurs GoTrue mentionnant « email » (rate limit, déjà inscrit,
    // adresse invalide…), qui doivent retomber sur le message générique.
    if (
      normalized.includes('not confirmed') ||
      normalized.includes('not verified') ||
      (normalized.includes('email') &&
        (normalized.includes('verif') ||
          normalized.includes('link') ||
          normalized.includes('confirm')))
    ) {
      return ERROR_KEY.linkUnverified;
    }
  }

  return ERROR_KEY.generic;
}
