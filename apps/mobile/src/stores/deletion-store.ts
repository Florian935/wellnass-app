import { create } from 'zustand';
import { fetchPendingDeletion } from '@/data/repositories/account-deletion-repository';

/**
 * État de détection « suppression de compte en cours » (US CONF-02), partagé entre
 * le routage racine (`_layout.tsx`, qui affiche la gate) et l'écran-gate lui-même
 * (`deletion-pending.tsx`, qui peut annuler la suppression).
 *
 * Pourquoi un store plutôt qu'un état local à `_layout` : après une **annulation**
 * depuis la gate, il faut pouvoir réinitialiser la détection pour **sortir de la gate**
 * (sinon `deletionPending` reste `true` et le routage y ramène en boucle). L'état local
 * n'était pas accessible depuis l'écran.
 *
 * `check` ne s'exécute **qu'une fois par utilisateur** (dédup via `checkedFor`) pour ne
 * pas re-déclencher le contrôle à chaque renouvellement de token (nouvel objet session).
 */
type DeletionState = {
  /** Le contrôle réseau n'a pas encore répondu (→ splash). */
  loading: boolean;
  /** Une demande de suppression est pending côté serveur (→ gate). */
  pending: boolean;
  /** Id utilisateur pour lequel le contrôle a déjà été lancé (dédup). */
  checkedFor: string | null;
  /** Lance le contrôle pour un utilisateur (une seule fois). Fail-open hors-ligne. */
  check: (userId: string) => void;
  /** Réinitialise (déconnexion / après annulation réussie) → sortie de la gate. */
  reset: () => void;
};

export const useDeletionStore = create<DeletionState>((set, get) => ({
  loading: true,
  pending: false,
  checkedFor: null,
  check: (userId) => {
    if (get().checkedFor === userId) return;
    set({ checkedFor: userId, loading: true, pending: false });
    fetchPendingDeletion()
      .then((r) => {
        // N'applique le résultat que si l'utilisateur courant n'a pas changé entre-temps.
        if (get().checkedFor === userId) set({ loading: false, pending: r != null });
      })
      .catch(() => {
        // Fail-open (hors-ligne / erreur réseau) : ne pas bloquer l'accès à l'app sur un
        // contrôle de suppression indisponible.
        if (get().checkedFor === userId) set({ loading: false, pending: false });
      });
  },
  reset: () => set({ loading: false, pending: false, checkedFor: null }),
}));
