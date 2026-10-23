/**
 * Les quatre allures d'entraînement qu'une allure de référence produit (US CARDIO-02, R5).
 *
 * Extrait du profil coureur (« Mes allures d'entraînement ») pour que l'aperçu des portes, la carte
 * du profil et l'arrivée d'un test montrent **exactement** les mêmes plages : celles que les séances
 * recevront (`trainingPaceBands` → `sessionTargetPace`).
 */

import { trainingPaceBands } from '@wellness/shared';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  refSPerKm: number;
  /** Fond des lignes : la surface de l'écran (`surface`) ou celle d'une carte (`background`). */
  tone?: 'surface' | 'background';
  testID?: string;
};

export function TrainingPaceList({ refSPerKm, tone = 'surface', testID }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const bands = trainingPaceBands(refSPerKm);

  return (
    <View
      testID={testID}
      style={[
        styles.list,
        { backgroundColor: tone === 'surface' ? colors.surface : colors.background, borderColor: colors.border },
      ]}
    >
      {bands.map(({ type, range }, i) => (
        <View
          key={type}
          style={[
            styles.row,
            i < bands.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
          ]}
        >
          <Text style={[styles.type, { color: colors.text }]}>{t(`running.sessionType.${type}`)}</Text>
          <Text style={[styles.range, { color: colors.accent }]}>
            {t('running.paces.range', {
              min: units.formatPace(range.minSPerKm),
              max: units.formatPace(range.maxSPerKm),
            })}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  type: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14 },
  range: { fontFamily: fontFamily.monoBold, fontSize: 13.5 },
});
