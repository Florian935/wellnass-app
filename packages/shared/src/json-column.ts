/**
 * Lecture des colonnes texte-JSON écrites côté client.
 *
 * PowerSync / op-sqlite **double-encode** les colonnes texte-JSON écrites depuis le device
 * (une string JSON stockée dans une string JSON), alors que les mêmes données arrivées par
 * la synchro serveur sont en **simple** encodage. Ce helper déballe les strings jusqu'à
 * deux fois, puis renvoie `fallback` si le résultat n'est pas exploitable.
 *
 * Cause racine identifiée sur `micronutrients` (US4.34) ; centralisé ici pour couvrir
 * **toutes** les colonnes JSON client (`portions`, `active_pillars`, `meals`, …).
 *
 * `isValid` (optionnel) valide la **forme** du résultat : si la valeur décodée ne le
 * satisfait pas (ex. une chaîne restée telle quelle après un encodage trop profond, ou
 * un objet là où on attend un tableau), on renvoie `fallback` plutôt qu'une valeur au
 * type mensonger. Indispensable pour les colonnes tableau : sans ça, un `active_pillars`
 * corrompu était typé `Pillar[]` mais restait une chaîne → `activePillars.map` plantait
 * le rendu (crash rejeu onboarding, fix/onboarding-rejeu-profil).
 */
export function parseJsonColumn<T>(
  input: unknown,
  fallback: T,
  isValid?: (value: unknown) => value is T,
): T {
  let value: unknown = input;
  // Jusqu'à 3 déballages : simple (serveur), double (écriture client op-sqlite) et le
  // triple observé sur des lignes corrompues. Au-delà, `isValid` renverra le fallback.
  for (let i = 0; i < 3 && typeof value === 'string'; i += 1) {
    try {
      value = JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  if (value == null) return fallback;
  if (isValid && !isValid(value)) return fallback;
  return value as T;
}
