import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PROGRAM_LEVELS, type ProgramLevel } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import {
  addSession,
  createProgram,
  useProgramDetail,
} from '@/data/repositories/program-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { SessionEditor } from '@/components/programs/SessionEditor';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

// Valeur sentinelle « niveau non précisé » pour le sélecteur segmenté.
const NO_LEVEL = 'none' as const;
type LevelChoice = ProgramLevel | typeof NO_LEVEL;
const LEVEL_CHOICES: readonly LevelChoice[] = [NO_LEVEL, ...PROGRAM_LEVELS];

/** Nom de séance par défaut « Séance A », « Séance B »… d'après la position (0-based). */
function sessionLetter(index: number): string {
  // A partir de 'A' ; au-delà de Z (rare), on retombe sur le numéro.
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

/**
 * Écran de création / édition d'un programme personnalisé (spec musculation
 * §3.4/3.5/3.6).
 *
 *  - Sans `?id=` : formulaire de métadonnées (nom requis, pilier = 'strength',
 *    niveau, objectif, durée) ; `createProgram` puis bascule en édition du
 *    programme créé (navigation vers soi-même avec l'`id`).
 *  - Avec `?id=` : édition d'un programme existant — liste réactive des séances
 *    (ajout/suppression) et, par séance, des exercices planifiés avec leurs cibles.
 */
export default function ProgramEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const programId = typeof params.id === 'string' ? params.id : '';

  if (programId) {
    return <ProgramComposer programId={programId} />;
  }
  return <ProgramCreateForm onCreated={(id) => router.replace(`/programs/edit?id=${id}`)} />;
}

// ---------------------------------------------------------------------------
// Étape 1 — création (métadonnées)
// ---------------------------------------------------------------------------

function ProgramCreateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [level, setLevel] = useState<LevelChoice>(NO_LEVEL);
  const [goal, setGoal] = useState('');
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
        pillar: 'strength',
        name: name.trim(),
        level: level === NO_LEVEL ? null : level,
        goal: goal.trim() === '' ? null : goal.trim(),
        durationWeeks,
      });
      onCreated(id);
    } catch {
      // Écriture locale (offline-first) : un échec est très improbable. On
      // réactive le bouton pour permettre une nouvelle tentative.
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('programs.edit.createTitle')}
        subtitle={t('programs.edit.createSubtitle')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <TextField
            label={t('programs.edit.name')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            placeholder={t('programs.edit.namePlaceholder')}
          />

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              {t('programs.edit.level')}
            </Text>
            <Segment
              scrollable
              options={LEVEL_CHOICES}
              value={level}
              onChange={setLevel}
              label={(l) =>
                l === NO_LEVEL ? t('programs.edit.levelNone') : t(`programs.level.${l}`)
              }
            />
          </View>

          <TextField
            label={t('programs.edit.goal')}
            value={goal}
            onChangeText={setGoal}
            autoCapitalize="sentences"
            placeholder={t('programs.edit.goalPlaceholder')}
          />

          <TextField
            label={t('programs.edit.durationWeeks')}
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            maxLength={3}
            placeholder={t('programs.edit.durationPlaceholder')}
          />

          <Button
            label={submitting ? t('programs.edit.creating') : t('programs.edit.createCta')}
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
// Étape 2 — composition (séances + exercices)
// ---------------------------------------------------------------------------

function ProgramComposer({ programId }: { programId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { detail, isLoading } = useProgramDetail(programId);
  // `addingSession` ne pilote que l'affichage : la garde contre le double appui est portée par
  // `useActionLock`. L'ancien `if (addingSession) return` ne gardait rien — deux appuis rapides
  // tombent dans le MÊME cycle de rendu et lisent tous deux `false`, ce qui creait deux séances
  // portant la même lettre (l'index est calculé avant l'écriture). Quinzième site du défaut du
  // 08/08/2026, trouvé le 14/08 — jumeau exact de celui de `running-programs/edit.tsx`.
  const [addingSession, setAddingSession] = useState(false);
  const lockAddSession = useActionLock();

  const onAddSession = () =>
    void lockAddSession(async () => {
      setAddingSession(true);
      try {
        const index = detail?.sessions.length ?? 0;
        await addSession(programId, {
          name: t('programs.edit.sessionDefaultName', { letter: sessionLetter(index) }),
        });
      } finally {
        setAddingSession(false);
      }
    });

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
        title={detail?.name ? detail.name : t('programs.edit.editTitle')}
        subtitle={t('programs.edit.editSubtitle')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('programs.edit.sectionSessions')}
        </Text>

        {sessions.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('programs.edit.emptySessions')}
          </Text>
        ) : (
          <View style={styles.sessions}>
            {sessions.map((session, index) => (
              <SessionEditor
                key={session.id}
                session={session}
                fallbackName={t('programs.edit.sessionDefaultName', {
                  letter: sessionLetter(index),
                })}
              />
            ))}
          </View>
        )}

        <View style={styles.addSession}>
          <Button
            label={t('programs.edit.addSession')}
            variant="ghost"
            onPress={onAddSession}
            disabled={addingSession}
          />
        </View>

        <View style={styles.done}>
          <Button label={t('programs.edit.done')} onPress={() => router.back()} />
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
