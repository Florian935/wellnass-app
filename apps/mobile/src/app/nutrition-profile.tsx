import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ACTIVITY_LEVELS,
  DIET_RESTRICTIONS,
  MICRONUTRIENT_KEYS,
  NUTRITION_OBJECTIVES,
  activityFactor,
  computeAge,
  defaultMacroRatios,
  macroGramsFromCalories,
  macroRatiosFromGrams,
  objectiveFromGoal,
  targetCalories,
  tdee,
  type ActivityLevel,
  type DietRestriction,
  type MacroGrams,
  type NutritionObjective,
  type TrainingBonusMode,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { useProfile } from '@/data/repositories/profile-repository';
import {
  upsertNutritionProfile,
  useNutritionProfile,
} from '@/data/repositories/nutrition-repository';
import { useTrackedMicros } from '@/stores/tracked-micros';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const MACRO_KEYS = ['protein', 'carbs', 'fat'] as const;
type MacroKey = (typeof MACRO_KEYS)[number];
const MACRO_COLORS: Record<MacroKey, 'accent' | 'success' | 'textMuted'> = {
  protein: 'accent',
  carbs: 'success',
  fat: 'textMuted',
};

/** Modes du bonus calorique des jours d'entraînement (item RN-02). */
const TRAINING_BONUS_MODES: readonly TrainingBonusMode[] = ['fixed', 'auto'];

/** Marges d'adhérence proposées (%, item NUTR-10). */
const ADHERENCE_MARGINS = ['5', '10', '15'] as const;

function parseNumber(value: string): number | null {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Bonus calorique (entier ≥ 0). Vide / invalide / négatif → 0 (désactivé). */
function parseBonus(value: string): number {
  const n = Math.round(Number(value.replace(',', '.')));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function NutritionProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { profile } = useProfile();
  const { nutritionProfile } = useNutritionProfile();

  const objective: NutritionObjective =
    nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const activityLevel: ActivityLevel = nutritionProfile?.activityLevel ?? 'moderate';
  const manualCalories = nutritionProfile?.manualCalories ?? null;
  const trainingBonus = nutritionProfile?.trainingDayBonus ?? 0;
  const trainingBonusMode: TrainingBonusMode = nutritionProfile?.trainingBonusMode ?? 'fixed';
  const restrictions = nutritionProfile?.restrictions ?? [];
  const allergens = nutritionProfile?.allergens ?? [];

  // Micronutriments suivis dans le récap (US 4.35) — préférence locale.
  const trackedMicros = useTrackedMicros((s) => s.tracked);
  const toggleMicro = useTrackedMicros((s) => s.toggle);

  const age = profile?.birthDate ? computeAge(new Date(profile.birthDate)) : null;
  const tdeeValue = tdee({
    sex: profile?.sex ?? 'unspecified',
    weightKg: profile?.weightKg ?? undefined,
    heightCm: profile?.heightCm ?? undefined,
    age: age ?? undefined,
    activityLevel,
  });

  const autoTarget = tdeeValue != null ? targetCalories(tdeeValue, objective) : null;
  const target = tdeeValue != null ? targetCalories(tdeeValue, objective, manualCalories) : null;

  // Mode manuel actif dès qu'une macro est saisie ; sinon macros dérivées de l'objectif.
  const manualSet =
    nutritionProfile?.manualProteinG != null ||
    nutritionProfile?.manualCarbsG != null ||
    nutritionProfile?.manualFatG != null;
  const manualGrams: MacroGrams | null = manualSet
    ? {
        protein: nutritionProfile?.manualProteinG ?? 0,
        carbs: nutritionProfile?.manualCarbsG ?? 0,
        fat: nutritionProfile?.manualFatG ?? 0,
      }
    : null;
  const ratios = defaultMacroRatios(objective);
  const defaultGrams = target != null ? macroGramsFromCalories(target, ratios) : null;
  const grams: MacroGrams | null = manualGrams ?? defaultGrams;
  const displayRatios = manualGrams ? macroRatiosFromGrams(manualGrams) : ratios;

  const onEditGram = (key: MacroKey, value: string) => {
    if (!grams) return;
    const n = value === '' ? 0 : parseNumber(value) ?? 0;
    const next = { ...grams, [key]: Math.round(n) };
    void upsertNutritionProfile({
      manualProteinG: next.protein,
      manualCarbsG: next.carbs,
      manualFatG: next.fat,
    });
  };

  const toggleRestriction = (r: DietRestriction) => {
    const next = restrictions.includes(r)
      ? restrictions.filter((x) => x !== r)
      : [...restrictions, r];
    void upsertNutritionProfile({ restrictions: next });
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Objectif nutritionnel (4.4 / spec §2.1) */}
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('nutrition.objective.title')}</Text>
      <OptionList
        options={NUTRITION_OBJECTIVES}
        value={objective}
        onChange={(o) => void upsertNutritionProfile({ objective: o })}
        label={(o) => t(`nutrition.objective.options.${o}`)}
      />

      {/* Niveau d'activité (4.2 / spec §2.2) */}
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('nutrition.activity.title')}</Text>
      <OptionList
        options={ACTIVITY_LEVELS}
        value={activityLevel}
        onChange={(l) => void upsertNutritionProfile({ activityLevel: l })}
        label={(l) => t(`nutrition.activity.options.${l}`)}
        trailing={(l: ActivityLevel) => `×${activityFactor(l).toString().replace('.', ',')}`}
      />

      {/* Besoin calorique + objectif (4.1 / 4.3) */}
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('nutrition.calories.title')}</Text>
      {tdeeValue == null || target == null ? (
        <Card>
          <Text style={[styles.cardText, { color: colors.text }]}>{t('nutrition.calories.incomplete')}</Text>
          <Button
            label={t('nutrition.calories.completeProfile')}
            variant="ghost"
            onPress={() => router.push('/profile')}
          />
        </Card>
      ) : (
        <Card>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{t('nutrition.calories.tdee')}</Text>
            <Text style={[styles.rowValue, { color: colors.text }]}>{tdeeValue} {t('nutrition.kcal')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{t('nutrition.calories.target')}</Text>
            <Text style={[styles.rowValue, { color: colors.accent }]}>{target} {t('nutrition.kcal')}</Text>
          </View>
          <TextField
            label={t('nutrition.calories.manual')}
            value={manualCalories?.toString() ?? ''}
            onChangeText={(v) => void upsertNutritionProfile({ manualCalories: parseNumber(v) })}
            keyboardType="number-pad"
            placeholder={String(autoTarget)}
          />
          {manualCalories != null ? (
            <Button
              label={t('nutrition.calories.recompute')}
              variant="ghost"
              onPress={() => void upsertNutritionProfile({ manualCalories: null })}
            />
          ) : null}
          {/* Mode du bonus jour d'entraînement (RN-02) : forfait fixe ou auto (dépense course) */}
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            {t('nutrition.calories.bonusMode.label')}
          </Text>
          <Segment
            options={TRAINING_BONUS_MODES}
            value={trainingBonusMode}
            onChange={(mode) => void upsertNutritionProfile({ trainingBonusMode: mode })}
            label={(mode) => t(`nutrition.calories.bonusMode.${mode}`)}
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('nutrition.calories.bonusMode.hint')}
          </Text>
          {/* Bonus jour d'entraînement (4.7) — 0/vide = désactivé */}
          <TextField
            label={t('nutrition.calories.trainingBonus')}
            value={trainingBonus > 0 ? String(trainingBonus) : ''}
            onChangeText={(v) => void upsertNutritionProfile({ trainingDayBonus: parseBonus(v) })}
            keyboardType="number-pad"
            placeholder="0"
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('nutrition.calories.trainingBonusHint')}
          </Text>
          {/* Marge d'adhérence (NUTR-10) : tolérance % pour « dans la cible » */}
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            {t('nutrition.calories.adherenceMargin.label')}
          </Text>
          <Segment
            options={ADHERENCE_MARGINS}
            value={String(nutritionProfile?.adherenceMarginPct ?? 10)}
            onChange={(v) => void upsertNutritionProfile({ adherenceMarginPct: parseInt(v, 10) })}
            label={(v) => `${v} %`}
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('nutrition.calories.adherenceMargin.hint')}
          </Text>
        </Card>
      )}

      {/* Macros (4.4 / 4.5 / spec §2.3) */}
      {grams != null ? (
        <>
          <Text style={[styles.section, { color: colors.textMuted }]}>{t('nutrition.macros.title')}</Text>
          <Card>
            {MACRO_KEYS.map((key) => (
              <View key={key} style={styles.macroRow}>
                <View style={styles.macroHeader}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t(`nutrition.macros.${key}`)}
                  </Text>
                  <Text style={[styles.macroPct, { color: colors.textMuted }]}>{displayRatios[key]} %</Text>
                </View>
                <View style={styles.macroInputRow}>
                  <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          backgroundColor: colors[MACRO_COLORS[key]],
                          width: `${Math.min(100, displayRatios[key])}%`,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.gramField}>
                    <TextField
                      label={t('nutrition.macros.grams')}
                      value={grams[key].toString()}
                      onChangeText={(v) => onEditGram(key, v)}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </View>
            ))}
            {manualSet ? (
              <Button
                label={t('nutrition.macros.reset')}
                variant="ghost"
                onPress={() =>
                  void upsertNutritionProfile({
                    manualProteinG: null,
                    manualCarbsG: null,
                    manualFatG: null,
                  })
                }
              />
            ) : null}
          </Card>
        </>
      ) : null}

      {/* Restrictions / préférences (4.6 / spec §2.4) */}
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('nutrition.restrictions.title')}</Text>
      <View style={styles.chips}>
        {DIET_RESTRICTIONS.map((r: DietRestriction) => {
          const active = restrictions.includes(r);
          return (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => toggleRestriction(r)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: active ? colors.accentText : colors.text }]}>
                {t(`nutrition.restrictions.options.${r}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label={t('nutrition.restrictions.allergens')}
        value={allergens.join(', ')}
        onChangeText={(v) =>
          void upsertNutritionProfile({
            allergens: v
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        placeholder={t('nutrition.restrictions.allergensPlaceholder')}
        autoCapitalize="none"
      />

      {/* Micronutriments suivis dans le récap (4.35) */}
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('nutrition.micros.tracked.title')}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('nutrition.micros.tracked.hint')}</Text>
      <View style={styles.chips}>
        {MICRONUTRIENT_KEYS.map((key) => {
          const active = trackedMicros.includes(key);
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => toggleMicro(key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: active ? colors.accentText : colors.text }]}>
                {t(`nutrition.micros.labels.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Button label={t('nutrition.done')} onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

type OptionListProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (option: T) => string;
  trailing?: (option: T) => string;
};

/** Liste d'options verticale à sélection unique (labels longs). */
function OptionList<T extends string>({ options, value, onChange, label, trailing }: OptionListProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {options.map((option, i) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[
              styles.listItem,
              i < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.border }]}>
              {selected ? <View style={[styles.radioDot, { backgroundColor: colors.accent }]} /> : null}
            </View>
            <Text style={[styles.listLabel, { color: colors.text }]}>{label(option)}</Text>
            {trailing ? <Text style={[styles.trailing, { color: colors.textMuted }]}>{trailing(option)}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  section: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
  },
  cardText: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 21 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
  list: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  listLabel: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 16 },
  trailing: { fontFamily: fontFamily.mono, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  rowValue: { fontFamily: fontFamily.bodyBold, fontSize: 18 },
  macroRow: { gap: 6 },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  macroPct: { fontFamily: fontFamily.mono, fontSize: 13 },
  macroInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 16 },
  fill: { height: '100%', borderRadius: 5 },
  gramField: { width: 96 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  chipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  footer: { marginTop: 20 },
});
