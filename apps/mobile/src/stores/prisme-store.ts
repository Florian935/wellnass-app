import { create } from 'zustand';
import type { PrismeStatus } from '@wellness/shared';

/**
 * US PRISME-01 — ce que l'app sait de Prisme pendant la session. **En mémoire seulement** : rien sur
 * disque.
 *
 * - `status` : le dernier statut connu (`kind: 'status'`). Gardé tel quel quand une relecture échoue
 *   hors ligne — c'est lui qui décide si une entrée est visible (spec DD7). US ACCES-IA : il dit aussi
 *   « bêta fermée » (`reason: 'closed'`) et le mode de l'interrupteur serveur (`access`).
 * - `statusLoading` : une demande de statut est en vol. Tant que le statut est inconnu, chaque écran
 *   qui en a besoin le redemande — une seule requête à la fois (ACCES-IA D15) ; une fois connu, plus
 *   aucun appel dans la session (PRISME-01 DD6).
 * - `reset()` : tout effacer à la déconnexion (ACCES-IA D17) — sur un téléphone partagé, le compte
 *   suivant hériterait sinon du statut du précédent.
 * - `epoch` : avance à chaque `reset()`. Une demande partie avant la déconnexion relit l'époque à son
 *   retour et **n'écrit rien** si elle a changé : la réponse destinée au compte A ne doit pas devenir le
 *   statut du compte B (constat de la revue du 23/10/2026).
 * - `texts` : les textes lus, par clé (« evening:2026-10-02 », « week:2026-09-21 »), avec l'empreinte
 *   du dossier qu'ils racontent. Pas de stockage : un texte périmé est pire que pas de texte (DD12) ;
 *   l'empreinte permet de dire « ta journée a bougé depuis ».
 * - `devSimulateInvented` : **développement seulement** — fait inventer un chiffre à Prisme pour
 *   recetter le refus du garde-fou (critère de recette 8). Sans effet dans un build de production.
 */
type PrismeTextEntry = { text: string; fingerprint: string };

type PrismeState = {
  status: PrismeStatus | null;
  /** Une demande de statut est-elle en vol ? Une seule à la fois (ACCES-IA D15). */
  statusLoading: boolean;
  /** Avance à chaque `reset()` : une réponse arrivée après un changement de compte est ignorée (D17). */
  epoch: number;
  texts: Record<string, PrismeTextEntry>;
  devSimulateInvented: boolean;
  setStatusLoading: (loading: boolean) => void;
  setStatus: (status: PrismeStatus) => void;
  clearConsent: () => void;
  rememberText: (key: string, entry: PrismeTextEntry) => void;
  forgetText: (key: string) => void;
  setDevSimulateInvented: (value: boolean) => void;
  /** ACCES-IA D17 — à la déconnexion : statut, demande en vol et textes lus, tout part. */
  reset: () => void;
};

export const usePrismeStore = create<PrismeState>((set) => ({
  status: null,
  statusLoading: false,
  epoch: 0,
  texts: {},
  devSimulateInvented: false,
  setStatusLoading: (loading) => set({ statusLoading: loading }),
  setStatus: (status) => set({ status }),
  clearConsent: () =>
    set((state) => (state.status ? { status: { ...state.status, consent: { at: null, provider: null } } } : state)),
  rememberText: (key, entry) => set((state) => ({ texts: { ...state.texts, [key]: entry } })),
  forgetText: (key) =>
    set((state) => {
      const { [key]: _forgotten, ...rest } = state.texts;
      return { texts: rest };
    }),
  setDevSimulateInvented: (value) => set({ devSimulateInvented: value }),
  reset: () => set((state) => ({ status: null, statusLoading: false, texts: {}, epoch: state.epoch + 1 })),
}));
