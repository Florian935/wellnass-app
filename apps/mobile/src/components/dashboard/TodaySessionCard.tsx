/**
 * Widget 7.4 — Séance du jour, décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : eyebrow + pastille accent + nom de séance + nb d'exercices ;
 *  - `wide`  : détail séance (nom, programme, exercices) + bouton lecture (démarrer/reprendre) ;
 *  - `large` : carte panneau inversée + chips + bouton « Démarrer » / « Reprendre » pleine largeur.
 *
 * États (source de vérité calendrier, `useTodaySession('strength')`) : séance en cours →
 * reprendre ; occurrence planifiée du jour → démarrer ; sinon repli (fait / à venir / créer).
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useTodaySession } from '@/data/repositories/dashboard-repository';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function TodaySessionCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const today = useTodaySession('strength');
  const [starting, setStarting] = useState(false);

  if (today.isLoading) return null;

  const openWorkout = () => router.push('/workout');
  const openPrograms = () => router.push('/programs');

  const sessionName =
    today.state === 'today-session'
      ? today.session.name?.trim() ||
        t('programs.detail.sessionFallback', { index: today.session.orderIndex + 1 })
      : '';

  const startSession = async () => {
    if (today.state !== 'today-session' || starting) return;
    setStarting(true);
    try {
      await startWorkoutFromSession(today.session.sessionId, {
        plannedSessionId: today.session.plannedSessionId,
      });
      router.push('/workout');
    } catch {
      // Offline-first : échec très improbable.
    } finally {
      setStarting(false);
    }
  };

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    const onPress =
      today.state === 'active-workout' || today.state === 'today-session' ? openWorkout : openPrograms;
    return (
      <WidgetFrame pad={16} onPress={onPress} accessibilityLabel={t('home.today.title')}>
        <View style={styles.smallHead}>
          <Eyebrow>{t('home.today.eyebrow')}</Eyebrow>
          {today.state === 'today-session' ? (
            <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          ) : null}
        </View>
        <View style={styles.smallBottom}>
          {today.state === 'today-session' ? (
            <Metric value={sessionName} sub={t('home.today.exercises', { count: today.session.exerciseCount })} />
          ) : today.state === 'active-workout' ? (
            <Metric value={t('home.today.compactActive')} />
          ) : (
            <Metric value={t('home.today.compactNone')} muted />
          )}
        </View>
      </WidgetFrame>
    );
  }

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    if (today.state === 'today-session') {
      return (
        <WidgetFrame pad={18} onPress={openWorkout} accessibilityLabel={t('home.today.title')} style={styles.wideRow}>
          <View style={styles.wideText}>
            <Eyebrow>{t('home.today.eyebrow')}</Eyebrow>
            <Text style={[styles.wideTitle, { color: colors.text }]} numberOfLines={1}>
              {sessionName}
            </Text>
            <Text style={[styles.wideMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {t('home.today.exercises', { count: today.session.exerciseCount })}
              {today.session.programName ? ` · ${today.session.programName}` : ''}
            </Text>
          </View>
          <PlayButton onPress={() => void startSession()} />
        </WidgetFrame>
      );
    }
    if (today.state === 'active-workout') {
      return (
        <WidgetFrame pad={18} onPress={openWorkout} accessibilityLabel={t('home.today.title')} style={styles.wideRow}>
          <View style={styles.wideText}>
            <Eyebrow>{t('home.today.eyebrow')}</Eyebrow>
            <Text style={[styles.wideTitle, { color: colors.text }]}>{t('home.today.resume')}</Text>
          </View>
          <PlayButton onPress={openWorkout} />
        </WidgetFrame>
      );
    }
    return <RestState size="wide" today={today} onCreate={openPrograms} />;
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  if (today.state === 'today-session') {
    return (
      <WidgetFrame pad={22} tone="panel" onPress={openWorkout} accessibilityLabel={t('home.today.title')} style={styles.panelCol}>
        <Eyebrow tone="panel">{t('home.today.eyebrow')}</Eyebrow>
        <Text style={styles.panelTitle} numberOfLines={2}>
          {sessionName}
        </Text>
        {today.session.programName ? (
          <Text style={[styles.panelSub, { color: colors.panelMuted }]}>{today.session.programName}</Text>
        ) : null}
        <View style={styles.chips}>
          <PanelChip label={t('home.today.exercises', { count: today.session.exerciseCount })} />
        </View>
        <PanelButton
          label={t('home.today.cta')}
          loading={starting}
          onPress={() => void startSession()}
        />
      </WidgetFrame>
    );
  }
  if (today.state === 'active-workout') {
    return (
      <WidgetFrame pad={22} tone="panel" onPress={openWorkout} accessibilityLabel={t('home.today.title')} style={styles.panelCol}>
        <Eyebrow tone="panel">{t('home.today.eyebrow')}</Eyebrow>
        <Text style={styles.panelTitle}>{t('home.today.resume')}</Text>
        <PanelButton label={t('home.today.resume')} onPress={openWorkout} />
      </WidgetFrame>
    );
  }
  return <RestState size="large" today={today} onCreate={openPrograms} />;
}

/** Bouton lecture rond (accent) du rectangle. */
function PlayButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={6}
      style={[styles.playBtn, { backgroundColor: colors.accent }]}
    >
      <Ionicons name="play" size={20} color={colors.accentText} />
    </Pressable>
  );
}

/** Chip clair sur fond panneau. */
function PanelChip({ label }: { label: string }) {
  return (
    <View style={styles.panelChip}>
      <Text style={styles.panelChipText}>{label}</Text>
    </View>
  );
}

/** Bouton plein accent dans la carte panneau. */
function PanelButton({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={loading}
      style={[styles.panelBtn, { backgroundColor: colors.accent }, loading && styles.pressed]}
    >
      <Ionicons name="play" size={16} color={colors.accentText} />
      <Text style={[styles.panelBtnText, { color: colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

/** Repli (aucune occurrence aujourd'hui) : fait / à venir / créer un programme. */
function RestState({
  size,
  today,
  onCreate,
}: {
  size: WidgetSize;
  today: Extract<ReturnType<typeof useTodaySession>, { state: 'none' }>;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const pad = size === 'large' ? 22 : 18;

  if (!today.hasActiveProgram) {
    return (
      <WidgetFrame pad={pad} style={styles.center}>
        <Eyebrow>{t('home.today.eyebrow')}</Eyebrow>
        <Text style={[styles.restText, { color: colors.textMuted }]}>{t('home.today.empty')}</Text>
        <Button label={t('home.today.createProgram')} variant="ghost" onPress={onCreate} />
      </WidgetFrame>
    );
  }
  const nextName = today.nextUpcoming?.name?.trim();
  const nextDate = today.nextUpcoming
    ? (() => {
        const [, mm, dd] = today.nextUpcoming.scheduledDate.split('-');
        return `${dd}/${mm}`;
      })()
    : undefined;
  return (
    <WidgetFrame pad={pad} style={styles.center}>
      <Eyebrow>{t('home.today.eyebrow')}</Eyebrow>
      <Text style={[styles.restText, { color: colors.textMuted }]}>{t('home.today.noneToday')}</Text>
      {today.nextUpcoming ? (
        <Text style={[styles.restText, { color: colors.textMuted }]}>
          {t('home.today.next', { date: nextDate, name: nextName })}
        </Text>
      ) : null}
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  smallHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  smallBottom: { marginTop: 'auto' },
  center: { justifyContent: 'center', gap: 8 },
  restText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  wideText: { flex: 1, gap: 4 },
  wideTitle: { fontFamily: fontFamily.displayBold, fontSize: 21, letterSpacing: -0.4 },
  wideMeta: { fontFamily: fontFamily.body, fontSize: 13 },
  playBtn: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  panelCol: { gap: 8 },
  panelTitle: { fontFamily: fontFamily.displayBold, fontSize: 28, letterSpacing: -0.8, color: '#fff', marginTop: 2 },
  panelSub: { fontFamily: fontFamily.body, fontSize: 14 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 6 },
  panelChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  panelChipText: { fontFamily: fontFamily.bodyBold, fontSize: 12, color: '#fff' },
  panelBtn: {
    marginTop: 'auto',
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  panelBtnText: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  pressed: { opacity: 0.7 },
});
