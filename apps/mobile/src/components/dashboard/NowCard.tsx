/**
 * US ACCUEIL-01 — **la carte « maintenant »** : l'action du moment, un seul sujet.
 *
 * ⚠️ **Le choix ne se fait pas ici.** `useNowAction` collecte les faits, `buildDayTimeline` (pur,
 * testé) décide. Ce composant ne fait que peindre la décision.
 *
 * ⚠️ **Ne rend jamais `null`.** Au pire, elle affiche le repli « rien de prévu ».
 *
 * ── US ACCUEIL-07 ────────────────────────────────────────────────────────────────────────────────
 * La décision arrive par props (calculée une fois par l'écran) ; un repas à la fois, à son heure,
 * avec les kcal restantes ; « rien de prévu » ne propose plus un programme à tout le monde ; teinte
 * Aurore (nuit dense du `panel` de l'accueil, bouton en dégradé turquoise → rose).
 *
 * ── US ACCUEIL-08 — la carte entre dans le fil « Ta journée » ────────────────────────────────────
 * Elle se déplie à la place du geste qu'elle porte, et son sur-titre dit **quand** : « À 18:00 ·
 * dans 5 h 20 » ou « Maintenant ». Trois gestes de plus que le fil seul connaît : le **check-in du
 * matin** (les visages, dans la carte), la **marche suggérée**, et **la série en jeu** le soir (les
 * vrais gestes pour la garder). Une **astuce croisée** s'y pose quand deux piliers se parlent
 * (« Jambes ce soir : un bon féculent à ce repas »).
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  clockLabel,
  mealForHour,
  type CrossTip,
  type DayNow,
  type MealSlot,
  type StreakRescueOption,
  type WellbeingLevel,
} from '@wellness/shared';

import { AccentHalo } from '@/components/AccentHalo';
import { CheckinFaces } from '@/components/dashboard/CheckinFaces';
import { StreakRescue } from '@/components/dashboard/StreakRescue';
import { useStageTheme } from '@/components/stage/PillarStage';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { briefRouteForSession } from '@/components/workout/immersive/brief-entry';
import { useUnits } from '@/hooks/useUnits';
import { useTodayKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Ce qu'il faut pour peindre la carte : trois textes et un bouton. */
type Painted = {
  eyebrow: string;
  title: string;
  meta: string | null;
  cta: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void } | null;
};

/** Les quatre repas que l'app nomme elle-même ; un repas personnalisé porte son propre libellé. */
const DEFAULT_MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

/** En deçà d'un quart d'heure, un geste à venir se dit « Maintenant » (la toile : 0,26 h). */
const NOW_THRESHOLD_HOURS = 0.26;

/** Le nom d'un repas, partagé avec le fil : celui de l'app, ou le libellé choisi. */
export function useMealName(): (slot: MealSlot) => string {
  const { t } = useTranslation();
  return (slot) =>
    slot.label?.trim() ||
    (DEFAULT_MEALS.has(slot.key) ? t(`home.now.meal.name.${slot.key}`) : t('home.now.meal.nameFallback'));
}

export type RescueProps = {
  streak: number;
  hoursLeft: number;
  options: readonly StreakRescueOption[];
  onWalk: () => void;
  onActivity: () => void;
  onJoker: () => void;
  busy: boolean;
  formatSteps: (steps: number) => string;
};

type Props = {
  /** La décision, calculée UNE fois par l'écran (`useNowAction` → `buildDayTimeline`). */
  action: DayNow;
  isLoading: boolean;
  /** Heure décimale courante, et l'heure du geste porté (`null` : compte rendu, repli). */
  hour?: number;
  itemHour?: number | null;
  /** `false` pour une séance sans heure : le sur-titre ne promet pas d'horaire. */
  itemTimeKnown?: boolean;
  /** Kcal restantes sur la cible du jour, `null` sans cible. */
  kcalRemaining: number | null;
  /** Mise en forme des kcal (séparateur de milliers de la langue). */
  formatKcal: (kcal: number) => string;
  /** L'astuce croisée du moment (`crossTip`), ou `null`. */
  tip?: CrossTip | null;
  /** Le check-in du matin, depuis la carte. */
  checkin?: { onPick: (level: WellbeingLevel) => void; saving: boolean };
  /** La série en jeu ce soir : la carte propose les vraies sorties à la place de l'action. */
  rescue?: RescueProps | null;
};

export function NowCard({
  action,
  isLoading,
  hour = 0,
  itemHour = null,
  itemTimeKnown = true,
  kcalRemaining,
  formatKcal,
  tip = null,
  checkin,
  rescue = null,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const stage = useStageTheme('home');
  const router = useRouter();
  const todayKey = useTodayKey();
  const units = useUnits();
  const mealName = useMealName();
  const [starting, setStarting] = useState(false);
  // Même verrou que le hub muscu : un état React ne voit pas un second appui du même cycle de
  // rendu, et sans lui deux appuis créaient DEUX séances, dont une orpheline que rien ne rouvrait.
  const lockStart = useActionLock();

  const startSession = (sessionId: string, plannedSessionId: string) => {
    // Mode immersif : le brief annonce la séance puis la crée lui-même (US MUSCU-UX03, §5.1).
    const brief = briefRouteForSession(sessionId, plannedSessionId);
    if (brief) {
      router.push(brief);
      return;
    }
    void lockStart(async () => {
      setStarting(true);
      try {
        await startWorkoutFromSession(sessionId, { plannedSessionId });
        router.push('/workout');
      } catch {
        // Offline-first : écriture locale, échec très improbable.
      } finally {
        setStarting(false);
      }
    });
  };

  const openMeal = (meal: string) =>
    router.push({ pathname: '/food-picker', params: { date: todayKey, meal } });

  const mealCta = (slot: MealSlot): NonNullable<Painted['cta']> => ({
    label:
      DEFAULT_MEALS.has(slot.key) && !slot.label?.trim()
        ? t(`home.now.meal.cta.${slot.key}`)
        : t('home.now.meal.ctaCustom', { label: mealName(slot) }),
    icon: 'add',
    onPress: () => openMeal(slot.key),
  });

  const kcalMeta = () =>
    kcalRemaining === null
      ? t('home.now.meal.metaNoTarget')
      : kcalRemaining > 0
        ? t('home.now.meal.metaKcal', { kcal: formatKcal(Math.round(kcalRemaining)) })
        : t('home.now.meal.metaReached');

  /** « À 18:00 · dans 5 h 20 », « Aujourd'hui » (sans heure) ou « Maintenant ». */
  const when = (): string | null => {
    if (itemHour === null) return null;
    const delta = itemHour - hour;
    if (delta <= NOW_THRESHOLD_HOURS) return t('home.now.when.now');
    if (!itemTimeKnown) return t('home.now.when.today');
    const total = Math.round(delta * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    const inLabel =
      h === 0
        ? t('home.now.when.inMinutes', { m })
        : m === 0
          ? t('home.now.when.inHours', { h })
          : t('home.now.when.inHoursMinutes', { h, m: String(m).padStart(2, '0') });
    return t('home.now.when.at', { time: clockLabel(itemHour), in: inLabel });
  };
  const withWhen = (label: string) => [when(), label].filter(Boolean).join(' · ');

  const painted = paint(action);

  /** Traduit la décision en textes et en action. */
  function paint(a: DayNow): Painted {
    switch (a.kind) {
      case 'workout-active':
        return {
          eyebrow: t('home.now.workoutActive.eyebrow'),
          title: t('home.now.workoutActive.title'),
          meta: t('home.now.workoutActive.meta'),
          cta: {
            label: t('home.now.workoutActive.cta'),
            icon: 'play',
            onPress: () => router.push('/workout'),
          },
        };

      case 'run-active':
        return {
          eyebrow: t('home.now.runActive.eyebrow'),
          title: t('home.now.runActive.title'),
          meta: null,
          cta: {
            label: t('home.now.runActive.cta'),
            icon: 'play',
            onPress: () => router.push('/run/active'),
          },
        };

      case 'checkin-due':
        return {
          eyebrow: withWhen(t('home.now.checkin.eyebrow')),
          title: t('home.checkin.title'),
          meta: t('home.now.checkin.meta'),
          cta: null,
        };

      case 'session-today': {
        const tr = a.training;
        const name = tr.name || t('home.now.session.fallbackName');
        // Détail composé ICI, où l'on a `t()` et les unités — le hook de collecte n'a ni l'un ni
        // l'autre. C'est ce qui manquait : la carte n'affichait que le nom du programme.
        const meta =
          [
            tr.exerciseCount != null && tr.exerciseCount > 0
              ? t('home.today.exercises', { count: tr.exerciseCount })
              : null,
            tr.targetDistanceM != null
              ? t('running.plannedToday.distance', {
                  distance: units.formatDistance(tr.targetDistanceM / 1000),
                })
              : null,
            tr.targetDurationSeconds != null
              ? t('running.plannedToday.duration', {
                  minutes: Math.round(tr.targetDurationSeconds / 60),
                })
              : null,
            tr.programName,
          ]
            .filter(Boolean)
            .join(' · ') || null;
        // Sans heure de geste connue (carte hors fil), l'heure stockée garde sa place : elle est
        // tronquée à HH:MM — la base stocke `HH:MM:SS`.
        const eyebrow =
          itemHour !== null
            ? withWhen(t(`home.now.session.kind.${tr.pillar}`))
            : tr.scheduledTime
              ? t('home.now.session.eyebrowAt', { time: tr.scheduledTime.slice(0, 5) })
              : t('home.now.session.eyebrow');
        return {
          eyebrow,
          title: name,
          meta,
          cta:
            tr.pillar === 'strength'
              ? {
                  label: t('home.now.session.startStrength'),
                  icon: 'play',
                  onPress: () => startSession(tr.sessionId, tr.plannedSessionId),
                }
              : {
                  label: t('home.now.session.startRunning'),
                  icon: 'play',
                  onPress: () =>
                    router.push({
                      pathname: '/run',
                      params: { plannedSessionId: tr.plannedSessionId },
                    }),
                },
        };
      }

      case 'meal-due':
        return {
          // L'heure du repas devient visible : apprise (« d'habitude vers 12:45 ») ou par défaut.
          eyebrow:
            itemHour !== null
              ? withWhen(mealName(a.meal).toLocaleLowerCase())
              : a.meal.learned
                ? t('home.now.meal.eyebrowDue', { time: clockLabel(a.meal.hour) })
                : t('home.now.meal.eyebrowDueDefault', { time: clockLabel(a.meal.hour) }),
          title: mealName(a.meal),
          meta: kcalMeta(),
          cta: mealCta(a.meal),
        };

      case 'meal-next':
        return {
          eyebrow:
            itemHour !== null
              ? withWhen(mealName(a.meal).toLocaleLowerCase())
              : t('home.now.meal.eyebrowNext', { time: clockLabel(a.meal.hour) }),
          title: mealName(a.meal),
          meta: kcalMeta(),
          // On peut noter un repas en avance : le bouton reste là.
          cta: mealCta(a.meal),
        };

      case 'meal-missed':
        return {
          eyebrow: t('home.now.meal.eyebrowMissed'),
          title: mealName(a.meal),
          meta: t('home.now.meal.metaMissed'),
          cta: mealCta(a.meal),
        };

      case 'weigh-in-due':
        return {
          eyebrow: itemHour !== null ? withWhen(t('home.now.weighIn.kind')) : t('home.now.weighIn.eyebrow'),
          title: t('home.now.weighIn.title'),
          meta: t('home.now.weighIn.meta'),
          cta: {
            label: t('home.now.weighIn.cta'),
            icon: 'add',
            onPress: () => router.push('/nutrition-stats?tab=weight'),
          },
        };

      case 'wellbeing-due':
        return {
          eyebrow: itemHour !== null ? withWhen(t('home.now.wellbeing.kind')) : t('home.now.wellbeing.eyebrow'),
          title: t('home.now.wellbeing.title'),
          meta: t('home.now.wellbeing.meta'),
          cta: {
            label: t('home.now.wellbeing.cta'),
            icon: 'moon-outline',
            onPress: () => router.push('/wellbeing'),
          },
        };

      case 'walk-idea':
        return {
          eyebrow: withWhen(t('home.now.walk.eyebrow')),
          title: t('home.now.walk.title'),
          meta: t('home.now.walk.meta', { steps: formatKcal(a.stepsLeft) }),
          cta: {
            label: t('home.now.walk.cta'),
            icon: 'walk-outline',
            // Les pas se comptent seuls (Health Connect) : on ouvre leur suivi.
            onPress: () => router.push('/steps'),
          },
        };

      case 'day-done': {
        const parts = [
          a.tally.strengthSessions > 0
            ? t('home.now.dayDone.sessions', { count: a.tally.strengthSessions })
            : null,
          a.tally.runs > 0 ? t('home.now.dayDone.runs', { count: a.tally.runs }) : null,
          a.tally.streak > 0 ? t('home.now.dayDone.streak', { count: a.tally.streak }) : null,
        ].filter(Boolean);
        return {
          eyebrow: t('home.now.dayDone.eyebrow'),
          title: t('home.now.dayDone.title'),
          meta: parts.join(' · ') || null,
          // Aucun bouton : la journée est faite, il n'y a rien à réclamer. Proposer une action ici
          // transformerait un compte rendu en injonction.
          cta: null,
        };
      }

      case 'idle':
      default: {
        const moment = a.kind === 'idle' ? a.moment : 'morning';
        const suggestion = a.kind === 'idle' ? a.suggestion : 'activity';
        const ctas: Record<typeof suggestion, NonNullable<Painted['cta']>> = {
          // Seulement à la musculation sans programme (ACCUEIL-07, constat 2).
          program: {
            label: t('home.now.idle.cta.program'),
            icon: 'barbell-outline',
            onPress: () => router.push('/programs'),
          },
          meal: {
            label: t('home.now.idle.cta.meal'),
            icon: 'add',
            onPress: () => openMeal(mealForHour(hour)),
          },
          activity: {
            label: t('home.now.idle.cta.activity'),
            icon: 'flash-outline',
            onPress: () => router.push('/activity'),
          },
        };
        return {
          eyebrow: t(`home.now.idle.eyebrow.${moment}`),
          title: t(`home.now.idle.title.${suggestion}`),
          meta: t(`home.now.idle.meta.${suggestion}`),
          cta: ctas[suggestion],
        };
      }
    }
  }

  // La série en jeu ce soir passe avant tout : c'est la seule chose qui compte à cette heure-là.
  const shown: Painted = rescue
    ? {
        eyebrow: t('home.now.rescue.eyebrow', { count: rescue.streak }),
        title: t('home.now.rescue.title', { count: rescue.hoursLeft }),
        meta: t('stage.home.rescue.lead'),
        cta: null,
      }
    : painted;

  const a11y = [shown.eyebrow, shown.title, shown.meta].filter(Boolean).join('. ');
  const busy = starting || isLoading;

  return (
    <View style={[styles.card, { backgroundColor: colors.panel }]} testID="now-card">
      <AccentHalo size={150} breathe />
      <View accessible accessibilityLabel={a11y}>
        <Text style={[styles.eyebrow, { color: colors.panelAccent }]} numberOfLines={1}>
          {shown.eyebrow}
        </Text>
        <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.4}>
          {shown.title}
        </Text>
        {shown.meta ? (
          <Text style={[styles.meta, { color: colors.panelMuted }]} numberOfLines={2}>
            {shown.meta}
          </Text>
        ) : null}
      </View>

      {!rescue && tip ? (
        <View style={styles.tip} testID="now-card-tip">
          <Ionicons name="link-outline" size={16} color={colors.panelAccent} style={styles.tipIcon} />
          <View style={styles.tipTexts}>
            <Text style={[styles.tipTag, { color: colors.panelAccent }]} numberOfLines={1}>
              {t(`home.tips.tag.${tip.tag}`)}
            </Text>
            <Text style={[styles.tipText, { color: colors.panelText }]}>
              {t(tip.key, {
                ...tip.params,
                ...(typeof tip.params.kcal === 'number' ? { kcal: formatKcal(tip.params.kcal) } : {}),
              })}
            </Text>
          </View>
        </View>
      ) : null}

      {rescue ? (
        <View style={styles.slot}>
          <StreakRescue
            options={rescue.options}
            onWalk={rescue.onWalk}
            onActivity={rescue.onActivity}
            onJoker={rescue.onJoker}
            busy={rescue.busy}
            formatSteps={rescue.formatSteps}
          />
        </View>
      ) : action.kind === 'checkin-due' && checkin ? (
        <View style={styles.slot}>
          <CheckinFaces
            onPick={checkin.onPick}
            disabled={checkin.saving}
            ink={colors.panelText}
            glass="rgba(255,255,255,0.07)"
            glassBorder="rgba(255,255,255,0.14)"
          />
        </View>
      ) : shown.cta ? (
        <Pressable
          onPress={shown.cta.onPress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={shown.cta.label}
          accessibilityState={{ disabled: busy }}
          style={[styles.cta, { backgroundColor: stage.solid }, busy && styles.dimmed]}
        >
          {/* Le bouton principal d'Aurore : le dégradé turquoise → rose de la scène (mesuré par
              `stage.test.ts` contre son encre, arrêt par arrêt). */}
          {stage.solidGradient ? (
            <LinearGradient
              pointerEvents="none"
              colors={stage.solidGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.gradient}
            />
          ) : null}
          <Ionicons name={shown.cta.icon} size={16} color={stage.onSolid} />
          <Text style={[styles.ctaLabel, { color: stage.onSolid }]} maxFontSizeMultiplier={1.3}>
            {shown.cta.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'relative', overflow: 'hidden', borderRadius: 22, padding: 16 },
  eyebrow: {
    fontFamily: fontFamily.monoBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: 23,
    letterSpacing: -0.6,
    color: '#fff',
    marginTop: 7,
  },
  meta: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19, marginTop: 5 },
  tip: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tipIcon: { marginTop: 2 },
  tipTexts: { flex: 1, gap: 3 },
  tipTag: { fontFamily: fontFamily.monoBold, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase' },
  tipText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  slot: { marginTop: 14 },
  cta: {
    marginTop: 14,
    height: 50,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    overflow: 'hidden',
  },
  gradient: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 15 },
  ctaLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  dimmed: { opacity: 0.6 },
});
