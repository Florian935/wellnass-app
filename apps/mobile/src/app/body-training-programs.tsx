import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  recommendStrengthPrograms,
  type BodyTrainingDocument,
  type StrengthProgramContext,
  type StrengthProgramRecommendation,
} from '@wellness/shared';

import { Screen } from '@/components/Screen';
import { BodyTrainingButton } from '@/components/body/BodyTrainingButton';
import { StrengthProgramContextEditor } from '@/components/body/StrengthProgramContextEditor';
import { StrengthProgramRecommendationCard } from '@/components/body/StrengthProgramRecommendationCard';
import { useBodyTraining } from '@/data/repositories/body-training-repository';
import {
  saveStrengthProgramContext,
  type StrengthProgramContextSnapshot,
  useStrengthProgramContext,
} from '@/data/repositories/strength-program-context-repository';
import {
  type StrengthProgramRecommendationCandidate,
  useStrengthProgramCandidates,
} from '@/data/repositories/strength-program-recommendation-repository';
import { prepareCompatibleStrengthProgram } from '@/data/repositories/program-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useAuthStore } from '@/stores/auth-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type ContextPreferences = Pick<StrengthProgramContext, 'sessionMinutes' | 'equipment'>;

type OptimisticContext = StrengthProgramContextSnapshot & {
  previousUpdatedAt: string;
};

type ComparisonSnapshot = {
  accountId: string | null;
  priorities: BodyTrainingDocument['priorities'];
  confirmedAt: string;
  context: StrengthProgramContext;
  contextUpdatedAt: string;
  candidateFingerprints: string;
};

type Comparison = {
  snapshot: ComparisonSnapshot;
  candidates: StrengthProgramRecommendationCandidate[];
  recommendations: StrengthProgramRecommendation[];
};

type ReactiveValues = {
  accountId: string | null;
  document: BodyTrainingDocument | null;
  context: StrengthProgramContext | null;
  contextUpdatedAt: string | null;
  candidates: StrengthProgramRecommendationCandidate[];
};

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function fingerprintKey(candidates: StrengthProgramRecommendationCandidate[]): string {
  return JSON.stringify(
    candidates
      .map((candidate) => ({ id: candidate.program.id, fingerprint: candidate.fingerprint }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}

function snapshotMatches(snapshot: ComparisonSnapshot, values: ReactiveValues): boolean {
  return Boolean(
    values.accountId === snapshot.accountId &&
      values.document &&
      same(values.document.priorities, snapshot.priorities) &&
      values.document.confirmedAt === snapshot.confirmedAt &&
      values.context &&
      same(values.context, snapshot.context) &&
      values.contextUpdatedAt === snapshot.contextUpdatedAt &&
      fingerprintKey(values.candidates) === snapshot.candidateFingerprints,
  );
}

function contextPreferences(context: StrengthProgramContext | null) {
  return context
    ? { sessionMinutes: context.sessionMinutes, equipment: context.equipment }
    : null;
}

export default function BodyTrainingProgramsScreen() {
  const accountId = useAuthStore((state) => state.session?.user.id ?? null);

  return <BodyTrainingProgramsSession key={accountId ?? 'signed-out'} accountId={accountId} />;
}

function currentAccountId(): string | null {
  return useAuthStore.getState().session?.user.id ?? null;
}

function BodyTrainingProgramsSession({ accountId }: { accountId: string | null }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const training = useBodyTraining();
  const contextSource = useStrengthProgramContext();
  const repository = useStrengthProgramCandidates();
  const lockPreparation = useActionLock();
  const [hasLoadedCore, setHasLoadedCore] = useState(false);
  const [fallbackContext, setFallbackContext] = useState<StrengthProgramContextSnapshot | null>(
    () =>
      contextSource.context && contextSource.updatedAt
        ? { context: contextSource.context, updatedAt: contextSource.updatedAt }
        : null,
  );
  const [draftPreferences, setDraftPreferences] = useState<ContextPreferences | null>(() =>
    contextPreferences(contextSource.context),
  );
  const [optimisticContext, setOptimisticContext] = useState<OptimisticContext | null>(null);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);

  const coreLoading = training.isLoading || contextSource.isLoading;
  if (!coreLoading && !hasLoadedCore) setHasLoadedCore(true);

  const repositoryContext =
    contextSource.context && contextSource.updatedAt
      ? { context: contextSource.context, updatedAt: contextSource.updatedAt }
      : null;
  const waitingForEcho = Boolean(
    optimisticContext &&
      repositoryContext?.updatedAt === optimisticContext.previousUpdatedAt,
  );
  if (repositoryContext && !waitingForEcho && !same(repositoryContext, fallbackContext)) {
    setFallbackContext({
      context: {
        ...repositoryContext.context,
        equipment: repositoryContext.context.equipment
          ? [...repositoryContext.context.equipment]
          : null,
      },
      updatedAt: repositoryContext.updatedAt,
    });
  }
  const savedContext = waitingForEcho
    ? optimisticContext
    : repositoryContext ?? fallbackContext;
  const effectivePreferences =
    draftPreferences ?? contextPreferences(savedContext?.context ?? null);
  const draftContext =
    savedContext && effectivePreferences
      ? { ...savedContext.context, ...effectivePreferences }
      : null;
  const dirty = !same(
    effectivePreferences,
    contextPreferences(savedContext?.context ?? null),
  );

  const currentValues: ReactiveValues = {
    accountId,
    document: training.document,
    context: contextSource.context,
    contextUpdatedAt: contextSource.updatedAt,
    candidates: repository.candidates,
  };
  const currentValuesKey = JSON.stringify({
    accountId: currentValues.accountId,
    priorities: currentValues.document?.priorities ?? null,
    confirmedAt: currentValues.document?.confirmedAt ?? null,
    context: currentValues.context,
    contextUpdatedAt: currentValues.contextUpdatedAt,
    candidateFingerprints: fingerprintKey(currentValues.candidates),
  });
  const latest = useRef<ReactiveValues | null>(null);
  useEffect(() => {
    latest.current = currentValues;
    // `currentValuesKey` contains every field used by the stale-snapshot guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValuesKey]);

  if (!hasLoadedCore && coreLoading) {
    return (
      <Screen center>
        <ActivityIndicator
          accessibilityLabel={t('strengthProgramFinder.loading')}
          color={colors.accent}
        />
      </Screen>
    );
  }

  const documentReady = training.status === 'ready' && training.document !== null;
  const prioritiesUnavailable = !documentReady || Boolean(training.error);
  const contextReadFailed = Boolean(contextSource.error);
  const candidatesReadFailed = Boolean(repository.error) && repository.candidates.length === 0;
  const hasEditorial = repository.candidates.some((candidate) => !candidate.isCurrent);
  const hasCurrent = repository.candidates.some((candidate) => candidate.isCurrent);
  const currentOnly = hasCurrent && !hasEditorial;
  const emptyLibrary = repository.candidates.length === 0 && !repository.isLoading && !repository.error;
  const canCompare = Boolean(
    documentReady &&
      savedContext &&
      !dirty &&
      !waitingForEcho &&
      !saving &&
      !contextSource.isLoading &&
      !contextReadFailed &&
      !repository.isLoading &&
      !candidatesReadFailed &&
      repository.candidates.length > 0,
  );
  const comparisonStale = comparison
    ? !snapshotMatches(comparison.snapshot, currentValues)
    : false;

  const changeDraft = (draft: StrengthProgramContext) => {
    setDraftPreferences(contextPreferences(draft));
    setFailure(null);
  };

  const persistContext = () => {
    if (!draftContext || !savedContext || saving || waitingForEcho || !dirty) return;
    if (currentAccountId() !== accountId) {
      setFailure(t('strengthProgramFinder.errors.recalculate'));
      return;
    }
    const draft = draftContext;
    const expectedUpdatedAt = savedContext.updatedAt;
    setSaving(true);
    setFailure(null);
    void saveStrengthProgramContext(draft, expectedUpdatedAt)
      .then((saved: StrengthProgramContextSnapshot) => {
        if (currentAccountId() !== accountId) return;
        setFallbackContext(saved);
        setDraftPreferences(contextPreferences(saved.context));
        setOptimisticContext({ ...saved, previousUpdatedAt: expectedUpdatedAt });
        setComparison(null);
      })
      .catch((error: unknown) => {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : 'save';
        const known = ['conflict', 'profile_missing', 'unauthenticated', 'invalid'].includes(code)
          ? code
          : 'save';
        setFailure(t(`strengthProgramFinder.errors.context.${known}`));
      })
      .finally(() => setSaving(false));
  };

  const compare = () => {
    if (!canCompare || !training.document || !savedContext) return;
    if (currentAccountId() !== accountId) {
      setFailure(t('strengthProgramFinder.errors.recalculate'));
      return;
    }
    const candidates = [...repository.candidates];
    const recommendations = recommendStrengthPrograms(
      candidates,
      training.document.priorities,
      savedContext.context,
    );
    setFailure(null);
    setComparison({
      snapshot: {
        accountId,
        priorities: [...training.document.priorities],
        confirmedAt: training.document.confirmedAt,
        context: {
          ...savedContext.context,
          equipment: savedContext.context.equipment
            ? [...savedContext.context.equipment]
            : null,
        },
        contextUpdatedAt: savedContext.updatedAt,
        candidateFingerprints: fingerprintKey(candidates),
      },
      candidates,
      recommendations,
    });
  };

  const requireFreshComparison = (snapshot: ComparisonSnapshot): boolean => {
    const liveAccountId = currentAccountId();
    const reactiveValues = latest.current ?? currentValues;
    if (
      liveAccountId === snapshot.accountId &&
      snapshotMatches(snapshot, { ...reactiveValues, accountId: liveAccountId })
    ) {
      return true;
    }
    setFailure(t('strengthProgramFinder.errors.recalculate'));
    return false;
  };

  const openCurrent = (programId: string, snapshot: ComparisonSnapshot) => {
    if (!requireFreshComparison(snapshot)) return;
    router.push(`/programs/edit?id=${programId}`);
  };

  const prepareEditorial = (
    candidate: StrengthProgramRecommendationCandidate,
    snapshot: ComparisonSnapshot,
  ) => {
    if (!requireFreshComparison(snapshot)) return;
    void lockPreparation(
      () =>
        new Promise<void>((release) => {
          let consumed = false;
          const cancel = () => {
            if (consumed) return;
            consumed = true;
            release();
          };
          const confirm = async () => {
            if (consumed) return;
            consumed = true;
            try {
              if (!requireFreshComparison(snapshot)) return;
              setPreparing(true);
              setFailure(null);
              try {
                const id = await prepareCompatibleStrengthProgram(
                  candidate.program.id,
                  candidate.fingerprint,
                );
                if (!requireFreshComparison(snapshot)) return;
                router.push(`/programs/edit?id=${id}`);
              } catch (error) {
                const code =
                  error && typeof error === 'object' && 'code' in error
                    ? String(error.code)
                    : 'prepare';
                const needsRecalculation = [
                  'source_missing',
                  'source_invalid',
                  'source_changed',
                  'account_changed',
                ].includes(code);
                setFailure(
                  t(
                    needsRecalculation
                      ? 'strengthProgramFinder.errors.recalculate'
                      : 'strengthProgramFinder.errors.prepare',
                  ),
                );
              } finally {
                setPreparing(false);
              }
            } finally {
              release();
            }
          };

          Alert.alert(
            t('strengthProgramFinder.confirm.title'),
            t('strengthProgramFinder.confirm.body'),
            [
              { text: t('common.cancel'), style: 'cancel', onPress: cancel },
              {
                text: t('strengthProgramFinder.confirm.action'),
                onPress: confirm,
              },
            ],
            { cancelable: true, onDismiss: cancel },
          );
        }),
    );
  };

  const recommendationCandidate = (programId: string) =>
    comparison?.candidates.find((candidate) => candidate.program.id === programId);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/body-training'))}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
          <Text style={[styles.body, { color: colors.text }]}>{t('common.back')}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {t('strengthProgramFinder.title')}
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {t('strengthProgramFinder.subtitle')}
        </Text>

        {prioritiesUnavailable ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text accessibilityRole="alert" style={[styles.sectionTitle, { color: colors.text }]}>
              {t(
                training.status === 'invalid' || training.status === 'unsupported' || training.error
                  ? 'strengthProgramFinder.prioritiesUnreadable'
                  : 'strengthProgramFinder.prioritiesMissing',
              )}
            </Text>
            <BodyTrainingButton
              label={t('strengthProgramFinder.choosePriorities')}
              onPress={() => router.push('/body-training')}
              primary
            />
          </View>
        ) : null}

        {!prioritiesUnavailable && !savedContext ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text accessibilityRole="alert" style={[styles.sectionTitle, { color: colors.text }]}>
              {t('strengthProgramFinder.context.unavailable')}
            </Text>
            <BodyTrainingButton
              label={t('strengthProgramFinder.context.editProfile')}
              onPress={() => router.push('/strength-profile')}
              primary
            />
          </View>
        ) : null}

        {!prioritiesUnavailable && draftContext ? (
          <StrengthProgramContextEditor
            draft={draftContext}
            dirty={dirty}
            saving={saving}
            disabled={contextReadFailed || contextSource.isLoading || waitingForEcho}
            onChange={changeDraft}
            onSave={persistContext}
            onOpenProfile={() => router.push('/strength-profile')}
          />
        ) : null}

        {contextReadFailed && draftContext ? (
          <Text accessibilityRole="alert" style={[styles.alert, { color: colors.danger }]}>
            {t('strengthProgramFinder.errors.context.load')}
          </Text>
        ) : null}
        {failure ? (
          <Text accessibilityRole="alert" style={[styles.alert, { color: colors.danger }]}>
            {failure}
          </Text>
        ) : null}
        {dirty ? (
          <Text style={[styles.notice, { color: colors.warnText }]}>
            {t('strengthProgramFinder.saveRequired')}
          </Text>
        ) : null}
        {waitingForEcho ? (
          <Text style={[styles.notice, { color: colors.textMuted }]}>
            {t('strengthProgramFinder.waitingForSave')}
          </Text>
        ) : null}

        {!prioritiesUnavailable && savedContext ? (
          <View style={styles.compareSection}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {t('strengthProgramFinder.libraryTitle')}
            </Text>
            {repository.isLoading ? (
              <ActivityIndicator
                accessibilityLabel={t('strengthProgramFinder.libraryLoading')}
                color={colors.accent}
              />
            ) : null}
            {emptyLibrary ? (
              <Text style={[styles.body, { color: colors.textMuted }]}>
                {t('strengthProgramFinder.libraryEmpty')}
              </Text>
            ) : null}
            {currentOnly ? (
              <Text style={[styles.body, { color: colors.textMuted }]}>
                {t('strengthProgramFinder.currentOnly')}
              </Text>
            ) : null}
            {candidatesReadFailed ? (
              <Text accessibilityRole="alert" style={[styles.alert, { color: colors.danger }]}>
                {t('strengthProgramFinder.libraryError')}
              </Text>
            ) : null}
            {repository.error && repository.candidates.length > 0 ? (
              <Text accessibilityRole="alert" style={[styles.notice, { color: colors.warnText }]}>
                {t('strengthProgramFinder.libraryPartial')}
              </Text>
            ) : null}
            <BodyTrainingButton
              label={t('strengthProgramFinder.compare')}
              onPress={compare}
              primary
              disabled={!canCompare}
            />
          </View>
        ) : null}

        {comparison ? (
          <View style={styles.results}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {t(
                comparison.recommendations.some((recommendation) => recommendation.compatible)
                  ? 'strengthProgramFinder.resultsTitle'
                  : 'strengthProgramFinder.noCompatible',
              )}
            </Text>
            {comparisonStale ? (
              <Text accessibilityRole="alert" style={[styles.notice, { color: colors.warnText }]}>
                {t('strengthProgramFinder.errors.recalculate')}
              </Text>
            ) : null}
            {comparison.recommendations.map((recommendation) => {
              const candidate = recommendationCandidate(recommendation.programId);
              if (!candidate) return null;
              return (
                <StrengthProgramRecommendationCard
                  key={recommendation.programId}
                  candidate={candidate}
                  recommendation={recommendation}
                  actionDisabled={preparing}
                  onAction={() =>
                    recommendation.isCurrent
                      ? openCurrent(recommendation.programId, comparison.snapshot)
                      : prepareEditorial(candidate, comparison.snapshot)
                  }
                />
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 40 },
  back: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  title: { fontFamily: fontFamily.displayBold, fontSize: 28, lineHeight: 35 },
  body: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21 },
  sectionTitle: { fontFamily: fontFamily.bodyBold, fontSize: 19, lineHeight: 26 },
  card: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 12 },
  alert: { fontFamily: fontFamily.bodySemi, fontSize: 14, lineHeight: 21 },
  notice: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21 },
  compareSection: { gap: 12 },
  results: { gap: 14 },
});
