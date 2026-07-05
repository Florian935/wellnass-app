/** Identifiant local court (non cryptographique). Les vraies entités synchronisées
 *  utiliseront des UUID v4 (voir modele-donnees §1) une fois la synchro PowerSync branchée. */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
