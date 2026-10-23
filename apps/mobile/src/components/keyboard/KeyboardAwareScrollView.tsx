/**
 * US CLAV-01 — un `ScrollView` de formulaire, posé dans le conteneur d'évitement du clavier.
 *
 * Remplace un `ScrollView` **sans toucher à son style** : toutes ses props et sa `ref` lui sont
 * transmises ; son fond est repris par le conteneur (la zone de padding, sous le clavier, ne doit pas
 * paraître d'une autre couleur pendant que le clavier descend — Android n'émet `keyboardDidHide`
 * qu'après l'animation).
 *
 * `keyboardShouldPersistTaps="handled"` est **imposé** (décision D8) : sans lui, le premier appui sur
 * « Enregistrer » clavier ouvert ferme le clavier **sans enregistrer**. Un appelant qui passerait
 * `"never"` est volontairement ignoré.
 */

import { forwardRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  KeyboardAvoidingContainer,
  type KeyboardAvoidingContainerProps,
} from './KeyboardAvoidingContainer';

export type KeyboardAwareScrollViewProps = ScrollViewProps & {
  kind?: KeyboardAvoidingContainerProps['kind'];
  safeAreaBottom?: KeyboardAvoidingContainerProps['safeAreaBottom'];
  /** Style du conteneur (le `style` reste celui du `ScrollView`). */
  containerStyle?: StyleProp<ViewStyle>;
};

export const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  function KeyboardAwareScrollView(
    {
      kind,
      safeAreaBottom,
      containerStyle,
      style,
      keyboardShouldPersistTaps: _ignored,
      ...scrollProps
    },
    ref,
  ) {
    const backgroundColor = StyleSheet.flatten(style)?.backgroundColor;
    return (
      <KeyboardAvoidingContainer
        kind={kind}
        safeAreaBottom={safeAreaBottom}
        style={[backgroundColor != null ? { backgroundColor } : null, containerStyle]}
      >
        <ScrollView ref={ref} {...scrollProps} style={style} keyboardShouldPersistTaps="handled" />
      </KeyboardAvoidingContainer>
    );
  },
);
