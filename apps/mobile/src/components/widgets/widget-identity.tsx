/**
 * Identité du widget en cours de rendu, exposée par contexte.
 *
 * Sert aux ornements qui doivent **varier d'un widget à l'autre** — aujourd'hui le cercle
 * d'accent (`AccentHalo`), dont le coin et la taille sont dérivés de cette chaîne. Sans ça,
 * tous les widgets d'un même écran portaient leur halo dans le même coin : le motif se
 * répétait à l'identique d'une carte à l'autre, ce qui recréait exactement la monotonie que
 * le halo est censé casser.
 *
 * Passe par un **contexte** plutôt que par une prop : `WidgetFrame` est appelé depuis une
 * vingtaine de composants de widget qui n'ont aucune raison de connaître leur propre id, et
 * les deux grilles (`WidgetGrid` et `SortableWidgetGrid`) l'ont déjà sous la main.
 *
 * Hors grille (carte héros d'un écran, ex. « Bilan du jour »), le contexte est absent : le
 * halo retombe alors sur la géométrie du module actif.
 */

import { createContext, useContext, type ReactNode } from 'react';

const WidgetIdentityContext = createContext<string | null>(null);

export function WidgetIdentityProvider({ id, children }: { id: string; children: ReactNode }) {
  return <WidgetIdentityContext.Provider value={id}>{children}</WidgetIdentityContext.Provider>;
}

/** Id du widget englobant, ou `null` hors d'une grille. */
export function useWidgetIdentity(): string | null {
  return useContext(WidgetIdentityContext);
}
