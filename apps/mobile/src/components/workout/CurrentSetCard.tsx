/**
 * Carte de **contexte** de la série en cours — US MUSCU-UX01 (10/09/2026).
 *
 * ── Ce que cette carte était, et pourquoi elle a changé de rôle ──────────────────────────────────
 * Elle portait tout : le contexte **et** la saisie **et** la validation. Onze blocs empilés, ~560 px
 * au niveau détaillé, sur un écran utile de 700 à 760. Conséquence : « Valider la série » — le geste
 * répété 30 à 40 fois par séance — se retrouvait en bas, sous le pli, et sous le clavier dès qu'on
 * saisissait les reps.
 *
 * La saisie et la validation sont parties dans `SetActionBar`, **fixée en bas de l'écran**. Cette
 * carte ne garde que ce qui informe : ce qu'on a déjà fait sur cet exercice, ce qu'on avait fait la
 * dernière fois, ce que l'app suggère, et les réglages fins de la série.
 *
 * ── Règle R4-1 : c'est ICI que le niveau d'affichage agit, et nulle part ailleurs ────────────────
 * `simplified` / `normal` / `detailed` pilotent cette carte. La barre du bas est identique aux trois
 * niveaux — c'est ce qui rend le changement de niveau sans risque, et donc ce qui permet de le
 * proposer depuis la séance elle-même (`SessionMenuSheet`).
 *
 * Les suppléments du niveau `detailed` (type de série, RPE, note, superset) sont regroupés derrière
 * **un seul repli** plutôt qu'empilés : ils servent à quelques séries par séance, pas à toutes.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SetType, WorkoutDisplayLevel } from '@wellness/shared';
import { workoutFieldVisibility } from '@wellness/shared';
import { SetOptions } from '@/components/workout/SetOptions';
import { fontFamily } from '@/theme/fonts';
import type { Palette } from '@/theme/colors';

/** État de la liaison superset de la série courante, dérivé par le parent. */
export type SupersetLinkState =
  | { status: 'linkable' }
  | { status: 'linked'; partnerName: string }
  | { status: 'orphaned' }
  | null;

/** Une série de l'exercice courant, telle que la frise la représente. */
export type SetChip = {
  id: string;
  done: boolean;
  /** Résumé court d'une série faite (« 80×8 »), `null` si pas encore validée. */
  label: string | null;
};

type Props = {
  exerciseName: string;
  /** Séries de l'exercice courant, dans l'ordre — la frise en haut de carte. */
  sets: SetChip[];
  /** Rang (0-based) de la série en cours dans `sets`. */
  currentRang: number;
  /** Repos de l'exercice, en secondes — affiché en lecture ; le réglage vit ailleurs. */
  restSeconds: number;
  lastPerfLabel: string | null;
  suggestionLabel?: string | null;
  /** Consigne du plan (charge prévue, déjà formatée) ; visible à tous les niveaux. */
  plannedLabel?: string | null;
  /** Écart réalisé / prévu, déjà formaté et signé ; `null` si non calculable. */
  deltaLabel?: string | null;
  deltaPositive?: boolean;
  setType: SetType;
  onSetType: (type: SetType) => void;
  rpe: number | null;
  onSetRpe: (rpe: number | null) => void;
  note?: string | null;
  onChangeNote?: (value: string) => void;
  onBlurNote?: () => void;
  supersetLink?: SupersetLinkState;
  onRequestLinkSuperset?: () => void;
  onUnlinkSuperset?: () => void;
  onAddSet: () => void;
  level: WorkoutDisplayLevel;
  colors: Palette;
};

export function CurrentSetCard({
  exerciseName,
  sets,
  currentRang,
  restSeconds,
  lastPerfLabel,
  suggestionLabel,
  plannedLabel,
  deltaLabel,
  deltaPositive = true,
  setType,
  onSetType,
  rpe,
  onSetRpe,
  note,
  onChangeNote,
  onBlurNote,
  supersetLink,
  onRequestLinkSuperset,
  onUnlinkSuperset,
  onAddSet,
  level,
  colors,
}: Props) {
  const { t } = useTranslation();
  const vis = workoutFieldVisibility(level);

  const warmupActive = setType === 'warmup';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* En-tête : l'exercice, et son repos en lecture seule */}
      <View style={styles.headRow}>
        <Text style={[styles.exName, { color: colors.text }]} numberOfLines={2}>
          {exerciseName}
        </Text>
        <View style={[styles.restChip, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="timer-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.restValue, { color: colors.textMuted }]}>
            {t('workout.restSeconds', { count: restSeconds })}
          </Text>
        </View>
      </View>

      {/* Frise des séries : ce qui est fait, où on en est, ce qui reste. Remplace le « Série 2/4 »
          qui disait le rang sans jamais montrer les charges déjà posées. */}
      <View style={styles.chips}>
        {sets.map((set, index) => {
          const isCurrent = index === currentRang;
          if (set.done) {
            return (
              <View
                key={set.id}
                style={[styles.chipDone, { backgroundColor: `${colors.success}24` }]}
              >
                <Ionicons name="checkmark" size={12} color={colors.success} />
                <Text style={[styles.chipDoneText, { color: colors.success }]}>
                  {set.label ?? '—'}
                </Text>
              </View>
            );
          }
          return (
            <View
              key={set.id}
              style={[
                isCurrent ? styles.chipCurrent : styles.chipTodo,
                isCurrent
                  ? { borderColor: colors.accent }
                  : { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isCurrent ? colors.accent : colors.textMuted },
                ]}
              >
                {isCurrent
                  ? t('workout.setProgress', { current: index + 1, total: sets.length })
                  : String(index + 1)}
              </Text>
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.addSet')}
          onPress={onAddSet}
          hitSlop={8}
          style={({ pressed }) => [styles.chipAdd, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={15} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Repères : dernière fois, consigne du plan, suggestion */}
      {lastPerfLabel || plannedLabel || (vis.suggestion && suggestionLabel) ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.refs}>
            {lastPerfLabel ? (
              <View style={styles.refRow}>
                <Text style={[styles.refLabel, { color: colors.textMuted }]}>
                  {t('workout.lastTimeShort')}
                </Text>
                <Text style={[styles.refValue, { color: colors.text }]}>{lastPerfLabel}</Text>
              </View>
            ) : null}
            {plannedLabel ? (
              <View style={styles.refRow}>
                <Text style={[styles.refLabel, { color: colors.textMuted }]}>
                  {t('workout.plannedShort')}
                </Text>
                <Text style={[styles.refValue, { color: colors.text }]}>{plannedLabel}</Text>
                {vis.delta && deltaLabel ? (
                  <Text
                    style={[
                      styles.delta,
                      {
                        color: deltaPositive ? colors.success : colors.accent,
                        backgroundColor: colors.surfaceAlt,
                      },
                    ]}
                  >
                    {deltaLabel}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {vis.suggestion && suggestionLabel ? (
              <View style={styles.refRow}>
                <Text style={[styles.refLabel, { color: colors.textMuted }]}>
                  {t('workout.suggestionShort')}
                </Text>
                <Text style={[styles.refSuggestion, { color: colors.success }]}>
                  {suggestionLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {/* Raccourci échauffement : visible dès `normal`, hors du repli — c'est le seul supplément
          qu'on active en cours de série, avant même de saisir. */}
      {vis.warmupShortcut ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: warmupActive }}
          onPress={() => onSetType(warmupActive ? 'normal' : 'warmup')}
          style={({ pressed }) => [
            styles.warmupChip,
            {
              backgroundColor: warmupActive ? colors.accent : colors.surfaceAlt,
            },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="flame-outline"
            size={14}
            color={warmupActive ? colors.accentText : colors.textMuted}
          />
          <Text
            style={[
              styles.warmupLabel,
              { color: warmupActive ? colors.accentText : colors.textMuted },
            ]}
          >
            {t('workout.warmupToggle')}
          </Text>
        </Pressable>
      ) : null}

      {/* Suppléments du niveau détaillé — extraits dans `SetOptions` (US MUSCU-UX03), pour que le
          mode immersif affiche **exactement** les mêmes contrôles sans les redessiner. */}
      <SetOptions
        level={level}
        setType={setType}
        onSetType={onSetType}
        rpe={rpe}
        onSetRpe={onSetRpe}
        note={note}
        onChangeNote={onChangeNote}
        onBlurNote={onBlurNote}
        supersetLink={supersetLink}
        onRequestLinkSuperset={onRequestLinkSuperset}
        onUnlinkSuperset={onUnlinkSuperset}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  exName: {
    flex: 1,
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  restChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  restValue: { fontFamily: fontFamily.monoBold, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  chipDone: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  chipDoneText: { fontFamily: fontFamily.monoBold, fontSize: 12 },
  chipCurrent: { borderWidth: 1.5, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5 },
  chipTodo: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontFamily: fontFamily.monoBold, fontSize: 12 },
  chipAdd: { paddingHorizontal: 6, paddingVertical: 6 },
  divider: { height: 1 },
  refs: { gap: 6 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refLabel: { width: 82, flexShrink: 0, fontFamily: fontFamily.body, fontSize: 12 },
  refValue: { fontFamily: fontFamily.mono, fontSize: 13 },
  refSuggestion: { fontFamily: fontFamily.bodySemi, fontSize: 13, flexShrink: 1 },
  delta: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  warmupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  warmupLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  pressed: { opacity: 0.8 },
});
