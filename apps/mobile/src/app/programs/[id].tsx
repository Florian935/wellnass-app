import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CollapsibleCard } from '@/components/CollapsibleCard';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  activateProgram,
  deleteProgram,
  duplicateProgram,
  useProgramDetail,
  useMyPrograms,
  type PlanItem,
  type SessionDetail,
} from '@/data/repositories/program-repository';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = typeof id === 'string' ? id : '';

  return <ProgramDetailView programId={programId} />;
}

// ---------------------------------------------------------------------------
// Vue principale
// ---------------------------------------------------------------------------

function ProgramDetailView({ programId }: { programId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { detail, isLoading } = useProgramDetail(programId);
  const { programs: myPrograms } = useMyPrograms();

  const [activating, setActivating] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);

  // Un programme appartient à l'utilisateur s'il figure dans « Mes programmes ».
  const isOwned = myPrograms.some((p) => p.id === programId);

  const onActivate = async () => {
    if (activating || detail?.isActive) return;
    setActivating(true);
    try {
      await activateProgram(programId);
    } catch {
      // Écriture offline-first : un échec est très improbable ; on réactive le bouton.
    } finally {
      setActivating(false);
    }
  };

  const onStartSession = async (sessionId: string) => {
    if (startingSessionId) return;
    setStartingSessionId(sessionId);
    try {
      await startWorkoutFromSession(sessionId);
      router.push('/workout');
    } catch {
      // Écriture offline-first : échec très improbable ; on réactive le bouton.
    } finally {
      setStartingSessionId(null);
    }
  };

  const onEdit = () => {
    router.push(`/programs/edit?id=${programId}`);
  };

  const onPlan = () => {
    router.push(`/planning/plan?id=${programId}`);
  };

  const onDuplicate = async () => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const newId = await duplicateProgram(programId);
      router.replace(`/programs/${newId}`);
    } catch {
      // Silencieux : la duplication atomique a échoué, on reste sur le détail.
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteProgram(programId);
      router.replace('/programs');
    } catch {
      setDeleting(false);
      Alert.alert(
        t('programs.detail.deleteError'),
        t('programs.detail.deleteErrorMessage'),
      );
    }
  };

  const onDelete = () => {
    if (deleting) return;
    Alert.alert(detail?.name ?? '', t('programs.detail.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('programs.detail.delete'),
        style: 'destructive',
        onPress: () => void handleDelete(),
      },
    ]);
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading && !detail) {
    return (
      <Screen edges={['top']} center>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  // ── Programme introuvable ─────────────────────────────────────────────────
  if (!detail) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={t('programs.detail.notFoundTitle')} />
        <Text style={[styles.notFound, { color: colors.textMuted }]}>
          {t('programs.detail.notFoundMessage')}
        </Text>
      </Screen>
    );
  }

  // ── Rendu principal ───────────────────────────────────────────────────────
  const metaParts: string[] = [];
  if (detail.level) metaParts.push(t(`programs.level.${detail.level}`));
  if (detail.durationWeeks) {
    metaParts.push(t('programs.weeks', { count: detail.durationWeeks }));
  }
  if (detail.goal) metaParts.push(detail.goal);

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={detail.name}
        action={
          detail.isActive ? (
            <View style={[styles.activeBadge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.activeBadgeText, { color: colors.accentText }]}>
                {t('programs.active')}
              </Text>
            </View>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Métadonnées */}
        {metaParts.length > 0 ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {metaParts.join(' · ')}
          </Text>
        ) : null}

        {/* Séances */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('programs.detail.sectionSessions')}
        </Text>

        {detail.sessions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {t('programs.detail.emptySessions')}
            </Text>
          </Card>
        ) : (
          <View style={styles.sessionList}>
            {detail.sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onStart={() => void onStartSession(session.id)}
                starting={startingSessionId === session.id}
                startDisabled={startingSessionId !== null}
              />
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {detail.isActive ? (
            <Button
              label={t('programs.detail.alreadyActive')}
              onPress={() => undefined}
              disabled
            />
          ) : (
            <Button
              label={activating ? t('programs.detail.activating') : t('programs.detail.activate')}
              onPress={() => void onActivate()}
              loading={activating}
            />
          )}

          <Button
            label={t('planning.planCta')}
            variant="ghost"
            onPress={onPlan}
          />

          {isOwned ? (
            <Button
              label={t('programs.detail.edit')}
              variant="ghost"
              onPress={onEdit}
            />
          ) : (
            <Button
              label={duplicating ? t('programs.detail.duplicating') : t('programs.detail.duplicate')}
              variant="ghost"
              onPress={() => void onDuplicate()}
              loading={duplicating}
              disabled={duplicating}
            />
          )}

          {isOwned ? (
            <Button
              label={deleting ? t('programs.detail.deleting') : t('programs.detail.delete')}
              variant="destructive"
              onPress={onDelete}
              loading={deleting}
              disabled={deleting}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Carte de séance (read-only)
// ---------------------------------------------------------------------------

function SessionCard({
  session,
  onStart,
  starting,
  startDisabled,
}: {
  session: SessionDetail;
  onStart: () => void;
  starting: boolean;
  startDisabled: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const hasPlans = session.plans.length > 0;
  const sessionName =
    session.name?.trim() ||
    t('programs.detail.sessionFallback', { index: session.orderIndex + 1 });

  return (
    <CollapsibleCard
      title={sessionName}
      summary={t('programs.detail.exerciseCount', { count: session.plans.length })}
      footer={
        hasPlans ? (
          <Button
            label={starting ? t('programs.detail.starting') : t('programs.detail.startSession')}
            variant="ghost"
            onPress={onStart}
            loading={starting}
            disabled={startDisabled}
          />
        ) : null
      }
    >
      {hasPlans ? (
        <View style={styles.planList}>
          {session.plans.map((plan) => (
            <PlanRow key={plan.id} plan={plan} />
          ))}
        </View>
      ) : (
        <Text style={[styles.emptyPlans, { color: colors.textMuted }]}>
          {t('programs.detail.emptyPlans')}
        </Text>
      )}
    </CollapsibleCard>
  );
}

// ---------------------------------------------------------------------------
// Ligne de plan d'exercice (read-only)
// ---------------------------------------------------------------------------

function PlanRow({ plan }: { plan: PlanItem }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  const targets: string[] = [];
  if (plan.targetSets !== null) {
    targets.push(t('programs.detail.sets', { count: plan.targetSets }));
  }
  if (plan.targetReps) {
    targets.push(t('programs.detail.reps', { reps: plan.targetReps }));
  }
  if (plan.targetWeightKg !== null) {
    targets.push(t('programs.detail.weight', { weight: units.formatWeight(plan.targetWeightKg) }));
  }
  if (plan.restSeconds !== null) {
    targets.push(t('programs.detail.rest', { seconds: plan.restSeconds }));
  }

  return (
    <View style={styles.planRow}>
      <View style={styles.planLeft}>
        <Ionicons name="barbell-outline" size={14} color={colors.textMuted} />
        <Text style={[styles.planName, { color: colors.text }]} numberOfLines={2}>
          {plan.exerciseName || t('programs.detail.unknownExercise')}
        </Text>
      </View>
      {targets.length > 0 ? (
        <Text style={[styles.planTargets, { color: colors.textMuted }]}>
          {targets.join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  meta: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  sessionList: { gap: 12 },
  planList: { gap: 12 },
  // Nom et objectifs sur DEUX lignes (le nom ne partage plus la ligne avec les
  // objectifs → plus de troncature à ~1 caractère). Cf. bug #1 de la spec.
  planRow: { gap: 2 },
  planLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planName: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 14,
  },
  planTargets: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    marginLeft: 20,
  },
  emptyPlans: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: { padding: 16 },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  activeBadgeText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
  },
  actions: {
    gap: 10,
    marginTop: 28,
  },
  notFound: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
