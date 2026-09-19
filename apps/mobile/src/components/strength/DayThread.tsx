/**
 * US MUSCU-UX05 — **« Le fil du jour »**.
 *
 * Une bande d'une ligne, pas une carte. C'est la seule chose de l'écran qui change tous les jours :
 * l'audit du 19/09 avait relevé que la scène a cinq états pendant que le corps du hub rendait
 * **exactement les mêmes blocs** dans les cinq cas — un jour de repos et le lendemain d'un record
 * affichaient le même écran.
 *
 * Elle porte **un** insight, jamais trois. Trois signaux empilés en tête d'écran refont la pile de
 * cartes qu'on vient de défaire ; le classement de `selectInsights` sert précisément à choisir.
 *
 * Elle se tait quand il n'y a rien à dire — zéro est une réponse valable (spec INSIGHTS-01, R4), et
 * une bande qui s'excuse serait le défaut 2 de l'audit (« la moitié des blocs parlent de ce qui
 * manque ») réintroduit au meilleur emplacement de l'écran.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { useStrengthThread } from '@/data/repositories/strength-cards-repository';
import { fontFamily } from '@/theme/fonts';
import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/useTheme';

type Props = { onPress: () => void };

export function DayThread({ onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { thread, isLoading } = useStrengthThread();

  if (isLoading || thread === null) return null;

  // Même schéma de clés que l'accueil (`InsightsCard`) : un signal n'a pas deux formulations selon
  // l'écran qui l'affiche. Le `subject` d'un déséquilibre est un groupe musculaire, donc traduit.
  const subject =
    thread.id === 'muscle_neglected' && thread.subject
      ? t(`muscles.${thread.subject}`, { defaultValue: thread.subject })
      : thread.subject;

  const label = t(`insights.cards.${thread.id}.title`, {
    ...thread.metrics,
    subject,
    count: Object.values(thread.metrics)[0] ?? 0,
  });

  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="strength-day-thread"
      style={[
        styles.band,
        { backgroundColor: withAlpha(colors.accent, 0.14), borderColor: colors.accent },
      ]}
    >
      <Ionicons name="flash-outline" size={17} color={colors.accent} />
      <Text style={[styles.text, { color: colors.text }]} numberOfLines={2}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={15} color={colors.accent} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 12,
    minHeight: 48,
  },
  text: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 12.5, lineHeight: 17 },
});
