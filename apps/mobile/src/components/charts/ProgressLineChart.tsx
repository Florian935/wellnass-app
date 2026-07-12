import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '@/theme/useTheme';

type DataPoint = {
  label: string;
  value: number;
};

const NO_OF_SECTIONS = 4;

type ProgressLineChartProps = {
  data: DataPoint[];
  title?: string;
  unit?: string;
  width?: number;
  /**
   * Opt-in : formate chaque libellé de l'axe Y (valeur brute → texte). Par défaut
   * `undefined` → axe Y numérique natif inchangé (usage muscu). Quand fourni, on
   * construit `noOfSections + 1` graduations réparties sur [min(value), max(value)]
   * et on les formate (ex. allure en secondes → M:SS).
   */
  formatYLabel?: (value: number) => string;
};

/**
 * Courbe de progression thémée — wraps LineChart de react-native-gifted-charts.
 * Composant présentationnel : aucune récupération de données.
 * Si `data` est vide, rend null.
 */
export function ProgressLineChart({ data, title, unit, width, formatYLabel }: ProgressLineChartProps) {
  const { colors } = useTheme();

  if (data.length === 0) return null;

  const chartWidth = width ?? Dimensions.get('window').width - 48;

  const chartData = data.map((point) => ({
    value: point.value,
    label: point.label,
  }));

  // Libellés d'axe Y formatés (opt-in) : noOfSections + 1 graduations réparties
  // linéairement de min à max des valeurs, puis formatées via `formatYLabel`.
  let yAxisLabelTexts: string[] | undefined;
  if (formatYLabel) {
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (max - min) / NO_OF_SECTIONS;
    yAxisLabelTexts = Array.from({ length: NO_OF_SECTIONS + 1 }, (_, i) =>
      formatYLabel(min + step * i),
    );
  }

  return (
    <View style={styles.container}>
      {title ? (
        <Text style={[styles.title, { color: colors.text }]}>
          {title}
          {unit ? ` (${unit})` : ''}
        </Text>
      ) : null}
      <LineChart
        data={chartData}
        width={chartWidth}
        color={colors.accent}
        dataPointsColor={colors.accent}
        startFillColor={colors.accent}
        endFillColor={colors.surface}
        startOpacity={0.25}
        endOpacity={0.02}
        areaChart
        curved
        hideRules={false}
        rulesColor={colors.border}
        xAxisColor={colors.border}
        yAxisColor={colors.border}
        xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 11 }}
        yAxisTextStyle={{ color: colors.textMuted, fontSize: 11 }}
        backgroundColor={colors.surface}
        noOfSections={NO_OF_SECTIONS}
        yAxisLabelTexts={yAxisLabelTexts}
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
