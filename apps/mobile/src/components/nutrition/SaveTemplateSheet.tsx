/**
 * Nommer un repas type avant de l'enregistrer — US NUTRI-UX03, R5 (décision Q6 de Florian).
 *
 * Avant cette US, un repas type prenait **le nom du repas** : deux déjeuners enregistrés
 * s'appelaient tous deux « Déjeuner », et comme la recherche est le seul chemin vers un repas type,
 * ils devenaient indiscernables. Le nom est désormais **saisi par l'utilisateur, obligatoirement** :
 * aucune proposition (« ça n'a aucun sens », Q6) — « Enregistrer » reste inactif tant qu'il est vide.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export const TEMPLATE_NAME_MAX = 60;

type Props = {
  /** Le repas à enregistrer ; `null` ferme la feuille. */
  meal: { label: string; count: number; kcal: string } | null;
  onCancel: () => void;
  onSave: (name: string) => void;
};

export function SaveTemplateSheet({ meal, onCancel, onSave }: Props) {
  if (meal == null) return null;
  return <SheetContent meal={meal} onCancel={onCancel} onSave={onSave} />;
}

function SheetContent({ meal, onCancel, onSave }: Props & { meal: NonNullable<Props['meal']> }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const trimmed = name.trim();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onCancel} accessibilityElementsHidden importantForAccessibility="no" />
        <View style={[styles.sheet, { backgroundColor: colors.background }]} testID="save-template-sheet">
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {t('nutritionHub.template.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('nutritionHub.template.subtitle', { meal: meal.label, count: meal.count, kcal: meal.kcal })}
          </Text>
          <TextField
            label={t('nutritionHub.template.label')}
            value={name}
            onChangeText={(v) => setName(v.slice(0, TEMPLATE_NAME_MAX))}
            placeholder={t('nutritionHub.template.placeholder')}
            autoFocus
            maxLength={TEMPLATE_NAME_MAX}
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('nutritionHub.template.hint')}</Text>
          <View style={styles.actions}>
            <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
            <Button
              label={t('nutritionHub.template.save')}
              onPress={() => {
                if (trimmed === '') return;
                onSave(trimmed);
              }}
              disabled={trimmed === ''}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28, gap: 10 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 13.5 },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 6 },
});
