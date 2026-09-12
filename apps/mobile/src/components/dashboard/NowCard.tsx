/**
 * US ACCUEIL-01 — **zone 1 de l'accueil** : la carte « maintenant ».
 *
 * Une carte, un sujet : la prochaine action. Elle est **épinglée hors grille** — ni masquable, ni
 * déplaçable — parce que l'accueil livré n'avait rien de garanti à l'écran : cinq à six widgets de
 * poids égal, tous personnalisables, dont aucun n'était certain d'être visible.
 *
 * Elle remplace le widget `today-session`, qui a été retiré du registre (voir `widgets.ts` et la
 * destination `home-pinned` dans `widget-destinations.ts`) — et elle corrige au passage ses deux
 * défauts de fond : le pilier était **câblé en dur sur la musculation**, et l'heure de la séance
 * n'était jamais affichée alors qu'elle est stockée depuis HORAIRE-01.
 *
 * ⚠️ **Le choix ne se fait pas ici.** `useNowAction` collecte les faits, `resolveNowAction`
 * (pur, testé) décide. Ce composant ne fait que peindre la décision — c'est ce qui permet de
 * vérifier la table de priorité sans monter d'arbre React.
 *
 * ⚠️ **Ne rend jamais `null`.** Une carte épinglée qui disparaît réintroduirait le trou de mise en
 * page que la grille a mis quatre tentatives à corriger. Au pire, elle affiche l'état `idle`.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NowAction } from '@wellness/shared';

import { AccentHalo } from '@/components/AccentHalo';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useNowAction } from '@/hooks/useNowAction';
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

export function NowCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const todayKey = useTodayKey();
  const units = useUnits();
  const { action, isLoading } = useNowAction();
  const [starting, setStarting] = useState(false);
  // Même verrou que le hub muscu : un état React ne voit pas un second appui du même cycle de
  // rendu, et sans lui deux appuis créaient DEUX séances, dont une orpheline que rien ne rouvrait.
  const lockStart = useActionLock();

  const startSession = (sessionId: string, plannedSessionId: string) =>
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

  const painted = paint(action);

  /** Traduit la décision en textes et en action. */
  function paint(a: NowAction): Painted {
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

      case 'session-today': {
        const tr = a.training;
        const name = tr.name || t('home.now.session.fallbackName');
        // L'heure entre dans le sur-titre quand elle existe — c'est l'information que la maquette
        // validée portait depuis l'origine et que le widget n'a jamais affichée.
        //
        // ⚠️ `scheduledTime` est stocké en `HH:MM:SS` : on ne garde que les heures et minutes,
        // sinon la carte annoncerait « 18:30:00 ».
        const eyebrow = tr.scheduledTime
          ? t('home.now.session.eyebrowAt', { time: tr.scheduledTime.slice(0, 5) })
          : t('home.now.session.eyebrow');

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
          // L'échéance apprise devient enfin visible : elle ne servait qu'à programmer une
          // notification (NUTR-F1), jamais à être montrée à l'ouverture de l'app.
          eyebrow:
            a.deadlineHour != null
              ? t('home.now.meal.eyebrowUsually', { hour: a.deadlineHour })
              : t('home.now.meal.eyebrow'),
          title: t(`home.now.meal.title.${a.meal}`),
          meta: t('home.now.meal.meta'),
          cta: {
            label: t(`home.now.meal.cta.${a.meal}`),
            icon: 'add',
            onPress: () =>
              router.push({
                pathname: '/food-picker',
                params: { date: todayKey, meal: a.meal },
              }),
          },
        };

      case 'weigh-in-due':
        return {
          eyebrow: t('home.now.weighIn.eyebrow'),
          title: t('home.now.weighIn.title'),
          meta: t('home.now.weighIn.meta'),
          cta: {
            label: t('home.now.weighIn.cta'),
            icon: 'add',
            onPress: () => router.push('/nutrition-stats'),
          },
        };

      case 'wellbeing-due':
        return {
          eyebrow: t('home.now.wellbeing.eyebrow'),
          title: t('home.now.wellbeing.title'),
          meta: null,
          cta: {
            label: t('home.now.wellbeing.cta'),
            icon: 'happy-outline',
            onPress: () => router.push('/wellbeing'),
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
      default:
        return {
          eyebrow: t(`home.now.idle.eyebrow.${a.kind === 'idle' ? a.moment : 'morning'}`),
          title: t('home.now.idle.title'),
          meta: t('home.now.idle.meta'),
          cta: {
            label: t('home.now.idle.cta'),
            icon: 'barbell-outline',
            onPress: () => router.push('/programs'),
          },
        };
    }
  }

  const a11y = [painted.eyebrow, painted.title, painted.meta].filter(Boolean).join('. ');

  return (
    <View style={[styles.card, { backgroundColor: colors.panel }]}>
      {/* Hors grille, donc sans identité de widget : `AccentHalo` retombe sur la géométrie du
          module actif (`MENU_HALO.home`) et le rend systématiquement. C'est voulu ici — dans la
          grille, `hasHaloFor` n'en pose que sur environ un widget sur trois, et la carte épinglée
          doit, elle, être toujours marquée. */}
      {/* Carte héros de l'accueil : la seule de la grille qui respire (MOTION-01 · A4). */}
      <AccentHalo size={150} breathe />
      <View accessible accessibilityLabel={a11y}>
        <Text style={[styles.eyebrow, { color: colors.panelAccent }]} numberOfLines={1}>
          {painted.eyebrow}
        </Text>
        <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.4}>
          {painted.title}
        </Text>
        {painted.meta ? (
          <Text style={[styles.meta, { color: colors.panelMuted }]} numberOfLines={2}>
            {painted.meta}
          </Text>
        ) : null}
      </View>

      {painted.cta ? (
        <Pressable
          onPress={painted.cta.onPress}
          disabled={starting || isLoading}
          accessibilityRole="button"
          accessibilityLabel={painted.cta.label}
          style={[
            styles.cta,
            { backgroundColor: colors.accent },
            (starting || isLoading) && styles.dimmed,
          ]}
        >
          <Ionicons name={painted.cta.icon} size={16} color={colors.accentText} />
          <Text style={[styles.ctaLabel, { color: colors.accentText }]} maxFontSizeMultiplier={1.3}>
            {painted.cta.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'relative', overflow: 'hidden', borderRadius: 22, padding: 18 },
  eyebrow: {
    fontFamily: fontFamily.monoBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: 24,
    letterSpacing: -0.6,
    color: '#fff',
    marginTop: 6,
  },
  meta: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 3 },
  cta: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  ctaLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  dimmed: { opacity: 0.6 },
});
