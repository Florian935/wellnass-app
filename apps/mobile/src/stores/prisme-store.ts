import { create } from 'zustand';
import type { PrismeStatus } from '@wellness/shared';

/**
 * US PRISME-01 — ce que l'app sait de Prisme pendant la session. **En mémoire seulement** : rien sur
 * disque.
 *
 * - `status` : le dernier statut connu (`kind: 'status'`). Gardé tel quel quand une relecture échoue
 *   hors ligne — c'est lui qui décide si une entrée est visible (spec DD7).
 * - `texts` : les textes lus, par clé (« evening:2026-10-02 », « week:2026-09-21 »), avec l'empreinte
 *   du dossier qu'ils racontent. Pas de stockage : un texte périmé est pire que pas de texte (DD12) ;
 *   l'empreinte permet de dire « ta journée a bougé depuis ».
 * - `devSimulateInvented` : **développement seulement** — fait inventer un chiffre à Prisme pour
 *   recetter le refus du garde-fou (critère de recette 8). Sans effet dans un build de production.
 */
type PrismeTextEntry = { text: string; fingerprint: string };

type PrismeState = {
  status: PrismeStatus | null;
  /** Le statut a-t-il déjà été demandé dans cette session ? Une fois suffit (DD6). */
  statusRequested: boolean;
  texts: Record<string, PrismeTextEntry>;
  devSimulateInvented: boolean;
  markStatusRequested: () => void;
  setStatus: (status: PrismeStatus) => void;
  clearConsent: () => void;
  rememberText: (key: string, entry: PrismeTextEntry) => void;
  forgetText: (key: string) => void;
  setDevSimulateInvented: (value: boolean) => void;
};

export const usePrismeStore = create<PrismeState>((set) => ({
  status: null,
  statusRequested: false,
  texts: {},
  devSimulateInvented: false,
  markStatusRequested: () => set({ statusRequested: true }),
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
}));
