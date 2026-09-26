/**
 * Hub Nutrition — **trois onglets : Aujourd'hui, Historique, Progrès** (US NUTRI-UX03, 26/09/2026).
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────────────────────────────
 * Suite de MUSCU-UX07 : « le même travail sur le pilier Nutrition, plus intuitif, avec des onglets
 * cohérents avec ceux de la muscu ». Le haut du hub était juste — le geste de saisie et « il me
 * reste » y étaient déjà. Ce qui clochait, c'est tout ce qui touche au passé :
 *  - « Copier d'hier » n'existait que dans le ⋯ d'un repas **déjà rempli**, où il le doublait ;
 *  - consulter hier faisait basculer **tout** l'écran, et l'ajout écrivait alors sur hier ;
 *  - les repas prévus au planning n'apparaissaient pas dans la journée.
 *
 * ── Ce qu'il est ─────────────────────────────────────────────────────────────────────────────────
 * Variante B choisie par Florian le 25/09/2026, avec ses réponses Q1 à Q8 :
 *   · **Aujourd'hui** — toujours aujourd'hui (D4) : le remplissage dans l'en-tête, « Reprendre un
 *     déjeuner » (R3), la carte de décision, le Réservoir, « Ta journée » avec « Comme hier » (R4)
 *     et les repas prévus (R6), l'énergie, les micros, la qualité ;
 *   · **Historique** — le calendrier en verres, les jours, les repas habituels (R7 à R9) ;
 *   · **Progrès** — « La semaine » de NUTRI-UX02, renommée (D12).
 *
 * L'onglet affiché (D3) : un paramètre `section` (lu une fois, puis effacé), sinon le dernier choisi
 * pendant la vie de l'app, sinon Aujourd'hui. Rien ne change d'onglet de force, pas même au
 * changement de jour (Q5). Les onglets défilent avec la page (D2) ; un nouvel appui sur l'onglet Alim
 * de la barre du bas ramène en haut.
 */

import { useLocalSearchParams, useRouter, useScrollToTop } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  explainCalorieTarget,
  groupMealOccurrences,
  localDateFromDayKey,
  localDayKey,
  mealForHour,
  recentDistinctMeals,
  resolveNutritionSection,
  sumNutrients,
  type PlannedMealEntry,
  type RecentMeal,
} from '@wellness/shared';
import { ExplainSheet } from '@/components/explain/ExplainSheet';
import { DayEnergyCard } from '@/components/energy/DayEnergyCard';
import { AddFoodSheet } from '@/components/nutrition/AddFoodSheet';
import { FuelTankCard } from '@/components/nutrition/FuelTankCard';
import { HydrationCard } from '@/components/nutrition/HydrationCard';
import { LibrarySheet, type LibraryTarget } from '@/components/nutrition/LibrarySheet';
import { MacroSuggestionCard } from '@/components/nutrition/MacroSuggestionCard';
import type { MacroKey } from '@/components/nutrition/MacroTriple';
import { NutritionHeader } from '@/components/nutrition/NutritionHeader';
import { NutritionLevel, NutritionLevelMatter, type QuickFood } from '@/components/nutrition/NutritionLevel';
import { RepeatMealCard } from '@/components/nutrition/RepeatMealCard';
import { DayJournal } from '@/components/nutrition/journal/DayJournal';
import { DayQualitySection, TrackedMicrosRecap } from '@/components/nutrition/journal/TrackedMicrosRecap';
import { HistorySection } from '@/components/nutrition/sections/HistorySection';
import { ProgressSection } from '@/components/nutrition/sections/ProgressSection';
import { StageScrollView } from '@/components/stage/StageScrollView';
import { useDenseFoodCandidates, useRecentFoods } from '@/data/repositories/food-repository';
import {
  addFoodEntry,
  copyMeal,
  duplicateDay,
  useDayEntries,
  useEntriesBetween,
} from '@/data/repositories/journal-repository';
import { consumePlannedEntry, useDayMealPlan } from '@/data/repositories/meal-plan-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useDayNutritionTargets } from '@/hooks/useDayNutritionTargets';
import { useMealList } from '@/hooks/useMealList';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useCurrentHour, useTodayKey } from '@/hooks/useTodayKey';
import { useNutritionSection } from '@/stores/nutrition-section-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Fenêtre de « Reprendre un repas » (R3), comme celle des repas habituels (R9). */
const REPEAT_WINDOW_DAYS = 60;

const shiftDay = (dayKey: string, n: number) => localDayKey(addDays(localDateFromDayKey(dayKey), n));

export default function NutritionScreen() {
  useMenuFocus('nutrition');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();

  // ── L'onglet affiché (D3) ──────────────────────────────────────────────────────────────────────
  const remembered = useNutritionSection((s) => s.section);
  const setSection = useNutritionSection((s) => s.setSection);
  const openHabits = useNutritionSection((s) => s.openHabits);
  const section = resolveNutritionSection({ param: params.section, remembered });
  useEffect(() => {
    // Un paramètre de route est lu **une fois** : laissé en place, il s'appliquerait de nouveau à
    // chaque retour sur l'onglet et écraserait le choix de l'utilisateur.
    if (params.section === undefined) return;
    setSection(section);
    router.setParams({ section: undefined });
  }, [params.section, section, setSection, router]);

  // D2 — un nouvel appui sur l'onglet Alim ramène en haut.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  // ── Aujourd'hui, toujours (D4) ─────────────────────────────────────────────────────────────────
  const todayKey = useTodayKey();
  const yesterdayKey = shiftDay(todayKey, -1);
  const hour = useCurrentHour();
  const mealOfHour = mealForHour(hour);
  const { entries } = useDayEntries(todayKey);
  const { entries: yesterdayEntries } = useDayEntries(yesterdayKey);
  const mealList = useMealList();
  const configuredKeys = useMemo(() => new Set(mealList.map((m) => m.key)), [mealList]);
  const { entries: dayPlan } = useDayMealPlan(todayKey);
  // R6 — les repas prévus non portés au journal, dont le repas existe encore.
  const planned = useMemo(
    () => dayPlan.filter((p) => p.consumedAt == null && configuredKeys.has(p.mealKey)),
    [dayPlan, configuredKeys],
  );

  const [addTarget, setAddTarget] = useState<{ mealKey: string } | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const {
    tdeeValue,
    target,
    effectiveTarget,
    trainingBonus,
    trainingApplies,
    targetLoading,
    targetMacros,
    profileComplete,
  } = useDayNutritionTargets(todayKey);

  const totals = sumNutrients(entries);
  const remaining = effectiveTarget != null ? effectiveTarget - totals.kcal : null;
  const consumedMacros: Record<MacroKey, number> = {
    protein: totals.proteinG,
    carbs: totals.carbsG,
    fat: totals.fatG,
  };

  // US NUTR-F2 — vivier de suggestion : les **aliments récents d'abord, puis la base** (décision
  // D4 de NUTR-F2). Au lancement, aucun compte n'a d'aliment récent : sans repli sur la base, la
  // carte ne pourrait rien proposer aux nouveaux utilisateurs. Le pré-filtrage vit en SQL.
  const { foods: recentFoods } = useRecentFoods(40);
  const { foods: denseFoods } = useDenseFoodCandidates();
  const recentIds = useMemo(() => recentFoods.map((f) => f.id), [recentFoods]);
  const suggestionCandidates = useMemo(() => {
    const vus = new Set<string>();
    return [...recentFoods, ...denseFoods]
      .filter((f) => (vus.has(f.id) ? false : (vus.add(f.id), true)))
      .map((f) => ({
        id: f.id,
        name: f.name,
        kcalPer100g: f.kcalPer100g,
        proteinPer100g: f.proteinPer100g,
        carbsPer100g: f.carbsPer100g,
        fatPer100g: f.fatPer100g,
        // Première portion déclarée = portion de référence : c'est le plafond de la suggestion.
        portionG: f.portions[0]?.grams ?? null,
      }));
  }, [recentFoods, denseFoods]);

  /**
   * US DASH-01 — l'ajout rapide : les trois derniers aliments, à leur portion de référence, dans le
   * repas de l'heure. Le geste le plus fréquent du pilier tient en un tap.
   */
  const quickFoods = useMemo<QuickFood[]>(
    () =>
      recentFoods.slice(0, 3).map((f) => {
        const grams = f.portions[0]?.grams ?? 100;
        const per = (per100: number | null) => Math.round(((per100 ?? 0) * grams) / 100);
        const kcal = Math.round((f.kcalPer100g * grams) / 100);
        return {
          id: f.id,
          name: f.name,
          kcal,
          onAdd: () => {
            void addFoodEntry(todayKey, mealOfHour, {
              foodId: f.id,
              name: f.name,
              quantityG: grams,
              kcal,
              proteinG: per(f.proteinPer100g),
              carbsG: per(f.carbsPer100g),
              fatG: per(f.fatPer100g),
            }).catch(() => undefined);
          },
        };
      }),
    [recentFoods, todayKey, mealOfHour],
  );

  // ── Reprendre un repas (R3) ────────────────────────────────────────────────────────────────────
  const { rows: historyRows } = useEntriesBetween(shiftDay(todayKey, -REPEAT_WINDOW_DAYS), yesterdayKey);
  const recentMeals = useMemo(
    () => recentDistinctMeals(groupMealOccurrences(historyRows), mealOfHour, { limit: 3 }),
    [historyRows, mealOfHour],
  );
  const mealOfHourOption = mealList.find((m) => m.key === mealOfHour);
  const showRepeat =
    mealOfHourOption != null && !entries.some((e) => e.mealType === mealOfHour) && recentMeals.length > 0;

  // Un verrou par action (useActionLock) : un double appui n'écrit qu'une fois.
  const lockRepeat = useActionLock();
  const lockLikeYesterday = useActionLock();
  const lockEat = useActionLock();
  const lockCopyDay = useActionLock();

  // Écritures offline-first optimistes : la base locale a déjà répondu et le journal se rafraîchit
  // par ses requêtes surveillées. Sans `catch`, un échec remonterait en rejet non capturé.
  const repeat = (meal: RecentMeal) =>
    void lockRepeat(() => copyMeal(meal.occurrence.dayKey, mealOfHour, todayKey)).catch(() => undefined);
  const likeYesterday = (mealKey: string) =>
    void lockLikeYesterday(() => copyMeal(yesterdayKey, mealKey, todayKey)).catch(() => undefined);
  const eatPlanned = (entry: PlannedMealEntry) =>
    void lockEat(() => consumePlannedEntry(entry.id)).catch(() => undefined);
  const copyYesterday = () => void lockCopyDay(() => duplicateDay(yesterdayKey, todayKey)).catch(() => undefined);

  const openDay = (dayKey: string) => router.push({ pathname: '/nutrition-day', params: { date: dayKey } });

  // §4.2-4 — l'état vide ne reste que quand il n'y a rien à proposer : ni entrée aujourd'hui, ni la
  // veille, ni repas prévu.
  const showEmptyState = entries.length === 0 && yesterdayEntries.length === 0 && planned.length === 0;

  const onLibrary = (target: LibraryTarget) => {
    setLibraryOpen(false);
    if (target === 'meals') router.push('/nutrition-meals');
    else router.push({ pathname: '/food-picker', params: { tab: target } });
  };

  return (
    <>
      <StageScrollView
        pillar="nutrition"
        testID="nutrition-screen"
        scrollRef={scrollRef}
        stage={
          <NutritionHeader
            section={section}
            onSection={setSection}
            onPlanning={() => router.push('/meal-plan')}
            onLibrary={() => setLibraryOpen(true)}
            onSettings={() => router.push('/nutrition-profile')}
            matter={
              section === 'today' ? (
                <NutritionLevelMatter consumedKcal={totals.kcal} targetKcal={effectiveTarget} />
              ) : undefined
            }
          >
            {section === 'today' ? (
              <NutritionLevel
                todayKey={todayKey}
                consumedKcal={totals.kcal}
                targetKcal={effectiveTarget}
                consumedMacros={consumedMacros}
                targetMacros={targetMacros}
                trainingBonusKcal={trainingApplies && !targetLoading ? trainingBonus : 0}
                quickFoods={quickFoods}
                onExplainTarget={effectiveTarget != null ? () => setExplainOpen(true) : undefined}
                onSetTarget={() => router.push('/nutrition-profile')}
                onSearch={() => setAddTarget({ mealKey: mealOfHour })}
                onScan={() => router.push({ pathname: '/food-scan', params: { date: todayKey, meal: mealOfHour } })}
                onOpenDay={openDay}
              />
            ) : null}
          </NutritionHeader>
        }
      >
        {section === 'today' ? (
          <>
            {showRepeat ? (
              <RepeatMealCard
                mealKey={mealOfHour}
                mealLabel={mealOfHourOption!.label}
                meals={recentMeals}
                onRepeat={repeat}
                onOpenDay={openDay}
                onAllHabits={() => openHabits(mealOfHour)}
              />
            ) : null}

            {/* US NUTR-F2 — la carte de décision. Elle se tait d'elle-même sans objectif, sans écart
                significatif ou sans budget ; jamais sur une journée vide, où « il te manque 160 g
                de protéines » n'est qu'une paraphrase de l'objectif. */}
            {entries.length > 0 ? (
              <MacroSuggestionCard
                day={todayKey}
                mealType={mealList[0]?.key ?? 'snack'}
                consumed={consumedMacros}
                targets={targetMacros}
                kcalRemaining={remaining}
                candidates={suggestionCandidates}
                recentIds={recentIds}
              />
            ) : null}

            {/* US RESERV-01 — le Réservoir : « est-ce que j'ai de quoi tenir ma séance ? ». */}
            <FuelTankCard dayKey={todayKey} atHour={hour} />

            {showEmptyState ? (
              <View
                testID="nutrition-empty-day"
                style={[styles.emptyDay, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={[styles.emptyIcon, { backgroundColor: colors.track }]}>
                  <Ionicons name="restaurant-outline" size={28} color={colors.accent} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('journal.emptyDay.title')}</Text>
                <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{t('nutritionHub.emptyDay.body')}</Text>
                <Pressable
                  onPress={() => setAddTarget({ mealKey: mealOfHour })}
                  style={[styles.emptyPrimary, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.emptyPrimaryLabel, { color: colors.accentText }]}>+ {t('journal.addFood')}</Text>
                </Pressable>
                {/* L'eau reste là : on boit avant de manger. */}
                <View style={[styles.emptyHydration, { borderTopColor: colors.border }]}>
                  <HydrationCard day={todayKey} compact />
                </View>
              </View>
            ) : (
              <DayJournal
                day={todayKey}
                entries={entries}
                mealList={mealList}
                onAdd={(mealKey) => setAddTarget({ mealKey })}
                yesterdayEntries={yesterdayEntries}
                onLikeYesterday={likeYesterday}
                onCopyYesterday={entries.length === 0 && yesterdayEntries.length > 0 ? copyYesterday : undefined}
                planned={planned}
                onEatPlanned={eatPlanned}
              />
            )}

            {/* US DEPENSE-03 — « Ta journée en énergie », repliée par défaut. */}
            <DayEnergyCard dayKey={todayKey} consumedKcal={totals.kcal} />

            {/* R3.4 de NUTRI-UX01 — les micronutriments, SOUS les repas. */}
            <TrackedMicrosRecap entries={entries} />

            {/* R3.5 — repères de qualité, quand la journée a de quoi les calculer. */}
            {entries.length > 0 ? <DayQualitySection day={todayKey} targetKcal={effectiveTarget} /> : null}
          </>
        ) : section === 'history' ? (
          <HistorySection
            todayKey={todayKey}
            mealOfHour={mealOfHour}
            mealList={mealList}
            historyRows={historyRows}
            onOpenDay={openDay}
            onToday={() => setSection('today')}
          />
        ) : (
          <ProgressSection
            targetKcal={effectiveTarget}
            onStats={() => router.push('/nutrition-stats')}
            onStart={() => setSection('today')}
          />
        )}
      </StageScrollView>

      <LibrarySheet visible={libraryOpen} onClose={() => setLibraryOpen(false)} onPick={onLibrary} />

      {/* R2.1 de NUTRI-UX01 — la feuille d'ajout, montée à la demande : elle porte trois requêtes
          surveillées et un debounce qu'il est inutile de faire tourner en permanence. */}
      {addTarget != null ? (
        <AddFoodSheet
          visible
          date={todayKey}
          mealKey={addTarget.mealKey}
          mealLabel={mealList.find((m) => m.key === addTarget.mealKey)?.label ?? t('journal.meals.other')}
          kcalRemaining={remaining}
          proteinRemaining={targetMacros != null ? Math.max(0, targetMacros.protein - totals.proteinG) : null}
          consumedRatio={effectiveTarget != null && effectiveTarget > 0 ? totals.kcal / effectiveTarget : 0}
          onClose={() => setAddTarget(null)}
        />
      ) : null}

      {/* §6.1 — d'où sort la cible du jour. Les étapes viennent de la brique, pas de l'écran. */}
      <ExplainSheet
        visible={explainOpen}
        title={t('journal.balance.target')}
        explanation={
          tdeeValue != null && target != null && effectiveTarget != null
            ? explainCalorieTarget({
                tdee: tdeeValue,
                objectiveDeltaKcal: target - tdeeValue,
                trainingDayBonusKcal: trainingApplies && !targetLoading ? trainingBonus : 0,
                target: effectiveTarget,
                profileComplete,
              })
            : null
        }
        onClose={() => setExplainOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  emptyDay: { borderRadius: 20, borderWidth: 1, paddingTop: 30, paddingHorizontal: 24, alignItems: 'center', overflow: 'hidden' },
  emptyIcon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontFamily: fontFamily.displayBold, fontSize: 18, marginBottom: 5, textAlign: 'center' },
  emptyBody: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 20, textAlign: 'center', maxWidth: 260, marginBottom: 18 },
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
  emptyHydration: { alignSelf: 'stretch', marginHorizontal: -24, marginTop: 20, borderTopWidth: 1 },
});
