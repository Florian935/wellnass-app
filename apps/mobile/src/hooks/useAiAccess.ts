/**
 * US ACCES-IA — l'accès de ce compte à l'IA, en trois états (spec D15).
 * Réf. : docs/specs/functional/us/acces-ia-testeurs.md §4.1.
 *
 * - `allowed` : un statut est connu et ne dit pas « bêta fermée » — ce compte est testeur, ou le serveur
 *   est ouvert à tous. (Prisme peut rester indisponible pour une autre raison : âge, fournisseur ;
 *   c'est `usePrismeVisibility` qui en tient compte.)
 * - `closed` : le serveur a répondu « bêta fermée » (`reason: 'closed'`).
 * - `unknown` : pas encore de statut — hors ligne au démarrage, premier rendu, appel en échec, ou
 *   fonction trop ancienne pour être comprise.
 *
 * ── Quand le statut est demandé ──────────────────────────────────────────────────────────────────
 * Tant qu'il est inconnu, **chaque montage** d'un écran qui en a besoin le redemande, une seule requête
 * à la fois (drapeau `statusLoading` du store). Une fois connu, plus aucun appel dans la session
 * (PRISME-01 DD6) : un changement de la liste des testeurs vaut au démarrage suivant (D13).
 * Volontairement au montage et non à chaque rendu : hors ligne, chaque échec relancerait sinon la
 * demande en boucle. Une demande qui **pend** (portail captif, réseau mort sans erreur) libère le drapeau
 * au bout de {@link STATUS_REQUEST_TIMEOUT_MS} : l'écran suivant pourra redemander. Et une demande partie
 * avant un changement de compte ne touche plus au drapeau du compte suivant (`epoch`, D17).
 */

import { useEffect } from 'react';
import type { AiAccessMode, PrismeStatus } from '@wellness/shared';

import { refreshPrismeStatus } from '@/lib/ai/prisme';
import { usePrismeStore } from '@/stores/prisme-store';

export type AiAccessState = 'allowed' | 'closed' | 'unknown';

/** Au-delà, une demande de statut restée sans réponse ne bloque plus les suivantes (D15). */
export const STATUS_REQUEST_TIMEOUT_MS = 10_000;

/** L'état d'accès que dit un statut (ou son absence). Pur : la règle se teste sans rendu. */
export function aiAccessStateOf(status: PrismeStatus | null): AiAccessState {
  if (status === null) return 'unknown';
  return status.reason === 'closed' ? 'closed' : 'allowed';
}

export function useAiAccess(): {
  access: AiAccessState;
  mode: AiAccessMode | null;
  status: PrismeStatus | null;
  /** Une demande de statut est en vol : l'écran peut attendre au lieu de dire « il faut le réseau ». */
  loading: boolean;
} {
  const status = usePrismeStore((s) => s.status);
  const loading = usePrismeStore((s) => s.statusLoading);

  useEffect(() => {
    const store = usePrismeStore.getState();
    if (store.status !== null || store.statusLoading) return;
    const epoch = store.epoch;
    store.setStatusLoading(true);
    const release = () => {
      const current = usePrismeStore.getState();
      if (current.epoch === epoch) current.setStatusLoading(false);
    };
    const timer = setTimeout(release, STATUS_REQUEST_TIMEOUT_MS);
    void refreshPrismeStatus()
      .finally(() => {
        clearTimeout(timer);
        release();
      })
      // `refreshPrismeStatus` ne rejette pas (le client traduit tout en code) ; ce `catch` ne sert que
      // de filet : un statut qui n'arrive pas laisse l'état « inconnu », que l'écran suivant relancera.
      .catch(() => undefined);
  }, []);

  return { access: aiAccessStateOf(status), mode: status?.access ?? null, status, loading };
}
