import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  addDays,
  computeAge,
  dayTargetKcal,
  DEFAULT_MEAL_KEYS,
  localDateFromDayKey,
  localDayKey,
  objectiveFromGoal,
  resolveMealConfig,
  startOfWeek,
  targetCalories,
  tdee,
  weekDayKeys,
  type PlannedMealEntry,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { MealPlanDayCard } from '@/components/nutrition/MealPlanDayCard';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useRecipes } from '@/data/repositories/recipe-repository';
import { useMealTemplates } from '@/data/repositories/meal-template-repository';
import {
  consumePlannedEntry,
  duplicateWeek,
  planRecipe,
  planTemplate,
  removePlannedEntry,
  undoConsumedEntry,
  useWeekMealPlan,
  useWeekMealPlanCount,
} from '@/data/repositories/meal-plan-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Clés i18n des jours de semaine, indexées 0 = lundi … 6 = dimanche (comme `planning/`). */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

type AddTarget = { dayKey: string; mealKey: string };

/**
 * Planning repas à la semaine (US REPAS-01, roadmap 4.27).
 *
 * Module **optionnel**, atteint volontairement depuis le hub Nutrition : pas de widget d'accueil,
 * pas de réglage d'activation (règle R15).
 *
 * ⚠️ Écran d'**intention** : il n'écrit jamais dans le journal alimentaire (règle R1). Seul
 * « J'ai mangé ça » crée des `food_entries`, et il est réversible (R2/R3).
 */
export default function MealPlanScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [weekStart, setWeekStart] = useState(() => localDayKey(startOfWeek(new Date())));
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [busy, setBusy] = useState(false);

  const { entries } = useWeekMealPlan(weekStart);
  const { items: sessions } = useWeekPlan(weekStart);
  // Semaine source de la duplication : on ne propose l'action que si elle a du contenu.
  const previousWeekStart = useMemo(
    () => localDayKey(addDays(localDateFromDayKey(weekStart), -7)),
    [weekStart],
  );
  const { count: previousWeekCount } = useWeekMealPlanCount(previousWeekStart);
  const { nutritionProfile } = useNutritionProfile();
  const { profile } = useProfile();
  const { settings } = useSettings();

  const todayKey = localDayKey(new Date());
  const dayKeys = useMemo(() => weekDayKeys(weekStart), [weekStart]);

  // Repas configurés (clé + libellé d'affichage) — même résolution que le journal, pour que le
  // planning et le journal parlent des mêmes repas.
  const mealConfig = useMemo(
    () => resolveMealConfig(nutritionProfile?.meals),
    [nutritionProfile?.meals],
  );
  const mealLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    mealConfig.forEach((m, i) => {
      labels[m.key] =
        m.label ??
        (DEFAULT_MEAL_KEYS.includes(m.key as never)
          ? t(`journal.meals.${m.key}`)
          : t('meals.mealN', { n: i + 1 }));
    });
    return labels;
  }, [mealConfig, t]);

  // Objectif calorique de base — même chaîne de calcul que le hub nutrition et `useDayCalorieTarget`.
  const objective = nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const age = profile?.birthDate ? computeAge(new Date(profile.birthDate)) : undefined;
  const tdeeValue = tdee({
    sex: profile?.sex ?? 'unspecified',
    weightKg: profile?.weightKg ?? undefined,
    heightCm: profile?.heightCm ?? undefined,
    age,
    activityLevel: nutritionProfile?.activityLevel ?? 'moderate',
  });
  const baseTarget =
    tdeeValue != null && objective != null
      ? targetCalories(tdeeValue, objective, nutritionProfile?.manualCalories ?? null)
      : null;

  /**
   * Bonus des jours d'entraînement : **forfait fixe uniquement** ici, jamais le mode `auto` de
   * RN-02. Ce mode dérive le bonus de la dépense d'une course **déjà enregistrée** — une notion
   * qui n'existe pas pour un jour futur, qui est tout l'objet d'un planning.
   */
  const trainingBonus = nutritionProfile?.trainingDayBonus ?? 0;

  // Décision H : sans pilier d'entraînement actif, le planning repas ne parle pas d'entraînement.
  const activePillars = settings?.activePillars ?? [];
  const trainingPillarsActive =
    activePillars.includes('strength') || activePillars.includes('running');

  const trainingDays = useMemo(
    () => new Set(sessions.map((s) => s.scheduledDate)),
    [sessions],
  );

  const entriesByDay = useMemo(() => {
    const map = new Map<string, PlannedMealEntry[]>();
    for (const e of entries) {
      const list = map.get(e.planDate);
      if (list) list.push(e);
      else map.set(e.planDate, [e]);
    }
    return map;
  }, [entries]);

  const shiftWeek = (delta: number) => {
    setWeekStart(localDayKey(addDays(localDateFromDayKey(weekStart), delta * 7)));
  };

  const weekLabel = useMemo(() => {
    const start = localDateFromDayKey(weekStart);
    const end = addDays(start, 6);
    return t('mealPlan.week.range', {
      from: `${start.getDate()}/${start.getMonth() + 1}`,
      to: `${end.getDate()}/${end.getMonth() + 1}`,
    });
  }, [weekStart, t]);

  const currentWeekStart = localDayKey(startOfWeek(new Date()));
  const weekSubtitle =
    weekStart === currentWeekStart
      ? t('mealPlan.week.current')
      : weekStart === localDayKey(addDays(localDateFromDayKey(currentWeekStart), 7))
        ? t('mealPlan.week.next')
        : null;

  const onDuplicatePreviousWeek = async () => {
    setBusy(true);
    try {
      const previous = localDayKey(addDays(localDateFromDayKey(weekStart), -7));
      await duplicateWeek(previous, weekStart);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('mealPlan.title')} subtitle={t('mealPlan.subtitle')} />

      <View style={[styles.weekNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          onPress={() => shiftWeek(-1)}
          accessibilityRole="button"
          accessibilityLabel={t('mealPlan.week.previousA11y')}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </Pressable>
        <View style={styles.weekTexts}>
          <Text style={[styles.weekLabel, { color: colors.text }]}>{weekLabel}</Text>
          {weekSubtitle && (
            <Text style={[styles.weekSub, { color: colors.textMuted }]}>{weekSubtitle}</Text>
          )}
        </View>
        <Pressable
          onPress={() => shiftWeek(1)}
          accessibilityRole="button"
          accessibilityLabel={t('mealPlan.week.nextA11y')}
          hitSlop={10}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {entries.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('mealPlan.empty.title')}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {t('mealPlan.empty.message')}
            </Text>
          </View>
        )}

        {dayKeys.map((dayKey, index) => {
          const dayEntries = entriesByDay.get(dayKey) ?? [];
          const hasTrainingSession = trainingDays.has(dayKey);
          const appliedBonus =
            hasTrainingSession && trainingPillarsActive ? Math.max(0, trainingBonus) : 0;

          return (
            <MealPlanDayCard
              key={dayKey}
              dayKey={dayKey}
              dayLabel={`${t(`common.weekday.${WEEKDAY_KEYS[index]}`)} ${localDateFromDayKey(dayKey).getDate()}`}
              isToday={dayKey === todayKey}
              entries={dayEntries}
              mealConfig={mealConfig}
              mealLabels={mealLabels}
              targetKcal={dayTargetKcal({
                targetKcal: baseTarget,
                trainingBonusKcal: trainingBonus,
                hasTrainingSession,
                trainingPillarsActive,
              })}
              trainingBonusKcal={appliedBonus}
              onAdd={(mealKey) => setAddTarget({ dayKey, mealKey })}
              onConsume={(entry) => void consumePlannedEntry(entry.id)}
              onUndoConsume={(entry) => void undoConsumedEntry(entry.id)}
              onRemove={(entry) => void removePlannedEntry(entry.id)}
            />
          );
        })}

        {/* Dupliquer n'est proposé que si la semaine précédente a du contenu (arbitrage Florian du
            04/08/2026). Sinon l'appel « réussissait » en ne copiant rien, sans le moindre retour.
            Le bouton est remplacé par une explication, jamais retiré en silence — même principe
            que le bouton « liste de courses » ci-dessous. */}
        {previousWeekCount > 0 ? (
          <Button
            label={t('mealPlan.duplicateWeek.action')}
            variant="ghost"
            onPress={() => void onDuplicatePreviousWeek()}
            loading={busy}
          />
        ) : (
          <Text style={[styles.duplicateEmpty, { color: colors.textMuted }]}>
            {t('mealPlan.duplicateWeek.emptySource')}
          </Text>
        )}

        {/* Le bouton n'apparaît que si la semaine a du contenu : générer une liste vide n'a aucun
            sens, et un bouton grisé sans explication est pire qu'un bouton absent. */}
        {entries.length > 0 && (
          <Button
            label={t('mealPlan.shopping.open')}
            onPress={() => router.push(`/meal-plan/shopping?week=${weekStart}`)}
          />
        )}
      </ScrollView>

      <AddEntrySheet
        target={addTarget}
        mealLabel={addTarget ? (mealLabels[addTarget.mealKey] ?? t('mealPlan.day.otherMeal')) : ''}
        onClose={() => setAddTarget(null)}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Feuille d'ajout : recette (avec portions) ou repas type — décision D1
// ---------------------------------------------------------------------------

function AddEntrySheet({
  target,
  mealLabel,
  onClose,
}: {
  target: AddTarget | null;
  mealLabel: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { recipes } = useRecipes();
  const { templates } = useMealTemplates();

  const [tab, setTab] = useState<'recipes' | 'templates'>('recipes');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [servings, setServings] = useState(1);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setSelectedId(null);
    setServings(1);
    setTab('recipes');
    onClose();
  };

  const selectedRecipe = recipes.find((r) => r.id === selectedId) ?? null;
  const selectedTemplate = templates.find((tpl) => tpl.id === selectedId) ?? null;

  // Une recette porte ses macros pour la TOTALITÉ de son rendement : ce qu'on ajoute est
  // proportionnel aux portions demandées (règle R8).
  const previewKcal =
    tab === 'recipes' && selectedRecipe
      ? Math.round((selectedRecipe.totalKcal * servings) / Math.max(1, selectedRecipe.servings))
      : (selectedTemplate?.totalKcal ?? 0);

  const onConfirm = async () => {
    if (!target || !selectedId) return;
    setSaving(true);
    try {
      if (tab === 'recipes') {
        await planRecipe(target.dayKey, target.mealKey, selectedId, servings);
      } else {
        await planTemplate(target.dayKey, target.mealKey, selectedId);
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={target !== null} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityElementsHidden />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.grab, { backgroundColor: colors.borderStrong }]} />
        <Text style={[styles.sheetTitle, { color: colors.text }]}>
          {t('mealPlan.add.title', { meal: mealLabel })}
        </Text>

        <View style={[styles.segment, { borderColor: colors.border }]}>
          {(['recipes', 'templates'] as const).map((key) => (
            <Pressable
              key={key}
              onPress={() => {
                setTab(key);
                setSelectedId(null);
                setServings(1);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === key }}
              accessibilityLabel={t(`mealPlan.add.${key}`)}
              style={[
                styles.segmentItem,
                {
                  backgroundColor: tab === key ? colors.accent : colors.background,
                },
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  { color: tab === key ? colors.accentText : colors.textMuted },
                ]}
              >
                {t(`mealPlan.add.${key}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={styles.options} showsVerticalScrollIndicator={false}>
          {tab === 'recipes' &&
            recipes.length === 0 && (
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                {t('mealPlan.add.noRecipe')}
              </Text>
            )}
          {tab === 'templates' &&
            templates.length === 0 && (
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                {t('mealPlan.add.noTemplate')}
              </Text>
            )}

          {tab === 'recipes'
            ? recipes.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedId(r.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedId === r.id }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selectedId === r.id ? colors.surface : colors.background,
                      borderColor: selectedId === r.id ? colors.accent : colors.border,
                      borderWidth: selectedId === r.id ? 1.5 : 1,
                    },
                  ]}
                >
                  <View style={styles.optionTexts}>
                    <Text style={[styles.optionName, { color: colors.text }]}>{r.name}</Text>
                    <Text style={[styles.optionMeta, { color: colors.textMuted }]}>
                      {t('mealPlan.add.recipeMeta', {
                        servings: r.servings,
                        kcal: Math.round(r.totalKcal / Math.max(1, r.servings)),
                      })}
                    </Text>
                  </View>
                  {selectedId === r.id && (
                    <Ionicons name="checkmark" size={20} color={colors.accent} />
                  )}
                </Pressable>
              ))
            : templates.map((tpl) => (
                <Pressable
                  key={tpl.id}
                  onPress={() => setSelectedId(tpl.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedId === tpl.id }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selectedId === tpl.id ? colors.surface : colors.background,
                      borderColor: selectedId === tpl.id ? colors.accent : colors.border,
                      borderWidth: selectedId === tpl.id ? 1.5 : 1,
                    },
                  ]}
                >
                  <View style={styles.optionTexts}>
                    <Text style={[styles.optionName, { color: colors.text }]}>{tpl.name}</Text>
                    <Text style={[styles.optionMeta, { color: colors.textMuted }]}>
                      {t('mealPlan.add.templateMeta', {
                        count: tpl.itemCount,
                        kcal: tpl.totalKcal,
                      })}
                    </Text>
                  </View>
                  {selectedId === tpl.id && (
                    <Ionicons name="checkmark" size={20} color={colors.accent} />
                  )}
                </Pressable>
              ))}
        </ScrollView>

        {/* Portions : recettes seulement. Un repas type n'a pas cette notion (décision D1). */}
        {tab === 'recipes' && selectedRecipe && (
          <>
            <View
              style={[
                styles.stepper,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.stepperLabel, { color: colors.text }]}>
                {t('mealPlan.add.servings')}
              </Text>
              <View style={styles.stepperCtl}>
                <Pressable
                  onPress={() => setServings((s) => Math.max(1, s - 1))}
                  accessibilityRole="button"
                  accessibilityLabel={t('mealPlan.add.servingsMinus')}
                  hitSlop={8}
                  style={[styles.stepperBtn, { backgroundColor: colors.accent }]}
                >
                  <Ionicons name="remove" size={16} color={colors.accentText} />
                </Pressable>
                <Text style={[styles.stepperValue, { color: colors.text }]}>{servings}</Text>
                <Pressable
                  onPress={() => setServings((s) => s + 1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('mealPlan.add.servingsPlus')}
                  hitSlop={8}
                  style={[styles.stepperBtn, { backgroundColor: colors.accent }]}
                >
                  <Ionicons name="add" size={16} color={colors.accentText} />
                </Pressable>
              </View>
            </View>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('mealPlan.add.portionHint', {
                servings,
                total: selectedRecipe.servings,
              })}
            </Text>
          </>
        )}

        <Button
          label={t('mealPlan.add.confirm', { kcal: previewKcal })}
          onPress={() => void onConfirm()}
          disabled={selectedId === null}
          loading={saving}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginBottom: 11,
  },
  weekTexts: { flex: 1, alignItems: 'center' },
  weekLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  weekSub: { fontFamily: fontFamily.body, fontSize: 12 },
  list: { paddingBottom: 32, gap: 0 },
  duplicateEmpty: {
    fontFamily: fontFamily.body,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  empty: { alignItems: 'center', paddingVertical: 20, gap: 5 },
  emptyTitle: { fontFamily: fontFamily.displayBold, fontSize: 16, textAlign: 'center' },
  emptyText: { fontFamily: fontFamily.body, fontSize: 13.5, textAlign: 'center', maxWidth: 300 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    padding: 14,
    paddingBottom: 26,
    gap: 9,
    maxHeight: '85%',
  },
  grab: { width: 36, height: 4, borderRadius: 2, opacity: 0.45, alignSelf: 'center' },
  sheetTitle: { fontFamily: fontFamily.displayBold, fontSize: 16 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9 },
  segmentLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  options: { maxHeight: 240 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 10,
    padding: 10,
    marginBottom: 5,
  },
  optionTexts: { flex: 1, gap: 1 },
  optionName: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  optionMeta: { fontFamily: fontFamily.body, fontSize: 11.5 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  stepperLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  stepperCtl: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  stepperBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontFamily: fontFamily.displayBold, fontSize: 16, minWidth: 40, textAlign: 'center' },
  hint: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 16 },
});
