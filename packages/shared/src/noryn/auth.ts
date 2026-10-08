/**
 * US NORYN-01 — l'accès : le **seul** jeton de Noryn (R2). Ni JWT Supabase, ni clé `apikey`.
 *
 * Seule l'empreinte SHA-256 du jeton est stockée (secret `NORYN_TOKEN_SHA256`) ; on compare les
 * empreintes à **temps constant**. Le calcul de l'empreinte est injecté par l'appelant (WebCrypto
 * côté Deno) : ce module ne dépend d'aucune API de plateforme.
 */

/** `Bearer <jeton>`, jeton de 16 à 4 096 caractères ASCII visibles (la borne de Noryn). */
const BEARER = /^Bearer +([\x21-\x7E]{16,4096})$/i;
const TOKEN_HASH = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Le jeton présenté, ou `null` si l'en-tête est absent ou mal formé. */
export function parseBearer(header: string | null): string | null {
  const match = header === null ? null : BEARER.exec(header);
  return match ? (match[1] as string) : null;
}

/** L'empreinte attendue, en minuscules — ou `null` si le secret est absent ou mal formé. */
export function normalizeTokenHash(value: string | undefined): string | null {
  const hash = (value ?? '').trim().toLowerCase();
  return TOKEN_HASH.test(hash) ? hash : null;
}

/**
 * Égalité de deux empreintes **sans sortie anticipée** : le temps ne dépend pas de la position du
 * premier caractère différent. Les deux empreintes font 64 caractères ; une longueur différente ne
 * peut venir que d'une erreur de programmation, et rend faux.
 */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Le propriétaire fixé par secret (`NORYN_OWNER_USER_ID`), en minuscules — ou `null`. Jamais la requête. */
export function normalizeOwnerId(value: string | undefined): string | null {
  const id = (value ?? '').trim().toLowerCase();
  return UUID.test(id) ? id : null;
}
