import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '@/theme/useTheme';

type DataPoint = {
  label: string;
  value: number;
};

type ProgressLineChartProps = {
  data: DataPoint[];
  title?: string;
  unit?: string;
  width?: number;
};

/**
 * Courbe de progression thémée — wraps LineChart de react-native-gifted-charts.
 * Composant présentationnel : aucune récupération de données.
 * Si `data` est vide, rend null.
 */
export function ProgressLineChart({ data, title, unit, width }: ProgressLineChartProps) {
  const { colors } = useTheme();

  if (data.length === 0) return null;

  const chartWidth = width ?? Dimensions.get('window').width - 48;

  const chartData = data.map((point) => ({
    value: point.value,
    label: point.label,
  }));

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
        noOfSections={4}
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
