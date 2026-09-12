/**
 * Hub Musculation — **deux zones** (US MUSCU-UX01, 10/09/2026).
 *
 * ── Ce que cet écran était ───────────────────────────────────────────────────────────────────────
 * Une carte d'action, une ligne « bibliothèque », et une grille de **sept widgets** rendus quoi
 * qu'il arrive. Faute de prédicat `isActive` — que l'accueil passait déjà — les sept tuiles se
 * montraient **même vides** : environ 2,4 écrans de scroll sur un compte neuf, dont l'essentiel
 * n'avait rien à dire. Neuf blocs, aucune hiérarchie entre eux.
 *
 * Et sans programme actif, l'action mise en avant était « Séance libre », la moins structurée :
 * le problème 3 de l'audit de juillet, revenu par la porte du cas « pas encore de programme ».
 *
 * ── Ce qu'il est ─────────────────────────────────────────────────────────────────────────────────
 *   1 · `StrengthNowCard`     — la zone **Agir**, quatre états exclusifs, épinglée hors grille
 *   2 · `ProgramProgressBar`  — « semaine 3 sur 8 », le repère que MUSC-F15 calculait sans l'afficher
 *   3 · `SuggestedPrograms`   — trois propositions, seulement quand il n'y a pas de programme
 *   4 · `WidgetGrid`          — la zone **Suivre**, 3 widgets plafonnés et masqués s'ils sont vides
 *   5 · la ligne d'annuaire   — exercices, programmes, templates
 *
 * ⚠️ La zone Agir et la ligne d'annuaire **ne sont pas des widgets** : elles ne consomment aucune
 * place au plafond `MAX_STRENGTH_WIDGETS`. Même distinction que sur l'accueil.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { StrengthWidgetId, WidgetId, WidgetSize } from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BodyExplorerLink } from '@/components/body/BodyExplorerLink';
import { ProgramProgressBar } from '@/components/strength/ProgramProgressBar';
import { StrengthNowCard } from '@/components/strength/StrengthNowCard';
import { SuggestedPrograms } from '@/components/strength/SuggestedPrograms';
import { CustomizeButton } from '@/components/widgets/CustomizeButton';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { STRENGTH_WIDGETS } from '@/components/widgets/strength-widgets';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import {
  startWorkout,
  startWorkoutFromSession,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useStrengthHub } from '@/data/repositories/strength-hub-repository';
import { useWorkoutTemplates } from '@/data/repositories/workout-template-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function StrengthScreen() {
  useMenuFocus('strength');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { state, progress, programName } = useStrengthHub();
  const { profile } = useProfile();
  const [starting, setStarting] = useState(false);
  const lockStart = useActionLock();
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);

  // ── Widgets conditionnels ─────────────────────────────────────────────────────────────────
  // Le défaut corrigé : sans ce prédicat, une tuile sans donnée réserve quand même sa case et
  // laisse un carré vide. L'accueil le passait déjà ; ce hub ne le passait pas.
  const { workouts } = useWorkoutHistory();
  const { templates } = useWorkoutTemplates();
  const isWidgetActive = (id: WidgetId) => {
    // Le planning reste utile vide (il montre la semaine) ; l'historique et la progression, non.
    if (id === 'strength-history') return workouts.length > 0;
    if (id === 'strength-progress') return workouts.length > 0;
    return true;
  };

  const onStartFree = () => {
    // Le choix « à blanc / depuis un template » n'a de sens que si des templates existent.
    if (templates.length === 0) {
      void lockStart(async () => {
        await startWorkout();
        router.push('/workout');
      });
      return;
    }
    Alert.alert(t('workout.freeStart.title'), undefined, [
      {
        text: t('workout.freeStart.blank'),
        onPress: () =>
          void lockStart(async () => {
            await startWorkout();
            router.push('/workout');
          }),
      },
      { text: t('workout.freeStart.fromTemplate'), onPress: () => router.push('/templates') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  // `starting` ne pilote que l'affichage : la garde est portée par `useActionLock`. Un état React
  // ne voit pas un second appui du même cycle de rendu — sans le verrou, deux appuis créaient
  // DEUX séances, dont une orpheline que rien ne rouvrirait.
  const onStartToday = (sessionId: string, plannedSessionId: string) =>
    void lockStart(async () => {
      setStarting(true);
      try {
        await startWorkoutFromSession(sessionId, { plannedSessionId });
        router.push('/workout');
      } catch {
        // offline-first : échec improbable
      } finally {
        setStarting(false);
      }
    });

  const renderWidget = (id: WidgetId, size: WidgetSize) => {
    const Widget = STRENGTH_WIDGETS[id as StrengthWidgetId];
    return <Widget size={size} />;
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('pillars.strength')}
        action={<CustomizeButton editing={editing} onToggle={() => setEditing((v) => !v)} />}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragging}
      >
        {/* Zone 1 — Agir. Masquée en édition : garder une carte épinglée au-dessus d'une grille
            qu'on réorganise ferait croire qu'elle est déplaçable aussi. */}
        {!editing ? (
          <>
            <StrengthNowCard
              state={state}
              starting={starting}
              onResume={() => router.push('/workout')}
              onStartToday={onStartToday}
              onStartFree={onStartFree}
              onFromTemplate={() => router.push('/templates')}
              onBrowsePrograms={() => router.push('/programs')}
              onOpenPlanning={() => router.push('/planning')}
            />

            {/* Zone 2 — l'avancement du programme, quand il y en a un. */}
            {progress && programName ? (
              <ProgramProgressBar
                programName={programName}
                week={progress.week}
                totalWeeks={progress.totalWeeks}
                done={progress.done}
                total={progress.total}
                ratio={progress.ratio}
                onPress={() => router.push('/programs')}
              />
            ) : null}

            {/* Zone 3 — les propositions, uniquement pour qui n'a pas encore de programme. */}
            {state.kind === 'onboarding' ? (
              <SuggestedPrograms
                displayLevel={profile?.workoutDisplayLevel}
                onPick={(programId) => router.push(`/programs/${programId}`)}
                onSeeAll={() => router.push('/programs')}
              />
            ) : null}
          </>
        ) : null}

        {/* Zone 4 — Suivre. */}
        {!editing ? (
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {t('strengthHub.followSection')}
            </Text>
            <View style={[styles.rule, { backgroundColor: colors.border }]} />
          </View>
        ) : null}

        {!editing ? <BodyExplorerLink /> : null}

        <WidgetGrid
          screen="strength"
          editing={editing}
          renderWidget={renderWidget}
          onDragActiveChange={setDragging}
          isActive={isWidgetActive}
        />

        {/* Zone 5 — l'annuaire, en pied : c'est une destination, pas une action du jour.
            Il recueille l'entrée « Mes templates » que le widget `strength-templates` portait. */}
        {!editing ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/exercises', params: { mode: 'browse' } })}
            style={({ pressed }) => [
              styles.libraryRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="library-outline" size={17} color={colors.textMuted} />
            <Text style={[styles.libraryLabel, { color: colors.text }]} numberOfLines={1}>
              {t('strengthHub.directory')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 12, paddingBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  sectionLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  rule: { flex: 1, height: 1 },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  libraryLabel: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14 },
  pressed: { opacity: 0.85 },
});
