import * as SecureStore from 'expo-secure-store';
import type { SupportedStorage } from '@supabase/supabase-js';

/**
 * Stockage **chiffré et persistant** pour la session Supabase (Android Keystore via
 * expo-secure-store — architecture §7 « chiffrement au repos »).
 *
 * SecureStore limite chaque valeur à ~2 Ko : on **découpe** les valeurs plus grandes
 * (la session Supabase dépasse souvent cette taille). La clé principale stocke le nombre
 * de morceaux ; chaque morceau est stocké sous `<clé>.<index>`.
 */
const CHUNK_SIZE = 2000;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function clearChunks(key: string, from = 0): Promise<void> {
  for (let i = from; ; i += 1) {
    const existing = await SecureStore.getItemAsync(chunkKey(key, i));
    if (existing === null) {
      break;
    }
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
}

export const secureStorage: SupportedStorage = {
  getItem: async (key) => {
    const meta = await SecureStore.getItemAsync(key);
    if (meta === null) {
      return null;
    }
    const count = Number.parseInt(meta, 10);
    if (Number.isNaN(count)) {
      return meta; // valeur simple écrite avant chunking
    }
    let result = '';
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part === null) {
        return null; // donnée corrompue → considérée absente
      }
      result += part;
    }
    return result;
  },
  setItem: async (key, value) => {
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(key, String(chunks.length));
    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]!);
    }
    // Nettoie d'éventuels morceaux résiduels d'une valeur précédente plus longue.
    await clearChunks(key, chunks.length);
  },
  removeItem: async (key) => {
    await SecureStore.deleteItemAsync(key);
    await clearChunks(key);
  },
};
