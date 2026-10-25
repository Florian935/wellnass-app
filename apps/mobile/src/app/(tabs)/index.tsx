/**
 * Écran d'accueil — **les cinq zones** (US ACCUEIL-01 → 05, 09/09/2026).
 *
 * ── Ce que cet écran était ───────────────────────────────────────────────────────────────────────
 * Un en-tête (salut figé + **nom de l'application** en 28 px + sync + « Personnaliser ») et une
 * `WidgetGrid`. Rien d'autre. Tout y était déplaçable et masquable, donc **rien n'y était garanti**
 * — alors que les deux hubs pilier, eux, ont chacun une carte d'action épinglée hors grille. L'écran
 * d'atterrissage était le seul à n'avoir aucune priorité.
 *
 * ── Ce qu'il est ─────────────────────────────────────────────────────────────────────────────────
 *   0 · `HomeStage`    — la scène du moment (US DASH-01) : date, accroche, et selon l'heure un
 *                        check-in, une série en danger, un retour, ou les anneaux de la semaine ;
 *                        elle porte `NowCard` — la prochaine action, un seul sujet   (fixe)
 *   1 · `SinceLastVisitCard` · `WeeklyStoryCard` · objectif — ce qui a bougé          (fixes)
 *   2 · `QuickActions` — les quatre gestes du quotidien à un tap        (fixe)
 *   3 · `WidgetGrid`   — la grille personnalisable, densifiée           (personnalisable)
 *   4 · `UpNext`       — « la suite », trois lignes de texte            (fixe)
 *
 * ⚠️ **Les zones 0/1/2/4 ne sont pas des widgets** et ne consomment donc aucune place au plafond
 * de huit d'ADR-007 §2. C'est écrit dans l'ADR (amendement du 09/09/2026) parce que la distinction
 * est exactement le genre de nuance qu'une relecture rapide écrase — et le plafond ne doit pas
 * devenir une excuse pour laisser l'accueil sans hiérarchie.
 *
 * ⚠️ **Le mode édition masque le chrome.** Pendant la personnalisation, seules la grille et ses
 * consignes restent : garder une carte épinglée et une barre d'actions au-dessus d'une grille
 * qu'on réorganise ferait croire qu'elles sont déplaçables aussi.
 *
 * ── US ACCUEIL-07 — l'accueil dit vrai (25/10/2026) ──────────────────────────────────────────────
 * La décision (`useNowAction`) est calculée **ici, une fois**, et passée à la scène et à la carte —
 * la carte la recalculait elle-même. La scène porte la salutation (avec le prénom) et la phrase du
 * jour (qui ne répète plus la carte), le check-in en visages, les vrais gestes pour sauver la série,
 * et la reprise en douceur qui ne pousse plus la route `/real-life` inexistante (VIE-02). Teinte
 * Aurore : voir `theme/stage.ts`.
 */

import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  dayMoment,
  daySentence,
  explainReadiness,
  greetingKind,
  localDateFromDayKey,
  localDayKey,
  MEAL_TYPES,
  type HomeWidgetId,
  type MealType,
  type WellbeingLevel,
  type WidgetId,
  type WidgetSize,
} from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { SyncStatus } from '@/components/SyncStatus';
import { DashboardWidget } from '@/components/dashboard/dashboard-widgets';
import { HomeStage, type HomeScene } from '@/components/dashboard/HomeStage';
import { GoalConflictBanner } from '@/components/dashboard/GoalConflictBanner';
import { NowCard } from '@/components/dashboard/NowCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { MorningBrief } from '@/components/dashboard/MorningBrief';
import { SinceLastVisitCard } from '@/components/dashboard/SinceLastVisitCard';
import { EveningCard } from '@/components/dashboard/EveningCard';
import { WeeklyStoryCard } from '@/components/dashboard/WeeklyStoryCard';
import { GoalCard } from '@/components/goals/GoalCard';
import { ExplainSheet } from '@/components/explain/ExplainSheet';
import { UpNext } from '@/components/dashboard/UpNext';
import { StageScrollView } from '@/components/stage/StageScrollView';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { AskCard } from '@/components/ask/AskCard';
import { useAskQuestions, useHomeScene } from '@/hooks/useHomeScene';
import { useWeekRings } from '@/hooks/useWeekRings';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useNowAction } from '@/hooks/useNowAction';
import { useProfile } from '@/data/repositories/profile-repository';
import { useGoals } from '@/data/repositories/goal-repository';
import { saveWellbeing } from '@/data/repositories/daily-wellbeing-repository';
import { useNutritionSummary } from '@/data/repositories/dashboard-repository';
import { consumeJoker } from '@/data/repositories/streak-joker-repository';
import { useActivationPath } from '@/data/repositories/activation-path-repository';
import { useInsights } from '@/data/repositories/insights-repository';
import { usePressingLink } from '@/data/repositories/cross-links-repository';
import { InsightsProvider } from '@/data/repositories/insights-context';
import { startRealLifePeriod, useRealLifeState } from '@/data/repositories/real-life-repository';
import { useSyncRefresh } from '@/hooks/useSyncRefresh';
import { useKcalFormat } from '@/hooks/useKcalFormat';
import { useCurrentHour, useTodayDate } from '@/hooks/useTodayKey';
import { useComebackChoice } from '@/stores/home-comeback-store';
import { fontFamily } from '@/theme/fonts';
import { auroraMoment } from '@/theme/stage';
import { useTheme } from '@/theme/useTheme';

/** Durée d'une reprise en douceur (VIE-01) : une semaine, le temps de reprendre le rythme. */
const GENTLE_RESTART_DAYS = 7;

export default function HomeScreen() {
  useMenuFocus('home');
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useProfile();
  const firstName = profile?.firstName ?? '';

  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);

  // La décision est calculée **une seule fois ici** et partagée entre la scène, la carte et la mise
  // en avant du repas : plusieurs appels à `useNowAction` monteraient plusieurs fois l'union d'une
  // quinzaine de hooks sur l'écran le plus ouvert de l'app. ⚠️ Jusqu'à ACCUEIL-07, ce commentaire
  // mentait : `NowCard` rappelait le hook elle-même. La carte reçoit désormais la décision par props.
  const { action, isLoading: actionLoading } = useNowAction();
  const formatKcal = useKcalFormat();
  const { kcal: kcalEaten, effectiveTarget } = useNutritionSummary();
  const kcalRemaining = effectiveTarget != null ? effectiveTarget - kcalEaten : null;

  // ── Widgets conditionnels : ils rendent `null` hors condition, il faut donc les exclure de la
  // grille, sinon `WidgetGrid` réserve leur cellule et laisse un **trou**. Ce défaut s'est produit
  // quatre fois sur ce dashboard.
  const activationPathActive = useActivationPath().show;
  // US INSIGHTS-01 : la porte d'entrée de l'écran « Insights ». Calculée **une seule fois** ici,
  // puis diffusée au widget via `InsightsProvider` (voir `insights-context.tsx`).
  const insightsValue = useInsights();
  // US ECHO-01 — le widget dit aussi « Tes liens » : un lien à régler suffit à l'afficher.
  const pressingLink = usePressingLink();
  const insightsActive = insightsValue.insights.length > 0 || pressingLink.link !== null;
  const isWidgetActive = (id: WidgetId) => {
    if (id === 'activation-path') return activationPathActive;
    if (id === 'insights') return insightsActive;
    return true;
  };

  // US ACCUEIL-04 — forme **effective** de `real-life` : `row` hors période (une ligne suffit),
  // `large` pendant. La disposition enregistrée n'est pas réécrite : le widget retrouve sa bande à
  // la fin de la période.
  //
  // ⚠️ **`large` et non `wide`** (correctif du 10/09/2026). Le premier jet remontait à `wide`
  // (170 px) : constaté en recette, la carte active était **tronquée** et ses deux boutons
  // inatteignables. Son contenu en période fait environ 230 px — échéance, jours restants,
  // séparateur, trois lignes d'objectif de semaine, puis « Prolonger » et « Reprendre le plan
  // normal » côte à côte. Seule `large` (352 px) le contient sans couper.
  //
  // Le vide résiduel est assumé : mieux vaut une carte trop grande pendant les quelques semaines
  // d'une période qu'une carte dont on ne peut pas se servir.
  const { activePeriod } = useRealLifeState();
  const normalChosenOn = useComebackChoice((s) => s.normalChosenOn);
  const chooseNormal = useComebackChoice((s) => s.chooseNormal);
  const sizeFor = (id: WidgetId, stored: WidgetSize): WidgetSize =>
    id === 'real-life' && activePeriod !== null && (stored === 'row' || stored === 'wide')
      ? 'large'
      : stored;

  const { refreshing, onRefresh } = useSyncRefresh();

  const toggleEditing = () => {
    // Analytics : uniquement à l'entrée en mode édition (pas à la sortie). Fire-and-forget.
    if (!editing) void track(ANALYTICS_EVENTS.dashboardCustomized);
    setEditing((v) => !v);
  };

  // ── La scène du moment (US DASH-01, §4.1) ─────────────────────────────────────────────────
  const facts = useHomeScene();
  const rings = useWeekRings();
  const today = useTodayDate();
  // US PRISME-01 — l'heure par `useCurrentHour`, jamais `new Date()` dans le corps (React Compiler).
  const hour = useCurrentHour();
  const { active: activeGoals } = useGoals();
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [freezing, setFreezing] = useState(false);
  // §6.1 — « Pourquoi ? » sur le verdict de forme : les étapes viennent de la brique, pas d'ici.
  const [explainOpen, setExplainOpen] = useState(false);

  const dateLabel = today.toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  // §7.3 — les trois questions du moment, réponses calculées ici : le modèle ne fait que formuler.
  const askQuestions = useAskQuestions(facts.readiness);
  const todayKey = localDayKey(today);

  // US ACCUEIL-07 (constat 6) — deux lignes : la salutation, avec le prénom quand on le connaît,
  // puis la phrase du jour, qui dérive de la même décision que la carte sans jamais la répéter.
  const greetKind = greetingKind({
    hour,
    comeback: facts.moment === 'comeback',
    firstDay: facts.firstDay,
  });
  const greeting = firstName
    ? t(`home.greet.${greetKind}`, { name: firstName })
    : t(`home.greet.${greetKind}Anon`);
  const phrase = daySentence(action, { hour, kcalRemaining });
  const sentence = t(phrase.key, {
    ...phrase.params,
    ...(phrase.params.kcal !== undefined ? { kcal: formatKcal(phrase.params.kcal) } : {}),
  });

  /**
   * Le check-in du matin, depuis la scène : **une seule question**, l'énergie. Le formulaire complet
   * (humeur, stress, poids) reste à un tap, mais réclamer trois curseurs avant le café était le plus
   * sûr moyen de n'avoir aucun check-in du tout.
   */
  const onCheckin = (level: WellbeingLevel) => {
    setSavingCheckin(true);
    void saveWellbeing(localDayKey(today), { energy: level })
      // §5 — l'événement mesure un **geste**, jamais la valeur saisie : le niveau d'énergie est une
      // donnée de santé, il ne sort pas de l'appareil.
      .then((written) => {
        if (written) void track(ANALYTICS_EVENTS.homeCheckinDone);
      })
      .catch(() => undefined)
      .finally(() => setSavingCheckin(false));
  };

  /**
   * Reprise en douceur (VIE-01) : une période « vie réelle » d'une semaine, et la série traverse.
   *
   * 🔴 VIE-02 (absorbée par ACCUEIL-07) — elle poussait ensuite `/real-life`, une route qui n'a
   * jamais existé : l'utilisateur qui revenait tombait sur « Unmatched Route ». On reste désormais
   * sur l'accueil, et la scène relit la période qu'on vient d'écrire pour dire jusqu'à quand.
   */
  const onGentleRestart = () => {
    void startRealLifePeriod({
      startedOn: todayKey,
      endsOn: localDayKey(addDays(today, GENTLE_RESTART_DAYS)),
    }).catch(() => undefined);
  };

  /** La date de fin d'une période, en clair (« 1 novembre »). */
  const formatDay = (dayKey: string) =>
    localDateFromDayKey(dayKey).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', {
      day: 'numeric',
      month: 'long',
    });

  /**
   * US ACCUEIL-07 (constat 5) — le joker sur aujourd'hui, confirmé d'abord : il n'y en a qu'un par
   * mois. `consumeJoker` relit le quota au moment d'écrire ; un refus s'affiche, il ne se perd pas.
   */
  const onFreezeToday = () => {
    void track(ANALYTICS_EVENTS.streakSavedEvening);
    Alert.alert(t('stage.home.rescue.jokerConfirmTitle'), t('stage.home.rescue.jokerConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('stage.home.rescue.jokerConfirm'),
        onPress: () => {
          setFreezing(true);
          void consumeJoker(todayKey)
            .catch(() => Alert.alert(t('home.streak.jokerError')))
            .finally(() => setFreezing(false));
        },
      },
    ]);
  };

  const scene: HomeScene =
    facts.moment === 'morning'
      ? {
          kind: 'morning',
          checkinDone: facts.checkinDone,
          verdict: facts.verdict,
          onCheckin,
          saving: savingCheckin,
        }
      : facts.moment === 'evening-at-risk'
        ? {
            kind: 'evening-at-risk',
            streak: facts.streak,
            hoursLeft: facts.hoursLeft,
            // US ACCUEIL-07 (constat 5) — de vrais gestes, plus un bouton vers le planning.
            rescue: facts.rescue,
            onWalk: () => {
              void track(ANALYTICS_EVENTS.streakSavedEvening);
              router.push('/steps');
            },
            onActivity: () => {
              void track(ANALYTICS_EVENTS.streakSavedEvening);
              router.push('/activity');
            },
            onJoker: onFreezeToday,
            busy: freezing,
            formatSteps: formatKcal,
          }
        : facts.moment === 'comeback'
          ? {
              kind: 'comeback',
              days: facts.daysSinceLastActivity ?? 0,
              bestStreak: facts.streak,
              gentleUntil: activePeriod ? formatDay(activePeriod.endsOn) : null,
              normalChosen: normalChosenOn === todayKey,
              onGentle: onGentleRestart,
              onNormal: () => chooseNormal(todayKey),
            }
          : { kind: 'day', rings, streak: facts.streak, verdict: facts.verdict };

  const renderWidget = (id: WidgetId, size: WidgetSize) => (
    <DashboardWidget id={id as HomeWidgetId} size={size} />
  );

  /** La grille et ses consignes, partagées par les deux modes — c'est le même contenu. */
  const grid = (
    <InsightsProvider value={insightsValue}>
      <WidgetGrid
        screen="home"
        editing={editing}
        renderWidget={renderWidget}
        onDragActiveChange={setDragging}
        isActive={isWidgetActive}
        sizeFor={sizeFor}
      />
    </InsightsProvider>
  );

  /**
   * Le mode édition **n'a pas de scène** : réorganiser des widgets sous une scène qui, elle, ne se
   * déplace pas ferait croire qu'elle est déplaçable aussi. C'est la même raison qui masquait déjà
   * l'en-tête et la carte épinglée (US ACCUEIL-01).
   */
  if (editing) {
    return (
      <Screen edges={['top']}>
        <View style={styles.editHeader}>
          <View style={styles.editTexts}>
            {/* US UX-04 : le mode édition annonce **comment** déplacer un widget. Le geste
                (appui long) existait déjà mais restait invisible : personne ne le découvrait. */}
            <Text style={[styles.editTitle, { color: colors.text }]}>
              {t('home.customize.editHint')}
            </Text>
            <Text style={[styles.editHint, { color: colors.textMuted }]} maxFontSizeMultiplier={1.4}>
              {t('home.customize.dragHint')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: true }}
            accessibilityLabel={t('home.customize.done')}
            onPress={toggleEditing}
            hitSlop={8}
            style={StyleSheet.flatten([
              styles.doneBtn,
              { backgroundColor: colors.accent, borderColor: colors.accent },
            ])}
          >
            <Ionicons name="checkmark" size={16} color={colors.accentText} />
            <Text style={[styles.doneLabel, { color: colors.accentText }]}>
              {t('home.customize.done')}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.blocks}
          showsVerticalScrollIndicator={false}
          // Neutralise le défilement pendant un drag actif (maquette / spec 7.2).
          scrollEnabled={!dragging}
        >
          {grid}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <StageScrollView
      pillar="home"
      testID="home-screen"
      scrollEnabled={!dragging}
      refreshControl={
        // US ACCUEIL-05 : le geste est un réflexe et ne renvoyait rien — il n'existait pas un
        // seul `RefreshControl` dans l'app.
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
      stage={
        <HomeStage
          scene={scene}
          greeting={greeting}
          sentence={sentence}
          dateLabel={dateLabel}
          glowMoment={auroraMoment(hour)}
          onExplainVerdict={facts.verdict ? () => setExplainOpen(true) : undefined}
          trailing={
            <>
              <SyncStatus />
              <Link href="/settings" asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.title')}
                  hitSlop={10}
                  style={styles.avatar}
                >
                  <Ionicons name="person-circle-outline" size={24} color={colors.text} />
                </Pressable>
              </Link>
            </>
          }
        >
          <NowCard
            action={action}
            isLoading={actionLoading}
            kcalRemaining={kcalRemaining}
            formatKcal={formatKcal}
          />
        </HomeStage>
      }
    >
      {/* §6.2 — le brief du matin, lu à voix haute. Le matin seulement : une « revue du matin »
          affichée à 19 h n'est plus un rendez-vous, c'est du remplissage. */}
      {facts.moment === 'morning' ? (
        <MorningBrief
          action={action}
          verdict={facts.verdict}
          speechLanguage={i18n.language === 'en' ? 'en-GB' : 'fr-FR'}
        />
      ) : null}

      {/* US PRISME-01 — « Ta journée », dès 18 h : les faits du jour, et Prisme qui les raconte à la
          demande. La carte se tait sur une journée sans séance ni repas. */}
      {dayMoment(hour) === 'evening' ? <EveningCard /> : null}

      {/* §4.5 — ce qui a bougé depuis la dernière visite : la carte se tait si rien n'a bougé. */}
      <SinceLastVisitCard />

      {/* §4.1 — le bilan de la semaine, les deux premiers jours seulement (BILAN-01). */}
      <WeeklyStoryCard weekday={isoWeekday(today)} onOpen={() => router.push('/review')} />

      {/* §4.1 — l'objectif dont l'échéance est la plus proche (OBJ-01) ; `active` est déjà trié. */}
      {activeGoals[0] ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('goals.title')}
          onPress={() => router.push('/goals')}
        >
          <GoalCard goal={activeGoals[0]} />
        </Pressable>
      ) : null}

      {/* §7.3 — « Demande-moi ». Sans IA, sans réseau, sans consentement : mêmes réponses. */}
      <AskCard questions={askQuestions} />

      {/* US GUID-01 — la contradiction entre objectifs. Carte CONDITIONNELLE : elle n'apparaît que
          s'il y a réellement une tension, et ne consomme donc aucune place au plafond de widgets
          (ADR-007 §2 : le catalogue se surface « quand il a quelque chose à dire »). */}
      <GoalConflictBanner />

      <QuickActions
        highlightMeal={action.kind === 'meal-due' ? asMealType(action.meal.key) : undefined}
      />

      {grid}

      <UpNext onCustomize={toggleEditing} />

      <ExplainSheet
        visible={explainOpen}
        title={t('home.readiness.eyebrow')}
        explanation={explainReadiness(facts.readiness)}
        onClose={() => setExplainOpen(false)}
      />
    </StageScrollView>
  );
}

/** La pastille « repas » des actions rapides ne connaît que les quatre repas par défaut. */
function asMealType(key: string): MealType | undefined {
  return (MEAL_TYPES as readonly string[]).includes(key) ? (key as MealType) : undefined;
}

/** Jour de la semaine, 1 = lundi (l'ISO, pas le `getDay()` de JavaScript qui met dimanche à 0). */
function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

const styles = StyleSheet.create({
  avatar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  editTexts: { flex: 1, gap: 2 },
  editTitle: { fontFamily: fontFamily.displayBold, fontSize: 20, letterSpacing: -0.5 },
  editHint: { fontFamily: fontFamily.body, fontSize: 13 },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  doneLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  blocks: { gap: 12, paddingBottom: 8 },
});
