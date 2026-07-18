/**
 * Widget 7.4 — Séance du jour.
 *
 * Consomme `useTodaySession('strength')` (source de vérité calendrier, Refonte-B) :
 *  - `today-session`   : nom + badge exercices + CTA "Démarrer la séance", lié à l'occurrence
 *                        (`plannedSessionId`)
 *  - `active-workout`  : CTA "Reprendre la séance"
 *  - `none`            : si programme actif → repli informatif (fait aujourd'hui / prochaine
 *                        occurrence) ; sinon → texte vide + CTA "Créer un programme"
 *
 * Routing :
 *  - Démarrer → démarre la séance via
 *    `startWorkoutFromSession(session.sessionId, { plannedSessionId: session.plannedSessionId })`
 *    puis `/workout`
 *  - Reprendre → `/workout` (séance déjà en cours)
 *  - Créer un programme → `/programs`
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { Button } from '@/components/Button';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardCardCompact } from '@/components/dashboard/DashboardCardCompact';
import { useTodaySession } from '@/data/repositories/dashboard-repository';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function TodaySessionCard({ size = 'full' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const today = useTodaySession('strength');
  const [starting, setStarting] = useState(false);

  if (today.isLoading) return null;

  // ── Variante compacte (US 7.11) : titre + nom séance / état ─────────────────
  if (size === 'compact') {
    const value =
      today.state === 'active-workout'
        ? t('home.today.compactActive')
        : today.state === 'today-session'
          ? today.session.name?.trim() ||
            t('programs.detail.sessionFallback', { index: today.session.orderIndex + 1 })
          : t('home.today.compactNone');
    return (
      <DashboardCardCompact icon="calendar-outline" title={t('home.today.title')} value={value} />
    );
  }

  // ── État : séance en cours ──────────────────────────────────────────────────
  if (today.state === 'active-workout') {
    return (
      <DashboardCard icon="calendar-outline" title={t('home.today.title')}>
        <Button
          label={t('home.today.resume')}
          onPress={() => router.push('/workout')}
        />
      </DashboardCard>
    );
  }

  // ── État : occurrence planifiée aujourd'hui ─────────────────────────────────
  if (today.state === 'today-session') {
    const { session } = today;
    const sessionName =
      session.name?.trim() ||
      t('programs.detail.sessionFallback', { index: session.orderIndex + 1 });
    const onStart = async () => {
      if (starting) return;
      setStarting(true);
      try {
        // Démarre la séance planifiée du programme (pré-remplit ses exercices),
        // même mécanisme que l'écran détail de programme (programs/[id].tsx), en gardant
        // le lien vers l'occurrence pour marquer sa complétion.
        await startWorkoutFromSession(session.sessionId, {
          plannedSessionId: session.plannedSessionId,
        });
        router.push('/workout');
      } catch {
        // Offline-first : échec très improbable.
      } finally {
        setStarting(false);
      }
    };

    return (
      <DashboardCard icon="calendar-outline" title={t('home.today.title')}>
        <Text style={[styles.sessionName, { color: colors.text }]}>
          {t('home.today.session', {
            index: session.orderIndex + 1,
            name: sessionName,
          })}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>
              {t('home.today.exercises', { count: session.exerciseCount })}
            </Text>
          </View>
          {session.programName != null && (
            <Text style={[styles.programName, { color: colors.textMuted }]} numberOfLines={1}>
              {t('home.today.program', { name: session.programName })}
            </Text>
          )}
        </View>
        <Button
          label={t('home.today.cta')}
          onPress={() => void onStart()}
          loading={starting}
        />
      </DashboardCard>
    );
  }

  // ── État : aucune occurrence aujourd'hui, mais programme actif ──────────────
  if (today.hasActiveProgram) {
    const doneName =
      today.doneToday?.name?.trim() ||
      (today.doneToday
        ? t('programs.detail.sessionFallback', { index: 1 })
        : undefined);
    const nextName =
      today.nextUpcoming?.name?.trim() ||
      (today.nextUpcoming ? t('programs.detail.sessionFallback', { index: 1 }) : undefined);
    const nextDateStr = today.nextUpcoming
      ? (() => {
          const [, mm, dd] = today.nextUpcoming.scheduledDate.split('-');
          return `${dd}/${mm}`;
        })()
      : undefined;

    return (
      <DashboardCard icon="calendar-outline" title={t('home.today.title')}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('home.today.noneToday')}
        </Text>
        {today.doneToday && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoCheck, { color: colors.success }]}>✓</Text>
            <Text style={[styles.infoText, { color: colors.success }]}>
              {t('home.today.doneToday', { name: doneName })}
            </Text>
          </View>
        )}
        {today.nextUpcoming && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              {t('home.today.next', { date: nextDateStr, name: nextName })}
            </Text>
          </View>
        )}
      </DashboardCard>
    );
  }

  // ── État : aucun programme ─────────────────────────────────────────────────
  return (
    <DashboardCard icon="calendar-outline" title={t('home.today.title')}>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        {t('home.today.empty')}
      </Text>
      <Button
        label={t('home.today.createProgram')}
        variant="ghost"
        onPress={() => router.push('/programs')}
      />
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  sessionName: {
    fontFamily: fontFamily.displayBold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  programName: { fontFamily: fontFamily.body, fontSize: 13, flex: 1 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoCheck: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  infoText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
});
