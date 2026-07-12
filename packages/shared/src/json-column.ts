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
 */
export function parseJsonColumn<T>(input: unknown, fallback: T): T {
  let value: unknown = input;
  for (let i = 0; i < 2 && typeof value === 'string'; i += 1) {
    try {
      value = JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  if (value == null) return fallback;
  return value as T;
}
