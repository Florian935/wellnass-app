/**
 * US BIEN-02 — le garde-fou « humeur basse » (décision D7 du 01/10/2026).
 *
 * Suivre l'humeur chaque jour oblige à savoir quoi dire quand elle reste basse. La règle
 * (`shouldShowLowMoodCard`) : 5 des 7 derniers jours renseignés à 1 ou 2, et pas plus d'une fois tous
 * les 14 jours. La carte ne diagnostique rien, n'emploie aucun mot clinique, ne commente pas un jour
 * isolé : elle dit qu'on a vu, et où trouver quelqu'un à qui parler.
 *
 * ⚠️ **Seuil et texte à faire relire par une personne compétente avant la sortie du pilier** (D7) —
 * noté en tête de la recette.
 */

import { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { shouldShowLowMoodCard, type LocalWellbeing } from '@wellness/shared';

import { useLowMoodCard } from '@/stores/low-mood-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Le numéro national de prévention du suicide (France) : gratuit, 24 h/24. */
export const LOW_MOOD_HELPLINE = '3114';

type Props = { rows: readonly LocalWellbeing[]; todayKey: string };

/** Vrai si la carte doit être à l'écran aujourd'hui (règle + mémoire de l'appareil). */
export function useLowMoodVisible(rows: readonly LocalWellbeing[], todayKey: string): boolean {
  const { shownOn, dismissedOn, hydrated } = useLowMoodCard();
  useEffect(() => {
    void useLowMoodCard.getState().hydrate();
  }, []);
  if (!hydrated || dismissedOn === todayKey) return false;
  return shownOn === todayKey || shouldShowLowMoodCard(rows, todayKey, shownOn);
}

export function LowMoodCard({ rows, todayKey }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const visible = useLowMoodVisible(rows, todayKey);

  useEffect(() => {
    // Apparue aujourd'hui : c'est ce jour qui ouvre les 14 jours de silence.
    if (visible) useLowMoodCard.getState().markShown(todayKey);
  }, [visible, todayKey]);

  if (!visible) return null;

  return (
    <View testID="low-mood-card" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.pillarWellbeing }]}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('wellbeingHub.lowMood.title')}
      </Text>
      <Text style={[styles.body, { color: colors.text }]}>{t('wellbeingHub.lowMood.body', { phone: LOW_MOOD_HELPLINE })}</Text>
      <View style={styles.actions}>
        <Pressable
          testID="low-mood-call"
          onPress={() => void Linking.openURL(`tel:${LOW_MOOD_HELPLINE}`).catch(() => undefined)}
          accessibilityRole="button"
          accessibilityLabel={t('wellbeingHub.lowMood.callA11y', { phone: LOW_MOOD_HELPLINE })}
          style={[styles.button, { backgroundColor: colors.pillarWellbeing }]}
        >
          <Text style={[styles.buttonLabel, { color: colors.accentText }]}>{t('wellbeingHub.lowMood.call', { phone: LOW_MOOD_HELPLINE })}</Text>
        </Pressable>
        <Pressable
          testID="low-mood-dismiss"
          onPress={() => useLowMoodCard.getState().dismiss(todayKey)}
          accessibilityRole="button"
          style={[styles.button, styles.ghost, { borderColor: colors.border }]}
        >
          <Text style={[styles.buttonLabel, { color: colors.text }]}>{t('wellbeingHub.lowMood.dismiss')}</Text>
        </Pressable>
      </View>
      <Text style={[styles.note, { color: colors.textMuted }]}>{t('wellbeingHub.lowMood.note')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1.5, padding: 18, gap: 10 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 18 },
  body: { fontFamily: fontFamily.body, fontSize: 14.5, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 44, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  ghost: { borderWidth: 1.5, backgroundColor: 'transparent' },
  buttonLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  note: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
});
