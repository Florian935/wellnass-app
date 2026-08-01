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
