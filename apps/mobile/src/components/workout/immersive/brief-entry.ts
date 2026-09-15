/**
 * Les chemins qui mènent au brief — US MUSCU-UX03, spec §5.1.
 *
 * ── Le problème que ça règle ────────────────────────────────────────────────────────────────────
 * Cinq écrans démarrent une séance de musculation : l'accueil du pilier, l'accueil général
 * (`NowCard`), le planning, la fiche d'un programme et la fiche d'un modèle. Chacun faisait
 * « je crée la séance, puis j'ouvre `/workout` ». Le brief renverse l'ordre — **on annonce, puis on
 * crée** — et il fallait que les cinq le fassent de la même manière, sans recopier la condition.
 *
 * ── La condition, une seule fois ────────────────────────────────────────────────────────────────
 * Le brief n'existe qu'en mode immersif, et seulement pour une séance qui a quelque chose à
 * annoncer. Le mode classique ne voit **jamais** cet écran : ses cinq chemins restent identiques à
 * ce qu'ils étaient, ce qui est précisément le contrat du mode (décision D1).
 *
 * On lit le store avec `getState()` plutôt qu'avec un hook : ces appels partent depuis des
 * gestionnaires d'appui, pas depuis un rendu, et un hook y serait une règle des hooks violée.
 */

import type { Href } from 'expo-router';
import { useSessionMode } from '@/stores/session-mode-store';

/**
 * La route du brief pour une séance de **programme**, ou `null` s'il n'y a pas lieu de l'afficher
 * (mode classique, ou séance sans identifiant).
 */
export function briefRouteForSession(
  sessionId: string | null | undefined,
  plannedSessionId?: string | null,
): Href | null {
  if (!sessionId || useSessionMode.getState().mode !== 'immersive') return null;
  return {
    pathname: '/workout-brief',
    params: plannedSessionId ? { sessionId, plannedSessionId } : { sessionId },
  };
}

/** La route du brief pour une séance créée depuis un **modèle**, ou `null`. */
export function briefRouteForTemplate(templateId: string | null | undefined): Href | null {
  if (!templateId || useSessionMode.getState().mode !== 'immersive') return null;
  return { pathname: '/workout-brief', params: { templateId } };
}
