import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_MEAL_KEYS,
  computeAge,
  countReportedMicros,
  explainCalorieTarget,
  effectiveActivityLevel,
  mealForHour,
  effectiveNutritionObjective,
  isRealLifeDay,
  objectiveFromGoal,
  rescaleEntryNutrition,
  resolveMealConfig,
  saltFromSodiumMg,
  sumMicronutrients,
  sumNutrients,
  targetCalories,
  tdee,
  trainingDayMacroGrams,
  type MicronutrientKey,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { MicronutrientDetails } from '@/components/MicronutrientDetails';
import { useTrackedMicros } from '@/stores/tracked-micros';
import { useProfile } from '@/data/repositories/profile-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useDayCalorieTarget } from '@/data/repositories/dashboard-repository';
import { useRealLifePeriods } from '@/data/repositories/real-life-repository';
import {
  addFoodEntry,
  copyMeal,
  duplicateDay,
  moveEntry,
  reassignEntryMeal,
  removeEntry,
  updateEntry,
  useDayEntries,
  useDayQuality,
  type JournalEntry,
} from '@/data/repositories/journal-repository';
import { saveMealAsTemplate } from '@/data/repositories/meal-template-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { MacroSuggestionCard } from '@/components/nutrition/MacroSuggestionCard';
// US NUTRI-UX02 — l'onglet « La semaine » : le verdict, puis les cartes d'analyses REMONTÉES de
// `Nutrition › Stats`. Aucune n'est réécrite : elles lisent déjà leurs propres données.
import { WeekVerdictCard } from '@/components/nutrition/WeekVerdictCard';
import { RegularityCard } from '@/components/nutrition/RegularityCard';
import { ProteinPerKgCard } from '@/components/ProteinPerKgCard';
import { WeightGoalCard } from '@/components/WeightGoalCard';
import { ExplainSheet } from '@/components/explain/ExplainSheet';
import { FuelTankCard } from '@/components/nutrition/FuelTankCard';
import { NutritionStage, type QuickFood } from '@/components/nutrition/NutritionStage';
import { StageScrollView } from '@/components/stage/StageScrollView';
import type { MacroKey } from '@/components/nutrition/MacroTriple';
import { MicroCoverageGrid, type MicroCell } from '@/components/nutrition/MicroCoverageGrid';
import {
  useDenseFoodCandidates,
  useLibraryPresence,
  useRecentFoods,
} from '@/data/repositories/food-repository';
import { useCurrentHour, useTodayKey } from '@/hooks/useTodayKey';
import { AddFoodSheet } from '@/components/nutrition/AddFoodSheet';
import { DayCalendarSheet } from '@/components/nutrition/DayCalendarSheet';
import { DayEnergyCard } from '@/components/energy/DayEnergyCard';
import { HydrationCard } from '@/components/nutrition/HydrationCard';
import { QualityCard } from '@/components/nutrition/QualityCard';
import { MealGlyph } from '@/components/nutrition/CategoryGlyph';

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

export default function NutritionScreen() {
  useMenuFocus('nutrition');
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { profile } = useProfile();
  const { nutritionProfile } = useNutritionProfile();
  const todayKey = useTodayKey();
  const [day, setDay] = useState(todayKey);
  // Suit le jour courant **uniquement** si l'utilisateur était sur « aujourd'hui » : sinon on
  // écraserait une navigation délibérée vers un jour passé.
  const previousToday = useRef(todayKey);
  useEffect(() => {
    if (previousToday.current === todayKey) return;
    setDay((current) => (current === previousToday.current ? todayKey : current));
    previousToday.current = todayKey;
  }, [todayKey]);
  const { entries } = useDayEntries(day);

  const hour = useCurrentHour();
  /**
   * US NUTRI-UX02 — l'onglet courant. **Pas persisté, délibérément** : l'app s'ouvre sur « saisir »,
   * qui est le geste de vingt fois par jour. Quelqu'un qui consulte sa semaine le dimanche soir ne
   * doit pas retrouver un écran d'analyses le lundi matin devant son petit-déjeuner.
   */
  const [tab, setTab] = useState<'today' | 'week'>('today');
  // R2.1 / R3.1 — les deux feuilles du journal. `addTarget` porte le repas visé : `null` ferme.
  const [addTarget, setAddTarget] = useState<{ mealKey: string } | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // §6.1 — « Pourquoi ? » sur la cible du jour : TDEE, objectif, bonus de séance.
  const [explainOpen, setExplainOpen] = useState(false);

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
  const { periods: realLifePeriods } = useRealLifePeriods();
  const objective = nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const age = profile?.birthDate ? computeAge(new Date(profile.birthDate)) : null;
  const tdeeValue = tdee({
    sex: profile?.sex ?? 'unspecified',
    weightKg: profile?.weightKg ?? undefined,
    heightCm: profile?.heightCm ?? undefined,
    age: age ?? undefined,
      activityLevel: effectiveActivityLevel(nutritionProfile),
  });
  // US VIE-01 (R4) : objectif au maintien pendant une période « vie réelle ». Évalué sur le jour
  // **sélectionné** (`day`), pas sur aujourd'hui : cet écran navigue dans l'historique, et une cible
  // rétroactive doit refléter ce qui était demandé ce jour-là.
  const inRealLifePeriod = isRealLifeDay(realLifePeriods, day);
  const target =
    tdeeValue != null
      ? targetCalories(
          tdeeValue,
          effectiveNutritionObjective(objective, inRealLifePeriod),
          nutritionProfile?.manualCalories ?? null,
        )
      : null;

  // Objectif effectif + bonus du jour SÉLECTIONNÉ : centralisés dans useDayCalorieTarget
  // (RN-02, mode forfait/auto + dépense des courses). Paramétré par `day` → la navigation
  // par jour reste correcte. Les macros cibles redirigent ce bonus vers les glucides
  // (US MN-04, `trainingDayMacroGrams`) — il n'est plus invisible dans le détail comme avant.
  // `bonusSource` pilote le libellé du badge ci-dessous (course vs jour de séance forfait) ;
  // `isLoading` évite un badge transitoire pendant le chargement.
  const {
    effectiveTarget,
    trainingBonus,
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
    : target != null && effectiveTarget != null
      ? trainingDayMacroGrams({ targetBase: target, effectiveTarget, objective })
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

  // US NUTR-F2 — vivier de suggestion : les **aliments récents d'abord, puis la base** (décision
  // D4). On mange ce qu'on a chez soi, donc les récents restent prioritaires — c'est `recentIds`
  // qui les fait gagner à densité comparable, dans la brique de score.
  //
  // 🔴 Le repli sur la base a été ouvert le 12/08/2026, et pas parce que la recette l'a réclamé :
  // **au lancement, aucun compte n'a d'aliment récent.** Sans repli, la carte ne peut rien proposer
  // à 100 % des nouveaux utilisateurs — précisément quand le conseil vaut le plus. Le pré-filtrage
  // vit en SQL (`useDenseFoodCandidates`), donc CIQUAL n'est jamais chargé en mémoire : c'est ce
  // qui avait motivé le report.
  const { foods: recentFoods } = useRecentFoods(40);
  const { foods: denseFoods } = useDenseFoodCandidates();
  const recentIds = useMemo(() => recentFoods.map((f) => f.id), [recentFoods]);
  const suggestionCandidates = useMemo(() => {
    const vus = new Set<string>();
    // Récents en tête : à densité égale la brique préfère déjà un aliment connu, et l'ordre du
    // vivier départage les ex æquo restants.
    return [...recentFoods, ...denseFoods]
      .filter((f) => (vus.has(f.id) ? false : (vus.add(f.id), true)))
      .map((f) => ({
        id: f.id,
        name: f.name,
        kcalPer100g: f.kcalPer100g,
        proteinPer100g: f.proteinPer100g,
        carbsPer100g: f.carbsPer100g,
        fatPer100g: f.fatPer100g,
        // Première portion déclarée = portion de référence (« 1 banane » = 120 g). C'est le
        // plafond de quantité de la suggestion : sans elle, on retombe sur une borne générique.
        portionG: f.portions[0]?.grams ?? null,
      }));
  }, [recentFoods, denseFoods]);

  const consumedMacros: Record<MacroKey, number> = {
    protein: totals.proteinG,
    carbs: totals.carbsG,
    fat: totals.fatG,
  };

  /**
   * US DASH-01 — l'ajout rapide de la scène : les trois derniers aliments, à leur portion de
   * référence. Rien de neuf à calculer — c'est le même vivier que la feuille d'ajout, remonté d'un
   * cran pour que le geste le plus fréquent du pilier tienne en un tap.
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
            void addFoodEntry(day, mealForHour(hour), {
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
    [recentFoods, day, hour],
  );

  const onDeleteEntry = (entry: JournalEntry) => {
    Alert.alert(entry.name, t('journal.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('journal.delete'), style: 'destructive', onPress: () => void removeEntry(entry.id) },
    ]);
  };

  // Copier toute la journée d'hier (4.18) — proposé uniquement si le jour est vide.
  const copyYesterday = () => {
    void duplicateDay(addDays(day, -1), day)
      .then((n) => {
        if (n === 0) Alert.alert(t('journal.copyDayYesterday'), t('journal.nothingYesterdayFull'));
      })
      // Écriture offline-first optimiste : la base locale a déjà répondu, le journal se rafraîchit
      // par la requête surveillée. Rien à annoncer de plus — mais sans `catch`, un échec remonte
      // en rejet non capturé.
      .catch(() => undefined);
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
    <>
    <StageScrollView
      pillar="nutrition"
      testID="nutrition-screen"
      compactTitle={isToday ? t('journal.today') : dayLabel}
      compactValue={`${totals.kcal} ${t('nutrition.kcal')}`}
      stage={
        <NutritionStage
          day={day}
          todayKey={todayKey}
          dayLabel={dayLabel}
          consumedKcal={totals.kcal}
          targetKcal={effectiveTarget}
          consumedMacros={consumedMacros}
          targetMacros={targetMacros}
          trainingBonusKcal={trainingApplies && !targetLoading ? trainingBonus : 0}
          quickFoods={quickFoods}
          onExplainTarget={effectiveTarget != null ? () => setExplainOpen(true) : undefined}
          onSelectDay={setDay}
          onOpenCalendar={() => setCalendarOpen(true)}
          onSetTarget={() => router.push('/nutrition-profile')}
          onSearch={() => setAddTarget({ mealKey: mealForHour(hour) })}
          onScan={() => router.push({ pathname: '/food-scan', params: { date: day, meal: mealForHour(hour) } })}
          onStats={() => router.push('/nutrition-stats')}
          onProfile={() => router.push('/nutrition-profile')}
        />
      }
    >
        {/*
          US NUTRI-UX02 — les deux moments du journal alimentaire, enfin séparés.

          L'écran servait deux usages empilés l'un sur l'autre : **saisir** (vingt fois par jour,
          cinq secondes — ce qu'il reste à manger et le bouton d'ajout) et **comprendre** (deux fois
          par semaine, trois minutes — est-ce que ça marche). Le second était relégué derrière une
          icône de la scène, sur un écran que personne n'ouvrait : onze analyses livrées y dormaient.

          🔴 Un onglet, pas un écran de plus. ADR-007 plafonne le **Tier 0** (l'accueil) à 4-6
          widgets ; l'écran d'un pilier est du Tier 1, « à la demande » — et un onglet est
          précisément à la demande. Chaque carte garde en plus la règle du Tier 2 : elle ne
          s'affiche que lorsqu'elle a quelque chose à dire.
        */}
        <View style={styles.tabs}>
          {(['today', 'week'] as const).map((key) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                testID={`nutrition-tab-${key}`}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active ? colors.accent : 'transparent',
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.tabLabel, { color: active ? colors.accentText : colors.textMuted }]}
                >
                  {t(key === 'today' ? 'nutrition.week.tabToday' : 'nutrition.week.tabWeek')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'week' ? (
          <>
            <WeekVerdictCard />
            {/*
              Les cartes remontées telles quelles de `Nutrition › Stats` — aucune n'est réécrite ni
              dupliquée : elles lisent déjà leurs propres données et se taisent quand elles n'en ont
              pas. L'ordre suit celui du verdict : ce qu'il affirme, puis ce qui le prouve.
            */}
            {/*
              🔴 Passe 2 — `TrainingNutritionCrossCard` (le tableau 8 semaines) est RETIRÉ d'ici.

              Cinq colonnes de chiffres sur 390 px : les dates s'y cassent en deux (« 07/09–13/0 »
              puis « 9 »), et le badge de variation compare une semaine en cours à des semaines
              complètes. Ce tableau est un outil d'analyse — il reste sur `Nutrition › Stats`, où on
              vient pour ça, et l'onglet garde le lien qui y mène.
            */}
            <ProteinPerKgCard window="7d" />
            <WeightGoalCard />
            <RegularityCard targetKcal={effectiveTarget} windowDays={7} />
            <Pressable
              onPress={() => router.push('/nutrition-stats')}
              style={styles.manageMeals}
              accessibilityRole="button"
            >
              <Ionicons name="stats-chart-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.manageMealsLabel, { color: colors.textMuted }]}>
                {t('nutrition.week.allStats')}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
        {/*
          US NUTRI-UX02 — **l'ordre du journal suit celui des questions qu'on se pose.**

          Il suivait jusqu'ici l'ordre d'arrivée des US : hydratation (R5.2), énergie (DEPENSE-03),
          Réservoir (RESERV-01), repas. Chacune avait sa raison d'être « haut dans le journal », et
          à la fin quatre blocs se disputaient le haut de l'écran — dont deux qui ne font que
          rapporter. L'ordre est désormais celui-ci, et il se lit comme une suite de questions :

            1. « qu'est-ce que je peux encore manger ? »   → la carte de décision
            2. « est-ce que je tiens ma séance de ce soir ? » → le Réservoir
            3. « qu'est-ce que j'ai mangé ? »               → Ta journée (hydratation comprise)
            4. « qu'est-ce que ça m'a coûté ? »             → l'énergie, repliée

          L'hydratation rejoint la carte « Ta journée » en une ligne, et l'énergie se replie : deux
          blocs entiers rendus à ce qui demande une décision.
        */}

        {/* US NUTR-F2 — la carte de décision, désormais EN TÊTE. Elle se rend `null` d'elle-même
            s'il n'y a pas d'objectif, pas d'écart significatif, ou plus de budget calorique (D6) —
            donc la remonter ne coûte rien les jours où elle n'a rien à dire. Jour courant seulement,
            et jamais sur une journée vide, où « il te manque 160 g de protéines » n'est qu'une
            paraphrase de l'objectif. */}
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

        {/*
          US RESERV-01 — « Réservoir » : la même journée, vue en glucides disponibles. Placée juste
          après l'énergie parce qu'elle répond à la question suivante (« est-ce que j'ai de quoi
          tenir ma séance de ce soir ? ») et qu'elle se tait quand elle n'a rien à dire.
        */}
        <FuelTankCard dayKey={day} atHour={hour} />

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
              onPress={() => setAddTarget({ mealKey: mealForHour(hour) })}
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
        {/*
          US NUTRI-UX02 — « Ta journée » : une carte, des sections, au lieu de cinq cartes.

          Cinq cartes de ~150 px portaient quatre lignes d'aliments : l'essentiel du défilement
          était du contenant. Elles répétaient aussi cinq fois le même bouton et le même « ⋯ ».
          Ici, un seul cadre, un filet entre les repas, un seul bouton d'ajout au pied — et chaque
          repas gagne la **part du jour** qu'il représente (NUTR-16, rendue sur le journal).
        */}
        {entries.length > 0 ? (
          <View style={[styles.dayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dayCardHead}>
              <Text style={[styles.dayCardTitle, { color: colors.text }]}>{t('journal.dayCard.title')}</Text>
              <Text style={[styles.dayCardMeta, { color: colors.textMuted }]}>
                {t('journal.dayCard.meta', { count: entries.length, kcal: totals.kcal })}
              </Text>
            </View>
            {mealList.map((m) => (
              <MealSection
                key={m.key}
                mealKey={m.key}
                mealLabel={m.label}
                day={day}
                dense
                dayKcal={totals.kcal}
                entries={entries.filter((e) => e.mealType === m.key)}
                onAdd={() => setAddTarget({ mealKey: m.key })}
                onDeleteEntry={onDeleteEntry}
                onSelectEntry={onSelectEntry}
                onEditEntry={onEditEntry}
              />
            ))}
            {/* Section « Autres » : entrées dont le repas n'existe plus (récupération). Dans la
                carte depuis NUTRI-UX02 — une carte orpheline posée à côté de « Ta journée » aurait
                laissé croire à un contenu d'une autre nature. 🔴 Toujours **sans `onAdd`** : on ne
                crée rien dans un repas qui n'existe plus, on en sort par réaffectation. */}
            {orphanEntries.length > 0 ? (
              <MealSection
                key="__orphan__"
                mealKey="__orphan__"
                mealLabel={t('journal.meals.other')}
                day={day}
                dense
                dayKcal={totals.kcal}
                entries={orphanEntries}
                onDeleteEntry={onDeleteEntry}
                onSelectEntry={onSelectEntry}
                onEditEntry={onEditEntry}
              />
            ) : null}
            {/* R5.2 — l'hydratation : un tap, aucune saisie. En ligne dans la carte depuis
                NUTRI-UX02 : elle occupait un bloc entier, au-dessus de tout ce qui demande une
                décision, pour une donnée le plus souvent déjà atteinte. */}
            <View style={[styles.dayCardHydration, { borderTopColor: colors.border }]}>
              <HydrationCard day={day} compact />
            </View>
            {/*
              Passe 2 — le bouton d'ajout du pied de carte est RETIRÉ.

              Il faisait la quatrième porte vers le même écran, à moins de 200 px du « + » de chaque
              repas, alors que le bouton blanc de la scène est toujours visible et fait exactement la
              même chose. Le « + » par repas, lui, se garde : il porte un contexte que les autres
              n'ont pas.
            */}
          </View>
        ) : null}

        {/* US DEPENSE-03 — « Ta journée en énergie », désormais SOUS les repas et repliée par
            défaut. Elle garde l'entrée « Ajouter une activité » — la seule porte de saisie pour qui
            n'a activé que la nutrition — et se déplie d'elle-même le jour où l'écart entre le
            bonus forfaitaire et la dépense réelle mérite une décision. */}
        <DayEnergyCard dayKey={day} consumedKcal={totals.kcal} />

        {/* R3.4 — les micronutriments passent SOUS les repas. En tête d'écran, ils repoussaient
            le premier repas entièrement hors de vue : un journal alimentaire dont aucun repas
            n'est visible sans scroller. */}
        <TrackedMicrosRecap entries={entries} />

        {/* R3.5 — repères de qualité, uniquement quand la journée a de quoi les calculer. */}
        {entries.length > 0 ? <DayQualitySection day={day} targetKcal={effectiveTarget} /> : null}

        {/* US REPAS-01 (4.27) — carte dédiée, arbitrage Florian du 04/08/2026 (point P1) : le
            planning repas demande un investissement de saisie avant de rendre sa valeur. Rangé
            dans un sous-menu, il ne serait jamais adopté. */}
        <Pressable
          onPress={() => router.push('/meal-plan')}
          accessibilityRole="button"
          accessibilityLabel={t('mealPlan.title')}
          style={[styles.mealPlanCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.mealPlanIcon, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.mealPlanTexts}>
            <Text style={[styles.mealPlanTitle, { color: colors.text }]}>{t('mealPlan.title')}</Text>
            <Text style={[styles.mealPlanSubtitle, { color: colors.textMuted }]}>
              {t('mealPlan.hubTeaser')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        <Pressable onPress={() => router.push('/nutrition-meals')} style={styles.manageMeals}>
          <Ionicons name="create-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.manageMealsLabel, { color: colors.textMuted }]}>{t('meals.manage')}</Text>
        </Pressable>
          </>
        )}
    </StageScrollView>

      {/* R2.1 — la feuille d'ajout à 3 modes remplace l'écran plein à 9 entrées.
          🔴 Montée **à la demande** : la feuille porte trois requêtes surveillées (habitudes,
          recherche, récents) et un `setTimeout` de debounce. Laissée montée avec `visible={false}`,
          elle les faisait tourner en permanence sur le journal — l'écran le plus ouvert de l'app —
          pour un contenu que personne ne regarde. */}
      {addTarget != null ? (
      <AddFoodSheet
        visible
        date={day}
        mealKey={addTarget?.mealKey ?? mealForHour(hour)}
        mealLabel={
          mealList.find((m) => m.key === addTarget?.mealKey)?.label ?? t('journal.meals.other')
        }
        kcalRemaining={remaining}
        proteinRemaining={
          targetMacros != null ? Math.max(0, targetMacros.protein - totals.proteinG) : null
        }
        consumedRatio={
          effectiveTarget != null && effectiveTarget > 0 ? totals.kcal / effectiveTarget : 0
        }
        onClose={() => setAddTarget(null)}
      />
      ) : null}

      {/* §6.1 — d'où sort la cible du jour. Les étapes viennent de la brique, pas de l'écran :
          elles ne peuvent donc pas diverger du chiffre affiché. */}
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
                profileComplete: profile?.weightKg != null && profile?.heightCm != null && age != null,
              })
            : null
        }
        onClose={() => setExplainOpen(false)}
      />

      {/* R3.1 — calendrier mensuel : la spec §4.7 le prévoyait, il n'existait pas. */}
      {calendarOpen ? (
      <DayCalendarSheet
        visible
        selectedDay={day}
        targetKcal={effectiveTarget}
        onSelect={setDay}
        onClose={() => setCalendarOpen(false)}
      />
      ) : null}

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
    </>
  );
}

/**
 * Repères de qualité du jour (R3.5).
 *
 * Se tait tant que rien n'est calculable : sans aliment identifié, les trois valeurs seraient
 * des zéros trompeurs plutôt qu'une information (les sous-macros vivent sur `foods`, pas sur
 * l'entrée de journal — voir `useDayQuality`).
 */
function DayQualitySection({ day, targetKcal }: { day: string; targetKcal: number | null }) {
  const { quality } = useDayQuality(day);
  if (quality.coverageRatio === 0) return null;
  return (
    <QualityCard
      compact
      targetKcal={targetKcal}
      values={{
        fiber: quality.fiber,
        sugars: quality.sugars,
        saturatedFat: quality.saturatedFat,
      }}
    />
  );
}

/** Micronutriments suivis du jour, en grille de couverture (4.35). */
function TrackedMicrosRecap({ entries }: { entries: JournalEntry[] }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  // F6 — la cause réelle de l'absence de micros : une base vide n'est pas une saisie imparfaite.
  const library = useLibraryPresence();
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

  /**
   * US NUTRI-UX02 — six pastilles à « 0,0 mg » valent moins que rien.
   *
   * `sumMicronutrients` respecte la règle de NUTR-07 (« une clé n'apparaît que si renseignée,
   * jamais forcée à 0 ») ; c'est la lecture `dayMicros[key] ?? 0` juste au-dessus qui fabriquait
   * les zéros. Sur une journée saisie en texte libre ou en ajout rapide — c'est-à-dire toute
   * journée d'un appareil où la bibliothèque n'est pas descendue — l'écran affirmait « 0,0 mg de
   * fer » là où la vérité est « je n'en sais rien ». Un zéro faux coûte la confiance dans tous
   * les autres chiffres de l'écran.
   *
   * 🔴 Le seuil est **aucun**, pas « peu » : si trois micros sur six sont connus, les trois autres
   * à zéro sont une information juste (« tu n'as pas eu de vitamine D aujourd'hui ») et la grille
   * reste. Seul le cas « rien n'est connu » ment, et lui seul est remplacé par son explication.
   */
  const reported = countReportedMicros(dayMicros, tracked);

  if (tracked.length === 0) return null;
  if (reported === 0) {
    /*
     * Passe 2 — F6 : ne pas donner un conseil impossible à suivre.
     *
     * Le message disait « cherche l'aliment dans la base pour les suivre ». Juste dans l'absolu —
     * et faux sur un appareil où la bibliothèque n'est pas descendue, c'est-à-dire précisément
     * celui où le cas se produit le plus souvent. On envoyait l'utilisateur dans un mur, en lui
     * laissant croire que le problème venait de sa saisie.
     */
    const cause = library.isEmpty
      ? 'unknownNoLibrary'
      : entries.length === 0
        ? 'unknownEmptyDay'
        : 'unknownFreeText';
    return (
      <View style={[styles.microsUnknown, { borderColor: colors.border }]} testID="micros-unknown">
        <Ionicons name="help-circle-outline" size={17} color={colors.textMuted} />
        <Text style={[styles.microsUnknownText, { color: colors.textMuted }]}>
          {t(`nutrition.micros.${cause}`)}
        </Text>
      </View>
    );
  }
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

/**
 * US NUTRI-UX02 — `dense` : le repas devient une **section** d'une carte unique, au lieu d'être une
 * carte à lui seul.
 *
 * ── Ce que coûtait une carte par repas ───────────────────────────────────────────────────────────
 * Cinq cartes de ~150 px pour quatre lignes d'aliments — soit ~750 px de défilement, deux écrans de
 * pouce, dont l'essentiel est du contenant. Et la même phrase « + Ajouter un aliment » répétée cinq
 * fois, qui n'apprend rien la cinquième fois.
 *
 * En `dense`, la section perd son fond, sa bordure et son bouton texte ; elle garde son en-tête, son
 * menu, et **tout** le comportement des lignes (swipe éditer/supprimer, tap détail). Le parent porte
 * la carte, le bouton d'ajout principal et le total.
 *
 * 🔴 Le `+` par repas est **conservé**, en icône dans l'en-tête. Le supprimer aurait forcé à passer
 * par la feuille, qui déduit le repas de l'heure courante (R2.6 de NUTRI-UX01) : noter son
 * petit-déjeuner à 20 h serait redevenu un parcours à corriger, exactement le défaut que R2.6 avait
 * réglé. On supprime la répétition, pas le raccourci.
 */
function MealSection({
  mealKey,
  mealLabel,
  day,
  entries,
  dense = false,
  dayKcal = 0,
  onAdd,
  onDeleteEntry,
  onSelectEntry,
  onEditEntry,
}: {
  mealKey: string;
  mealLabel: string;
  day: string;
  entries: JournalEntry[];
  /** Section d'une carte unique (US NUTRI-UX02) plutôt que carte autonome. */
  dense?: boolean;
  /** Total calorique du jour, pour la part que ce repas représente. 0 = pas de barre. */
  dayKcal?: number;
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
    void copyMeal(addDays(day, -1), mealKey, day)
      .then((n) => {
        if (n === 0) Alert.alert(mealLabel, t('journal.nothingYesterday'));
      })
      .catch(() => undefined);
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
    void saveMealAsTemplate(mealLabel, items)
      .then(() => Alert.alert(t('journal.templateSaved'), mealLabel))
      // 🔴 Ici l'alerte est une CONFIRMATION : la taire sur échec est le comportement voulu —
      // annoncer « modèle enregistré » alors que l'écriture a échoué serait pire que se taire.
      .catch(() => undefined);
  };

  /*
   * Passe 2 — en `dense`, un repas vide est une **section discrète**, pas un cadre pointillé.
   *
   * Le cadre pointillé a été conçu pour une liste de cartes, où il se lit comme « une carte encore
   * vide ». Posé au milieu d'une carte unique, entre des repas pleins, il coupe la lecture et se lit
   * comme un bouton d'action — c'est le « Snack » relevé en recette du 20/09.
   */
  if (entries.length === 0 && onAdd && dense) {
    return (
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={`${mealLabel} · ${t('journal.addFood')}`}
        style={[styles.mealHeadDense, styles.mealSection, { borderTopColor: colors.border }]}
      >
        <MealGlyph mealKey={mealKey} />
        <Text style={[styles.mealName, { color: colors.textMuted }]} numberOfLines={1}>
          {mealLabel}
        </Text>
        <Text style={[styles.mealEmptyAdd, { color: colors.accent }]}>+ {t('journal.add')}</Text>
      </Pressable>
    );
  }

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
          <MealGlyph mealKey={mealKey} />
          <Text style={[styles.mealEmptyName, { color: colors.textMuted }]} numberOfLines={1}>
            {mealLabel}
          </Text>
        </View>
        <Text style={[styles.mealEmptyAdd, { color: colors.accent }]}>+ {t('journal.add')}</Text>
      </Pressable>
    );
  }

  // US NUTRI-UX02 — la part du jour que pèse ce repas. C'est NUTR-16 (« répartition par repas »,
  // livrée mais rangée dans l'écran Stats) rendue là où la décision se prend, sans nouvel écran :
  // « mon dîner pèse un tiers de ma journée » se lit d'un coup d'œil, pas dans un rapport hebdo.
  const mealShare = dayKcal > 0 ? Math.round((mealKcal / dayKcal) * 100) : null;

  return (
    <View
      style={
        dense
          ? [styles.mealSection, { borderTopColor: colors.border }]
          : [styles.mealCard, { backgroundColor: colors.surface, borderColor: colors.border }]
      }
    >
      <View
        style={[
          dense ? styles.mealHeadDense : styles.mealHead,
          dense ? null : { borderBottomColor: colors.border },
        ]}
      >
        <MealGlyph mealKey={mealKey} />
        <Text style={[styles.mealName, { color: colors.text }]} numberOfLines={1}>{mealLabel}</Text>
        <Text style={[styles.mealKcal, { color: colors.textMuted }]}>
          {mealKcal}
          <Text style={styles.mealKcalUnit}> {t('nutrition.kcal')}</Text>
        </Text>
        {dense && onAdd ? (
          <Pressable
            onPress={onAdd}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${mealLabel} · ${t('journal.addFood')}`}
            style={[styles.mealMenuBtn, { backgroundColor: colors.track }]}
          >
            <Ionicons name="add" size={16} color={colors.accent} />
          </Pressable>
        ) : null}
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

      {dense && mealShare != null && entries.length > 0 ? (
        <View
          style={styles.mealShareRow}
          accessible
          accessibilityLabel={t('journal.mealShareA11y', { meal: mealLabel, pct: mealShare })}
        >
          <View style={[styles.mealShareTrack, { backgroundColor: colors.track }]}>
            <View
              style={[
                styles.mealShareFill,
                { backgroundColor: colors.accent, width: `${Math.min(100, mealShare)}%` },
              ]}
            />
          </View>
          <Text style={[styles.mealSharePct, { color: colors.textMuted }]}>{mealShare} %</Text>
        </View>
      ) : null}

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
        {/* En `dense`, le `+` vit dans l'en-tête et le bouton principal au pied de la carte : la
            même phrase répétée cinq fois n'apprenait rien la cinquième fois. */}
        {onAdd && !dense ? (
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
  tabs: { flexDirection: 'row', gap: 8 },
  // US NUTRI-UX02 — la carte unique « Ta journée » qui remplace les cartes par repas.
  dayCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  dayCardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 11,
  },
  dayCardTitle: { flex: 1, fontFamily: fontFamily.displayBold, fontSize: 17 },
  dayCardMeta: { fontFamily: fontFamily.mono, fontSize: 11.5 },
  dayCardHydration: { borderTopWidth: 1 },
  dayCardAdd: {
    minHeight: 48,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mealSection: { borderTopWidth: 1 },
  mealHeadDense: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11 },
  mealShareRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingBottom: 9 },
  mealShareTrack: { flex: 1, height: 4, borderRadius: 3, overflow: 'hidden' },
  mealShareFill: { height: '100%', borderRadius: 3 },
  mealSharePct: { fontFamily: fontFamily.mono, fontSize: 10.5, width: 34, textAlign: 'right' },
  // 44 px de haut : la cible tactile minimale de CONF-07, qu'un onglet de 36 px manquait.
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  // US NUTRI-UX02 — l'explication qui remplace les pastilles à zéro. Contour pointillé et non
  // carte pleine : ce n'est pas une donnée de plus, c'est l'absence de donnée, dite.
  microsUnknown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  microsUnknownText: { flex: 1, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  manageMealsLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  // US REPAS-01 — carte d'accès au planning repas (P1).
  mealPlanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  mealPlanIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mealPlanTexts: { flex: 1, gap: 2 },
  mealPlanTitle: { fontFamily: fontFamily.displayBold, fontSize: 15 },
  mealPlanSubtitle: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
});
