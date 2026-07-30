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
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { MacroSuggestionCard } from '@/components/nutrition/MacroSuggestionCard';
import { DayBalanceCard } from '@/components/nutrition/DayBalanceCard';
import { MacroTriple, type MacroKey } from '@/components/nutrition/MacroTriple';
import { MicroCoverageGrid, type MicroCell } from '@/components/nutrition/MicroCoverageGrid';
import { useRecentFoods } from '@/data/repositories/food-repository';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, m! - 1, d! + n);
  return isoDay(date);
};

/** Unité d'un micronutriment déduite du suffixe de sa clé (`_mg` / `_ug`). */
const microUnit = (key: MicronutrientKey): 'mg' | 'ug' => (key.endsWith('_ug') ? 'ug' : 'mg');

/** Format micro : entier ≥ 10, sinon 1 décimale ; virgule décimale en FR (cf. MicronutrientDetails). */
function fmtMicro(n: number, lang: 'fr' | 'en', decimals?: number): string {
  const d = decimals ?? (n >= 10 ? 0 : 1);
  const s = n.toFixed(d);
  return lang === 'fr' ? s.replace('.', ',') : s;
}
/** Emoji d'en-tête de repas — repère visuel de la maquette, replié sur 🍽️ pour un repas perso. */
const MEAL_ICONS: Record<string, string> = {
  breakfast: '🥐',
  lunch: '🍽️',
  dinner: '🍲',
  snack: '🍎',
};

export default function NutritionScreen() {
  useMenuFocus('nutrition');
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
  // Toujours calculée : aujourd'hui, elle passe en sous-titre sous « Aujourd'hui » (la date reste
  // utile pour se repérer) ; les autres jours, elle devient le libellé principal.
  const dayLabel = new Date(day + 'T00:00:00').toLocaleDateString(i18n.language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  // US NUTR-F2 — vivier de suggestion : les **aliments récents** (décision D4 — on mange ce qu'on a
  // chez soi, et suggérer un aliment jamais consommé reste un conseil théorique).
  //
  // ⚠️ Réduction assumée par rapport à la spec, qui prévoyait « récents **puis la base** » : scorer la
  // base côté client obligerait à charger l'intégralité de CIQUAL en mémoire à chaque rendu de
  // l'onglet. Un repli sur la base demande un **pré-filtrage SQL** (les N aliments les plus denses
  // pour le macro visé) — voir la spec §2.
  const { foods: recentFoods } = useRecentFoods(40);
  const recentIds = useMemo(() => recentFoods.map((f) => f.id), [recentFoods]);
  const suggestionCandidates = useMemo(
    () =>
      recentFoods.map((f) => ({
        id: f.id,
        name: f.name,
        kcalPer100g: f.kcalPer100g,
        proteinPer100g: f.proteinPer100g,
        carbsPer100g: f.carbsPer100g,
        fatPer100g: f.fatPer100g,
      })),
    [recentFoods],
  );

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

      {/* Navigation entre les jours (4.22) — encartée : elle appartient au contenu du journal,
          pas à l'en-tête de l'app, et se distingue ainsi des actions de la barre de titre. */}
      <View style={[styles.dayNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('journal.prevDay')}
          onPress={() => setDay(addDays(day, -1))}
          style={styles.dayNavBtn}
          hitSlop={6}
        >
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </Pressable>
        <Pressable onPress={() => setDay(isoDay(new Date()))} style={styles.dayNavCenter}>
          <Text style={[styles.dayLabel, { color: colors.text }]}>
            {isToday ? t('journal.today') : dayLabel}
          </Text>
          {isToday ? <Text style={[styles.dayDate, { color: colors.textMuted }]}>{dayLabel}</Text> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('journal.nextDay')}
          onPress={() => setDay(addDays(day, 1))}
          style={styles.dayNavBtn}
          hitSlop={6}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Bilan du jour (4.20 / 4.21) — carte héros */}
        <DayBalanceCard
          consumed={totals.kcal}
          target={effectiveTarget}
          trainingBonus={trainingBonus}
          bonusSource={bonusSource}
          isTrainingDay={trainingApplies && !targetLoading}
          onSetTarget={() => router.push('/nutrition-profile')}
        />

        <MacroTriple consumed={consumedMacros} targets={targetMacros} />

        {/* Micronutriments suivis du jour (4.35) */}
        <TrackedMicrosRecap entries={entries} />

        {/* Journée vide (4.18) — un état plein plutôt qu'une simple ligne pointillée : c'est le
            premier écran d'un nouvel utilisateur, et « copier hier » y est l'action la plus utile. */}
        {entries.length === 0 ? (
          <View style={[styles.emptyDay, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.track }]}>
              <Text style={styles.emptyIconGlyph}>🍽️</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('journal.emptyDay.title')}</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{t('journal.emptyDay.body')}</Text>
            <Pressable
              onPress={copyYesterday}
              style={[styles.emptyPrimary, { backgroundColor: colors.panel }]}
              accessibilityRole="button"
              accessibilityLabel={t('journal.copyDayYesterday')}
            >
              <Ionicons name="copy-outline" size={17} color={colors.panelText} />
              <Text style={[styles.emptyPrimaryLabel, { color: colors.panelText }]}>
                {t('journal.copyDayYesterday')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/food-picker',
                  params: { date: day, meal: mealList[0]?.key ?? 'breakfast' },
                })
              }
              style={[styles.emptySecondary, { borderColor: colors.borderStrong }]}
              accessibilityRole="button"
            >
              <Text style={[styles.emptyPrimaryLabel, { color: colors.accent }]}>
                + {t('journal.addFood')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Repas configurables (4.14 / 4.15). Masqués sur une journée vide : l'état vide ci-dessus
            porte déjà les deux actions utiles, et empiler 5 cartes pointillées identiques par-dessus
            ne donnait aucun repère de plus — juste du bruit. */}
        {entries.length > 0 ? mealList.map((m) => (
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
        )) : null}

        {/* US NUTR-F2 — suggestion pour combler un macro. La carte se rend `null` d'elle-même s'il
            n'y a pas d'objectif, pas d'écart significatif, ou plus de budget calorique (D6). Placée
            sous les repas : le conseil doit apparaître là où le manque se voit. Jour courant
            seulement — et jamais sur une journée vide, où « il te manque 160 g de protéines » n'est
            qu'une paraphrase de l'objectif, pas un conseil. */}
        {isToday && entries.length > 0 ? (
          <MacroSuggestionCard
            day={day}
            mealType={mealList[0]?.key ?? 'snack'}
            consumed={consumedMacros}
            targets={targetMacros}
            kcalRemaining={remaining}
            candidates={suggestionCandidates}
            recentIds={recentIds}
          />
        ) : null}

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

/** Micronutriments suivis du jour, en grille de couverture (4.35). */
function TrackedMicrosRecap({ entries }: { entries: JournalEntry[] }) {
  const { t, i18n } = useTranslation();
  const tracked = useTrackedMicros((s) => s.tracked);
  const dayMicros = useMemo(
    () => sumMicronutrients(entries.map((e) => e.micronutrients)),
    [entries],
  );
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const cells = useMemo<MicroCell[]>(() => {
    const list: MicroCell[] = tracked.map((key) => ({
      key,
      label: t(`nutrition.micros.labels.${key}`),
      value: fmtMicro(dayMicros[key] ?? 0, lang),
      unit: t(`nutrition.micros.units.${microUnit(key)}`),
      amount: dayMicros[key] ?? 0,
    }));
    // Le sel est dérivé du sodium et n'a pas de VNR : il reste affiché, sans anneau.
    if (tracked.includes('sodium_mg')) {
      list.push({
        key: 'salt',
        label: t('nutrition.micros.labels.salt'),
        value: fmtMicro(saltFromSodiumMg(dayMicros.sodium_mg ?? 0), lang, 2),
        unit: t('nutrition.micros.units.g'),
        amount: null,
      });
    }
    return list;
  }, [tracked, dayMicros, lang, t]);

  if (tracked.length === 0) return null;
  return <MicroCoverageGrid cells={cells} />;
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
  // Menu du repas (copier / enregistrer comme modèle) : replié par défaut. Deux actions
  // secondaires n'ont pas à occuper l'en-tête de chacun des 3 à 6 repas de la journée.
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Repas vide et ajoutable → carte pointillée, sans en-tête ni total : il n'y a rien à totaliser,
  // et l'écran reste lisible quand 3 repas sur 5 sont vides en début de journée.
  if (entries.length === 0 && onAdd) {
    return (
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={`${mealLabel} · ${t('journal.addFood')}`}
        style={[styles.mealEmpty, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
      >
        <View style={styles.mealEmptyLeft}>
          <Text style={styles.mealIcon}>{MEAL_ICONS[mealKey] ?? '🍽️'}</Text>
          <Text style={[styles.mealEmptyName, { color: colors.textMuted }]} numberOfLines={1}>
            {mealLabel}
          </Text>
        </View>
        <Text style={[styles.mealEmptyAdd, { color: colors.accent }]}>+ {t('journal.add')}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.mealCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.mealHead, { borderBottomColor: colors.border }]}>
        <Text style={styles.mealIcon}>{MEAL_ICONS[mealKey] ?? '🍽️'}</Text>
        <Text style={[styles.mealName, { color: colors.text }]} numberOfLines={1}>{mealLabel}</Text>
        <Text style={[styles.mealKcal, { color: colors.textMuted }]}>
          {mealKcal}
          <Text style={styles.mealKcalUnit}> {t('nutrition.kcal')}</Text>
        </Text>
        {entries.length > 0 ? (
          <Pressable
            onPress={() => setMenuOpen((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: menuOpen }}
            accessibilityLabel={t('journal.mealMenu', { meal: mealLabel })}
            style={[styles.mealMenuBtn, { backgroundColor: colors.track }]}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      {menuOpen ? (
        <View style={[styles.mealMenu, { backgroundColor: colors.track, borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              copyFromYesterday();
            }}
            style={[styles.mealMenuChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.mealMenuLabel, { color: colors.text }]}>{t('journal.copyYesterday')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              saveAsTemplate();
            }}
            style={[styles.mealMenuChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.mealMenuLabel, { color: colors.text }]}>{t('journal.saveMeal')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.mealItems}>
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
          <Pressable onPress={onAdd} style={styles.addRow} accessibilityRole="button">
            <View style={[styles.addGlyph, { backgroundColor: colors.track }]}>
              <Ionicons name="add" size={15} color={colors.accent} />
            </View>
            <Text style={[styles.addLabel, { color: colors.accent }]}>{t('journal.addFood')}</Text>
          </Pressable>
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
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  dayNavBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  dayNavCenter: { alignItems: 'center' },
  dayLabel: { fontFamily: fontFamily.displayBold, fontSize: 15, textTransform: 'capitalize' },
  dayDate: { fontFamily: fontFamily.mono, fontSize: 11.5, textTransform: 'capitalize' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  content: { gap: 12, paddingBottom: 32 },
  emptyDay: { borderRadius: 20, borderWidth: 1, paddingVertical: 34, paddingHorizontal: 24, alignItems: 'center' },
  emptyIcon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyIconGlyph: { fontSize: 28 },
  emptyTitle: { fontFamily: fontFamily.displayBold, fontSize: 18, marginBottom: 5, textAlign: 'center' },
  emptyBody: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 20, textAlign: 'center', maxWidth: 250, marginBottom: 18 },
  emptyPrimary: {
    height: 48,
    alignSelf: 'stretch',
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  emptyPrimaryLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  emptySecondary: {
    height: 48,
    alignSelf: 'stretch',
    borderRadius: 15,
    borderWidth: 1.5,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  modalTitle: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  modalSub: { fontFamily: fontFamily.mono, fontSize: 13, marginTop: 2 },
  modalBody: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  detailMacros: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  detailKcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  detailKcal: { fontFamily: fontFamily.displayBold, fontSize: 32 },
  // Conservés pour le détail d'entrée (modal), qui garde sa mise en page en lignes.
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
  moveLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  moveChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moveChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  moveChipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  mealCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  mealHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingLeft: 15,
    paddingRight: 12,
    paddingTop: 13,
    paddingBottom: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mealIcon: { fontSize: 19 },
  mealName: { fontFamily: fontFamily.bodyBold, fontSize: 15, flex: 1 },
  mealKcal: { fontFamily: fontFamily.monoBold, fontSize: 13 },
  mealKcalUnit: { fontFamily: fontFamily.mono, fontSize: 10 },
  mealMenuBtn: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  mealMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mealMenuChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 },
  mealMenuLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  mealItems: { paddingVertical: 4, paddingHorizontal: 4 },
  mealEmpty: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mealEmptyLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1 },
  mealEmptyName: { fontFamily: fontFamily.bodyBold, fontSize: 15, flexShrink: 1 },
  mealEmptyAdd: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 12,
  },
  swipeActions: { flexDirection: 'row', alignItems: 'stretch' },
  swipeAction: { justifyContent: 'center', alignItems: 'center', gap: 2, width: 76 },
  swipeActionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11, color: '#fff' },
  entryMain: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  entryName: { fontFamily: fontFamily.body, fontSize: 13.5, flexShrink: 1 },
  entryQty: { fontFamily: fontFamily.mono, fontSize: 12 },
  entryKcal: { fontFamily: fontFamily.monoBold, fontSize: 12.5 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, paddingVertical: 9 },
  addGlyph: { width: 20, height: 20, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  addLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  manageMeals: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  manageMealsLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
