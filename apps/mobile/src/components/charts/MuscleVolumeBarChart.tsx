import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTheme } from '@/theme/useTheme';

type DataPoint = {
  label: string;
  value: number;
  color?: string;
};

type MuscleVolumeBarChartProps = {
  data: DataPoint[];
  title?: string;
  unit?: string;
  width?: number;
};

/**
 * Histogramme de volume musculaire thémé — wraps BarChart de react-native-gifted-charts.
 * Composant présentationnel : aucune récupération de données.
 * Si `data` est vide, rend null.
 */
export function MuscleVolumeBarChart({ data, title, unit, width }: MuscleVolumeBarChartProps) {
  const { colors } = useTheme();

  if (data.length === 0) return null;

  const chartWidth = width ?? Dimensions.get('window').width - 48;

  const chartData = data.map((point) => ({
    value: point.value,
    label: point.label,
    frontColor: point.color ?? colors.accent,
    topLabelTextStyle: { color: colors.textMuted, fontSize: 10 },
  }));

  return (
    <View style={styles.container}>
      {title ? (
        <Text style={[styles.title, { color: colors.text }]}>
          {title}
          {unit ? ` (${unit})` : ''}
        </Text>
      ) : null}
      <BarChart
        data={chartData}
        width={chartWidth}
        barBorderRadius={6}
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
