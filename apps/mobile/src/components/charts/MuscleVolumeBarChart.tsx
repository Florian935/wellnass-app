import { formatTooltipValue } from '@wellness/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { useTheme } from '@/theme/useTheme';

type DataPoint = {
  label: string;
  value: number;
  color?: string;
  /**
   * Libellé riche affiché en en-tête de l'infobulle (date complète JJ/MM/AAAA). Optionnel : sur les
   * histogrammes musculaires, `label` est déjà le bon en-tête (nom du groupe), donc laissé vide.
   */
  detail?: string;
};

type MuscleVolumeBarChartProps = {
  data: DataPoint[];
  title?: string;
  unit?: string;
  width?: number;
};

/**
 * Largeur réservée à l'axe Y + marge de fin (px). Comme pour la courbe, l'axe Y de
 * `react-native-gifted-charts` est rendu HORS de `width` (empreinte totale =
 * `yAxisLabelWidth + width + endSpacing`) : on mesure le conteneur et on déduit
 * `width` pour tenir dans la carte sans déborder à droite.
 */
const Y_AXIS_LABEL_WIDTH = 44;
const END_SPACING = 12;

/** Largeur de repli avant la 1ᵉʳ mesure `onLayout` (écran − paddings usuels 20+18 ×2). */
const FALLBACK_OUTER_WIDTH = Dimensions.get('window').width - 2 * (20 + 18);

/**
 * Histogramme de volume musculaire thémé — wraps BarChart de react-native-gifted-charts.
 * Composant présentationnel : aucune récupération de données.
 * Si `data` est vide, rend null.
 */
export function MuscleVolumeBarChart({ data, title, unit, width }: MuscleVolumeBarChartProps) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  if (data.length === 0) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 0 && w !== containerWidth) setContainerWidth(w);
  };

  const outerWidth = width ?? containerWidth ?? FALLBACK_OUTER_WIDTH;
  const chartWidth = Math.max(0, outerWidth - Y_AXIS_LABEL_WIDTH - END_SPACING);

  // `detail` propagé pour que `renderTooltip` y ait accès (même écueil que la courbe).
  const chartData = data.map((point) => ({
    value: point.value,
    label: point.label,
    detail: point.detail,
    frontColor: point.color ?? colors.accent,
    topLabelTextStyle: { color: colors.textMuted, fontSize: 10 },
  }));

  return (
    <View style={styles.container} onLayout={onLayout}>
      {title ? (
        <Text style={[styles.title, { color: colors.text }]}>
          {title}
          {unit ? ` (${unit})` : ''}
        </Text>
      ) : null}
      <BarChart
        data={chartData}
        width={chartWidth}
        yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
        endSpacing={END_SPACING}
        barBorderRadius={6}
        rulesColor={colors.border}
        xAxisColor={colors.border}
        yAxisColor={colors.border}
        xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 11 }}
        yAxisTextStyle={{ color: colors.textMuted, fontSize: 11 }}
        backgroundColor={colors.surface}
        noOfSections={4}
        // Tap sur une barre → infobulle persistante (US UX-01), même composant que la courbe.
        //
        // ⚠️ Volontairement SANS `focusedBarConfig` : l'équilibre musculaire code du **sens** dans la
        // couleur de chaque barre (délaissé = doré, équilibré = bordeaux, sur-représenté = grisé), et
        // `FocusedBarConfig` n'offre qu'un aplat (`color`/`opacity`/`gradientColor`) — pas de contour.
        // Repeindre la barre focalisée écraserait donc la sémantique, ce que la spec interdit
        // explicitement. Le retour visuel est l'infobulle, ancrée au-dessus de la barre tapée.
        focusBarOnPress
        renderTooltip={(item: { value: number; label: string; detail?: string }) => (
          <ChartTooltip
            heading={item.detail ?? item.label}
            value={formatTooltipValue(item.value, { unit, locale: i18n.language })}
          />
        )}
        isAnimated
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
});
