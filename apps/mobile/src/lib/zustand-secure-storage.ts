import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Stockage `StateStorage` (pour le middleware `persist` de Zustand) adossé à
 * expo-secure-store (chiffré, Keystore). Les états persistés (profil, réglages) sont petits,
 * bien en deçà de la limite ~2 Ko de SecureStore — pas de découpage nécessaire.
 *
 * L'état de fin de réhydratation est suivi par un flag `hasHydrated` dans chaque store
 * (posé via `onRehydrateStorage`) — plus robuste qu'un abonnement côté composant.
 */
export const secureStateStorage: StateStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};
