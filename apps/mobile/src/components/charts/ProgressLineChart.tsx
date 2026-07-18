import { buildPaceYAxis, movingAverage } from '@wellness/shared';
import { useState } from 'react';
import { Dimensions, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '@/theme/useTheme';

type DataPoint = {
  label: string;
  value: number;
};

/** Nombre de gridlines de l'axe Y ; on génère `NO_OF_SECTIONS + 1` libellés (bornes incluses). */
const NO_OF_SECTIONS = 4;

/**
 * Largeur réservée aux libellés de l'axe Y et à la marge de fin (px). Dans
 * `react-native-gifted-charts`, l'axe Y est rendu à GAUCHE, HORS de la prop `width`
 * (empreinte totale = `yAxisLabelWidth + width + endSpacing`). On fixe donc ces deux
 * valeurs et on déduit `width = largeur mesurée − axe Y − marge` pour que le graphe
 * tienne exactement dans sa carte (jamais de débordement). 44 px suffisent à ~5
 * chiffres (« 12500 ») + une valeur d'allure « M:SS ».
 */
const Y_AXIS_LABEL_WIDTH = 44;
const END_SPACING = 12;

/**
 * Largeur de repli au tout premier rendu, avant que `onLayout` n'ait mesuré le
 * conteneur : largeur d'écran moins les paddings usuels (écran 20 + carte 18, ×2).
 * Corrigée dès la première mesure ; évite un graphe non monté (et garde le test
 * smoke vert, `onLayout` ne se déclenchant pas en environnement de test).
 */
const FALLBACK_OUTER_WIDTH = Dimensions.get('window').width - 2 * (20 + 18);

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
  /**
   * Opt-in : superpose la courbe brute (estompée, sans zone) et la courbe lissée
   * (accentuée, avec zone) calculée via `movingAverage`. Défaut `false` → rendu
   * strictement identique à la courbe brute seule. Sans effet si la série a moins de
   * 4 points (repli automatique sur le rendu brut).
   */
  smooth?: boolean;
};

/** Fenêtre de lissage auto : impaire, bornée [3,7], selon la longueur de série. */
function autoSmoothWindow(length: number): number {
  const rounded = Math.round(length / 5);
  const odd = rounded % 2 === 1 ? rounded : rounded + 1;
  return Math.min(7, Math.max(3, odd));
}

/**
 * Courbe de progression thémée — wraps LineChart de react-native-gifted-charts.
 * Composant présentationnel : aucune récupération de données.
 * Si `data` est vide, rend null.
 */
export function ProgressLineChart({
  data,
  title,
  unit,
  width,
  formatYLabel,
  smooth,
}: ProgressLineChartProps) {
  const { colors } = useTheme();
  // Largeur réelle du conteneur (mesurée), pour ne jamais déborder de la carte.
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  if (data.length === 0) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 0 && w !== containerWidth) setContainerWidth(w);
  };

  // Empreinte = axe Y + tracé + marge de fin. On répartit la largeur disponible
  // (prop explicite > mesure du conteneur > repli au 1ᵉʳ rendu avant onLayout).
  const outerWidth = width ?? containerWidth ?? FALLBACK_OUTER_WIDTH;
  const chartWidth = Math.max(0, outerWidth - Y_AXIS_LABEL_WIDTH - END_SPACING);

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

  // Overlay lissé (opt-in) : le brut garde l'échelle (yAxis ci-dessus, calculé sur le
  // brut) ; on repose la série lissée sur le même axe. Repli silencieux sur le brut seul
  // si la série est trop courte pour qu'une moyenne mobile ait du sens.
  const canSmooth = smooth === true && chartData.length >= 4;
  const smoothedData = canSmooth
    ? movingAverage(chartData.map((d) => d.value), autoSmoothWindow(chartData.length)).map(
        (value, i) => ({
          value,
          label: chartData[i]!.label,
        }),
      )
    : null;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {title ? (
        <Text style={[styles.title, { color: colors.text }]}>
          {title}
          {unit ? ` (${unit})` : ''}
        </Text>
      ) : null}
      <LineChart
        data={chartData}
        width={chartWidth}
        yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
        endSpacing={END_SPACING}
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
        {...(smoothedData
          ? {
              data2: smoothedData,
              color1: colors.textMuted,
              dataPointsColor1: colors.textMuted,
              areaChart1: false,
              color2: colors.accent,
              dataPointsColor2: colors.accent,
              areaChart2: true,
              startFillColor2: colors.accent,
              endFillColor2: colors.surface,
              startOpacity2: 0.25,
              endOpacity2: 0.02,
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
