import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RUNNER_OBJECTIVES, type ProgramLevel, type RunnerObjective } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import {
  addSession,
  createProgram,
  updateProgram,
  updateProgramTranslation,
  useProgramDetail,
} from '@/data/repositories/program-repository';
import { RunningSessionEditor } from '@/components/running/RunningSessionEditor';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

// ---------------------------------------------------------------------------
// Niveaux de programme de course — mêmes valeurs que ProgramLevel de @wellness/shared
// ---------------------------------------------------------------------------

const RUNNING_PROGRAM_LEVELS = ['beginner', 'intermediate', 'advanced'] as const satisfies readonly ProgramLevel[];

const NO_LEVEL = 'none' as const;
type LevelChoice = ProgramLevel | typeof NO_LEVEL;
const LEVEL_CHOICES: readonly LevelChoice[] = [NO_LEVEL, ...RUNNING_PROGRAM_LEVELS];

const NO_OBJECTIVE = 'none' as const;
type ObjectiveChoice = RunnerObjective | typeof NO_OBJECTIVE;
const OBJECTIVE_CHOICES: readonly ObjectiveChoice[] = [NO_OBJECTIVE, ...RUNNER_OBJECTIVES];

/** Lettre de séance à partir d'un index 0-based : A, B, C… */
function sessionLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

/**
 * Écran de création / édition d'un programme de course custom.
 *
 *  - Sans `?id=` : formulaire de métadonnées (nom requis, objectif, niveau, durée) ;
 *    `createProgram` puis bascule en édition.
 *  - Avec `?id=` : édition d'un programme existant — liste réactive des séances,
 *    chacune éditée via `RunningSessionEditor`.
 */
export default function RunningProgramEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const programId = typeof params.id === 'string' ? params.id : '';

  if (programId) {
    return <RunningProgramComposer programId={programId} />;
  }
  return (
    <RunningProgramCreateForm
      onCreated={(id) => router.replace(`/running-programs/edit?id=${id}`)}
    />
  );
}

// ---------------------------------------------------------------------------
// Étape 1 — création (métadonnées)
// ---------------------------------------------------------------------------

function RunningProgramCreateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [objective, setObjective] = useState<ObjectiveChoice>(NO_OBJECTIVE);
  const [level, setLevel] = useState<LevelChoice>(NO_LEVEL);
  const [duration, setDuration] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = name.trim().length > 0 && !submitting;

  const onSubmit = async () => {
    if (!canCreate) return;
    setSubmitting(true);
    try {
      const trimmedDuration = duration.trim();
      const parsedDuration = trimmedDuration === '' ? null : Number(trimmedDuration);
      const durationWeeks =
        parsedDuration !== null &&
        Number.isInteger(parsedDuration) &&
        parsedDuration > 0
          ? parsedDuration
          : null;

      const id = await createProgram({
        pillar: 'running',
        name: name.trim(),
        level: level === NO_LEVEL ? null : level,
        goal: objective === NO_OBJECTIVE ? null : objective,
        durationWeeks,
      });
      onCreated(id);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('running.program.createTitle')}
        subtitle={t('running.program.createSubtitle')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <TextField
            label={t('running.program.name')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            placeholder={t('running.program.namePlaceholder')}
          />

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              {t('running.program.objective')}
            </Text>
            <Segment
              scrollable
              options={OBJECTIVE_CHOICES}
              value={objective}
              onChange={setObjective}
              label={(o) =>
                o === NO_OBJECTIVE ? '—' : t(`running.objective.${o}`)
              }
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              {t('running.program.level')}
            </Text>
            <Segment
              scrollable
              options={LEVEL_CHOICES}
              value={level}
              onChange={setLevel}
              label={(l) =>
                l === NO_LEVEL ? '—' : t(`running.programLevel.${l}`)
              }
            />
          </View>

          <TextField
            label={t('running.program.durationWeeks')}
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            maxLength={3}
            placeholder={t('running.program.durationPlaceholder')}
          />

          <Button
            label={submitting ? t('running.program.creating') : t('running.program.createCta')}
            onPress={() => void onSubmit()}
            loading={submitting}
            disabled={!canCreate}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Étape 2 — composition (séances)
// ---------------------------------------------------------------------------

function RunningProgramComposer({ programId }: { programId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { detail, isLoading } = useProgramDetail(programId);
  const [addingSession, setAddingSession] = useState(false);

  // Métadonnées éditables — textuelles
  const [name, setName] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  // Métadonnées éditables — scalaires (objectif / niveau / durée)
  const [goal, setGoal] = useState<ObjectiveChoice | null>(null);
  const [level, setLevel] = useState<LevelChoice | null>(null);
  const [durationWeeks, setDurationWeeks] = useState<string | null>(null);

  const currentName = name ?? (detail?.name ?? '');
  const currentSummary = summary ?? (detail?.summary ?? '');
  const currentGoal: ObjectiveChoice =
    goal ?? ((detail?.goal as RunnerObjective | null | undefined) ?? NO_OBJECTIVE);
  const currentLevel: LevelChoice =
    level ?? (detail?.level ?? NO_LEVEL);

  const onAddSession = async () => {
    if (addingSession) return;
    setAddingSession(true);
    try {
      const index = detail?.sessions.length ?? 0;
      await addSession(programId, {
        name: t('running.program.sessionDefaultName', { letter: sessionLetter(index) }),
      });
    } finally {
      setAddingSession(false);
    }
  };

  const commitName = () => {
    const trimmed = currentName.trim();
    if (trimmed) {
      void updateProgramTranslation(programId, { name: trimmed });
    }
  };

  const commitSummary = () => {
    const trimmed = currentSummary.trim();
    void updateProgramTranslation(programId, { summary: trimmed === '' ? null : trimmed });
  };

  const commitGoal = (value: ObjectiveChoice) => {
    setGoal(value);
    void updateProgram(programId, { goal: value === NO_OBJECTIVE ? null : value });
  };

  const commitLevel = (value: LevelChoice) => {
    setLevel(value);
    void updateProgram(programId, { level: value === NO_LEVEL ? null : value });
  };

  const commitDurationWeeks = () => {
    const raw = (durationWeeks ?? '').trim();
    if (raw === '') {
      void updateProgram(programId, { durationWeeks: null });
      return;
    }
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      void updateProgram(programId, { durationWeeks: parsed });
    }
  };

  // ---------------------------------------------------------------------------
  // Commit-on-change (offline-first) : enregistre à la frappe pour ne pas perdre
  // la saisie si l'utilisateur tape « Terminé » sans faire perdre le focus au champ
  // (l'onBlur ne se déclencherait pas). PowerSync coalesce les écritures locales.
  // ---------------------------------------------------------------------------

  const saveName = (v: string) => {
    const trimmed = v.trim();
    if (trimmed) void updateProgramTranslation(programId, { name: trimmed });
  };

  const saveSummary = (v: string) => {
    const trimmed = v.trim();
    void updateProgramTranslation(programId, { summary: trimmed === '' ? null : trimmed });
  };

  const saveDurationWeeks = (v: string) => {
    const raw = v.trim();
    if (raw === '') {
      void updateProgram(programId, { durationWeeks: null });
      return;
    }
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      void updateProgram(programId, { durationWeeks: parsed });
    }
  };

  if (isLoading && !detail) {
    return (
      <Screen edges={['top']} center>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const sessions = detail?.sessions ?? [];

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={detail?.name ? detail.name : t('running.program.editTitle')}
        subtitle={t('running.program.editSubtitle')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Champs de métadonnées éditables */}
        <View style={styles.metaSection}>
          <TextField
            label={t('running.program.name')}
            value={name ?? (detail?.name ?? '')}
            onChangeText={(v) => {
              setName(v);
              saveName(v);
            }}
            onBlur={commitName}
            autoCapitalize="sentences"
            placeholder={t('running.program.namePlaceholder')}
          />
          <TextField
            label={t('running.program.summary')}
            value={summary ?? (detail?.summary ?? '')}
            onChangeText={(v) => {
              setSummary(v);
              saveSummary(v);
            }}
            onBlur={commitSummary}
            autoCapitalize="sentences"
            placeholder={t('running.program.summaryPlaceholder')}
          />

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              {t('running.program.objective')}
            </Text>
            <Segment
              scrollable
              options={OBJECTIVE_CHOICES}
              value={currentGoal}
              onChange={commitGoal}
              label={(o) =>
                o === NO_OBJECTIVE ? '—' : t(`running.objective.${o}`)
              }
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              {t('running.program.level')}
            </Text>
            <Segment
              scrollable
              options={LEVEL_CHOICES}
              value={currentLevel}
              onChange={commitLevel}
              label={(l) =>
                l === NO_LEVEL ? '—' : t(`running.programLevel.${l}`)
              }
            />
          </View>

          <TextField
            label={t('running.program.durationWeeks')}
            value={durationWeeks ?? (detail?.durationWeeks != null ? String(detail.durationWeeks) : '')}
            onChangeText={(v) => {
              setDurationWeeks(v);
              saveDurationWeeks(v);
            }}
            onBlur={commitDurationWeeks}
            keyboardType="number-pad"
            maxLength={3}
            placeholder={t('running.program.durationPlaceholder')}
          />
        </View>

        {/* Section séances */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('running.program.sessions')}
        </Text>

        {sessions.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('running.program.emptySessions')}
          </Text>
        ) : (
          <View style={styles.sessions}>
            {sessions.map((session, index) => (
              <RunningSessionEditor
                key={session.id}
                session={session}
                fallbackName={t('running.program.sessionDefaultName', {
                  letter: sessionLetter(index),
                })}
              />
            ))}
          </View>
        )}

        <View style={styles.addSession}>
          <Button
            label={t('running.program.addSession')}
            variant="ghost"
            onPress={() => void onAddSession()}
            disabled={addingSession}
          />
        </View>

        <View style={styles.done}>
          <Button
            label={t('running.program.done')}
            onPress={() => {
              Keyboard.dismiss();
              router.back();
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  form: { gap: 16 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  metaSection: { gap: 14, marginBottom: 24 },
  sectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  sessions: { gap: 14 },
  addSession: { marginTop: 16 },
  done: { marginTop: 12 },
});
