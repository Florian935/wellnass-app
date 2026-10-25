/**
 * US ACCUEIL-07 — **le check-in du matin en visages** (constat 9 du 24/10/2026).
 *
 * L'accueil montrait « 1 2 3 4 5 » : aucun libellé à l'écran (seulement pour TalkBack), et une
 * indication qui annonçait « humeur, énergie, stress » alors que seule l'énergie était demandée.
 * Cinq visages, de l'épuisement au top, chacun avec son mot — ceux du check-in complet
 * (`wellbeing.levels.energy.*`), pour que les deux écrans parlent la même langue.
 *
 * Le composant ne sait rien de l'écriture : il rend le niveau choisi. Il est posé sur une surface
 * sombre (la scène Aurore aujourd'hui, la carte du moment dans ACCUEIL-08) et en reçoit les encres.
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { WellbeingLevel } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';

const LEVELS: readonly WellbeingLevel[] = [1, 2, 3, 4, 5];

/** Le visage (cercle et yeux), puis une bouche par niveau — du plus triste au plus large sourire. */
const FACE = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 10h.01M15 10h.01';
const MOUTHS: Record<WellbeingLevel, string> = {
  1: 'M8.5 16.5q3.5-3 7 0',
  2: 'M8.5 16q3.5-1.6 7 0',
  3: 'M8.5 15.5h7',
  4: 'M8.5 14.5q3.5 2.2 7 0',
  5: 'M8 14q4 4.2 8 0',
};

type Props = {
  onPick: (level: WellbeingLevel) => void;
  disabled?: boolean;
  /** Encre des visages et des libellés. */
  ink: string;
  /** Fond et contour de chaque pastille. */
  glass: string;
  glassBorder: string;
};

export function CheckinFaces({ onPick, disabled = false, ink, glass, glassBorder }: Props) {
  const { t } = useTranslation();
  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('home.checkin.groupA11y')}
    >
      {LEVELS.map((level) => {
        const label = t(`wellbeing.levels.energy.${level}`);
        return (
          <PressableScale
            key={level}
            testID={`checkin-face-${level}`}
            haptic="confirm"
            disabled={disabled}
            onPress={() => onPick(level)}
            accessibilityRole="radio"
            accessibilityState={{ disabled, checked: false }}
            accessibilityLabel={t('wellbeing.a11yLevel', {
              indicator: t('wellbeing.indicators.energy'),
              level,
              label,
            })}
            style={[styles.face, { backgroundColor: glass, borderColor: glassBorder }]}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path
                d={`${FACE}${MOUTHS[level]}`}
                fill="none"
                stroke={ink}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text
              style={[styles.label, { color: ink }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1.3}
            >
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  face: {
    flex: 1,
    minWidth: 0,
    minHeight: 68,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 2,
  },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 10.5 },
});
