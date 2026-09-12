/**
 * L'app est-elle au premier plan ? — le garde-fou des boucles infinies de MOTION-01 (règle R4).
 *
 * ── Le besoin ───────────────────────────────────────────────────────────────────────────────────
 * Trois effets de l'US tournent **sans fin** : la respiration du halo des cartes héros, la
 * propagation autour de la position GPS, et les vagues d'hydratation. Sur une sortie course d'une
 * heure, une boucle oubliée, c'est une boucle de rendu vivante pendant une heure — pour un cercle
 * que personne ne regarde, écran éteint.
 *
 * ── Pourquoi pas `useIsFocused` / `useFocusEffect` ──────────────────────────────────────────────
 * C'était la première version, et elle avait un défaut rédhibitoire : ces hooks **lèvent une
 * exception** hors d'un conteneur de navigation (« Couldn't find a navigation object »). Un halo
 * décoratif qui fait planter l'écran qui l'héberge est un très mauvais marché — et le défaut s'est
 * manifesté immédiatement, sur les tests de composants qui rendent une carte isolément, sans
 * navigateur.
 *
 * `AppState` n'a aucune de ces dépendances : c'est un module de React Native, disponible partout,
 * qui ne lève jamais.
 *
 * ── Ce que ça couvre, et ce que ça ne couvre pas ────────────────────────────────────────────────
 * ✅ App en arrière-plan, écran éteint, utilisateur passé à une autre app — **le cas qui coûte de
 *    la batterie**, et de loin le plus fréquent sur une longue séance.
 * ⚠️ En revanche, un écran resté **monté mais masqué** par un autre (une carte de tableau de bord
 *    pendant qu'on navigue dans un autre onglet) continue d'animer. C'est un compromis assumé :
 *    l'utilisateur est alors activement dans l'app, l'écran est allumé de toute façon, et le coût
 *    est sans commune mesure avec celui d'une heure en arrière-plan.
 */

import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/** `true` tant que l'app est au premier plan. */
export function useIsAppActive(): boolean {
  const [active, setActive] = useState(() => AppState.currentState !== 'background');

  useEffect(() => {
    const handle = (state: AppStateStatus) => {
      // `inactive` (iOS, transition ou centre de contrôle) est traité comme actif : l'état dure
      // une fraction de seconde et couper les animations à chaque passage produirait un à-coup
      // visible au retour.
      setActive(state !== 'background');
    };
    const sub = AppState.addEventListener('change', handle);
    return () => sub.remove();
  }, []);

  return active;
}
