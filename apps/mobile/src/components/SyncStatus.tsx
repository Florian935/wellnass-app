import { useStatus } from '@powersync/react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Indicateur discret de synchronisation (navigation-ux §7). Reflète l'état de connexion
 * PowerSync : connecté (données à jour en arrière-plan) ou hors-ligne.
 */
export function SyncStatus() {
  const status = useStatus();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const connected = status.connected;
  const dotColor = connected ? colors.success : colors.textMuted;
  const label = connected ? t('sync.connected') : t('sync.offline');

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 12 },
});
