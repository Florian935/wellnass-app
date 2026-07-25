/**
 * Règle de validation d'un mot de passe saisi par l'utilisateur, partagée entre l'**inscription**
 * et la **réinitialisation** (CONF-08) pour que les deux ne divergent jamais. **Pure**, aucune I/O.
 *
 * Volontairement minimale : longueur + concordance, soit exactement la règle qui existait en local
 * dans l'écran d'inscription. Le durcissement de la politique (complexité, entropie, indicateur de
 * robustesse) est **hors périmètre** — à cadrer comme une US produit.
 */

/** Longueur minimale d'un mot de passe (contrat unique inscription + réinitialisation). */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordPairError = 'too-short' | 'mismatch';

/**
 * Valide un couple (mot de passe, confirmation). **Pure.**
 *
 * Ordre volontaire : la **longueur** est contrôlée AVANT la concordance — c'est le message le plus
 * utile quand les deux problèmes sont présents (inutile de dire « ils ne correspondent pas » si le
 * mot de passe est de toute façon trop court).
 *
 * Aucune normalisation : la casse et les espaces (y compris de fin) sont significatifs.
 *
 * @returns `'too-short'`, `'mismatch'`, ou `null` si le couple est valide.
 */
export function validatePasswordPair(
  password: string,
  confirm: string,
): PasswordPairError | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too-short';
  if (password !== confirm) return 'mismatch';
  return null;
}
