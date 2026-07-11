import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  PROGRAM_SESSION_TYPES,
  hasRunningSessionTarget,
  sessionTargetPace,
  type ProgramSessionType,
} from '@wellness/shared';
import {
  removeSession,
  updateRunningSession,
  type SessionDetail,
} from '@/data/repositories/program-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

type RunningSessionEditorProps = {
  session: SessionDetail;
  fallbackName: string;
};

type TargetKind = 'distance' | 'duration';

/**
 * Éditeur de séance running au sein d'un programme custom.
 *
 * - Sélecteur de type de séance (PROGRAM_SESSION_TYPES)
 * - Toggle Distance / Durée
 * - Champ de saisie de la cible (distance en km→m ; durée en min→s)
 * - Champ nom optionnel
 * - Affichage de l'allure calculée (sessionTargetPace + profil + formatPace)
 * - Validation : hasRunningSessionTarget avant commit
 *
 * Stratégie locale + onBlur (mirror de ExercisePlanEditor).
 */
export function RunningSessionEditor({ session, fallbackName }: RunningSessionEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { runnerProfile } = useRunnerProfile();

  const displayName = session.name?.trim() ? session.name : fallbackName;

  // État local — type de séance
  const [sessionType, setSessionType] = useState<ProgramSessionType | null>(
    session.sessionType ?? null,
  );

  // État local — toggle distance/durée
  const [targetKind, setTargetKind] = useState<TargetKind>(
    session.targetDurationSeconds != null && session.targetDistanceM == null
      ? 'duration'
      : 'distance',
  );

  // État local — valeur du champ de saisie (dans l'unité d'affichage)
  const initDistanceInput = units.distanceInputValue(
    session.targetDistanceM != null ? session.targetDistanceM / 1000 : null,
  );
  const initDurationInput =
    session.targetDurationSeconds != null
      ? String(Math.round(session.targetDurationSeconds / 60))
      : '';

  const [distanceInput, setDistanceInput] = useState(initDistanceInput);
  const [durationInput, setDurationInput] = useState(initDurationInput);

  // Erreur de validation
  const [targetError, setTargetError] = useState(false);

  // ---------------------------------------------------------------------------
  // Commit des changements
  // ---------------------------------------------------------------------------

  const commitType = (type: ProgramSessionType) => {
    setSessionType(type);
    void updateRunningSession(session.id, { sessionType: type });
  };

  const commitTarget = () => {
    let distanceM: number | null = null;
    let durationSeconds: number | null = null;

    if (targetKind === 'distance') {
      const km = units.parseDistanceToKm(distanceInput);
      distanceM = km != null && km > 0 ? Math.round(km * 1000) : null;
    } else {
      const minutes = parseFloat(durationInput.trim());
      durationSeconds =
        Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
    }

    if (!hasRunningSessionTarget(distanceM, durationSeconds)) {
      setTargetError(true);
      return;
    }
    setTargetError(false);

    if (targetKind === 'distance') {
      void updateRunningSession(session.id, {
        targetDistanceM: distanceM,
        targetDurationSeconds: null,
      });
    } else {
      void updateRunningSession(session.id, {
        targetDurationSeconds: durationSeconds,
        targetDistanceM: null,
      });
    }
  };

  const onRemove = () => {
    void removeSession(session.id);
  };

  // ---------------------------------------------------------------------------
  // Allure calculée
  // ---------------------------------------------------------------------------

  let paceDisplay: string | null = null;
  if (sessionType) {
    const ref5k = runnerProfile?.ref5kPaceSPerKm ?? null;
    if (ref5k == null) {
      paceDisplay = t('running.program.noProfileHint');
    } else {
      const range = sessionTargetPace(sessionType, ref5k);
      if (range) {
        paceDisplay = `${units.formatPace(range.minSPerKm)} – ${units.formatPace(range.maxSPerKm)}`;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Styles dynamiques
  // ---------------------------------------------------------------------------

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.background,
      borderColor: targetError ? '#d9534f' : colors.border,
      color: colors.text,
    },
  ];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Entête : nom + suppression */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('running.program.removeSessionA11y', { name: displayName })}
        >
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Sélecteur de type de séance */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
          {t('running.program.sessionType')}
        </Text>
        <View style={styles.typeGrid}>
          {PROGRAM_SESSION_TYPES.map((type) => {
            const selected = sessionType === type;
            return (
              <Pressable
                key={type}
                onPress={() => commitType(type)}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: selected ? colors.accent : colors.background,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.typeChipLabel,
                    { color: selected ? colors.accentText : colors.text },
                  ]}
                  numberOfLines={2}
                >
                  {t(`running.sessionType.${type}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Toggle Distance / Durée */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
          {t('running.program.targetKind')}
        </Text>
        <View style={[styles.toggle, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {(['distance', 'duration'] as const).map((kind) => {
            const selected = targetKind === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => {
                  setTargetKind(kind);
                  setTargetError(false);
                }}
                style={[
                  styles.toggleItem,
                  selected && { backgroundColor: colors.accent },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    { color: selected ? colors.accentText : colors.text },
                  ]}
                >
                  {kind === 'distance'
                    ? t('running.program.targetDistance_label')
                    : t('running.program.targetDuration_label')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Champ de saisie */}
      {targetKind === 'distance' ? (
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
            {t('running.program.targetDistance', { unit: units.distanceSymbol })}
          </Text>
          <TextInput
            style={inputStyle}
            value={distanceInput}
            onChangeText={(v) => {
              setDistanceInput(v);
              setTargetError(false);
            }}
            onBlur={commitTarget}
            keyboardType="decimal-pad"
            placeholder={t('running.program.targetDistancePlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
            {t('running.program.targetDuration')}
          </Text>
          <TextInput
            style={inputStyle}
            value={durationInput}
            onChangeText={(v) => {
              setDurationInput(v);
              setTargetError(false);
            }}
            onBlur={commitTarget}
            keyboardType="decimal-pad"
            placeholder={t('running.program.targetDurationPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      )}

      {/* Message d'erreur de validation */}
      {targetError ? (
        <Text style={[styles.errorText, { color: '#d9534f' }]}>
          {t('running.program.targetRequired')}
        </Text>
      ) : null}

      {/* Allure calculée */}
      {paceDisplay ? (
        <Text style={[styles.paceDisplay, { color: colors.textMuted }]}>
          {paceDisplay}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.displaySemi,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    minWidth: '45%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeChipLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    textAlign: 'center',
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  toggleItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
  },
  input: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
  },
  paceDisplay: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
  },
});
