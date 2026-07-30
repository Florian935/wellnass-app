import { create } from 'zustand';
import type { ColorScheme } from '@/theme/colors';

/**
 * Schéma de couleurs **effectif**, résolu **une seule fois** et partagé par toute l'app.
 *
 * ── Le bug que ce store corrige (30/07/2026) ──────────────────────────────────────────────────────
 * `useTheme()` est appelé par **126 composants**. Il lisait la préférence via `useSettings()`, donc
 * **chaque composant ouvrait sa propre requête PowerSync**. Conséquence à chaque navigation : les
 * composants du nouvel écran montaient avec `settings === null`, retombaient sur le thème **système**
 * le temps d'un tick, puis basculaient sur la vraie préférence — et comme les 126 abonnements se
 * résolvaient indépendamment, le basculement se voyait **composant par composant**. Symptôme
 * rapporté : « thème sombre 0,2 s, puis petit à petit le clair ».
 *
 * Le repli `?? 'system'` était le déclencheur, la multiplication des abonnements l'amplificateur.
 *
 * ── Pourquoi un store et pas un contexte ──────────────────────────────────────────────────────────
 * Un store Zustand se lit **sans provider** : les 126 appels à `useTheme()` restent inchangés, les
 * tests qui rendent un composant isolé continuent de fonctionner, et la valeur **survit à la
 * navigation** (un contexte remonté aurait le même problème qu'aujourd'hui si l'arbre se démonte).
 * C'est déjà le patron du dépôt (`menu-accent-store`, `useTrackedMicros`).
 *
 * `null` = pas encore résolu. Ne dure que le temps du démarrage, pendant lequel le splash est de
 * toute façon maintenu par `resolveRootRoute` (qui attend `settingsLoading`).
 */
type ColorSchemeState = {
  /** Schéma résolu, ou `null` tant que les réglages n'ont pas été lus une première fois. */
  scheme: ColorScheme | null;
  /** Écrit par `useSyncColorScheme()`, au niveau du navigateur racine, et par personne d'autre. */
  setScheme: (scheme: ColorScheme) => void;
};

export const useColorSchemeStore = create<ColorSchemeState>((set) => ({
  scheme: null,
  setScheme: (scheme) =>
    // Garde d'idempotence : `set` avec une valeur identique ferait re-render les 126 abonnés.
    set((state) => (state.scheme === scheme ? state : { scheme })),
}));
