/**
 * Vignette de catégorie d'une ligne de résultat (US NUTRI-UX01, E4).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * Les listes d'aliments n'avaient **ni vignette, ni couleur** : quatre-vingts lignes de texte
 * strictement identiques, que l'œil devait lire une à une. Une icône par famille rend la liste
 * balayable — on repère « une viande » avant d'avoir lu le mot.
 *
 * Icônes tracées (`Ionicons`), jamais d'emoji : elles se recolorent avec le thème et restent
 * nettes à toute taille. C'est aussi ce qui manquait aux en-têtes de repas, où deux repas sur
 * cinq affichaient la même assiette 🍽️ faute de glyphe distinct.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';

/** Icône par catégorie d'aliment — les 9 valeurs de `foods.category`. */
const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  meat: 'restaurant-outline',
  fish: 'fish-outline',
  starchy: 'pizza-outline',
  vegetables: 'leaf-outline',
  fruits: 'nutrition-outline',
  dairy: 'water-outline',
  nuts: 'egg-outline',
  drinks: 'cafe-outline',
  other: 'ellipsis-horizontal',
};

export function CategoryGlyph({
  kind,
  category,
  size = 38,
}: {
  kind: 'food' | 'recipe' | 'template';
  category: string | null;
  size?: number;
}) {
  const { colors } = useTheme();

  const icon: keyof typeof Ionicons.glyphMap =
    kind === 'recipe'
      ? 'book-outline'
      : kind === 'template'
        ? 'albums-outline'
        : (CATEGORY_ICON[category ?? 'other'] ?? 'ellipsis-horizontal');

  // Recettes et repas types se distinguent des aliments par leur fond, pas seulement par
  // l'icône : la famille doit se lire même quand la liste défile vite.
  const background = kind === 'food' ? colors.track : colors.surfaceAlt;

  return (
    <View
      style={[
        styles.glyph,
        { width: size, height: size, borderRadius: size / 3, backgroundColor: background },
      ]}
    >
      <Ionicons name={icon} size={Math.round(size / 2)} color={colors.accent} />
    </View>
  );
}

/** Variante compacte pour les en-têtes de repas — même vocabulaire visuel, sans catégorie. */
export function MealGlyph({ mealKey, size = 26 }: { mealKey: string; size?: number }) {
  const { colors } = useTheme();
  const icon: keyof typeof Ionicons.glyphMap =
    mealKey === 'breakfast'
      ? 'sunny-outline'
      : mealKey === 'lunch'
        ? 'restaurant-outline'
        : mealKey === 'dinner'
          ? 'moon-outline'
          : mealKey === 'snack'
            ? 'nutrition-outline'
            : 'ellipse-outline';
  return (
    <View
      style={[
        styles.glyph,
        { width: size, height: size, borderRadius: size / 3, backgroundColor: colors.surfaceAlt },
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.58)} color={colors.accent} />
    </View>
  );
}

/** Repli textuel, utilisé là où une icône n'est pas disponible. */
export function GlyphFallback({ label }: { label: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textMuted }}>{label}</Text>;
}

const styles = StyleSheet.create({
  glyph: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
