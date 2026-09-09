import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RunningWidgetId, WidgetId, WidgetSize } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CustomizeButton } from '@/components/widgets/CustomizeButton';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { RUNNING_WIDGETS } from '@/components/widgets/running-widgets';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useActiveRun, useTodayRunSession } from '@/data/repositories/run-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useSessionAdaptation } from '@/data/repositories/session-adaptation-repository';
import { SessionAdaptationCard } from '@/components/running/SessionAdaptationCard';
import { sessionPaceLabelText } from '@/running/session-pace-label';
import { useAuthStore } from '@/stores/auth-store';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function RunningScreen() {
  useMenuFocus('running');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { run: active } = useActiveRun();
  // US RUN-F3 — séance de course planifiée aujourd'hui, pas encore démarrée.
  const { session: todaySession } = useTodayRunSession();
  const { runnerProfile } = useRunnerProfile();
  const userId = useAuthStore((st) => st.session?.user.id ?? null);

  // US RUN-F4 (lot A) — allure cible de la séance du jour, saisie ou dérivée.
  const todayPaceLabel = todaySession
    ? sessionPaceLabelText(
        t,
        {
          sessionType: todaySession.sessionType,
          targetDistanceM: todaySession.targetDistanceM,
          targetTimeSeconds: todaySession.targetTimeSeconds,
          targetPaceMinSPerKm: todaySession.targetPaceMinSPerKm,
          targetPaceMaxSPerKm: todaySession.targetPaceMaxSPerKm,
          ref5kPaceSPerKm: runnerProfile?.ref5kPaceSPerKm ?? null,
        },
        units.formatPace,
      )
    : null;

  // US RUN-F4 (lot J) — ce que les signaux du jour disent de cette séance. `null` s'il n'y a
  // rien à dire : aucune carte ne s'affiche alors.
  const adaptation = useSessionAdaptation(todaySession?.sessionType ?? null, userId);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const renderWidget = (id: WidgetId, size: WidgetSize) => {
    const Widget = RUNNING_WIDGETS[id as RunningWidgetId];
    return <Widget size={size} />;
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('pillars.running')}
        subtitle={t('pillarScreens.running.tagline')}
        action={<CustomizeButton editing={editing} onToggle={() => setEditing((v) => !v)} />}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragging}
      >
        {/* Carte d'action épinglée (hors grille) : reprendre / démarrer une course planifiée /
            démarrer une course libre — dans cet ordre de priorité. */}
        {active ? (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="walk" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('running.resume.title')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('running.resume.subtitle')}
            </Text>
            <Button label={t('running.resume.cta')} onPress={() => router.push('/run/active')} />
          </Card>
        ) : todaySession ? (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('running.plannedToday.title')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {[
                todaySession.targetDistanceM
                  ? t('running.plannedToday.distance', {
                      distance: units.formatDistance(todaySession.targetDistanceM / 1000),
                    })
                  : null,
                todaySession.targetDurationSeconds
                  ? t('running.plannedToday.duration', {
                      minutes: Math.round(todaySession.targetDurationSeconds / 60),
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || t('running.plannedToday.noTarget')}
            </Text>

            {/* US RUN-F4 (lot A) — l'allure cible se lit AVANT de partir, pas seulement
                pendant. C'est la première chose que cherche un coureur qui suit un plan. */}
            {todayPaceLabel ? (
              <Text style={[styles.cardText, { color: colors.textMuted }]}>
                {t('running.paceGuidance.targetLabel')} : {todayPaceLabel}
              </Text>
            ) : null}

            {/* US RUN-F4 (lot I) — la consigne rédigée : « ne pas accélérer le premier 1 000 m ».
                C'est elle qui fait la différence entre une distance et une séance. */}
            {todaySession.instructions ? (
              <Text style={[styles.cardText, { color: colors.textMuted }]}>
                {todaySession.instructions}
              </Text>
            ) : null}

            <Button
              label={t('running.plannedToday.startCta')}
              onPress={() =>
                router.push({ pathname: '/run', params: { plannedSessionId: todaySession.id } })
              }
            />
          </Card>
        ) : (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="navigate-outline" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('running.start.title')}
              </Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textMuted }]}>
              {t('running.start.subtitle')}
            </Text>
            <Button label={t('running.start.startCta')} onPress={() => router.push('/run')} />
          </Card>
        )}

        {/* US RUN-F4 (lot J) — proposition d'adaptation de la séance du jour. La carte se
            supprime elle-même quand aucun signal n'est actif : rien à dire, rien à l'écran. */}
        <SessionAdaptationCard proposal={adaptation} />

        {/* Grille de widgets personnalisable (modules course, filtrés par pilier running). */}
        <WidgetGrid
          screen="running"
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
});
