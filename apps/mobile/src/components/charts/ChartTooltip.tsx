import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';

type ChartTooltipProps = {
  /** Ligne 1 : date complète (JJ/MM/AAAA), ou libellé d'axe si le point n'est pas daté (groupe musculaire). */
  heading: string;
  /** Ligne 2 : valeur **déjà formatée** (via `formatTooltipValue`) — le composant ne calcule rien. */
  value: string;
};

/**
 * Infobulle de graphique — **partagée** par la courbe et l'histogramme (US UX-01), pour n'avoir qu'un
 * seul rendu à maintenir. Purement présentationnelle : aucun accès aux données, aucun calcul.
 *
 * `maxWidth` + `numberOfLines` bornent la bulle : elle ne doit jamais s'étaler au point de sortir de la
 * carte (tout le travail de largeur mesurée des deux graphiques existe pour éviter les débordements).
 * La taille de police n'est pas verrouillée : avec le Dynamic Type (9.11), on préfère une bulle qui
 * grandit à un texte tronqué.
 */
export function ChartTooltip({ heading, value }: ChartTooltipProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
      // Lu comme un seul bloc par les lecteurs d'écran (« 12/07/2026, 82,5 kg ») plutôt que deux
      // fragments successifs.
      accessible
      accessibilityLabel={`${heading}, ${value}`}
    >
      <Text style={[styles.heading, { color: colors.textMuted }]} numberOfLines={1}>
        {heading}
      </Text>
      <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 150,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    // Ombre discrète : la bulle doit se détacher du tracé sans écraser le graphique.
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heading: {
    fontSize: 11,
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    fontWeight: '800',
  },
});
