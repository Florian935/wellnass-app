import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { explainCalorieTarget, mealForHour, sumNutrients } from '@wellness/shared';
import {
  addFoodEntry,
  duplicateDay,
  moveEntry,
  reassignEntryMeal,
  removeEntry,
  useDayEntries,
  type JournalEntry,
} from '@/data/repositories/journal-repository';
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
import { useDenseFoodCandidates, useRecentFoods } from '@/data/repositories/food-repository';
import { useCurrentHour, useTodayKey } from '@/hooks/useTodayKey';
import { useDayNutritionTargets } from '@/hooks/useDayNutritionTargets';
import { useMealList } from '@/hooks/useMealList';
import { AddFoodSheet } from '@/components/nutrition/AddFoodSheet';
import { DayCalendarSheet } from '@/components/nutrition/DayCalendarSheet';
import { DayEnergyCard } from '@/components/energy/DayEnergyCard';
import { HydrationCard } from '@/components/nutrition/HydrationCard';
// US NUTRI-UX03 — le journal sort de l'écran : la page d'un jour passé en a besoin aussi.
import { EntryDetailModal } from '@/components/nutrition/journal/EntryDetailModal';
import { MealSection } from '@/components/nutrition/journal/MealSection';
import { DayQualitySection, TrackedMicrosRecap } from '@/components/nutrition/journal/TrackedMicrosRecap';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, m! - 1, d! + n);
  return isoDay(date);
};

export default function NutritionScreen() {
  useMenuFocus('nutrition');
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
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

  // Objectif calorique, cible effective du jour affiché (bonus compris) et macros cibles. La
  // navigation par jour reste correcte : tout est paramétré par `day`.
  const {
    tdeeValue,
    target,
    effectiveTarget,
    trainingBonus,
    trainingApplies,
    targetLoading,
    targetMacros,
    profileComplete,
  } = useDayNutritionTargets(day);

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

  // Repas configurés résolus (clé + libellé d'affichage) — un repas custom sans nom retombe sur
  // « Repas N ».
  const mealList = useMealList();
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
                profileComplete,
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

const styles = StyleSheet.create({  emptyDay: { borderRadius: 20, borderWidth: 1, paddingVertical: 34, paddingHorizontal: 24, alignItems: 'center' },
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
  // Conservés pour le détail d'entrée (modal), qui garde sa mise en page en lignes.
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
