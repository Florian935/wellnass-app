import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  PROGRAM_SESSION_TYPES,
  hasRunningSessionTarget,
  sessionTargetPace,
  type ProgramSessionType,
  formatMmSs,
  isTimedSessionType,
  parseMmSs,
} from '@wellness/shared';
import {
  addIntervalBlock,
  removeSession,
  updateRunningSession,
  type SessionDetail,
} from '@/data/repositories/program-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { IntervalBlockEditor } from '@/components/running/IntervalBlockEditor';
import { Button } from '@/components/Button';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useActionLock } from '@/hooks/useActionLock';
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

  // État local — toggle distance/durée.
  // Offline-first : démarre null ; la valeur effective est dérivée de la séance
  // (re-émise par useProgramDetail après un commit, sans remontage du composant) tant
  // que l'utilisateur n'a pas basculé le toggle. Évite le gel « distance » vide au reload.
  const [targetKind, setTargetKind] = useState<TargetKind | null>(null);
  const effectiveTargetKind: TargetKind =
    targetKind ??
    (session.targetDurationSeconds != null && session.targetDistanceM == null
      ? 'duration'
      : 'distance');

  // État local — valeur du champ de saisie (dans l'unité d'affichage).
  // Même idiome : null = pas de saisie en cours → on retombe sur la valeur de la séance.
  const initDistanceInput = units.distanceInputValue(
    session.targetDistanceM != null ? session.targetDistanceM / 1000 : null,
  );
  const initDurationInput =
    session.targetDurationSeconds != null
      ? String(Math.round(session.targetDurationSeconds / 60))
      : '';

  const [distanceInput, setDistanceInput] = useState<string | null>(null);
  const [durationInput, setDurationInput] = useState<string | null>(null);
  const effectiveDistanceInput = distanceInput ?? initDistanceInput;
  const effectiveDurationInput = durationInput ?? initDurationInput;

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

    if (effectiveTargetKind === 'distance') {
      const km = units.parseDistanceToKm(effectiveDistanceInput);
      distanceM = km != null && km > 0 ? Math.round(km * 1000) : null;
    } else {
      const minutes = parseFloat(effectiveDurationInput.trim());
      durationSeconds =
        Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
    }

    if (!hasRunningSessionTarget(distanceM, durationSeconds)) {
      setTargetError(true);
      return;
    }
    setTargetError(false);

    if (effectiveTargetKind === 'distance') {
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

  /**
   * Sauvegarde silencieuse de la cible à la saisie (commit-on-change).
   * Offline-first : n'écrit QUE si la valeur est valide, sans jamais afficher
   * l'erreur « cible requise » pendant la frappe. Filet contre la perte de saisie
   * lorsque « Terminé » est tapé sans blur préalable. PowerSync coalesce les écritures.
   */
  const saveTargetValue = (kind: TargetKind, rawValue: string) => {
    if (kind === 'distance') {
      const km = units.parseDistanceToKm(rawValue);
      if (km != null && km > 0) {
        void updateRunningSession(session.id, {
          targetDistanceM: Math.round(km * 1000),
          targetDurationSeconds: null,
        });
      }
    } else {
      const min = parseFloat(rawValue.trim());
      if (Number.isFinite(min) && min > 0) {
        void updateRunningSession(session.id, {
          targetDurationSeconds: Math.round(min * 60),
          targetDistanceM: null,
        });
      }
    }
  };

  // ---- US RUN-F4 : la consigne de la séance (lots A, G, I) ----
  //
  // Saisie en `m:ss` et jamais en secondes : personne n'écrit « 245 s/km », tout le monde écrit
  // « 4:05 ». `parseMmSs` accepte aussi un nombre nu (interprété comme des minutes entières) et
  // rend `null` sur une saisie illisible — auquel cas on repose la valeur d'origine plutôt que
  // d'écrire un `null` qui effacerait silencieusement une consigne existante.
  const [paceMin, setPaceMin] = useState(formatMmSs(session.targetPaceMinSPerKm));
  const [paceMax, setPaceMax] = useState(formatMmSs(session.targetPaceMaxSPerKm));
  const commitPace = () => {
    const min = parseMmSs(paceMin);
    const max = parseMmSs(paceMax);
    // Les deux champs vides = on efface la consigne et l'allure redevient dérivée.
    void updateRunningSession(session.id, {
      targetPaceMinSPerKm: min,
      targetPaceMaxSPerKm: max,
    });
    setPaceMin(formatMmSs(min));
    setPaceMax(formatMmSs(max));
  };

  const [targetTime, setTargetTime] = useState(formatMmSs(session.targetTimeSeconds));
  const commitTargetTime = () => {
    const value = parseMmSs(targetTime);
    void updateRunningSession(session.id, { targetTimeSeconds: value });
    setTargetTime(formatMmSs(value));
  };

  const [targetRpe, setTargetRpe] = useState(
    session.targetRpe != null ? String(session.targetRpe) : '',
  );
  const commitTargetRpe = () => {
    const parsed = Number.parseInt(targetRpe.trim(), 10);
    // Hors 1-10 = saisie invalide, pas une valeur à écrire : le RPE est une échelle fermée.
    const value = Number.isFinite(parsed) && parsed >= 1 && parsed <= 10 ? parsed : null;
    void updateRunningSession(session.id, { targetRpe: value });
    setTargetRpe(value != null ? String(value) : '');
  };

  const [instructions, setInstructions] = useState(session.instructions ?? '');
  const commitInstructions = () => {
    const value = instructions.trim();
    void updateRunningSession(session.id, { instructions: value === '' ? null : value });
  };

  const [adaptation, setAdaptation] = useState(session.adaptationCriterion ?? '');
  const commitAdaptation = () => {
    const value = adaptation.trim();
    void updateRunningSession(session.id, { adaptationCriterion: value === '' ? null : value });
  };

  // Blocs fractionné (US RUN-F2c) — uniquement pour session_type='fractionne' (R5).
  // `addingBlock` ne pilote que l'affichage (bouton grisé) ; la garde contre le double appui est
  // portée par `useActionLock` — deux appuis rapides tombent dans le même cycle de rendu, où
  // l'état vaut encore `false` pour les deux. On créait alors **deux blocs au même `order_index`**,
  // et l'ordre devenait celui que Postgres tranche. Voir le hook.
  const [addingBlock, setAddingBlock] = useState(false);
  const lockAddBlock = useActionLock();
  const onAddBlock = () =>
    void lockAddBlock(async () => {
      setAddingBlock(true);
      try {
        await addIntervalBlock(session.id, { reps: 1 });
      } finally {
        setAddingBlock(false);
      }
    });

  const onRemove = () => {
    Alert.alert(displayName, t('running.program.removeSessionConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('running.program.removeSession'),
        style: 'destructive',
        onPress: () => void removeSession(session.id),
      },
    ]);
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
            const selected = effectiveTargetKind === kind;
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
      {effectiveTargetKind === 'distance' ? (
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
            {t('running.program.targetDistance', { unit: units.distanceSymbol })}
          </Text>
          <TextInput
            style={inputStyle}
            value={effectiveDistanceInput}
            onChangeText={(v) => {
              setDistanceInput(v);
              setTargetError(false);
              saveTargetValue(effectiveTargetKind, v);
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
            value={effectiveDurationInput}
            onChangeText={(v) => {
              setDurationInput(v);
              setTargetError(false);
              saveTargetValue(effectiveTargetKind, v);
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

      {/* Consigne de la séance (US RUN-F4, lots A/G/I) — le cœur de cette US : jusqu'ici une
          séance ne pouvait porter qu'un type et une cible chiffrée, jamais son allure. */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
          {t('running.consigne.targetPace')}
        </Text>
        <View style={styles.paceRow}>
          <TextInput
            style={[inputStyle, styles.paceInput]}
            value={paceMin}
            onChangeText={setPaceMin}
            onBlur={commitPace}
            keyboardType="numbers-and-punctuation"
            placeholder={t('running.consigne.targetPacePlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.consigne.targetPaceMin')}
          />
          <Text style={[styles.paceSeparator, { color: colors.textMuted }]}>–</Text>
          <TextInput
            style={[inputStyle, styles.paceInput]}
            value={paceMax}
            onChangeText={setPaceMax}
            onBlur={commitPace}
            keyboardType="numbers-and-punctuation"
            placeholder={t('running.consigne.targetPacePlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.consigne.targetPaceMax')}
          />
        </View>
      </View>

      {/* Objectif chrono — n'a de sens que pour un test ou une course (lot G). Afficher ce
          champ sur un footing inviterait à confondre « durée à couvrir » et « temps à ne pas
          dépasser », qui sont deux colonnes distinctes et deux intentions opposées. */}
      {isTimedSessionType(sessionType) ? (
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
            {t('running.consigne.targetTime')}
          </Text>
          <TextInput
            style={inputStyle}
            value={targetTime}
            onChangeText={setTargetTime}
            onBlur={commitTargetTime}
            keyboardType="numbers-and-punctuation"
            placeholder={t('running.consigne.targetTimePlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.consigne.targetTime')}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
          {t('running.consigne.targetRpe')}
        </Text>
        <TextInput
          style={inputStyle}
          value={targetRpe}
          onChangeText={setTargetRpe}
          onBlur={commitTargetRpe}
          keyboardType="number-pad"
          placeholder={t('running.consigne.targetRpePlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('running.consigne.targetRpe')}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
          {t('running.consigne.instructions')}
        </Text>
        <TextInput
          style={[inputStyle, styles.multiline]}
          value={instructions}
          onChangeText={setInstructions}
          onBlur={commitInstructions}
          multiline
          placeholder={t('running.consigne.instructionsPlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('running.consigne.instructions')}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
          {t('running.consigne.adaptationCriterion')}
        </Text>
        <TextInput
          style={[inputStyle, styles.multiline]}
          value={adaptation}
          onChangeText={setAdaptation}
          onBlur={commitAdaptation}
          multiline
          placeholder={t('running.consigne.adaptationCriterionPlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('running.consigne.adaptationCriterion')}
        />
      </View>

      {/*
        Structure de la séance (US RUN-F2c, étendue par RUN-F4 lot B).

        ⚠️ **La restriction `sessionType === 'fractionne'` est levée ici.** C'était le verrou qui
        bloquait le plus de séances de l'analyse du 04/09/2026 (6 sur 24) : un footing avec
        lignes droites, une sortie avec tempo inséré, une endurance progressive sont des séances
        d'endurance QUI PORTENT UNE STRUCTURE. Les typer `fractionne` pour leur donner des blocs
        aurait détruit leur nature et faussé toutes les analyses par type.
      */}
      <View style={styles.intervalsSection}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
          {t('running.intervals.title')}
        </Text>
        {session.intervals.length > 0 ? (
          <View style={styles.intervalsList}>
            {session.intervals.map((block, index) => (
              <IntervalBlockEditor key={block.id} block={block} index={index} />
            ))}
          </View>
        ) : null}
        <Button
          label={t('running.intervalsF4.addSegment')}
          variant="ghost"
          onPress={onAddBlock}
          disabled={addingBlock}
        />
      </View>
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
  paceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paceInput: { flex: 1 },
  paceSeparator: { fontSize: 16 },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  intervalsSection: { gap: 10 },
  intervalsList: { gap: 10 },
});
