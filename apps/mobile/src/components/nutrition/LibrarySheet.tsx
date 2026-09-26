/**
 * « Ta bibliothèque » — US NUTRI-UX03, §4.6.
 *
 * Recettes, repas types et favoris vivaient au troisième niveau (feuille d'ajout › Toute la base ›
 * onglet) ; « Gérer les repas » était un lien gris en bas du journal. Ils se rangent ici, derrière
 * une icône d'en-tête, comme la bibliothèque de la muscu (`DirectorySheet`). Les écrans ne changent
 * pas : le sélecteur s'ouvre sur l'onglet voulu (`tab`), et reste un sélecteur.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export type LibraryTarget = 'recipes' | 'templates' | 'favorites' | 'meals';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (target: LibraryTarget) => void;
};

export function LibrarySheet({ visible, onClose, onPick }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const rows: { key: LibraryTarget; icon: keyof typeof Ionicons.glyphMap; label: string; hint: string }[] = [
    { key: 'recipes', icon: 'restaurant-outline', label: t('journal.tabs.recipes'), hint: t('nutritionHub.library.recipesHint') },
    { key: 'templates', icon: 'albums-outline', label: t('journal.tabs.templates'), hint: t('nutritionHub.library.templatesHint') },
    { key: 'favorites', icon: 'star-outline', label: t('journal.tabs.favorites'), hint: t('nutritionHub.library.favoritesHint') },
    { key: 'meals', icon: 'list-outline', label: t('meals.manage'), hint: t('nutritionHub.library.mealsHint') },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityElementsHidden importantForAccessibility="no" />
      <View style={[styles.sheet, { backgroundColor: colors.background }]} testID="nutrition-library">
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {t('nutritionHub.library.title')}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={[styles.close, { backgroundColor: colors.track }]}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {rows.map((r, i) => (
            <Pressable
              key={r.key}
              onPress={() => onPick(r.key)}
              accessibilityRole="button"
              accessibilityLabel={r.label}
              accessibilityHint={r.hint}
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            >
              <Ionicons name={r.icon} size={20} color={colors.accent} />
              <View style={styles.texts}>
                <Text style={[styles.label, { color: colors.text }]}>{r.label}</Text>
                <Text style={[styles.hint, { color: colors.textMuted }]}>{r.hint}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  list: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 14, paddingVertical: 10 },
  texts: { flex: 1, gap: 1 },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5 },
});
