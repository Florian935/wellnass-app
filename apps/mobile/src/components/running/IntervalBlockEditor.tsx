import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hasRunningSessionTarget } from '@wellness/shared';
import {
  removeIntervalBlock,
  updateIntervalBlock,
  type IntervalBlockItem,
} from '@/data/repositories/program-repository';
import { toPositiveInt, numToStr } from '@/components/exercise/ExerciseTargetsFields';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type IntervalBlockEditorProps = {
  block: IntervalBlockItem;
  index: number;
};

type PhaseKind = 'distance' | 'duration';
type RecoveryKind = 'none' | PhaseKind;

/**
 * Ligne d'édition d'un bloc fractionné (US RUN-F2c) : répétitions, phase rapide
 * (distance en m OU durée en min, R2), % VMA optionnel (R4), récupération
 * entièrement optionnelle (R3). Commit au blur / au changement de toggle via
 * `updateIntervalBlock`, suppression via `removeIntervalBlock` — même patron
 * commit-on-blur que `ExercisePlanEditor`/`RunningSessionEditor`.
 *
 * Distances en mètres bruts (pas de conversion impériale) : un fractionné se
 * décrit universellement en mètres (« 400 m », convention piste), contrairement
 * à la distance totale d'une séance.
 */
export function IntervalBlockEditor({ block, index }: IntervalBlockEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Répétitions (toujours >= 1, R1) — jamais écrit null (non nullable en base).
  const [reps, setReps] = useState(numToStr(block.reps));

  const commitReps = () => {
    const n = toPositiveInt(reps);
    if (n !== null) {
      void updateIntervalBlock(block.id, { reps: n });
    } else {
      setReps(numToStr(block.reps));
    }
  };

  // Phase rapide — toggle distance/durée (R2 : exactement une des deux).
  const [fastKind, setFastKind] = useState<PhaseKind | null>(null);
  const effectiveFastKind: PhaseKind =
    fastKind ?? (block.fastDurationSeconds != null && block.fastDistanceM == null ? 'duration' : 'distance');

  const [fastDistance, setFastDistance] = useState(numToStr(block.fastDistanceM));
  const [fastDurationMin, setFastDurationMin] = useState(
    block.fastDurationSeconds != null ? String(block.fastDurationSeconds / 60) : '',
  );
  const [fastError, setFastError] = useState(false);

  const commitFast = () => {
    let fastDistanceM: number | null = null;
    let fastDurationSeconds: number | null = null;

    if (effectiveFastKind === 'distance') {
      fastDistanceM = toPositiveInt(fastDistance);
    } else {
      const minutes = parseFloat(fastDurationMin.trim());
      fastDurationSeconds = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
    }

    if (!hasRunningSessionTarget(fastDistanceM, fastDurationSeconds)) {
      setFastError(true);
      return;
    }
    setFastError(false);
    void updateIntervalBlock(block.id, { fastDistanceM, fastDurationSeconds });
  };

  // % VMA — nullable, jamais de valeur inventée (R4).
  const [pctVma, setPctVma] = useState(numToStr(block.fastPacePctVma));
  const commitPctVma = () => {
    void updateIntervalBlock(block.id, { fastPacePctVma: toPositiveInt(pctVma) });
  };

  // Récupération — entièrement optionnelle (R3) : aucune / distance / durée.
  const [recoveryKind, setRecoveryKind] = useState<RecoveryKind | null>(null);
  const effectiveRecoveryKind: RecoveryKind =
    recoveryKind ??
    (block.recoveryDistanceM != null
      ? 'distance'
      : block.recoveryDurationSeconds != null
        ? 'duration'
        : 'none');

  const [recoveryDistance, setRecoveryDistance] = useState(numToStr(block.recoveryDistanceM));
  const [recoveryDurationMin, setRecoveryDurationMin] = useState(
    block.recoveryDurationSeconds != null ? String(block.recoveryDurationSeconds / 60) : '',
  );

  const selectRecoveryKind = (kind: RecoveryKind) => {
    setRecoveryKind(kind);
    if (kind === 'none') {
      void updateIntervalBlock(block.id, { recoveryDistanceM: null, recoveryDurationSeconds: null });
    }
  };

  const commitRecovery = () => {
    if (effectiveRecoveryKind === 'none') return;
    if (effectiveRecoveryKind === 'distance') {
      const distanceM = toPositiveInt(recoveryDistance);
      if (distanceM !== null) {
        void updateIntervalBlock(block.id, { recoveryDistanceM: distanceM, recoveryDurationSeconds: null });
      }
    } else {
      const minutes = parseFloat(recoveryDurationMin.trim());
      if (Number.isFinite(minutes) && minutes > 0) {
        void updateIntervalBlock(block.id, {
          recoveryDurationSeconds: Math.round(minutes * 60),
          recoveryDistanceM: null,
        });
      }
    }
  };

  const onRemove = () => {
    void removeIntervalBlock(block.id);
  };

  const fieldStyle = [
    styles.input,
    { backgroundColor: colors.background, borderColor: colors.borderStrong, color: colors.text },
  ];
  const fastFieldStyle = [
    styles.input,
    {
      backgroundColor: colors.background,
      borderColor: fastError ? '#d9534f' : colors.borderStrong,
      color: colors.text,
    },
  ];

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('running.intervals.blockTitle', { index: index + 1 })}
        </Text>
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('running.intervals.removeBlockA11y', { index: index + 1 })}
        >
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('running.intervals.reps')}</Text>
        {/* `accessibilityLabel` sur chaque champ : le libellé visible est un `Text` frère, que
            TalkBack n'associe pas au champ. Sans lui, les quatre saisies de ce bloc sont annoncées
            « champ de saisie », sans distinction — sur un formulaire entièrement numérique, c'est
            inutilisable au lecteur d'écran (US CONF-07). Aucune clé nouvelle : on réutilise le
            libellé affiché. */}
        <TextInput
          style={fieldStyle}
          value={reps}
          onChangeText={setReps}
          onBlur={commitReps}
          keyboardType="number-pad"
          accessibilityLabel={t('running.intervals.reps')}
        />
      </View>

      {/* Phase rapide */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('running.intervals.fastPhase')}</Text>
        <View style={[styles.toggle, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {(['distance', 'duration'] as const).map((kind) => {
            const selected = effectiveFastKind === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => {
                  setFastKind(kind);
                  setFastError(false);
                }}
                style={[styles.toggleItem, selected && { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.toggleLabel, { color: selected ? colors.accentText : colors.text }]}>
                  {kind === 'distance'
                    ? t('running.intervals.distanceM')
                    : t('running.intervals.durationMin')}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {effectiveFastKind === 'distance' ? (
          <TextInput
            style={fastFieldStyle}
            value={fastDistance}
            onChangeText={setFastDistance}
            onBlur={commitFast}
            keyboardType="number-pad"
            placeholder={t('running.intervals.distanceMPlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.intervals.fastPhase')}
          />
        ) : (
          <TextInput
            style={fastFieldStyle}
            value={fastDurationMin}
            onChangeText={setFastDurationMin}
            onBlur={commitFast}
            keyboardType="decimal-pad"
            placeholder={t('running.intervals.durationMinPlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.intervals.fastPhase')}
          />
        )}
        {fastError ? (
          <Text style={[styles.errorText, { color: '#d9534f' }]}>
            {t('running.intervals.fastRequired')}
          </Text>
        ) : null}
      </View>

      {/* % VMA (optionnel) */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('running.intervals.pctVma')}</Text>
        <TextInput
          style={fieldStyle}
          value={pctVma}
          onChangeText={setPctVma}
          onBlur={commitPctVma}
          keyboardType="number-pad"
          placeholder={t('running.intervals.pctVmaPlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('running.intervals.pctVma')}
        />
      </View>

      {/* Récupération (optionnelle) */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('running.intervals.recoveryPhase')}</Text>
        <View style={[styles.toggle, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {(['none', 'distance', 'duration'] as const).map((kind) => {
            const selected = effectiveRecoveryKind === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => selectRecoveryKind(kind)}
                style={[styles.toggleItem, selected && { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.toggleLabel, { color: selected ? colors.accentText : colors.text }]}>
                  {kind === 'none'
                    ? t('running.intervals.recoveryNone')
                    : kind === 'distance'
                      ? t('running.intervals.distanceM')
                      : t('running.intervals.durationMin')}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {effectiveRecoveryKind === 'distance' ? (
          <TextInput
            style={fieldStyle}
            value={recoveryDistance}
            onChangeText={setRecoveryDistance}
            onBlur={commitRecovery}
            keyboardType="number-pad"
            placeholder={t('running.intervals.distanceMPlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.intervals.recoveryPhase')}
          />
        ) : effectiveRecoveryKind === 'duration' ? (
          <TextInput
            style={fieldStyle}
            value={recoveryDurationMin}
            onChangeText={setRecoveryDurationMin}
            onBlur={commitRecovery}
            keyboardType="decimal-pad"
            placeholder={t('running.intervals.durationMinPlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.intervals.recoveryPhase')}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 15 },
  field: { gap: 6 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  input: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  toggleItem: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
  },
  toggleLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
  },
});
