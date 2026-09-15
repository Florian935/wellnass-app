/**
 * US LABO-01 — « Ce qui change dans ton plan » : la feuille qui précède **toute** écriture.
 *
 * C'est le cœur de la confiance du Labo (R4) : on voit ce qui bouge, dans quel pilier, et **où ça se
 * verra dans l'app**, avant de valider. Rien d'autre ne bouge — et c'est dit.
 *
 * Même patron que `WellbeingCheckinSheet` (BIEN-01) : une modale glissante, fermable par le fond.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Pillar } from '@wellness/shared';

import { Button } from '@/components/Button';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export type LabChangeItem = {
  id: string;
  pillar: Pillar | 'sleep';
  title: string;
  detail: string;
  /** Les écrans où le changement se verra. */
  where: string;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle: string;
  items: LabChangeItem[];
  confirmLabel: string;
  busy?: boolean;
  /** Message d'échec de l'écriture. La feuille reste ouverte tant qu'il est là (leçon CONF-06). */
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

const ICON: Record<Pillar | 'sleep', keyof typeof Ionicons.glyphMap> = {
  strength: 'barbell',
  running: 'walk',
  nutrition: 'nutrition',
  sleep: 'moon',
};

export function LabApplySheet({ visible, title, subtitle, items, confirmLabel, busy = false, error = null, onConfirm, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={[styles.grip, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {items.map((item) => (
            <View key={item.id} testID={`lab-change-${item.id}`} style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.icon, { backgroundColor: colors.border }]}>
                <Ionicons name={ICON[item.pillar]} size={18} color={colors.text} />
              </View>
              <View style={styles.itemBody}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.itemDetail, { color: colors.text }]}>{item.detail}</Text>
                <Text style={[styles.itemWhere, { color: colors.textMuted }]}>{t('lab.apply.where', { list: item.where })}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {error !== null && (
          <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
            {error}
          </Text>
        )}
        <Text style={[styles.note, { color: colors.textMuted }]}>{t('lab.apply.note')}</Text>
        <Button label={confirmLabel} onPress={onConfirm} loading={busy} />
        <Button label={t('lab.apply.later')} onPress={onClose} variant="ghost" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '86%', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, gap: 10 },
  grip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, opacity: 0.6 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 22, letterSpacing: -0.4 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 12.5 },
  list: { maxHeight: 320 },
  listContent: { gap: 8, paddingVertical: 4 },
  item: { flexDirection: 'row', gap: 10, borderRadius: 16, borderWidth: 1, padding: 12 },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  itemDetail: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  itemWhere: { fontFamily: fontFamily.body, fontSize: 11.5 },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  note: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
});
