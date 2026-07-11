import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  FOOD_CATEGORIES,
  type FoodCategory,
  type MicronutrientKey,
  type Micronutrients,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { addCustomFood } from '@/data/repositories/food-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Champs micronutriments facultatifs, groupés comme la maquette (mg, sauf vitamines D/B9/B12 en µg). */
const MICRO_GROUPS: { key: string; items: { key: MicronutrientKey; unit: 'mg' | 'ug' }[] }[] = [
  { key: 'lipids', items: [{ key: 'cholesterol_mg', unit: 'mg' }] },
  {
    key: 'minerals',
    items: [
      { key: 'sodium_mg', unit: 'mg' },
      { key: 'magnesium_mg', unit: 'mg' },
      { key: 'potassium_mg', unit: 'mg' },
      { key: 'calcium_mg', unit: 'mg' },
      { key: 'iron_mg', unit: 'mg' },
    ],
  },
  {
    key: 'vitamins',
    items: [
      { key: 'vitamin_c_mg', unit: 'mg' },
      { key: 'vitamin_d_ug', unit: 'ug' },
      { key: 'vitamin_b9_ug', unit: 'ug' },
      { key: 'vitamin_b12_ug', unit: 'ug' },
    ],
  },
];

export default function FoodCustomScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('other');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [microsOpen, setMicrosOpen] = useState(false);
  const [micros, setMicros] = useState<Partial<Record<MicronutrientKey, string>>>({});

  const parse = (s: string) => {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const kcalNum = parse(kcal);
  const canSave = name.trim().length > 0 && kcalNum != null && kcalNum > 0;

  const setMicro = (key: MicronutrientKey, value: string) =>
    setMicros((m) => ({ ...m, [key]: value }));

  /** Ne garde que les champs micros réellement renseignés (valeur ≥ 0). */
  const collectMicros = (): Micronutrients => {
    const out: Micronutrients = {};
    for (const g of MICRO_GROUPS) {
      for (const it of g.items) {
        const n = parse(micros[it.key] ?? '');
        if (n != null) out[it.key] = n;
      }
    }
    return out;
  };

  const save = async () => {
    if (!canSave) return;
    await addCustomFood({
      name,
      category,
      kcalPer100g: kcalNum,
      proteinPer100g: parse(protein),
      carbsPer100g: parse(carbs),
      fatPer100g: parse(fat),
      micronutrients: collectMicros(),
    });
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('food.custom.hint')}</Text>

      <TextField label={t('journal.name')} value={name} onChangeText={setName} autoCapitalize="sentences" />

      <Text style={[styles.label, { color: colors.textMuted }]}>{t('food.custom.category')}</Text>
      <View style={styles.chips}>
        {FOOD_CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[
                styles.chip,
                { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.border },
              ]}
            >
              <Text style={[styles.chipLabel, { color: active ? colors.accentText : colors.text }]}>
                {t(`food.categories.${c}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.textMuted }]}>{t('food.custom.per100')}</Text>
      <TextField label={`${t('nutrition.calories.title')} (${t('nutrition.kcal')})`} value={kcal} onChangeText={setKcal} keyboardType="number-pad" />
      <View style={styles.macroRow}>
        <View style={styles.macroField}><TextField label={`${t('nutrition.macros.protein')} (g)`} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" /></View>
        <View style={styles.macroField}><TextField label={`${t('nutrition.macros.carbs')} (g)`} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" /></View>
        <View style={styles.macroField}><TextField label={`${t('nutrition.macros.fat')} (g)`} value={fat} onChangeText={setFat} keyboardType="decimal-pad" /></View>
      </View>

      <Pressable
        onPress={() => setMicrosOpen((o) => !o)}
        accessibilityRole="button"
        style={[styles.microsHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.microsTitle, { color: colors.accent }]}>{t('nutrition.micros.title')}</Text>
          <Text style={[styles.microsSub, { color: colors.accent }]}>{t('nutrition.micros.optional')}</Text>
        </View>
        <Ionicons name={microsOpen ? 'chevron-down' : 'chevron-forward'} size={20} color={colors.accent} />
      </Pressable>

      {microsOpen ? (
        <View style={styles.microsBody}>
          {MICRO_GROUPS.map((g) => (
            <View key={g.key} style={styles.microGroup}>
              <Text style={[styles.microGroupTitle, { color: colors.textMuted }]}>{t(`nutrition.micros.groups.${g.key}`)}</Text>
              <View style={styles.microGrid}>
                {g.items.map((it) => {
                  const unit = it.unit === 'mg' ? t('nutrition.micros.units.mg') : t('nutrition.micros.units.ug');
                  return (
                    <View key={it.key} style={styles.microField}>
                      <TextField
                        label={`${t(`nutrition.micros.labels.${it.key}`)} (${unit})`}
                        value={micros[it.key] ?? ''}
                        onChangeText={(v) => setMicro(it.key, v)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
          <Text style={[styles.microsNote, { color: colors.textMuted }]}>{t('nutrition.micros.optionalHint')}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Button label={t('food.custom.save')} onPress={() => void save()} disabled={!canSave} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  hint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  macroRow: { flexDirection: 'row', gap: 10 },
  macroField: { flex: 1 },
  microsHeader: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 15, gap: 12, marginTop: 4 },
  microsTitle: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  microsSub: { fontFamily: fontFamily.body, fontSize: 12.5, marginTop: 1, opacity: 0.8 },
  microsBody: { gap: 16 },
  microGroup: { gap: 4 },
  microGroupTitle: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 0.8, marginLeft: 2 },
  microGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  microField: { flexBasis: '47%', flexGrow: 1 },
  microsNote: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
  footer: { marginTop: 12 },
});
