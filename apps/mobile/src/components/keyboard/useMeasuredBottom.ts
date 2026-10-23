/**
 * Le bas d'une vue **dans sa fenêtre**, mesuré — la moitié « conteneur » du recouvrement
 * (`keyboard-overlap.ts`), l'autre étant le bord haut du clavier.
 *
 * ── Pourquoi la mesure est juste, même sous un en-tête natif ────────────────────────────────────
 * `measureInWindow` rend la position dans la fenêtre de la vue. Sous un en-tête natif Android, elle
 * n'est juste que parce que react-native-screens corrige l'origine de l'écran dans l'arbre d'ombre
 * (`RNSScreenShadowNode::applyFrameCorrections`, reportée aux descendants par
 * `getContentOriginOffset`). Dans une `Modal`, la mesure s'arrête à la fenêtre du `Dialog` — plein
 * écran en edge-to-edge (RN force `statusBarTranslucent` / `navigationBarTranslucent`), donc juste
 * aussi. C'est la prémisse de la règle (spec CLAV-01 §1.5), recettée par les écrans sous en-tête.
 *
 * Module à part pour être **simulé** dans les tests de rendu : sous Jest, la mesure native ne rappelle
 * jamais.
 */

import { useCallback, useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';

/**
 * Haut et bas de la vue `ref` dans sa fenêtre, et la fonction qui les remesure.
 *
 * Tant que rien n'est mesuré, le bas du **cadre de l'app** (`useSafeAreaFrame`) — pas
 * `useWindowDimensions` : la fenêtre de React Native exclut la barre de navigation sur certaines
 * versions d'Android, alors que l'app dessine dessous. Clavier fermé, cette valeur n'a aucun effet.
 */
export function useMeasuredBottom(ref: RefObject<View | null>): {
  /** Haut de la vue dans sa fenêtre (repli : le haut du cadre de l'app). */
  top: number;
  bottom: number;
  measure: () => void;
} {
  const appFrame = useSafeAreaFrame();
  const [measured, setMeasured] = useState<{ top: number; bottom: number } | null>(null);

  const measure = useCallback(() => {
    // `?.` deux fois : la `ref` peut être nulle (démontage, Jest), et la méthode absente d'un mock.
    ref.current?.measureInWindow?.((_x, y, _width, height) => {
      const bottom = y + height;
      if (!Number.isFinite(y) || !Number.isFinite(bottom)) return;
      setMeasured((current) =>
        current?.top === y && current.bottom === bottom ? current : { top: y, bottom },
      );
    });
  }, [ref]);

  return {
    top: measured?.top ?? appFrame.y,
    bottom: measured?.bottom ?? appFrame.y + appFrame.height,
    measure,
  };
}
