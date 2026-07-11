/**
 * Widget 7.4 — Séance du jour.
 *
 * États :
 *  - `has-session`    : nom + badge exercices + CTA "Démarrer la séance"
 *  - `active-workout` : CTA "Reprendre la séance"
 *  - `no-program`     : texte vide + CTA "Créer un programme"
 *
 * Routing :
 *  - Démarrer → démarre la séance planifiée via `startWorkoutFromSession(session.id)` puis `/workout`
 *  - Reprendre → `/workout` (séance déjà en cours)
 *  - Créer un programme → `/programs`
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { DashboardCard } from '@/components/DashboardCard';
import { useNextSession } from '@/data/repositories/dashboard-repository';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function TodaySessionCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const next = useNextSession();
  const [starting, setStarting] = useState(false);

  if (next.isLoading) return null;

  // ── État : séance en cours ──────────────────────────────────────────────────
  if (next.state === 'active-workout') {
    return (
      <DashboardCard icon="calendar-outline" title={t('home.today.title')}>
        <Button
          label={t('home.today.resume')}
          onPress={() => router.push('/workout')}
        />
      </DashboardCard>
    );
  }

  // ── État : programme actif avec séance ─────────────────────────────────────
  if (next.state === 'has-session') {
    const { session } = next;
    const onStart = async () => {
      if (starting) return;
      setStarting(true);
      try {
        // Démarre la séance planifiée du programme (pré-remplit ses exercices),
        // même mécanisme que l'écran détail de programme (programs/[id].tsx).
        await startWorkoutFromSession(session.id);
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
            name: session.name,
          })}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>
              {t('home.today.exercises', { count: session.exerciseCount })}
            </Text>
          </View>
        </View>
        <Button
          label={t('home.today.cta')}
          onPress={() => void onStart()}
          loading={starting}
        />
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
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
});
