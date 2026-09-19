/**
 * US CARDIO-UX02 — **la ligne de toujours**, en pied du hub Course.
 *
 * Une ligne, pas une carte — jumelle de `strength/LifetimeLine`. Elle ferme la page sans ajouter
 * une boîte de plus, et elle répond à la seule question à laquelle aucune fenêtre glissante ne
 * répond : *combien j'ai couru, en tout.*
 *
 * C'est aussi ce qui remplace le widget « Historique » de l'ancienne grille : il affichait la
 * distance de la **dernière** sortie en 34 px de haut, ce qui donnait au hub son plus gros chiffre
 * — pour une information qui ne mesure rien (défaut 4 de l'audit, décliné côté course).
 *
 * Elle se tait à zéro course : « 0,00 km depuis le début » est exactement le genre de phrase qui
 * s'excuse (défaut 2).
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatHoursMinutes } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { useRunLifetime } from '@/data/repositories/run-cards-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = { onPress: () => void };

export function RunLifetimeLine({ onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { totalDistanceM, totalDurationS, count, isLoading } = useRunLifetime();

  if (isLoading || count === 0 || totalDistanceM <= 0) return null;

  const label = t('runningHub.lifetime.line', {
    distance: units.formatDistance(totalDistanceM / 1000),
    duration: formatHoursMinutes(totalDurationS),
    count,
  });

  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="run-lifetime-line"
      style={styles.line}
    >
      <Ionicons name="infinite-outline" size={16} color={colors.textMuted} />
      <Text style={[styles.text, { color: colors.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, minHeight: 44 },
  text: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 12.5, lineHeight: 17 },
});
