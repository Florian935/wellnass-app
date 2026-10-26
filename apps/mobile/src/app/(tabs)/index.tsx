/**
 * Écran d'accueil — **« Ta journée »** (US ACCUEIL-08, 25/10/2026).
 *
 * ── Ce que cet écran était ───────────────────────────────────────────────────────────────────────
 * Douze blocs (~1 850 px, 2,4 écrans), dont la moitié redisaient la série (×2), la semaine (×3), la
 * forme (×3) ou l'assiette (×3) — et aucun ne répondait d'un coup d'œil à « où j'en suis
 * aujourd'hui ? » (constats du 24/10/2026, `design/accueil-2026-10/README.md`).
 *
 * ── Ce qu'il est ─────────────────────────────────────────────────────────────────────────────────
 * Trois questions, dans cet ordre : où j'en suis aujourd'hui, qu'est-ce que je fais maintenant,
 * qu'est-ce qui a bougé. De haut en bas :
 *   0 · **le ciel** (`HomeStage`, teinte Aurore) — la salutation, la phrase du jour, « Écouter mon
 *       brief » le matin, la séance en cours, puis les **trois cadrans** (`HomeDials`) — ou la carte
 *       « retour », ou « Premiers pas » le tout premier jour ;
 *   1 · **Ta journée** (`HomeDayTimeline`) — le fil horodaté, l'action du moment dépliée (`NowCard`) ;
 *   2 · **Ta semaine** (`WeekStrip`) ;
 *   3 · **Du nouveau** (`HomeNews`) — deux cartes au plus ;
 *   4 · **Tes repères** — la grille personnalisable, en tuiles compactes (D5) ;
 *   5 · le pied — « Semaine chargée ? Allège-la » (ou la carte de la période en cours) et
 *       « Personnaliser l'accueil » ;
 *   + · le **bouton « + »** flottant et sa feuille « Noter » (D4).
 *
 * ⚠️ **Seule la zone 4 est faite de widgets** (plafond de huit d'ADR-007 §2, amendé le 25/10/2026) :
 * les autres zones sont garanties à l'écran, non masquables, et ne consomment aucune place au plafond.
 *
 * ⚠️ **Le mode édition masque le chrome** : pendant la personnalisation, seules la grille et ses
 * consignes restent.
 *
 * ⚠️ **La décision est calculée une fois** (`useNowAction` → `buildDayTimeline`) et passée à la
 * scène, au fil et à la carte du moment par props.
 */

import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  buildDayDials,
  crossTip,
  dayMoment,
  daySentence,
  explainReadiness,
  greetingKind,
  localDateFromDayKey,
  localDayKey,
  resolveActivePillars,
  type DayDial,
  type HomeWidgetId,
  type TimelineItem,
  type WellbeingLevel,
  type WidgetId,
  type WidgetSize,
} from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { SyncStatus } from '@/components/SyncStatus';
import { DashboardWidget } from '@/components/dashboard/dashboard-widgets';
import { HomeStage } from '@/components/dashboard/HomeStage';
import { HomeDials } from '@/components/dashboard/HomeDials';
import { HomeDayTimeline } from '@/components/dashboard/HomeDayTimeline';
import { NowCard, type RescueProps } from '@/components/dashboard/NowCard';
import { WeekStrip, type StreakPill } from '@/components/dashboard/WeekStrip';
import { HomeNews } from '@/components/dashboard/HomeNews';
import { AddFab, AddSheet } from '@/components/dashboard/AddSheet';
import {
  ComebackCard,
  FirstStepsCard,
  ListenBriefButton,
  LiveBanner,
} from '@/components/dashboard/HomeSky';
import { EveningCard } from '@/components/dashboard/EveningCard';
import { RealLifeCard } from '@/components/dashboard/RealLifeCard';
import { RealLifeSheet } from '@/components/real-life/RealLifeSheet';
import { ExplainSheet } from '@/components/explain/ExplainSheet';
import { StageScrollView } from '@/components/stage/StageScrollView';
import { useStageTheme } from '@/components/stage/PillarStage';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { useHomeScene, useMorningBriefFacts } from '@/hooks/useHomeScene';
import { useHomeWeek } from '@/hooks/useHomeWeek';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useNowAction } from '@/hooks/useNowAction';
import { useProfile } from '@/data/repositories/profile-repository';
import { saveWellbeing } from '@/data/repositories/daily-wellbeing-repository';
import { useNutritionSummary, useProteinTarget } from '@/data/repositories/dashboard-repository';
import { consumeJoker } from '@/data/repositories/streak-joker-repository';
import { useActivationPath } from '@/data/repositories/activation-path-repository';
import { useLatestWeight } from '@/data/repositories/bodyweight-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { startRealLifePeriod, useRealLifeState } from '@/data/repositories/real-life-repository';
import { useSyncRefresh } from '@/hooks/useSyncRefresh';
import { useKcalFormat } from '@/hooks/useKcalFormat';
import { useTodayDate } from '@/hooks/useTodayKey';
import { useComebackChoice } from '@/stores/home-comeback-store';
import { fontFamily } from '@/theme/fonts';
import { auroraMoment } from '@/theme/stage';
import { useTheme } from '@/theme/useTheme';

/** Durée d'une reprise en douceur (VIE-01) : une semaine, le temps de reprendre le rythme. */
const GENTLE_RESTART_DAYS = 7;
/** « Écouter mon brief » : le matin seulement (le brief est un rendez-vous, pas du remplissage). */
const BRIEF_UNTIL_HOUR = 11;

export default function HomeScreen() {
  useMenuFocus('home');
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const stage = useStageTheme('home');
  const { profile } = useProfile();
  const firstName = profile?.firstName ?? '';
  const { settings } = useSettings();
  const pillars = resolveActivePillars(settings?.activePillars);

  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [realLifeOpen, setRealLifeOpen] = useState(false);
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [freezing, setFreezing] = useState(false);
  // §6.1 — « Pourquoi ? » sur le verdict de forme : les étapes viennent de la brique, pas d'ici.
  const [explainOpen, setExplainOpen] = useState(false);

  // ── La décision, une fois ───────────────────────────────────────────────────────────────────
  const { action, timeline, hour, mealTotals, checkinEnergy, isLoading } = useNowAction();
  const facts = useHomeScene();
  const week = useHomeWeek();
  const formatKcal = useKcalFormat();
  const { kcal: kcalEaten, effectiveTarget, macros, trainingBonus } = useNutritionSummary();
  const proteinTarget = useProteinTarget();
  const kcalRemaining = effectiveTarget != null ? effectiveTarget - kcalEaten : null;
  const activation = useActivationPath();
  const { latest } = useLatestWeight();
  const { activePeriod } = useRealLifeState();
  const normalChosenOn = useComebackChoice((s) => s.normalChosenOn);
  const chooseNormal = useComebackChoice((s) => s.chooseNormal);
  const { refreshing, onRefresh } = useSyncRefresh();

  const today = useTodayDate();
  const todayKey = localDayKey(today);
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR';
  const dateLabel = today.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  const toggleEditing = () => {
    // Analytics : uniquement à l'entrée en mode édition (pas à la sortie). Fire-and-forget.
    if (!editing) void track(ANALYTICS_EVENTS.dashboardCustomized);
    setEditing((v) => !v);
  };

  // ── La salutation et la phrase du jour (ACCUEIL-07, constat 6) ──────────────────────────────
  const atRisk = facts.moment === 'evening-at-risk';
  const greetKind = greetingKind({ hour, comeback: facts.moment === 'comeback', firstDay: facts.firstDay });
  const greeting = firstName
    ? t(`home.greet.${greetKind}`, { name: firstName })
    : t(`home.greet.${greetKind}Anon`);
  const phrase = daySentence(timeline.now, {
    hour,
    kcalRemaining,
    streakHoursLeft: atRisk ? facts.hoursLeft : null,
  });
  const sentence = t(phrase.key, {
    ...phrase.params,
    ...(phrase.params.kcal !== undefined ? { kcal: formatKcal(phrase.params.kcal) } : {}),
    ...(phrase.params.steps !== undefined ? { steps: formatKcal(phrase.params.steps) } : {}),
  });

  // ── Les gestes ──────────────────────────────────────────────────────────────────────────────
  /**
   * Le check-in du matin, depuis la carte du moment : **une seule question**, l'énergie. Le formulaire
   * complet reste à un tap ; réclamer trois curseurs avant le café était le plus sûr moyen de n'avoir
   * aucun check-in du tout.
   */
  const onCheckin = (level: WellbeingLevel) => {
    setSavingCheckin(true);
    void saveWellbeing(todayKey, { energy: level })
      // §5 — l'événement mesure un **geste**, jamais la valeur saisie : donnée de santé.
      .then((written) => {
        if (written) void track(ANALYTICS_EVENTS.homeCheckinDone);
      })
      .catch(() => undefined)
      .finally(() => setSavingCheckin(false));
  };

  /** Reprise en douceur (VIE-01) : une période « vie réelle » d'une semaine — sur place (VIE-02). */
  const onGentleRestart = () => {
    void startRealLifePeriod({
      startedOn: todayKey,
      endsOn: localDayKey(addDays(today, GENTLE_RESTART_DAYS)),
    }).catch(() => undefined);
  };

  const formatDay = (dayKey: string) =>
    localDateFromDayKey(dayKey).toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  /** Le joker sur aujourd'hui, confirmé d'abord : il n'y en a qu'un par mois (ACCUEIL-07). */
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

  const rescue: RescueProps | null = atRisk
    ? {
        streak: facts.streak,
        hoursLeft: facts.hoursLeft,
        options: facts.rescue,
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
    : null;

  /** Le « + » d'une ligne du fil : noter tout de suite un repas ou une pesée. */
  const onQuick = (item: TimelineItem) => {
    if (item.kind === 'meal' && item.meal) {
      router.push({ pathname: '/food-picker', params: { date: todayKey, meal: item.meal.key } });
    } else if (item.kind === 'weigh') {
      router.push('/nutrition-stats?tab=weight');
    }
  };

  // ── Les cadrans (D2) ────────────────────────────────────────────────────────────────────────
  const checkinItem = timeline.items.find((it) => it.kind === 'checkin');
  const dials = buildDayDials({
    pillars,
    todayKey,
    weekSessions: week.weekSessions,
    nutrition: { consumed: kcalEaten, target: effectiveTarget, proteinG: macros.p, proteinTarget },
    steps: facts.steps,
    readiness: facts.readiness,
    checkinPending: checkinItem !== undefined && !checkinItem.done && !checkinItem.missed,
  });
  const onDial = (key: DayDial['key']) => {
    if (key === 'move') router.push('/planning');
    else if (key === 'eat') router.push('/(tabs)/nutrition');
    else if (key === 'walk') router.push('/steps');
    else if (facts.readiness.show) setExplainOpen(true);
  };

  // ── Ce que porte le ciel ────────────────────────────────────────────────────────────────────
  const liveItem = timeline.items.find((it) => it.live);
  const firstStepsToday =
    facts.firstDay && activation.show && activation.day === 1 && activation.theme !== null;
  const sky = (
    <>
      {hour < BRIEF_UNTIL_HOUR && facts.moment !== 'comeback' && !facts.firstDay ? (
        <MorningListen action={action} verdict={facts.verdict} lead={[greeting, sentence]} language={locale} />
      ) : null}
      {action.kind === 'workout-active' || action.kind === 'run-active' ? (
        <LiveBanner
          pillar={action.kind === 'workout-active' ? 'strength' : 'running'}
          title={
            liveItem?.training?.name ||
            t(action.kind === 'workout-active' ? 'home.now.workoutActive.eyebrow' : 'home.now.runActive.eyebrow')
          }
          onResume={() => router.push(action.kind === 'workout-active' ? '/workout' : '/run/active')}
        />
      ) : null}
      {facts.moment === 'comeback' ? (
        <ComebackCard
          days={facts.daysSinceLastActivity ?? 0}
          bestStreak={facts.streak}
          gentleUntil={activePeriod ? formatDay(activePeriod.endsOn) : null}
          normalChosen={normalChosenOn === todayKey}
          onGentle={onGentleRestart}
          onNormal={() => chooseNormal(todayKey)}
        />
      ) : firstStepsToday ? (
        <FirstStepsCard
          title={t('activationPath.day1.title')}
          description={t('activationPath.day1.description')}
          ctaLabel={null}
          onCta={null}
        />
      ) : (
        <HomeDials dials={dials} onPress={onDial} formatNumber={formatKcal} />
      )}
    </>
  );

  // ── La carte du moment, dans le fil ─────────────────────────────────────────────────────────
  const nowItem = timeline.items.find((it) => it.id === timeline.nowItemId) ?? null;
  const doneTraining = timeline.items.find((it) => it.kind === 'training' && it.done)?.doneTraining;
  const tip = crossTip(timeline.now, {
    pendingTrainings: timeline.items.flatMap((it) => (it.training && !it.done ? [it.training] : [])),
    trainedPillar: doneTraining?.pillar ?? null,
    trainingBonusKcal: trainingBonus,
    proteinGapG: proteinTarget != null ? Math.max(0, proteinTarget - macros.p) : null,
  });
  const nowCard = (
    <NowCard
      action={timeline.now}
      isLoading={isLoading}
      hour={hour}
      itemHour={nowItem?.hour ?? null}
      itemTimeKnown={nowItem?.timeKnown ?? true}
      kcalRemaining={kcalRemaining}
      formatKcal={formatKcal}
      tip={tip}
      checkin={{ onPick: onCheckin, saving: savingCheckin }}
      rescue={rescue}
    />
  );

  // La série en pastille : en semaines si c'est l'unité choisie (SERIE-01), en jeu le soir.
  const streakPill: StreakPill =
    facts.weeklyStreak.unit === 'week'
      ? facts.weeklyStreak.current > 0
        ? { kind: 'weeks', weeks: facts.weeklyStreak.current }
        : { kind: 'start' }
      : facts.streak <= 0
        ? { kind: 'start' }
        : atRisk
          ? { kind: 'at-risk', days: facts.streak }
          : { kind: 'running', days: facts.streak };

  const renderWidget = (id: WidgetId, size: WidgetSize) => (
    <DashboardWidget id={id as HomeWidgetId} size={size} />
  );

  /** La grille et ses consignes, partagées par les deux modes — c'est le même contenu. */
  const grid = (
    <WidgetGrid screen="home" editing={editing} renderWidget={renderWidget} onDragActiveChange={setDragging} />
  );

  /**
   * Le mode édition **n'a pas de scène** : réorganiser des repères sous une scène qui, elle, ne se
   * déplace pas ferait croire qu'elle est déplaçable aussi.
   */
  if (editing) {
    return (
      <Screen edges={['top']}>
        <View style={styles.editHeader}>
          <View style={styles.editTexts}>
            <Text style={[styles.editTitle, { color: colors.text }]}>{t('home.customize.editHint')}</Text>
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
            style={StyleSheet.flatten([styles.doneBtn, { backgroundColor: colors.accent, borderColor: colors.accent }])}
          >
            <Ionicons name="checkmark" size={16} color={colors.accentText} />
            <Text style={[styles.doneLabel, { color: colors.accentText }]}>{t('home.customize.done')}</Text>
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
    <View style={styles.root}>
      <StageScrollView
        pillar="home"
        testID="home-screen"
        scrollEnabled={!dragging}
        bodyStyle={styles.body}
        refreshControl={
          // US ACCUEIL-05 : le geste est un réflexe ; il force la reprise de synchro.
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
        stage={
          <HomeStage
            greeting={greeting}
            sentence={sentence}
            dateLabel={dateLabel}
            glowMoment={auroraMoment(hour)}
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
                    <Ionicons name="person-circle-outline" size={26} color={stage.ink} />
                  </Pressable>
                </Link>
              </>
            }
          >
            {sky}
          </HomeStage>
        }
      >
        <HomeDayTimeline
          timeline={timeline}
          nowCard={nowCard}
          nowFirst={atRisk}
          mealTotals={mealTotals}
          checkinEnergy={checkinEnergy}
          weightKgToday={latest?.logDate === todayKey ? latest.weightKg : null}
          formatKcal={formatKcal}
          onPlanning={() => router.push('/planning')}
          onQuick={onQuick}
        />

        {/* US PRISME-01 — les faits du soir et « Prisme raconte », dès 18 h. ACCUEIL-09 les pose au
            bout du fil ; d'ici là, la carte reste sous lui. */}
        {dayMoment(hour) === 'evening' ? <EveningCard /> : null}

        <WeekStrip
          strip={week.strip}
          pillars={pillars}
          streak={streakPill}
          offers={{
            dailyCurrent: facts.streak,
            weeklyCurrent: facts.weeklyStreak.current,
            restorableGap: facts.offers.restorableGap,
            offerSwitch: facts.offers.offerSwitch,
          }}
          onReview={() => router.push('/review')}
        />

        <HomeNews strengthSessionToday={timeline.items.some((it) => it.training?.pillar === 'strength' && !it.done)} />

        <View style={styles.reperes} testID="home-reperes">
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]} accessibilityRole="header">
              {t('home.reperes.title')}
            </Text>
            <Pressable onPress={toggleEditing} accessibilityRole="button" hitSlop={8} style={styles.sectionLink}>
              <Text style={[styles.sectionLinkLabel, { color: colors.accent }]}>{t('home.reperes.customize')}</Text>
            </Pressable>
          </View>
          {grid}
        </View>

        {/* Le pied : la vie réelle (la carte de la période quand elle court), et personnaliser. */}
        {activePeriod ? <RealLifeCard size="large" /> : null}
        <View style={styles.footer}>
          {activePeriod ? null : (
            <Pressable onPress={() => setRealLifeOpen(true)} accessibilityRole="button" hitSlop={4} style={styles.footerLink}>
              <Text style={[styles.footerLabel, { color: colors.textMuted }]}>{t('home.footer.lighten')}</Text>
            </Pressable>
          )}
          <Pressable onPress={toggleEditing} accessibilityRole="button" hitSlop={4} style={styles.footerLink}>
            <Text style={[styles.footerLabel, { color: colors.accent }]}>{t('home.footer.customize')}</Text>
          </Pressable>
        </View>

        <ExplainSheet
          visible={explainOpen}
          title={t('home.readiness.eyebrow')}
          explanation={explainReadiness(facts.readiness)}
          onClose={() => setExplainOpen(false)}
        />
        <RealLifeSheet visible={realLifeOpen} onClose={() => setRealLifeOpen(false)} />
        <AddSheet visible={addOpen} onClose={() => setAddOpen(false)} pillars={pillars} hour={hour} />
      </StageScrollView>

      <AddFab onPress={() => setAddOpen(true)} />
    </View>
  );
}

/**
 * « Écouter mon brief », monté le matin seulement : c'est lui qui monte les requêtes du brief (record
 * à portée, protéines, période « vie réelle »), inutiles le reste de la journée.
 */
function MorningListen({
  action,
  verdict,
  lead,
  language,
}: {
  action: Parameters<typeof useMorningBriefFacts>[0];
  verdict: Parameters<typeof useMorningBriefFacts>[1];
  lead: readonly string[];
  language: string;
}) {
  const facts = useMorningBriefFacts(action, verdict);
  return <ListenBriefButton facts={facts} lead={lead} speechLanguage={language} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { gap: 14, paddingHorizontal: 16, paddingBottom: 96 },
  avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  reperes: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitle: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  sectionLink: { minHeight: 44, justifyContent: 'center' },
  sectionLinkLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18 },
  footerLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  footerLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
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
