/**
 * Hauteur du clavier logiciel, en points, réactive — `0` quand il est fermé.
 *
 * ── Le bug que ce hook corrige (recette MUSCU-UX01 §57.19, 11/09/2026) ──────────────────────────
 * L'écran de séance pose sa barre d'action en **bas du flux** (`SafeAreaView` en colonne :
 * en-tête, `ScrollView` en `flex: 1`, barre). Ce montage est correct, et il suffisait **tant que
 * `android:windowSoftInputMode="adjustResize"` redimensionnait réellement la fenêtre** : le
 * `ScrollView` rétrécissait, la barre remontait, tout le monde était content.
 *
 * Ce n'est plus le cas. Depuis Expo SDK 54, l'**edge-to-edge est forcé** sur Android (l'option
 * `edgeToEdgeEnabled` a disparu) : l'app dessine sous les barres système, la fenêtre **ne se
 * redimensionne plus**, et le clavier vient simplement **se superposer** au contenu. Le manifeste
 * porte toujours `adjustResize` — il ne ment pas, il n'a plus d'effet. Résultat : la barre de
 * saisie passe *sous* le clavier, et on tape une charge sans voir ce qu'on tape.
 *
 * C'est exactement le défaut que l'US MUSCU-UX01 était censée corriger, et la raison pour laquelle
 * il a survécu : la barre collante a bien été livrée, mais le décalage clavier ne l'a jamais été.
 *
 * ── Pourquoi ce hook plutôt que `KeyboardAvoidingView` ──────────────────────────────────────────
 * `KeyboardAvoidingView` est utilisé ailleurs dans l'app (`FormScreen`, les modales d'exercice)
 * avec `behavior` **non défini sur Android** — c'est-à-dire sans effet, puisqu'il comptait lui
 * aussi sur `adjustResize`. Lui passer `behavior="padding"` fonctionnerait, mais il faudrait
 * envelopper l'écran de séance dans un conteneur supplémentaire dont le `flex` interagit avec le
 * `ScrollView` et la barre — pour le même résultat qu'un `paddingBottom`.
 *
 * Un hook rend la valeur explicite et réutilisable : l'appelant décide **quoi** décaler.
 *
 * ── Les événements à écouter ────────────────────────────────────────────────────────────────────
 * `keyboardDidShow` / `keyboardDidHide` sur Android (les variantes `Will*` n'y sont **pas**
 * émises), `keyboardWillShow` / `keyboardWillHide` sur iOS où elles arrivent en même temps que
 * l'animation — d'où un décalage synchrone plutôt qu'un saut après coup.
 */

import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * Les deux événements à écouter pour une plateforme donnée.
 *
 * Exportée pour être testée seule : c'est la seule vraie connaissance de ce module, et la seule
 * qu'on puisse se tromper en modifiant.
 */
export function keyboardEventNames(os: typeof Platform.OS): {
  show: 'keyboardWillShow' | 'keyboardDidShow';
  hide: 'keyboardWillHide' | 'keyboardDidHide';
} {
  // iOS émet les `Will*` en amont de l'animation ; Android ne les émet **pas du tout**. S'abonner
  // à `keyboardWillShow` sur Android revient donc à ne rien écouter — en silence.
  return os === 'ios'
    ? { show: 'keyboardWillShow', hide: 'keyboardWillHide' }
    : { show: 'keyboardDidShow', hide: 'keyboardDidHide' };
}

/**
 * Hauteur occupée par le clavier logiciel, `0` s'il est fermé.
 *
 * À appliquer en `paddingBottom` (ou `marginBottom`) sur le conteneur qui doit rester visible.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const { show: showEvent, hide: hideEvent } = keyboardEventNames(Platform.OS);

    const onShow = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
      // Garde d'idempotence : un changement de disposition du clavier (passage aux emoji, aux
      // chiffres) ré-émet l'événement avec la même hauteur — inutile de re-rendre pour ça.
      const next = event.endCoordinates?.height ?? 0;
      setHeight((current) => (current === next ? current : next));
    });
    const onHide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  return height;
}
