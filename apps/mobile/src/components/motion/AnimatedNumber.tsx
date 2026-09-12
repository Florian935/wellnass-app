/**
 * Un nombre qui **transite** vers sa nouvelle valeur au lieu de la remplacer.
 *
 * ── Pourquoi ça compte ici plus qu'ailleurs ────────────────────────────────────────────────────
 * Règle R5 de la spec : *une valeur animée part de la précédente, jamais de zéro*. Le bilan
 * calorique en est l'illustration — si l'anneau et le chiffre repartaient de 0 à chaque ajout
 * d'aliment, ils cacheraient précisément ce qu'on cherche à montrer : **la portion qu'on vient
 * d'ajouter**. En transitant de 1 460 à 1 715, le chiffre dit « +255 » sans l'écrire.
 *
 * ── Pourquoi un `TextInput` et pas un `Text` ───────────────────────────────────────────────────
 * Règle R3 : aucun `setState` par image. Un `Text` dont le contenu vient de l'état React impose un
 * rendu JS à chaque frame — à 60 Hz, sur l'écran de séance, c'est exactement ce qui ferait ramer
 * l'écran qu'on voulait embellir.
 *
 * `TextInput` est le seul composant du cœur de React Native dont le **contenu** est pilotable
 * depuis le thread UI (`useAnimatedProps` → `text`). C'est le patron officiel de Reanimated pour ce
 * cas. Il est mis en lecture seule, sans bordure ni rembourrage, et se comporte visuellement comme
 * un `Text`.
 *
 * ── Accessibilité ───────────────────────────────────────────────────────────────────────────────
 * Un lecteur d'écran ne doit surtout pas annoncer un **champ de saisie**, ni lire quarante valeurs
 * intermédiaires. Le `TextInput` est donc masqué à l'accessibilité, et c'est la `View` parente qui
 * porte le rôle `text` et la **valeur d'arrivée** formatée. L'annonce est donc juste et unique.
 *
 * ── Formatage ───────────────────────────────────────────────────────────────────────────────────
 * Fait **dans le worklet**, donc pas de fonction injectée : une fonction JS passée en prop ne peut
 * pas s'exécuter sur le thread UI. Les options couvrent les usages réels de l'app (calories,
 * tonnage, série de jours, poids) ; un besoin exotique afficherait un `Text` ordinaire.
 */

import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { DURATION, EASING } from '@/theme/motion';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Formate un nombre côté worklet. Réimplémenté ici parce que `Intl` n'est pas disponible sur le
 * thread UI — et parce que le séparateur de milliers de l'app est **l'espace fine**, celui de la
 * typographie française, pas la virgule.
 */
function formatOnUi(value: number, decimals: number, grouping: boolean): string {
  'worklet';
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = Math.abs(safe).toFixed(decimals);
  const [intPart = '0', decPart] = fixed.split('.');
  let grouped = intPart;
  if (grouping && intPart.length > 3) {
    grouped = '';
    for (let i = 0; i < intPart.length; i += 1) {
      // Un espace tous les trois chiffres **en partant de la droite** : la position d'insertion
      // dépend donc du reste de la division, pas de l'index brut.
      if (i > 0 && (intPart.length - i) % 3 === 0) grouped += ' ';
      grouped += intPart[i];
    }
  }
  const sign = safe < 0 ? '-' : '';
  // Le séparateur décimal français est la virgule — cohérent avec le reste de l'app.
  return decPart ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
}

type AnimatedNumberProps = {
  /** Valeur cible. Le composant anime **depuis la précédente**. */
  value: number;
  /** Décimales affichées. Défaut 0 (calories, répétitions, jours). */
  decimals?: number;
  /** Espace fine tous les trois chiffres. Défaut `true`. */
  grouping?: boolean;
  /** Durée de la transition. Défaut `DURATION.data`. */
  duration?: number;
  style?: StyleProp<TextStyle>;
  /**
   * Nom accessible complet, valeur comprise (« 1 715 calories sur 2 250 »). Sans lui, la `View`
   * annonce la seule valeur formatée — suffisant quand le libellé voisin porte déjà le sens.
   */
  accessibilityLabel?: string;
  /** Posé sur le champ porteur du chiffre, pour les tests et les repères de recette. */
  testID?: string;
};

export function AnimatedNumber({
  value,
  decimals = 0,
  grouping = true,
  duration = DURATION.data,
  style,
  accessibilityLabel,
  testID,
}: AnimatedNumberProps) {
  const reduced = useAppReducedMotion();
  const progress = useSharedValue(value);

  useEffect(() => {
    if (reduced) {
      // État final immédiat — règle R1 : l'animation ne portait aucune information.
      progress.value = value;
      return;
    }
    const config: WithTimingConfig = { duration, easing: EASING.fill };
    progress.value = withTiming(value, config);
  }, [decimals, duration, progress, reduced, value]);

  const text = useDerivedValue(() => formatOnUi(progress.value, decimals, grouping));

  // `text` est une propriété **native** du `TextInput` (Android comme iOS) mais n'est pas déclarée
  // dans `TextInputProps` : React Native ne l'expose pas côté JS, on ne l'atteint que par
  // `setNativeProps` — c'est-à-dire exactement ce que fait `animatedProps`. D'où l'assertion :
  // elle ne masque pas une erreur, elle nomme une prop que les types ne connaissent pas.
  const animatedProps = useAnimatedProps(
    () => ({ text: text.value, defaultValue: text.value }) as Partial<TextInputProps>,
  );

  // La valeur d'arrivée, formatée côté JS, sert à l'annonce du lecteur d'écran : jamais les
  // valeurs intermédiaires.
  const settled = formatOnUi(value, decimals, grouping);

  return (
    <View accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? settled}>
      <AnimatedTextInput
        testID={testID}
        editable={false}
        // Pas de `value` : il figerait le contenu côté JS et annulerait la piste d'animation.
        defaultValue={settled}
        animatedProps={animatedProps}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.field, style]}
        // Empêche toute interaction : ça reste un affichage, pas un champ.
        pointerEvents="none"
        underlineColorAndroid="transparent"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Un `TextInput` arrive avec un rembourrage et une hauteur de ligne propres à la plateforme :
  // sans cette remise à zéro, le chiffre ne s'aligne pas sur les `Text` voisins.
  field: { padding: 0, margin: 0, includeFontPadding: false, textAlignVertical: 'center' },
});
