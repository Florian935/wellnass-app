/**
 * L'état du clavier logiciel, réactif : ouvert ou non, sa hauteur, et **la position de son bord haut**.
 *
 * Successeur de `useKeyboardHeight` (recette MUSCU-UX01 §57.19, 11/09/2026), qui ne rendait que la
 * hauteur. La hauteur seule obligeait chaque écran à savoir ce qui le sépare du bas de la fenêtre
 * (barre d'onglets, en-tête, arête de safe area, feuille) — un correctif par écran. Le bord haut
 * (`screenY`), comparé au bas mesuré du conteneur, donne le recouvrement exact partout (US CLAV-01,
 * voir `keyboard-overlap.ts`).
 *
 * ── Ce que React Native envoie (RN 0.86, `ReactRootView.checkForKeyboardEvents`) ─────────────────
 * Sur Android : `height` = `ime.bottom − systemBars.bottom` (le clavier **au-dessus** de la barre de
 * navigation) et `screenY` = le bas de la zone visible de la fenêtre, c'est-à-dire le haut du clavier.
 * L'événement est réémis quand la hauteur change clavier ouvert (passage aux emoji, aux chiffres).
 */

import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent, type KeyboardMetrics } from 'react-native';

export type KeyboardFrame = {
  /** Le clavier est-il ouvert ? */
  visible: boolean;
  /** Hauteur du clavier (Android : au-dessus de la barre de navigation), 0 s'il est fermé. */
  height: number;
  /** Bord haut du clavier dans la fenêtre, 0 s'il est fermé. */
  screenY: number;
};

const CLOSED: KeyboardFrame = { visible: false, height: 0, screenY: 0 };

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

/** Le cadre d'un clavier ouvert, d'après ses métriques. */
export function frameFromMetrics(metrics: KeyboardMetrics | null | undefined): KeyboardFrame {
  if (!metrics || !(metrics.height > 0)) return CLOSED;
  return { visible: true, height: metrics.height, screenY: metrics.screenY };
}

function sameFrame(a: KeyboardFrame, b: KeyboardFrame): boolean {
  return a.visible === b.visible && a.height === b.height && a.screenY === b.screenY;
}

/**
 * L'état du clavier. **État initial lu dans `Keyboard`** : un conteneur monté alors que le clavier est
 * déjà ouvert (une feuille ouverte pendant qu'on tapait dans l'écran) le voit tout de suite.
 *
 * `animate` (iOS) : programme une `LayoutAnimation` à la durée du clavier avant la mise à jour, comme
 * le faisait `KeyboardAvoidingView`. `LayoutAnimation` est **globale** (elle anime toute la mise en page
 * du commit suivant) : seul un conteneur **actif** la demande, pas les passifs (revue du 23/10/2026).
 */
export function useKeyboardFrame(animate = false): KeyboardFrame {
  const [frame, setFrame] = useState<KeyboardFrame>(() =>
    Keyboard.isVisible() ? frameFromMetrics(Keyboard.metrics()) : CLOSED,
  );
  // Lu dans les écouteurs, abonnés une seule fois : la dernière valeur, sans se réabonner.
  const animateRef = useRef(animate);
  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  useEffect(() => {
    const { show: showEvent, hide: hideEvent } = keyboardEventNames(Platform.OS);

    const onShow = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
      // iOS : le décalage suit l'animation du clavier, comme le faisait `KeyboardAvoidingView`.
      // Android n'émet que `keyboardDidShow`, une fois le clavier ouvert : pas d'animation à suivre.
      if (Platform.OS === 'ios' && animateRef.current) Keyboard.scheduleLayoutAnimation(event);
      const next = frameFromMetrics(event.endCoordinates);
      // Garde d'idempotence : un événement réémis avec le même cadre ne re-rend pas.
      setFrame((current) => (sameFrame(current, next) ? current : next));
    });
    const onHide = Keyboard.addListener(hideEvent, (event: KeyboardEvent) => {
      if (Platform.OS === 'ios' && animateRef.current) Keyboard.scheduleLayoutAnimation(event);
      setFrame((current) => (sameFrame(current, CLOSED) ? current : CLOSED));
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  return frame;
}
