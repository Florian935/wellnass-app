import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect } from 'react';
import { useMenuAccent, type MenuKey } from '@/stores/menu-accent-store';

/**
 * Déclare l'**identité** de l'écran (Accueil / Muscu / Course / Alimentation / Labo / Bien-être) :
 * l'accent et les surfaces que `useTheme` résout à partir de `activeMenu`. Une ligne par écran — un
 * onglet comme un écran empilé.
 *
 * Trois comportements (US IDENT-01, spec §4) :
 *  1. **à chaque focus**, l'écran pose son identité ;
 *  2. **un onglet seulement** se déclare aussi au premier plan (`focusedMenu`), et s'en retire à la
 *     perte de focus. C'est la règle de DASH-01 R4 (« `null` quand un écran empilé le recouvre ») :
 *     la barre d'état des onglets et les boucles décoratives (`useLoopActive`) en dépendent ;
 *  3. **un écran empilé** se déclare dès son montage, avant sa première image, et rend en partant
 *     l'identité qu'il a trouvée en arrivant.
 *
 * ── Pourquoi un écran empilé ne pose pas `focusedMenu` ───────────────────────────────────────────
 * Le `useFocusEffect` d'`expo-router` n'est pas celui de react-navigation : c'est une copie qui attend
 * `useOptionalNavigation()`, posée par un effet, donc au rendu **suivant** le montage. À la poussée,
 * le `blur` de l'écran du dessous passe donc **avant** la déclaration de l'écran empilé : quand celui-ci
 * posait `focusedMenu`, il le gardait tant qu'il était affiché, quelle que soit la porte — icônes de
 * barre d'état claires sur un fond clair, et la trace de l'onglet Course animée sous une course en cours.
 *
 * ── Pourquoi une pile ────────────────────────────────────────────────────────────────────────────
 * Un écran qui ne se déclare pas (Planning, Réglages, fiche d'un lien…) affiche l'identité laissée par
 * le précédent. Sans restitution, revenir d'un écran Nutrition laissait les Réglages en vert. Rendre
 * l'identité trouvée ne suffit pas à elle seule :
 *  - elle doit être lue **au montage**, pas au rendu : dans un `router.replace` (brief → séance, séance
 *    → fin de séance), React démonte le remplacé avant de monter le remplaçant, qui retrouve alors ce
 *    que le remplacé avait trouvé ;
 *  - quand plusieurs écrans se ferment d'un coup, l'ordre des démontages dépend de l'arbre (de bas en
 *    haut entre frères, mais une pile imbriquée peut partir avant ou après). Un écran qui n'est pas au
 *    sommet **lègue** donc son identité trouvée à l'écran juste au-dessus, et seul l'écran au sommet la
 *    rend : le résultat est juste quel que soit l'ordre.
 *
 * ⚠️ **Hypothèse** : l'effet de mise en page d'un écran n'est nettoyé qu'à son **démontage**. Le gel des
 * écrans masqués (`freezeOnBlur` / `enableFreeze` de react-native-screens, qui passent par Suspense),
 * `<Activity>` ou le préchargement d'un écran (`prefetch`) la casseraient : un écran gelé rendrait son
 * identité sans être parti, un écran préchargé s'empilerait sans être affiché. Rien de tout cela n'est
 * actif ; `pillar-identity.test.ts` échoue le jour où l'un apparaît dans `src/`.
 */
const pileEmpilee: { menu: MenuKey; trouvee: MenuKey }[] = [];

export function useMenuFocus(menu: MenuKey): void {
  const navigation = useNavigation();

  // `getState()` est lu dans les effets, jamais au rendu (react-navigation le déconseille).
  useLayoutEffect(() => {
    if (navigation.getState()?.type === 'tab') return;
    const store = useMenuAccent.getState();
    const entree = { menu, trouvee: store.activeMenu };
    pileEmpilee.push(entree);
    store.setActiveMenu(menu);
    return () => {
      const i = pileEmpilee.indexOf(entree);
      if (i === -1) return;
      pileEmpilee.splice(i, 1);
      const dessus = pileEmpilee[i];
      if (dessus) dessus.trouvee = entree.trouvee;
      else useMenuAccent.getState().setActiveMenu(entree.trouvee);
    };
  }, [navigation, menu]);

  useFocusEffect(
    useCallback(() => {
      const store = useMenuAccent.getState();
      store.setActiveMenu(menu);
      if (navigation.getState()?.type !== 'tab') return;
      store.setFocusedMenu(menu);
      // US DASH-01 (R4) : à la perte de focus, les boucles de la scène doivent s'arrêter.
      return () => useMenuAccent.getState().clearFocusedMenu(menu);
    }, [navigation, menu]),
  );
}
