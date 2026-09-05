import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  RECOVERY_KINDS,
  SEGMENT_KINDS,
  formatMmSs,
  hasRunningSessionTarget,
  parseMmSs,
  type RecoveryKind as RecoveryIntensity,
  type SegmentKind,
} from '@wellness/shared';
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

  // ---- US RUN-F4 : nature, allure absolue, chrono cible, récup, groupe ----

  const [kind, setKind] = useState<SegmentKind>(block.kind);
  const commitKind = (next: SegmentKind) => {
    setKind(next);
    void updateIntervalBlock(block.id, { kind: next });
  };

  const [fastPaceMin, setFastPaceMin] = useState(formatMmSs(block.fastPaceMinSPerKm));
  const [fastPaceMax, setFastPaceMax] = useState(formatMmSs(block.fastPaceMaxSPerKm));
  const commitFastPace = () => {
    const min = parseMmSs(fastPaceMin);
    const max = parseMmSs(fastPaceMax);
    void updateIntervalBlock(block.id, {
      fastPaceMinSPerKm: min,
      fastPaceMaxSPerKm: max,
    });
    // On repose la valeur normalisée : une saisie illisible ne doit pas rester à l'écran comme
    // si elle avait été enregistrée.
    setFastPaceMin(formatMmSs(min));
    setFastPaceMax(formatMmSs(max));
  };

  const [targetTimeMin, setTargetTimeMin] = useState(formatMmSs(block.fastTargetTimeMinSeconds));
  const [targetTimeMax, setTargetTimeMax] = useState(formatMmSs(block.fastTargetTimeMaxSeconds));
  const commitTargetTime = () => {
    const min = parseMmSs(targetTimeMin);
    const max = parseMmSs(targetTimeMax);
    void updateIntervalBlock(block.id, {
      fastTargetTimeMinSeconds: min,
      fastTargetTimeMaxSeconds: max,
    });
    setTargetTimeMin(formatMmSs(min));
    setTargetTimeMax(formatMmSs(max));
  };

  const [recoveryIntensity, setRecoveryIntensity] = useState<RecoveryIntensity | null>(
    block.recoveryKind,
  );
  const commitRecoveryIntensity = (next: RecoveryIntensity | null) => {
    // Re-toucher la puce déjà choisie l'efface : c'est un champ facultatif, il doit pouvoir
    // redevenir vide sans passer par une puce « aucune » de plus.
    setRecoveryIntensity(next);
    void updateIntervalBlock(block.id, { recoveryKind: next });
  };

  const [groupKey, setGroupKey] = useState(block.groupKey ?? '');
  const [groupReps, setGroupReps] = useState(numToStr(block.groupReps));
  const commitGroup = () => {
    const key = groupKey.trim();
    const reps = toPositiveInt(groupReps);
    // Sans clé, la notion de répétition de groupe n'a aucun sens : on efface les deux ensemble
    // plutôt que de laisser un `groupReps` orphelin que le moteur ignorerait en silence.
    void updateIntervalBlock(block.id, {
      groupKey: key === '' ? null : key,
      groupReps: key === '' ? null : reps,
    });
    if (key === '') setGroupReps('');
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
          {t('running.intervalsF4.segmentTitle', { index: index + 1 })}
        </Text>
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('running.intervalsF4.removeSegmentA11y', { index: index + 1 })}
        >
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Nature du segment (US RUN-F4, lot B) — c'est elle qui permet enfin d'écrire un
          échauffement et un retour au calme, prescrits par 24 séances sur 24 du plan analysé et
          représentables par aucune jusqu'ici. */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {t('running.intervalsF4.kind')}
        </Text>
        <View style={styles.chipGrid}>
          {SEGMENT_KINDS.map((k) => {
            const selected = kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => commitKind(k)}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  selected && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[styles.chipLabel, { color: selected ? colors.accentText : colors.text }]}
                >
                  {t(`running.segmentKind.${k}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
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

      {/* Allure ABSOLUE de la fraction (US RUN-F4, lot A) — prioritaire sur le %VMA ci-dessus,
          qui reste comme repli. Les deux coexistent : le %VMA est la seule source des séances
          déjà saisies, et un profil sans allure de référence ne pourrait pas le convertir. */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {t('running.intervalsF4.fastPace')}
        </Text>
        <View style={styles.rangeRow}>
          <TextInput
            style={[fieldStyle, styles.rangeInput]}
            value={fastPaceMin}
            onChangeText={setFastPaceMin}
            onBlur={commitFastPace}
            keyboardType="numbers-and-punctuation"
            placeholder={t('running.consigne.targetPacePlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.consigne.targetPaceMin')}
          />
          <Text style={[styles.label, { color: colors.textMuted }]}>–</Text>
          <TextInput
            style={[fieldStyle, styles.rangeInput]}
            value={fastPaceMax}
            onChangeText={setFastPaceMax}
            onBlur={commitFastPace}
            keyboardType="numbers-and-punctuation"
            placeholder={t('running.consigne.targetPacePlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.consigne.targetPaceMax')}
          />
        </View>
      </View>

      {/* Chrono cible de la fraction (lot C) — « 400 m en 1:38 ». Distinct de l'étendue : la
          distance ci-dessus borne la phase, ce champ est la cible à tenir dedans. */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {t('running.intervalsF4.fastTargetTime')}
        </Text>
        <View style={styles.rangeRow}>
          <TextInput
            style={[fieldStyle, styles.rangeInput]}
            value={targetTimeMin}
            onChangeText={setTargetTimeMin}
            onBlur={commitTargetTime}
            keyboardType="numbers-and-punctuation"
            placeholder={t('running.intervalsF4.fastTargetTimePlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.intervalsF4.fastTargetTime')}
          />
          <Text style={[styles.label, { color: colors.textMuted }]}>–</Text>
          <TextInput
            style={[fieldStyle, styles.rangeInput]}
            value={targetTimeMax}
            onChangeText={setTargetTimeMax}
            onBlur={commitTargetTime}
            keyboardType="numbers-and-punctuation"
            placeholder={t('running.intervalsF4.fastTargetTimePlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.intervalsF4.fastTargetTime')}
          />
        </View>
      </View>

      {/* Nature de la récupération (lot A) — « trot très lent » ≠ « marche active », distinction
          que le plan analysé fait systématiquement et que le modèle ne portait pas. */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {t('running.intervalsF4.recoveryKindLabel')}
        </Text>
        <View style={styles.chipGrid}>
          {RECOVERY_KINDS.map((k) => {
            const selected = recoveryIntensity === k;
            return (
              <Pressable
                key={k}
                onPress={() => commitRecoveryIntensity(selected ? null : k)}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  selected && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[styles.chipLabel, { color: selected ? colors.accentText : colors.text }]}
                >
                  {t(`running.recoveryKind.${k}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Groupe répété (lot D) — « 3 × (800 m + 400 m) ». Deux segments qui se suivent avec la
          même clé sont répétés ensemble. */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {t('running.intervalsF4.group')}
        </Text>
        <View style={styles.rangeRow}>
          <TextInput
            style={[fieldStyle, styles.rangeInput]}
            value={groupKey}
            onChangeText={setGroupKey}
            onBlur={commitGroup}
            placeholder={t('running.intervalsF4.groupNone')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.intervalsF4.group')}
          />
          <TextInput
            style={[fieldStyle, styles.rangeInput]}
            value={groupReps}
            onChangeText={setGroupReps}
            onBlur={commitGroup}
            keyboardType="number-pad"
            placeholder={t('running.intervalsF4.groupReps')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('running.intervalsF4.groupReps')}
          />
        </View>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('running.intervalsF4.groupHint')}
        </Text>
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
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeInput: { flex: 1 },
  hint: { fontFamily: fontFamily.body, fontSize: 11, lineHeight: 15 },
});
