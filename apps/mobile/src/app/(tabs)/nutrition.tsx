import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_MEAL_KEYS,
  computeAge,
  defaultMacroRatios,
  macroGramsFromCalories,
  objectiveFromGoal,
  rescaleEntryNutrition,
  resolveMealConfig,
  saltFromSodiumMg,
  sumMicronutrients,
  sumNutrients,
  targetCalories,
  tdee,
  type MicronutrientKey,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { MicronutrientDetails } from '@/components/MicronutrientDetails';
import { useTrackedMicros } from '@/stores/tracked-micros';
import { useProfile } from '@/data/repositories/profile-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useDayCalorieTarget } from '@/data/repositories/dashboard-repository';
import {
  copyMeal,
  duplicateDay,
  moveEntry,
  reassignEntryMeal,
  removeEntry,
  updateEntry,
  useDayEntries,
  type JournalEntry,
} from '@/data/repositories/journal-repository';
import { saveMealAsTemplate } from '@/data/repositories/meal-template-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, m! - 1, d! + n);
  return isoDay(date);
};

const MACRO_KEYS = ['protein', 'carbs', 'fat'] as const;
type MacroKey = (typeof MACRO_KEYS)[number];

/** Unité d'un micronutriment déduite du suffixe de sa clé (`_mg` / `_ug`). */
const microUnit = (key: MicronutrientKey): 'mg' | 'ug' => (key.endsWith('_ug') ? 'ug' : 'mg');

/** Format micro : entier ≥ 10, sinon 1 décimale ; virgule décimale en FR (cf. MicronutrientDetails). */
function fmtMicro(n: number, lang: 'fr' | 'en', decimals?: number): string {
  const d = decimals ?? (n >= 10 ? 0 : 1);
  const s = n.toFixed(d);
  return lang === 'fr' ? s.replace('.', ',') : s;
}
const MACRO_COLORS: Record<MacroKey, 'accent' | 'success' | 'textMuted'> = {
  protein: 'accent',
  carbs: 'success',
  fat: 'textMuted',
};

export default function NutritionScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { profile } = useProfile();
  const { nutritionProfile } = useNutritionProfile();
  const [day, setDay] = useState(() => isoDay(new Date()));
  const { entries } = useDayEntries(day);

  // Entrée sélectionnée pour le détail (4.34) — tap sur une entrée du journal.
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null);
  // Détail ouvert directement en mode édition (swipe → « Modifier ») vs simple consultation (tap).
  const [detailEditing, setDetailEditing] = useState(false);

  const onEditEntry = (entry: JournalEntry) => {
    setDetailEntry(entry);
    setDetailEditing(true);
  };
  const onSelectEntry = (entry: JournalEntry) => {
    setDetailEntry(entry);
    setDetailEditing(false);
  };

  // Objectif calorique + macros cibles (même logique que le profil nutritionnel).
  const objective = nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const age = profile?.birthDate ? computeAge(new Date(profile.birthDate)) : null;
  const tdeeValue = tdee({
    sex: profile?.sex ?? 'unspecified',
    weightKg: profile?.weightKg ?? undefined,
    heightCm: profile?.heightCm ?? undefined,
    age: age ?? undefined,
    activityLevel: nutritionProfile?.activityLevel ?? 'moderate',
  });
  const target = tdeeValue != null ? targetCalories(tdeeValue, objective, nutritionProfile?.manualCalories ?? null) : null;

  // Objectif effectif + bonus du jour SÉLECTIONNÉ : centralisés dans useDayCalorieTarget
  // (RN-02, mode forfait/auto + dépense des courses). Paramétré par `day` → la navigation
  // par jour reste correcte. Les macros cibles restent calées sur l'objectif de base
  // (bonus non ventilé). `bonusSource` pilote le libellé du badge ci-dessous (course vs
  // jour de séance forfait) ; `isLoading` évite un badge transitoire pendant le chargement.
  const {
    effectiveTarget,
    trainingBonus,
    bonusSource,
    isTrainingDay: trainingApplies,
    isLoading: targetLoading,
  } = useDayCalorieTarget(day);

  const manualSet =
    nutritionProfile?.manualProteinG != null ||
    nutritionProfile?.manualCarbsG != null ||
    nutritionProfile?.manualFatG != null;
  const targetMacros = manualSet
    ? {
        protein: nutritionProfile?.manualProteinG ?? 0,
        carbs: nutritionProfile?.manualCarbsG ?? 0,
        fat: nutritionProfile?.manualFatG ?? 0,
      }
    : target != null
      ? macroGramsFromCalories(target, defaultMacroRatios(objective))
      : null;

  const totals = sumNutrients(entries);
  const remaining = effectiveTarget != null ? effectiveTarget - totals.kcal : null;

  const isToday = day === isoDay(new Date());
  const dayLabel = isToday
    ? t('journal.today')
    : new Date(day + 'T00:00:00').toLocaleDateString(i18n.language, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });

  const consumedMacros: Record<MacroKey, number> = {
    protein: totals.proteinG,
    carbs: totals.carbsG,
    fat: totals.fatG,
  };

  const onDeleteEntry = (entry: JournalEntry) => {
    Alert.alert(entry.name, t('journal.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('journal.delete'), style: 'destructive', onPress: () => void removeEntry(entry.id) },
    ]);
  };

  // Copier toute la journée d'hier (4.18) — proposé uniquement si le jour est vide.
  const copyYesterday = () => {
    void duplicateDay(addDays(day, -1), day).then((n) => {
      if (n === 0) Alert.alert(t('journal.copyDayYesterday'), t('journal.nothingYesterdayFull'));
    });
  };

  // Repas configurés résolus (clé + libellé d'affichage). Un repas custom sans nom
  // retombe sur « Repas N » (et non sur sa clé technique `custom-…`, cf. bug corrigé).
  const mealList = useMemo(
    () =>
      resolveMealConfig(nutritionProfile?.meals).map((m, i) => ({
        key: m.key,
        label:
          m.label ??
          (DEFAULT_MEAL_KEYS.includes(m.key as never)
            ? t(`journal.meals.${m.key}`)
            : t('meals.mealN', { n: i + 1 })),
      })),
    [nutritionProfile?.meals, t],
  );
  const configuredKeys = useMemo(() => new Set(mealList.map((m) => m.key)), [mealList]);
  // Entrées « orphelines » : leur repas n'existe plus dans la config (repas supprimé /
  // renommé avec nouvelle clé). Surfacées dans une section « Autres » pour ne rien perdre.
  const orphanEntries = entries.filter((e) => !configuredKeys.has(e.mealType));

  // Position de l'entrée sélectionnée dans son repas (réordonnancement, 4.34) — `entries`
  // est déjà trié par order_index, donc les voisins déterminent si on peut monter/descendre.
  const detailSiblings = detailEntry ? entries.filter((e) => e.mealType === detailEntry.mealType) : [];
  const detailIdx = detailEntry ? detailSiblings.findIndex((e) => e.id === detailEntry.id) : -1;

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('pillars.nutrition')}
        subtitle={t('pillarScreens.nutrition.tagline')}
        action={
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('stats.title')}
              onPress={() => router.push('/nutrition-stats')}
              hitSlop={10}
            >
              <Ionicons name="stats-chart-outline" size={23} color={colors.accent} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nutrition.title')}
              onPress={() => router.push('/nutrition-profile')}
              hitSlop={10}
            >
              <Ionicons name="options-outline" size={24} color={colors.accent} />
            </Pressable>
          </View>
        }
      />

      {/* Navigation entre les jours (4.22) */}
      <View style={styles.dayNav}>
        <Pressable accessibilityLabel={t('journal.prevDay')} onPress={() => setDay(addDays(day, -1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setDay(isoDay(new Date()))}>
          <Text style={[styles.dayLabel, { color: colors.text }]}>{dayLabel}</Text>
        </Pressable>
        <Pressable accessibilityLabel={t('journal.nextDay')} onPress={() => setDay(addDays(day, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Totaux du jour (4.20 / 4.21) */}
        <View style={[styles.totals, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.totalsHead}>
            <View>
              <Text style={[styles.kcalValue, { color: colors.text }]}>{totals.kcal}</Text>
              <Text style={[styles.kcalUnit, { color: colors.textMuted }]}>
                {effectiveTarget != null ? `/ ${effectiveTarget} ${t('nutrition.kcal')}` : t('nutrition.kcal')}
              </Text>
              {trainingApplies && !targetLoading ? (
                <Text style={[styles.trainingBadge, { color: colors.accent }]}>
                  {t(bonusSource === 'run' ? 'journal.runDayBadge' : 'journal.trainingDayBadge', {
                    kcal: trainingBonus,
                  })}
                </Text>
              ) : null}
            </View>
            {remaining != null ? (
              <View style={styles.remaining}>
                <Text style={[styles.remainingValue, { color: remaining < 0 ? colors.danger : colors.success }]}>
                  {remaining < 0 ? '+' : ''}{Math.abs(remaining)}
                </Text>
                <Text style={[styles.kcalUnit, { color: colors.textMuted }]}>
                  {remaining < 0 ? t('journal.over') : t('journal.remaining')}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.macroBars}>
            {MACRO_KEYS.map((key) => {
              const consumed = consumedMacros[key];
              const goal = targetMacros?.[key] ?? 0;
              const pct = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;
              return (
                <View key={key} style={styles.macroBar}>
                  <View style={styles.macroBarHead}>
                    <Text style={[styles.macroName, { color: colors.textMuted }]}>{t(`nutrition.macros.${key}`)}</Text>
                    <Text style={[styles.macroVal, { color: colors.text }]}>
                      {consumed}{goal > 0 ? ` / ${goal}` : ''} g
                    </Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={[styles.fill, { backgroundColor: colors[MACRO_COLORS[key]], width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
          {/* Micronutriments suivis du jour (4.35) */}
          <TrackedMicrosRecap entries={entries} />

          {target == null ? (
            <Pressable onPress={() => router.push('/nutrition-profile')}>
              <Text style={[styles.setupLink, { color: colors.accent }]}>{t('journal.setTarget')}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Copier la journée d'hier (4.18) — seulement si le jour affiché est vide */}
        {entries.length === 0 ? (
          <Pressable
            onPress={copyYesterday}
            style={[styles.copyDay, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('journal.copyDayYesterday')}
          >
            <Ionicons name="copy-outline" size={16} color={colors.accent} />
            <Text style={[styles.copyDayLabel, { color: colors.accent }]}>{t('journal.copyDayYesterday')}</Text>
          </Pressable>
        ) : null}

        {/* Repas configurables (4.14 / 4.15) */}
        {mealList.map((m) => (
          <MealSection
            key={m.key}
            mealKey={m.key}
            mealLabel={m.label}
            day={day}
            entries={entries.filter((e) => e.mealType === m.key)}
            onAdd={() => router.push({ pathname: '/food-picker', params: { date: day, meal: m.key } })}
            onDeleteEntry={onDeleteEntry}
            onSelectEntry={onSelectEntry}
            onEditEntry={onEditEntry}
          />
        ))}

        {/* Section « Autres » : entrées dont le repas n'existe plus (récupération). Pas
            d'ajout direct — on les déplace vers un vrai repas depuis leur détail. */}
        {orphanEntries.length > 0 ? (
          <MealSection
            key="__orphan__"
            mealKey="__orphan__"
            mealLabel={t('journal.meals.other')}
            day={day}
            entries={orphanEntries}
            onDeleteEntry={onDeleteEntry}
            onSelectEntry={onSelectEntry}
            onEditEntry={onEditEntry}
          />
        ) : null}

        <Pressable onPress={() => router.push('/nutrition-meals')} style={styles.manageMeals}>
          <Ionicons name="create-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.manageMealsLabel, { color: colors.textMuted }]}>{t('meals.manage')}</Text>
        </Pressable>
      </ScrollView>

      {/* Détail d'une entrée de journal (4.34) — snapshot de la quantité journalisée */}
      <EntryDetailModal
        entry={detailEntry}
        startEditing={detailEditing}
        onClose={() => {
          setDetailEntry(null);
          setDetailEditing(false);
        }}
        onMoveUp={detailIdx > 0 ? () => void moveEntry(detailEntry!.id, 'up') : undefined}
        onMoveDown={
          detailIdx >= 0 && detailIdx < detailSiblings.length - 1
            ? () => void moveEntry(detailEntry!.id, 'down')
            : undefined
        }
        meals={mealList}
        onReassign={(entryId, mealKey) => {
          void reassignEntryMeal(entryId, mealKey);
          setDetailEntry(null);
          setDetailEditing(false);
        }}
      />
    </Screen>
  );
}

/** Totaux du jour des micronutriments suivis, sous les barres macros du récap (4.35). */
function TrackedMicrosRecap({ entries }: { entries: JournalEntry[] }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const tracked = useTrackedMicros((s) => s.tracked);
  const dayMicros = useMemo(
    () => sumMicronutrients(entries.map((e) => e.micronutrients)),
    [entries],
  );
  if (tracked.length === 0) return null;
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const row = (label: string, value: string, unit: string, key: string) => (
    <View key={key} style={styles.microRow}>
      <Text style={[styles.microLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text style={styles.microValueWrap}>
        <Text style={[styles.microValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.microUnit, { color: colors.textMuted }]}> {unit}</Text>
      </Text>
    </View>
  );

  return (
    <View style={[styles.microsRecap, { borderTopColor: colors.border }]}>
      {tracked.map((key) =>
        row(
          t(`nutrition.micros.labels.${key}`),
          fmtMicro(dayMicros[key] ?? 0, lang),
          t(`nutrition.micros.units.${microUnit(key)}`),
          key,
        ),
      )}
      {tracked.includes('sodium_mg')
        ? row(
            t('nutrition.micros.labels.salt'),
            fmtMicro(saltFromSodiumMg(dayMicros.sodium_mg ?? 0), lang, 2),
            t('nutrition.micros.units.g'),
            'salt',
          )
        : null}
    </View>
  );
}

/** Modal de détail d'une entrée : macros + micronutriments figés pour la quantité (4.34). */
type MealOption = { key: string; label: string };

function EntryDetailModal({
  entry,
  startEditing,
  onClose,
  onMoveUp,
  onMoveDown,
  meals,
  onReassign,
}: {
  entry: JournalEntry | null;
  startEditing?: boolean;
  onClose: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  meals: MealOption[];
  onReassign: (entryId: string, mealKey: string) => void;
}) {
  if (entry == null) return null;
  // Remonté à chaque ouverture (key) : l'état d'édition repart propre pour chaque entrée.
  return (
    <EntryDetailContent
      key={entry.id}
      entry={entry}
      startEditing={startEditing}
      onClose={onClose}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      meals={meals}
      onReassign={onReassign}
    />
  );
}

function EntryDetailContent({
  entry,
  startEditing,
  onClose,
  onMoveUp,
  onMoveDown,
  meals,
  onReassign,
}: {
  entry: JournalEntry;
  startEditing?: boolean;
  onClose: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  meals: MealOption[];
  onReassign: (entryId: string, mealKey: string) => void;
}) {
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
            <MicronutrientDetails
              micronutrients={previewMicros}
              grams={100}
              showPer100={false}
              defaultOpen
            />

            {/* Déplacer l'entrée vers un autre repas (récupération des orphelines incluse). */}
            {!editing && meals.length > 0 ? (
              <View style={styles.moveBlock}>
                <Text style={[styles.moveLabel, { color: colors.textMuted }]}>
                  {t('journal.detail.moveTo')}
                </Text>
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

function MealSection({
  mealKey,
  mealLabel,
  day,
  entries,
  onAdd,
  onDeleteEntry,
  onSelectEntry,
  onEditEntry,
}: {
  mealKey: string;
  mealLabel: string;
  day: string;
  entries: JournalEntry[];
  /** Ajout d'un aliment. Absent pour la section « Autres » (récupération seule). */
  onAdd?: () => void;
  onDeleteEntry: (e: JournalEntry) => void;
  onSelectEntry: (e: JournalEntry) => void;
  onEditEntry: (e: JournalEntry) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const mealKcal = entries.reduce((s, e) => s + e.kcal, 0);

  const copyFromYesterday = () => {
    void copyMeal(addDays(day, -1), mealKey, day).then((n) => {
      if (n === 0) Alert.alert(mealLabel, t('journal.nothingYesterday'));
    });
  };

  const saveAsTemplate = () => {
    const items = entries.map((e) => ({
      foodId: e.foodId,
      name: e.name,
      quantityG: e.quantityG,
      kcal: e.kcal,
      proteinG: e.proteinG,
      carbsG: e.carbsG,
      fatG: e.fatG,
    }));
    void saveMealAsTemplate(mealLabel, items).then(() =>
      Alert.alert(t('journal.templateSaved'), mealLabel),
    );
  };

  return (
    <View style={styles.meal}>
      <View style={styles.mealHead}>
        <Text style={[styles.mealName, { color: colors.text }]}>{mealLabel}</Text>
        <View style={styles.mealHeadRight}>
          {entries.length > 0 ? (
            <Pressable onPress={saveAsTemplate} hitSlop={8} accessibilityLabel={t('journal.saveMeal')}>
              <Ionicons name="bookmark-outline" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <Text style={[styles.mealKcal, { color: colors.textMuted }]}>{mealKcal} {t('nutrition.kcal')}</Text>
        </View>
      </View>
      <View style={[styles.mealCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {entries.map((e) => (
          <ReanimatedSwipeable
            key={e.id}
            friction={2}
            rightThreshold={40}
            renderRightActions={() => (
              <View style={styles.swipeActions}>
                <Pressable
                  onPress={() => onEditEntry(e)}
                  style={[styles.swipeAction, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('journal.swipeEdit')}
                >
                  <Ionicons name="create-outline" size={20} color="#fff" />
                  <Text style={styles.swipeActionLabel}>{t('journal.swipeEdit')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onDeleteEntry(e)}
                  style={[styles.swipeAction, { backgroundColor: colors.danger }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('journal.delete')}
                >
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                  <Text style={styles.swipeActionLabel}>{t('journal.delete')}</Text>
                </Pressable>
              </View>
            )}
          >
            <Pressable
              onPress={() => onSelectEntry(e)}
              style={[styles.entry, { backgroundColor: colors.surface }]}
              accessibilityHint={t('journal.swipeHint')}
            >
              <View style={styles.entryMain}>
                <Text style={[styles.entryName, { color: colors.text }]} numberOfLines={1}>{e.name}</Text>
                {e.quantityG != null ? (
                  <Text style={[styles.entryQty, { color: colors.textMuted }]}>{e.quantityG} g</Text>
                ) : null}
              </View>
              <Text style={[styles.entryKcal, { color: colors.textMuted }]}>{e.kcal} {t('nutrition.kcal')}</Text>
            </Pressable>
          </ReanimatedSwipeable>
        ))}
        {onAdd ? (
          <View style={styles.mealActions}>
            <Pressable onPress={onAdd} style={styles.addRow} accessibilityRole="button">
              <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
              <Text style={[styles.addLabel, { color: colors.accent }]}>{t('journal.addFood')}</Text>
            </Pressable>
            {entries.length === 0 ? (
              <Pressable onPress={copyFromYesterday} style={styles.addRow} accessibilityRole="button">
                <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.copyLabel, { color: colors.textMuted }]}>{t('journal.copyYesterday')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  dayLabel: { fontFamily: fontFamily.bodyBold, fontSize: 16, textTransform: 'capitalize' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  mealHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  content: { gap: 16, paddingBottom: 32 },
  totals: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14 },
  totalsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  kcalValue: { fontFamily: fontFamily.displayBold, fontSize: 36 },
  kcalUnit: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  remaining: { alignItems: 'flex-end' },
  remainingValue: { fontFamily: fontFamily.monoBold, fontSize: 22 },
  macroBars: { gap: 10 },
  macroBar: { gap: 4 },
  macroBarHead: { flexDirection: 'row', justifyContent: 'space-between' },
  macroName: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  macroVal: { fontFamily: fontFamily.mono, fontSize: 13 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  setupLink: { fontFamily: fontFamily.bodySemi, fontSize: 14, textAlign: 'center' },
  trainingBadge: { fontFamily: fontFamily.bodySemi, fontSize: 12, marginTop: 2 },
  microsRecap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  microRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  microLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13, flexShrink: 1 },
  microValueWrap: { flexShrink: 0 },
  microValue: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  microUnit: { fontFamily: fontFamily.mono, fontSize: 11 },
  copyDay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  copyDayLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  modalTitle: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  modalSub: { fontFamily: fontFamily.mono, fontSize: 13, marginTop: 2 },
  modalBody: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  detailMacros: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  detailKcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  detailKcal: { fontFamily: fontFamily.displayBold, fontSize: 32 },
  detailMacroRow: { flexDirection: 'row', gap: 10 },
  detailMacro: { flex: 1, gap: 2 },
  detailMacroVal: { fontFamily: fontFamily.monoBold, fontSize: 16 },
  reorderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  deleteAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  deleteLabel: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  moveBlock: { gap: 8 },
  moveLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  moveChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moveChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  moveChipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  meal: { gap: 8 },
  mealHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  mealName: { fontFamily: fontFamily.displaySemi, fontSize: 17 },
  mealKcal: { fontFamily: fontFamily.mono, fontSize: 13 },
  mealCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,133,111,0.25)',
    gap: 12,
  },
  swipeActions: { flexDirection: 'row', alignItems: 'stretch' },
  swipeAction: { justifyContent: 'center', alignItems: 'center', gap: 2, width: 76 },
  swipeActionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11, color: '#fff' },
  entryMain: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  entryName: { fontFamily: fontFamily.bodySemi, fontSize: 15, flexShrink: 1 },
  entryQty: { fontFamily: fontFamily.mono, fontSize: 12 },
  entryKcal: { fontFamily: fontFamily.mono, fontSize: 13 },
  mealActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  addLabel: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  copyLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  manageMeals: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  manageMealsLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
