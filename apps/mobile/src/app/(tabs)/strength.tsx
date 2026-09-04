import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { StrengthWidgetId, WidgetId, WidgetSize } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CustomizeButton } from '@/components/widgets/CustomizeButton';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { STRENGTH_WIDGETS } from '@/components/widgets/strength-widgets';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import {
  startWorkout,
  startWorkoutFromSession,
  useActiveWorkout,
} from '@/data/repositories/workout-repository';
import { useTodaySession } from '@/data/repositories/dashboard-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function StrengthScreen() {
  useMenuFocus('strength');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { workout: active } = useActiveWorkout();
  const today = useTodaySession('strength');
  const [starting, setStarting] = useState(false);
  const lockStart = useActionLock();
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const onStart = async () => {
    await startWorkout();
    router.push('/workout');
  };

  const onStartFree = () => {
    Alert.alert(t('workout.freeStart.title'), undefined, [
      { text: t('workout.freeStart.blank'), onPress: () => void onStart() },
      {
        text: t('workout.freeStart.fromTemplate'),
        onPress: () => router.push('/templates'),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  // `starting` ne pilote que l'affichage : la garde est portée par `useActionLock`. Un état React
  // ne voit pas un second appui du même cycle de rendu — sans le verrou, deux appuis créaient
  // DEUX séances, dont une orpheline que rien ne rouvrirait (l'app n'en affiche qu'une).
  // Seizième site du défaut du 08/08/2026, trouvé le 14/08.
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
        subtitle={t('pillarScreens.strength.tagline')}
        action={<CustomizeButton editing={editing} onToggle={() => setEditing((v) => !v)} />}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragging}
      >
        {/* Carte d'action épinglée (hors grille) : reprendre / séance du jour / séance libre. */}
        {active ? (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="barbell" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('workout.resumeTitle')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('workout.exerciseCount', { count: active.entries.length })}
            </Text>
            <Button label={t('workout.resume')} onPress={() => router.push('/workout')} />
          </Card>
        ) : today.state === 'today-session' ? (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="barbell" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('home.today.title')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {today.session.name?.trim() ||
                t('programs.detail.sessionFallback', { index: today.session.orderIndex + 1 })}
              {' · '}
              {t('home.today.exercises', { count: today.session.exerciseCount })}
            </Text>
            {today.session.programName ? (
              <Text style={[styles.cardText, { color: colors.textMuted }]}>
                {t('home.today.program', { name: today.session.programName })}
              </Text>
            ) : null}
            <Button
              label={t('home.today.cta')}
              loading={starting}
              onPress={() => onStartToday(today.session.sessionId, today.session.plannedSessionId)}
            />
            <Pressable
              onPress={() => router.push('/templates')}
              style={styles.todayNoteRow}
              hitSlop={8}
            >
              <Ionicons name="albums-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.todayNoteText, { color: colors.textMuted }]} numberOfLines={1}>
                {t('workout.freeStart.fromTemplate')}
              </Text>
            </Pressable>
          </Card>
        ) : (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="flash-outline" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('workout.freeTitle')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('workout.freeSubtitle')}
            </Text>
            <Button label={t('workout.startFree')} onPress={onStartFree} />
            {today.state === 'none' && today.doneToday ? (
              <View style={styles.todayNoteRow}>
                <Text style={[styles.todayNoteMark, { color: colors.success }]}>✓</Text>
                <Text style={[styles.todayNoteText, { color: colors.success }]} numberOfLines={1}>
                  {t('home.today.doneToday', {
                    name:
                      today.doneToday.name?.trim() ||
                      t('programs.detail.sessionFallback', { index: 1 }),
                  })}
                </Text>
              </View>
            ) : null}
            {today.state === 'none' && today.nextUpcoming ? (
              <Pressable
                onPress={() => router.push('/planning')}
                style={styles.todayNoteRow}
                hitSlop={8}
              >
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.todayNoteText, { color: colors.textMuted }]} numberOfLines={1}>
                  {(() => {
                    const [, mm, dd] = today.nextUpcoming.scheduledDate.split('-');
                    const nextDate = `${dd}/${mm}`;
                    return t('home.today.next', {
                      date: nextDate,
                      name:
                        today.nextUpcoming.name?.trim() ||
                        t('programs.detail.sessionFallback', { index: 1 }),
                    });
                  })()}
                </Text>
              </Pressable>
            ) : null}
          </Card>
        )}

        {/* Entrée persistante (hors grille) : bibliothèque d'exercices en mode consultation. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/exercises', params: { mode: 'browse' } })}
          style={[
            styles.libraryRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="library-outline" size={18} color={colors.accent} />
          <Text style={[styles.libraryLabel, { color: colors.text }]} numberOfLines={1}>
            {t('exercises.library')}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* Grille de widgets personnalisable (modules muscu). */}
        <WidgetGrid
          screen="strength"
          editing={editing}
          renderWidget={renderWidget}
          onDragActiveChange={setDragging}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, paddingBottom: 24 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  cardText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  libraryLabel: { flex: 1, fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: -0.3 },
  todayNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  todayNoteMark: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  todayNoteText: { fontFamily: fontFamily.body, fontSize: 13, flexShrink: 1 },
});
