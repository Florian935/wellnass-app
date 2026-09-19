/**
 * US MUSCU-UX05 — **« Ton total »** : une ligne, pas une carte.
 *
 * Le tonnage cumulé (MUSC-19) est le chiffre dont on est fier, et il vivait dans le deuxième onglet
 * de `/progress`. Il remonte ici — mais **en ligne de texte**, pas en tuile.
 *
 * C'est un choix de rythme, pas une économie de place : l'audit du 19/09 a montré qu'une seule
 * forme répétée neuf fois est ce qui rend un écran monotone. Une ligne nue après six cartes ferme
 * la page sans ajouter une dixième boîte à rayon 18.
 *
 * Se tait à zéro : « 0 t soulevées » n'est pas un fait qu'on affiche, c'est un reproche.
 */

import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { useLifetimeTonnage } from '@/data/repositories/records-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = { onPress: () => void };

export function LifetimeLine({ onPress }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { lifetimeKg, isLoading } = useLifetimeTonnage();
  const { workouts } = useWorkoutHistory();

  if (isLoading || lifetimeKg <= 0) return null;

  // En tonnes : « 1 248 t » se lit, « 1 248 000 kg » se compte. Séparateur localisé, comme partout
  // ailleurs (`AnimatedNumber` a payé cette leçon — `Intl` n'existe pas sur le thread UI).
  const tonnes = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 0,
    maximumFractionDigits: lifetimeKg < 100_000 ? 1 : 0,
  }).format(lifetimeKg / 1000);

  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      accessibilityRole="button"
      testID="lifetime-line"
      style={styles.line}
      accessibilityLabel={t('strengthHub.lifetime.a11y', {
        tonnes,
        count: workouts.length,
      })}
    >
      <Text style={[styles.value, { color: colors.text }]}>
        {t('strengthHub.lifetime.value', { tonnes })}
      </Text>
      <Text style={[styles.caption, { color: colors.textMuted }]}>
        {t('strengthHub.lifetime.caption', { count: workouts.length })}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 6,
    minHeight: 44,
  },
  value: { fontFamily: fontFamily.displayXBold, fontSize: 17 },
  caption: { fontFamily: fontFamily.body, fontSize: 11.5 },
});
