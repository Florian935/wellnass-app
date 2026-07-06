import * as Crypto from 'expo-crypto';

/** UUID v4 généré côté client — clé de réconciliation PowerSync (modele-donnees §1). */
export function generateId(): string {
  return Crypto.randomUUID();
}
