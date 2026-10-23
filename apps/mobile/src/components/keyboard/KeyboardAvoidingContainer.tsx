/**
 * US CLAV-01 — **le** conteneur d'évitement du clavier. Toute surface où l'on tape est posée dedans —
 * directement, par `KeyboardAwareScrollView`, ou par une enveloppe (`FormScreen`, `OnboardingScaffold`,
 * `StageScrollView`). Un test-garde l'impose (`__tests__/keyboard-coverage-guard.test.ts`).
 *
 * Une colonne : ses enfants rétrécissent quand il pose en bas **exactement** ce que le clavier recouvre
 * de lui (`keyboard-overlap.ts`). Un `ScrollView` qui rétrécit fait défiler, sur Android, le champ qui a
 * le focus pour le garder visible (`ScrollView.onSizeChanged`) : c'est ce qui rendait `adjustResize`
 * confortable avant l'edge-to-edge, et c'est retrouvé sans une ligne de défilement.
 *
 * ── Deux règles d'emploi ────────────────────────────────────────────────────────────────────────
 * - **Un seul conteneur actif par fenêtre et par branche.** Un conteneur posé dans un autre conteneur
 *   de la même fenêtre est passif : c'est le plus extérieur qui décale. Sans cela, deux conteneurs
 *   mesureraient en même temps, décaleraient deux fois, puis sauteraient (`TemplateComposer` dans la
 *   colonne « composeur + pied fixe » des modèles).
 * - **`kind="sheet"` ouvre une autre fenêtre.** Le conteneur posé en premier enfant d'une `Modal` est
 *   toujours actif et repart d'un contexte neuf. Une `Modal` React Native n'est **pas** un portail : le
 *   contexte la traverse, et plusieurs feuilles sont rendues dans un conteneur d'écran. Sans
 *   `kind="sheet"`, elles deviendraient passives — en silence.
 *
 * Clavier fermé, le conteneur ne change rien : son padding bas est celui de l'appelant (plus l'inset
 * bas, avec `safeAreaBottom`, qui rend exactement l'arête qu'il remplace).
 */

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomPadding, keyboardOverlap, resolveBottomPadding } from './keyboard-overlap';
import { useKeyboardFrame } from './useKeyboardFrame';
import { useMeasuredBottom } from './useMeasuredBottom';

/** Vrai dans un conteneur de la même fenêtre : le conteneur intérieur est alors passif. */
const InsideKeyboardContainer = createContext(false);

export type KeyboardAvoidingContainerProps = ViewProps & {
  children?: ReactNode;
  /**
   * `'screen'` (défaut) : un écran, ou une colonne dans un écran. `'sheet'` : le premier enfant d'une
   * `Modal` — une autre fenêtre, toujours active.
   */
  kind?: 'screen' | 'sheet';
  /**
   * Reprend l'arête basse d'un `SafeAreaView` : padding bas = `max(inset, recouvrement)`. Seulement
   * quand l'arête était posée **juste autour** de la colonne (`FormScreen`, pied fixe des modèles,
   * séance). Faux par défaut : partout ailleurs, la mesure suffit.
   */
  safeAreaBottom?: boolean;
  /** Faux : le conteneur ne décale plus (défaut : vrai). */
  enabled?: boolean;
};

export function KeyboardAvoidingContainer({
  children,
  kind = 'screen',
  safeAreaBottom = false,
  enabled = true,
  style,
  onLayout,
  ...viewProps
}: KeyboardAvoidingContainerProps) {
  const nested = useContext(InsideKeyboardContainer);
  const active = enabled && (kind === 'sheet' || !nested);

  const ref = useRef<View>(null);
  const frame = useKeyboardFrame(active);
  const insets = useSafeAreaInsets();
  const { top, bottom, measure } = useMeasuredBottom(ref);

  // Remesure à chaque ouverture (et changement de hauteur) du clavier : un écran a pu défiler, une
  // feuille glisser, depuis la dernière mise en page.
  useEffect(() => {
    if (active && frame.visible) measure();
  }, [active, frame.visible, frame.screenY, measure]);

  const flat = StyleSheet.flatten([styles.column, style]);
  const overlap = active
    ? keyboardOverlap({
        containerTop: top,
        containerBottom: bottom,
        keyboardTop: frame.screenY,
        visible: frame.visible,
      })
    : 0;
  const paddingBottom = bottomPadding({
    base: resolveBottomPadding(flat),
    overlap,
    safeAreaBottom,
    // Passif, clavier ouvert : c'est le conteneur extérieur qui décale — garder l'inset ici le
    // doublerait d'autant (revue du 23/10/2026).
    inset: !active && frame.visible ? 0 : insets.bottom,
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    if (active) measure();
    onLayout?.(event);
  };

  return (
    <InsideKeyboardContainer.Provider value>
      {/* `ref` après la décomposition : un `ref` passé en prop (React 19) n'écrase pas celui de la mesure. */}
      <View {...viewProps} ref={ref} style={[flat, { paddingBottom }]} onLayout={handleLayout}>
        {children}
      </View>
    </InsideKeyboardContainer.Provider>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1 },
});
