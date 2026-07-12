import { buildPaceYAxis } from '@wellness/shared';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '@/theme/useTheme';

type DataPoint = {
  label: string;
  value: number;
};

/** Nombre de gridlines de l'axe Y ; on génère `NO_OF_SECTIONS + 1` libellés (bornes incluses). */
const NO_OF_SECTIONS = 4;

type ProgressLineChartProps = {
  data: DataPoint[];
  title?: string;
  unit?: string;
  width?: number;
  /**
   * Opt-in : formate chaque libellé de l'axe Y (valeur brute → texte). Par défaut
   * `undefined` → axe Y numérique natif inchangé (usage muscu). Quand fourni, on
   * impose à la fois l'échelle tracée (`maxValue`/`yAxisOffset`/`stepValue`) ET les
   * libellés (`yAxisLabelTexts`) sur la même plage [min, max] — voir `buildPaceYAxis` —
   * pour que chaque point tombe pile sur son libellé (ex. allure en secondes → M:SS).
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

  // Axe Y formaté (opt-in) : on impose l'échelle À LA LIB en plus des libellés, sinon
  // gifted-charts trace sur son échelle 0→max et les libellés M:SS ne correspondent pas
  // aux points. `buildPaceYAxis` renvoie l'échelle ET les libellés sur la même plage.
  const yAxis = formatYLabel
    ? buildPaceYAxis(chartData.map((d) => d.value), NO_OF_SECTIONS, formatYLabel)
    : null;

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
        {...(yAxis
          ? {
              maxValue: yAxis.maxValue,
              yAxisOffset: yAxis.yAxisOffset,
              stepValue: yAxis.stepValue,
              yAxisLabelTexts: yAxis.labels,
            }
          : {})}
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
