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
import { sessionTargetPace, type ProgramSessionType } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CollapsibleCard } from '@/components/CollapsibleCard';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  deleteProgram,
  duplicateProgram,
  useMyPrograms,
  useProgramDetail,
  type SessionDetail,
} from '@/data/repositories/program-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

export default function RunningProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = typeof id === 'string' ? id : '';
  return <RunningProgramDetailView programId={programId} />;
}

function RunningProgramDetailView({ programId }: { programId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  const { detail, isLoading } = useProgramDetail(programId);
  const { runnerProfile } = useRunnerProfile();
  const { programs: myPrograms } = useMyPrograms();
  // Un programme éditorial (non possédé) ne peut pas être planifié/activé directement : il
  // doit d'abord être dupliqué (sinon activation de l'éditorial → divergence local↔cloud).
  const isOwned = myPrograms.some((p) => p.id === programId);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const onDuplicate = async () => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const newId = await duplicateProgram(programId);
      router.replace(`/running-programs/${newId}`);
    } catch {
      // Silencieux.
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteProgram(programId);
      router.replace('/running-programs');
    } catch {
      setDeleting(false);
      Alert.alert(
        t('running.program.deleteError'),
        t('running.program.deleteErrorMessage'),
      );
    }
  };

  const onDelete = () => {
    if (deleting) return;
    Alert.alert(detail?.name ?? '', t('running.program.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('running.program.delete'),
        style: 'destructive',
        onPress: () => void handleDelete(),
      },
    ]);
  };

  const onEdit = () => {
    router.push(`/running-programs/edit?id=${programId}`);
  };

  const onPlan = () => {
    router.push(`/planning/plan?id=${programId}`);
  };

  if (isLoading && !detail) {
    return (
      <Screen edges={['top']} center>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

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

  const metaChips: string[] = [];
  if (detail.goal) metaChips.push(t(`running.objective.${detail.goal}`));
  if (detail.level) metaChips.push(t(`running.programLevel.${detail.level}`));
  if (detail.durationWeeks) {
    metaChips.push(t('programs.weeks', { count: detail.durationWeeks }));
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={detail.name}
        action={
          detail.isActive ? (
            <View style={[styles.activeBadge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.activeBadgeText, { color: colors.accentText }]}>
                {t('running.program.activeBadge')}
              </Text>
            </View>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Chips de métadonnées */}
        {metaChips.length > 0 ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {metaChips.join(' · ')}
          </Text>
        ) : null}

        {/* Séances */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('running.program.sessions')}
        </Text>

        {detail.sessions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {t('running.program.emptySessions')}
            </Text>
          </Card>
        ) : (
          <View style={styles.sessionList}>
            {detail.sessions.map((session, index) => (
              <RunningSessionCard
                key={session.id}
                session={session}
                index={index}
                ref5kPaceSPerKm={runnerProfile?.ref5kPaceSPerKm ?? null}
                units={units}
              />
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {/* Planifier/activer réservé aux programmes POSSÉDÉS (cf. muscu) : un éditorial doit
              d'abord être dupliqué, sinon on activait l'éditorial → divergence local↔cloud. */}
          {isOwned ? (
            <Button
              label={detail.isActive ? t('programs.detail.editPlanning') : t('programs.detail.startProgram')}
              onPress={onPlan}
            />
          ) : null}

          {isOwned ? (
            <Button
              label={t('running.program.edit')}
              variant="ghost"
              onPress={onEdit}
            />
          ) : null}

          <Button
            label={duplicating ? t('programs.detail.duplicating') : t('running.program.duplicate')}
            variant="ghost"
            onPress={() => void onDuplicate()}
            loading={duplicating}
            disabled={duplicating}
          />

          {isOwned ? (
            <Button
              label={deleting ? t('running.program.deleting') : t('running.program.delete')}
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

type RunningSessionCardProps = {
  session: SessionDetail;
  index: number;
  ref5kPaceSPerKm: number | null;
  units: ReturnType<typeof useUnits>;
};

function RunningSessionCard({
  session,
  index,
  ref5kPaceSPerKm,
  units,
}: RunningSessionCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const sessionName =
    session.name?.trim() ||
    t('running.program.sessionDefaultName', { letter: sessionLetter(index) });

  const sessionType = session.sessionType as ProgramSessionType | null;

  // Libellé du type de séance
  const typeLabel = sessionType
    ? t(`running.sessionType.${sessionType}`)
    : null;

  // Cible formatée
  let targetLabel: string | null = null;
  if (session.targetDistanceM != null && session.targetDistanceM > 0) {
    const km = session.targetDistanceM / 1000;
    targetLabel = units.formatDistance(km);
  } else if (session.targetDurationSeconds != null && session.targetDurationSeconds > 0) {
    const minutes = Math.round(session.targetDurationSeconds / 60);
    targetLabel = `${minutes} min`;
  }

  // Allure cible calculée
  let paceLabel: string | null = null;
  if (sessionType) {
    if (ref5kPaceSPerKm == null) {
      paceLabel = t('running.program.noProfileHint');
    } else {
      const range = sessionTargetPace(sessionType, ref5kPaceSPerKm);
      if (range) {
        paceLabel = `${units.formatPace(range.minSPerKm)} – ${units.formatPace(range.maxSPerKm)}`;
      }
    }
  }

  // Résumé d'en-tête = type + cible (partie omise si absente).
  const summaryParts = [typeLabel, targetLabel].filter((p): p is string => Boolean(p));
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : undefined;

  return (
    <CollapsibleCard title={sessionName} summary={summary}>
      <View style={styles.chipsRow}>
        {typeLabel ? (
          <View style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.chipText, { color: colors.textMuted }]}>{typeLabel}</Text>
          </View>
        ) : null}
        {targetLabel ? (
          <View style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.chipText, { color: colors.textMuted }]}>{targetLabel}</Text>
          </View>
        ) : null}
      </View>

      {paceLabel ? (
        <Text style={[styles.paceLabel, { color: colors.textMuted }]}>{paceLabel}</Text>
      ) : null}
    </CollapsibleCard>
  );
}

/** Lettre de séance à partir d'un index 0-based : A, B, C… */
function sessionLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fontFamily.body,
    fontSize: 12,
  },
  paceLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
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
