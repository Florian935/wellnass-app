import { useEffect, useState } from 'react';

/**
 * Valeur retardée (US NUTRI-UX01, R6.2).
 *
 * La recherche d'aliments déclenche des requêtes surveillées : les relancer à chaque frappe fait
 * clignoter la liste sans rien apporter, et le coût grandira avec la base (80 aliments
 * aujourd'hui, ~900 après le remplissage prévu). 200 ms — assez pour absorber une frappe
 * continue, assez court pour que le résultat paraisse immédiat.
 */
export function useDebounced<T>(value: T, delayMs = 200): T {
  const [delayed, setDelayed] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDelayed(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return delayed;
}
