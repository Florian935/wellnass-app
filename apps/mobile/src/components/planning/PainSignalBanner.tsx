/**
 * US DOUL-01 — bandeau « zone sensible » sur une séance planifiée (R4).
 *
 * ⚠️ **Aucune action, et c'est le point.** Le bandeau énonce un **fait daté** et s'arrête là. Il n'y
 * a pas de bouton « remplacer l'exercice » parce qu'on n'a rien de fondé à proposer : `exercises` ne
 * porte ni articulation sollicitée ni schéma de mouvement (spec §0.1). Ajouter un bouton ici ferait
 * de l'app un avis médical.
 *
 * Le ton est celui de la règle R6 : ni « blessure », ni « repos conseillé », ni « consulte ».
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SessionPainSignal } from '@wellness/shared';

import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function PainSignalBanner({ signal }: { signal: SessionPainSignal }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const zone = t(`pain.zones.${signal.zone}`);
  const level = t(`pain.levels.${signal.level}`).toLocaleLowerCase();

  // Clé dédiée pour « aujourd'hui » : « il y a 0 jour » se lit mal, et le pluriel i18next ne sait
  // pas exprimer ce cas — même parti pris que « Dernier jour » sur la carte de période (VIE-01).
  const message =
    signal.daysAgo === 0
      ? t('pain.signalToday', { zone, level })
      : t('pain.signal', { zone, level, count: signal.daysAgo });

  return (
    <View
      style={[styles.box, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={message}
    >
      <Text style={[styles.text, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  text: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
});
