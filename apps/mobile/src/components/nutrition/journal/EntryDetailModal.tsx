/**
 * Détail d'une entrée du journal (4.34) : macros et micronutriments figés pour la quantité notée,
 * édition, suppression, réordonnancement et réaffectation à un autre repas.
 *
 * Sorti de `app/(tabs)/nutrition.tsx` par NUTRI-UX03 : la page d'un jour passé en a besoin aussi.
 * Aucun changement de comportement.
 */

import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { rescaleEntryNutrition } from '@wellness/shared';
import { Button } from '@/components/Button';
import { MicronutrientDetails } from '@/components/MicronutrientDetails';
import { TextField } from '@/components/TextField';
import type { MacroKey } from '@/components/nutrition/MacroTriple';
import { removeEntry, updateEntry, type JournalEntry } from '@/data/repositories/journal-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export type MealOption = { key: string; label: string };

type Props = {
  entry: JournalEntry | null;
  startEditing?: boolean;
  onClose: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  meals: MealOption[];
  onReassign: (entryId: string, mealKey: string) => void;
};

export function EntryDetailModal({ entry, ...rest }: Props) {
  if (entry == null) return null;
  // Remonté à chaque ouverture (key) : l'état d'édition repart propre pour chaque entrée.
  return <EntryDetailContent key={entry.id} entry={entry} {...rest} />;
}

function EntryDetailContent({
  entry,
  startEditing,
  onClose,
  onMoveUp,
  onMoveDown,
  meals,
  onReassign,
}: Omit<Props, 'entry'> & { entry: JournalEntry }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  // Distinction de type d'entrée :
  // - AVEC quantité (grammes) → édition par les grammes (règle de trois).
  // - SANS quantité (quick add / recette) → édition directe de kcal/macros/nom.
  const hasQuantity = entry.quantityG != null && entry.quantityG > 0;
  const oldQty = entry.quantityG ?? 0;
  const [editing, setEditing] = useState(startEditing ?? false);
  const [grams, setGrams] = useState(String(entry.quantityG ?? ''));
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(entry.name);
  const [kcal, setKcal] = useState(String(entry.kcal));
  const [protein, setProtein] = useState(String(entry.proteinG));
  const [carbs, setCarbs] = useState(String(entry.carbsG));
  const [fat, setFat] = useState(String(entry.fatG));
  const num = (s: string) => Math.max(0, Math.round(Number(s.replace(',', '.')) || 0));

  const g = Math.round(Number(grams.replace(',', '.')) || 0);

  // Recalcul du snapshot pour la nouvelle quantité (règle de trois, un seul arrondi — shared).
  const preview = editing && hasQuantity ? rescaleEntryNutrition(entry, oldQty, g) : entry;
  const canSave = hasQuantity ? g > 0 : num(kcal) > 0;
  const previewMicros = preview.micronutrients;

  const macros: { key: MacroKey; value: number }[] = [
    { key: 'protein', value: preview.proteinG },
    { key: 'carbs', value: preview.carbsG },
    { key: 'fat', value: preview.fatG },
  ];

  // Heure de journalisation (horodatage), format local court.
  const loggedTime = new Date(entry.createdAt).toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    if (hasQuantity) {
      const n = rescaleEntryNutrition(entry, oldQty, g);
      await updateEntry(entry.id, {
        quantityG: g,
        kcal: n.kcal,
        proteinG: n.proteinG,
        carbsG: n.carbsG,
        fatG: n.fatG,
        micronutrients: n.micronutrients,
      });
    } else {
      await updateEntry(entry.id, {
        quantityG: null,
        name: name.trim() || entry.name,
        kcal: num(kcal),
        proteinG: num(protein),
        carbsG: num(carbs),
        fatG: num(fat),
        // pas de micronutrients → micros existants inchangés
      });
    }
    onClose();
  };

  const onDelete = () => {
    Alert.alert(entry.name, t('journal.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('journal.delete'),
        style: 'destructive',
        onPress: () => {
          void removeEntry(entry.id);
          onClose();
        },
      },
    ]);
  };

  const canReorder = !editing && (onMoveUp != null || onMoveDown != null);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { backgroundColor: colors.background }]} onPress={() => {}}>
          <View style={styles.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={2}>{entry.name}</Text>
              {!editing ? (
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                  {entry.quantityG != null ? `${t('journal.detail.quantity', { grams: entry.quantityG })} · ` : ''}
                  {t('journal.detail.loggedAt', { time: loggedTime })}
                </Text>
              ) : null}
            </View>
            {canReorder ? (
              <View style={styles.reorderRow}>
                <Pressable
                  onPress={onMoveUp}
                  disabled={onMoveUp == null}
                  hitSlop={8}
                  accessibilityLabel={t('journal.detail.moveUp')}
                >
                  <Ionicons name="chevron-up" size={22} color={onMoveUp ? colors.text : colors.border} />
                </Pressable>
                <Pressable
                  onPress={onMoveDown}
                  disabled={onMoveDown == null}
                  hitSlop={8}
                  accessibilityLabel={t('journal.detail.moveDown')}
                >
                  <Ionicons name="chevron-down" size={22} color={onMoveDown ? colors.text : colors.border} />
                </Pressable>
              </View>
            ) : null}
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('journal.detail.close')}>
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Champs en mode édition — grammes (règle de trois) ou saisie directe (quick add) */}
            {editing ? (
              hasQuantity ? (
                <TextField
                  label={t('journal.grams')}
                  value={grams}
                  onChangeText={setGrams}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              ) : (
                <>
                  <TextField label={t('journal.name')} value={name} onChangeText={setName} autoFocus />
                  <TextField
                    label={t('journal.detail.calories')}
                    value={kcal}
                    onChangeText={setKcal}
                    keyboardType="decimal-pad"
                  />
                  <TextField
                    label={`${t('nutrition.macros.protein')} (g)`}
                    value={protein}
                    onChangeText={setProtein}
                    keyboardType="decimal-pad"
                  />
                  <TextField
                    label={`${t('nutrition.macros.carbs')} (g)`}
                    value={carbs}
                    onChangeText={setCarbs}
                    keyboardType="decimal-pad"
                  />
                  <TextField
                    label={`${t('nutrition.macros.fat')} (g)`}
                    value={fat}
                    onChangeText={setFat}
                    keyboardType="decimal-pad"
                  />
                </>
              )
            ) : null}

            {/* Macros de la quantité (aperçu live en édition ; masqué en édition quick add) */}
            {!editing || hasQuantity ? (
              <View style={[styles.detailMacros, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.detailKcalRow}>
                  <Text style={[styles.detailKcal, { color: colors.text }]}>{preview.kcal}</Text>
                  <Text style={[styles.kcalUnit, { color: colors.textMuted }]}>{t('nutrition.kcal')}</Text>
                </View>
                <View style={styles.detailMacroRow}>
                  {macros.map((mm) => (
                    <View key={mm.key} style={styles.detailMacro}>
                      <Text style={[styles.macroName, { color: colors.textMuted }]}>{t(`nutrition.macros.${mm.key}`)}</Text>
                      <Text style={[styles.detailMacroVal, { color: colors.text }]}>{mm.value} g</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Micronutriments de la quantité (snapshot déjà mis à l'échelle) */}
            <MicronutrientDetails micronutrients={previewMicros} grams={100} showPer100={false} defaultOpen />

            {/* Déplacer l'entrée vers un autre repas (récupération des orphelines incluse). */}
            {!editing && meals.length > 0 ? (
              <View style={styles.moveBlock}>
                <Text style={[styles.moveLabel, { color: colors.textMuted }]}>{t('journal.detail.moveTo')}</Text>
                <View style={styles.moveChips}>
                  {meals
                    .filter((m) => m.key !== entry.mealType)
                    .map((m) => (
                      <Pressable
                        key={m.key}
                        onPress={() => onReassign(entry.id, m.key)}
                        style={[styles.moveChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                        accessibilityRole="button"
                        accessibilityLabel={t('journal.detail.moveToMeal', { meal: m.label })}
                      >
                        <Text style={[styles.moveChipLabel, { color: colors.text }]} numberOfLines={1}>
                          {m.label}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </View>
            ) : null}

            {/* Actions : modifier la quantité / supprimer (4.34) */}
            {editing ? (
              <View style={styles.detailActions}>
                <Button label={t('common.cancel')} variant="ghost" onPress={() => setEditing(false)} />
                <Button label={t('journal.detail.save')} onPress={() => void onSave()} loading={saving} disabled={!canSave} />
              </View>
            ) : (
              <View style={styles.detailActions}>
                <Pressable
                  onPress={onDelete}
                  style={styles.deleteAction}
                  accessibilityRole="button"
                  accessibilityLabel={t('journal.delete')}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  <Text style={[styles.deleteLabel, { color: colors.danger }]}>{t('journal.delete')}</Text>
                </Pressable>
                <Button
                  label={hasQuantity ? t('journal.detail.edit') : t('journal.swipeEdit')}
                  onPress={() => setEditing(true)}
                />
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  modalTitle: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  modalSub: { fontFamily: fontFamily.mono, fontSize: 13, marginTop: 2 },
  modalBody: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  detailMacros: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  detailKcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  detailKcal: { fontFamily: fontFamily.displayBold, fontSize: 32 },
  kcalUnit: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  macroName: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  detailMacroRow: { flexDirection: 'row', gap: 10 },
  detailMacro: { flex: 1, gap: 2 },
  detailMacroVal: { fontFamily: fontFamily.monoBold, fontSize: 16 },
  reorderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  deleteAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  deleteLabel: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  moveBlock: { gap: 8 },
  moveLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  moveChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moveChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  moveChipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
