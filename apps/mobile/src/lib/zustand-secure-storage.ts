import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import type { StateStorage } from 'zustand/middleware';

/**
 * Stockage `StateStorage` (pour le middleware `persist` de Zustand) adossé à
 * expo-secure-store (chiffré, Keystore). Les états persistés (profil, réglages) sont petits,
 * bien en deçà de la limite ~2 Ko de SecureStore — pas de découpage nécessaire.
 */
export const secureStateStorage: StateStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};

type Persistable = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (cb: () => void) => () => void;
  };
};

/**
 * Vrai une fois le store réhydraté depuis le stockage. À attendre avant de router selon
 * l'état persisté (sinon on redirige sur un état par défaut, puis ça « saute »).
 */
export function useHydrated(store: Persistable): boolean {
  const [hydrated, setHydrated] = useState<boolean>(() => store.persist.hasHydrated());
  useEffect(() => {
    // L'init de useState couvre le cas « déjà hydraté » ; sinon on écoute la fin d'hydratation.
    return store.persist.onFinishHydration(() => setHydrated(true));
  }, [store]);
  return hydrated;
}
