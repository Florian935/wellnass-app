import { StyleSheet, Text, View } from 'react-native';
import { AnatomyFigure } from './AnatomyFigure';
import { useTranslation } from 'react-i18next';
import { type FineMuscle } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type BodyMapProps = {
  full: FineMuscle[];
  reduced: FineMuscle[];
};

/**
 * `<BodyMap full={...} reduced={...} />` — deux silhouettes côte à côte (face puis dos), chacune
 * neutre par défaut (R2 : un muscle non sollicité n'est pas « éteint »). Le schéma reste un
 * complément : la liste textuelle des muscles sollicités est affichée par l'appelant, jamais
 * remplacée (R5) — ce composant ne rend que le dessin + son `accessibilityLabel`.
 */
export function BodyMap({ full, reduced }: BodyMapProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const sollicited = [...full, ...reduced];
  const label =
    sollicited.length > 0
      ? t('bodyMap.a11yLabel', {
          muscles: sollicited.map((m) => t(`muscleFine.${m}`)).join(', '),
        })
      : t('bodyMap.a11yLabelEmpty');

  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={label}>
      <View style={styles.view}>
        <AnatomyFigure side="front" height={176} full={full} reduced={reduced} />
        <Text style={[styles.caption, { color: colors.textMuted }]}>{t('bodyMap.front')}</Text>
      </View>
      <View style={styles.view}>
        <AnatomyFigure side="back" height={176} full={full} reduced={reduced} />
        <Text style={[styles.caption, { color: colors.textMuted }]}>{t('bodyMap.back')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  view: { alignItems: 'center', gap: 4 },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
