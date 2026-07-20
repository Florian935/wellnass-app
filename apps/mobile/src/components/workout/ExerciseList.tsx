import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SetType } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import type { Palette } from '@/theme/colors';
import type { WorkoutEntry, WorkoutSetItem } from '@/data/repositories/workout-repository';
import { useUnits } from '@/hooks/useUnits';

/** Types de série portant un badge dans la liste (`normal` n'en a pas). */
const BADGE_TYPES: SetType[] = ['warmup', 'dropset', 'failure', 'duration', 'bodyweight', 'superset'];

type ExerciseListProps = {
  entries: WorkoutEntry[];
  currentExerciseId: string;
  onSelect: (exerciseId: string) => void;
  /** Dé-valide une série déjà validée (sans relancer le repos, spec §2.2). */
  onToggleSetDone: (setId: string, currentDone: boolean) => void;
  /** Retire une série de l'exercice (soft delete). */
  onRemoveSet: (setId: string) => void;
  /** Ajoute une série pré-remplie à la fin de l'exercice. */
  onAddSet: (exerciseId: string) => void;
  /**
   * Réorganise les exercices restants (C3, ↑/↓). Optionnelle : tant que
   * `workout.tsx` (Task 11, hors périmètre C3-Task10) n'appelle pas encore
   * `reorderExercise`, les actions restent masquées (voir `!allDone` ci-dessous).
   */
  onReorder?: (exerciseId: string, direction: 'up' | 'down') => void;
  /** Envoie l'exercice en fin des restants (« Plus tard », machine prise). */
  onSendLater?: (exerciseId: string) => void;
  /** Ouvre le picker de remplacement pour cet exercice. */
  onReplace?: (exerciseId: string) => void;
  /** Note persistante par exercice (map exerciseId → note), affichée en lecture. */
  exerciseNotes?: Record<string, string | null>;
  /**
   * Paires superset de la séance (C3, lien explicite) — map bidirectionnelle
   * `exerciseId → exerciseId du partenaire`. Sert à afficher la liaison dans
   * la liste (visible même replié), résolue via `entries` pour le nom.
   */
  supersetPairs?: Record<string, string>;
  colors: Palette;
};

/** Formate une durée en « m:ss » (série à la durée). */
function formatDurationMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Résumé d'une série pour la liste : « {durée} + lest » pour une série à la
 * durée, sinon « {reps} × {charge} » (`—` pour les valeurs manquantes).
 */
function formatSetLine(set: WorkoutSetItem, units: ReturnType<typeof useUnits>): string {
  if (set.setType === 'duration') {
    const duration = set.durationSeconds == null ? '—' : formatDurationMmSs(set.durationSeconds);
    return set.weightKg == null ? duration : `${duration} · +${units.formatWeight(set.weightKg)}`;
  }
  const repsLabel = set.reps == null ? '—' : String(set.reps);
  return `${repsLabel} × ${units.formatWeight(set.weightKg)}`;
}

/**
 * Liste des exercices de la séance (C1) : un rang par exercice avec sa
 * progression « {faites}/{total} », dépliable pour retrouver la gestion des
 * séries (dé-validation, suppression, ajout). L'exercice courant est mis en
 * avant et déplié par défaut ; tap sur l'en-tête = saut de focus + dépli.
 */
export function ExerciseList({
  entries,
  currentExerciseId,
  onSelect,
  onToggleSetDone,
  onRemoveSet,
  onAddSet,
  onReorder,
  onSendLater,
  onReplace,
  exerciseNotes,
  supersetPairs,
  colors,
}: ExerciseListProps) {
  const { t } = useTranslation();
  const units = useUnits();
  // Les actions de réorganisation (flèches, « Plus tard », « Remplacer ») ne sont
  // câblées qu'à partir de Task 11 (workout.tsx) : tant que le parent ne les
  // fournit pas, on les masque plutôt que d'afficher des boutons inertes.
  const actionsWired = Boolean(onReorder && onSendLater && onReplace);
  // Dépli par défaut = exercice courant ; un tap sur l'en-tête pose une
  // dérogation explicite (déplié/replié), sans effet ni resynchronisation :
  // quand le focus change, le nouvel exercice courant retombe sur le défaut
  // (déplié) tant qu'aucune dérogation n'a été posée pour lui.
  const [manualOverride, setManualOverride] = useState<Record<string, boolean>>({});

  const isExpandedFor = (exerciseId: string): boolean =>
    manualOverride[exerciseId] ?? exerciseId === currentExerciseId;

  const toggleExpanded = (exerciseId: string) => {
    setManualOverride((prev) => ({ ...prev, [exerciseId]: !isExpandedFor(exerciseId) }));
  };

  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const total = entry.sets.length;
        const doneCount = entry.sets.filter((set) => set.done).length;
        const allDone = total > 0 && doneCount === total;
        const isCurrent = entry.exerciseId === currentExerciseId;
        const isExpanded = isExpandedFor(entry.exerciseId);
        const exerciseNote = exerciseNotes?.[entry.exerciseId];
        const partnerExerciseId = supersetPairs?.[entry.exerciseId];
        const partnerName = partnerExerciseId
          ? entries.find((e) => e.exerciseId === partnerExerciseId)?.exerciseName
          : undefined;

        return (
          <View
            key={entry.exerciseId}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: isCurrent ? colors.accent : colors.border,
              },
              isCurrent && styles.cardCurrent,
              allDone && !isCurrent && styles.cardDone,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isExpanded }}
              onPress={() => {
                onSelect(entry.exerciseId);
                toggleExpanded(entry.exerciseId);
              }}
              style={({ pressed }) => [styles.header, pressed && styles.pressed]}
            >
              <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
                {entry.exerciseName}
              </Text>
              <View style={styles.trailing}>
                <Text style={[styles.count, { color: colors.textMuted }]}>{`${doneCount}/${total}`}</Text>
                {allDone ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </View>
            </Pressable>

            {/* Note d'exercice (C3) : lecture seule, visible même replié. */}
            {exerciseNote ? (
              <Text numberOfLines={1} style={[styles.note, { color: colors.textMuted }]}>
                {`📝 ${exerciseNote}`}
              </Text>
            ) : null}

            {/* Liaison superset (C3, lien explicite) : visible même replié. */}
            {partnerName ? (
              <Text numberOfLines={1} style={[styles.supersetTag, { color: colors.accent }]}>
                {`🔗 ${t('workout.superset.linked', { name: partnerName })}`}
              </Text>
            ) : null}

            {/* Réorganiser / Plus tard / Remplacer (C3) : visibles même repliées,
                seulement tant que l'exercice n'est pas entièrement validé — un
                exercice terminé garde sa position et n'affiche aucune action. */}
            {!allDone && actionsWired ? (
              <View style={[styles.actions, { borderTopColor: colors.border }]}>
                <View style={styles.arrows}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('workout.reorder.up')}
                    hitSlop={6}
                    onPress={() => onReorder?.(entry.exerciseId, 'up')}
                    style={({ pressed }) => [
                      styles.arrowBtn,
                      { backgroundColor: colors.surfaceAlt },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="chevron-up" size={14} color={colors.accent} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('workout.reorder.down')}
                    hitSlop={6}
                    onPress={() => onReorder?.(entry.exerciseId, 'down')}
                    style={({ pressed }) => [
                      styles.arrowBtn,
                      { backgroundColor: colors.surfaceAlt },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="chevron-down" size={14} color={colors.accent} />
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onSendLater?.(entry.exerciseId)}
                  style={({ pressed }) => [
                    styles.actBtn,
                    { backgroundColor: colors.surfaceAlt },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.actBtnText, { color: colors.accent }]}>{t('workout.later')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onReplace?.(entry.exerciseId)}
                  style={({ pressed }) => [styles.actBtnGhost, { borderColor: colors.border }, pressed && styles.pressed]}
                >
                  <Text style={[styles.actBtnGhostText, { color: colors.textMuted }]}>{t('workout.replace')}</Text>
                </Pressable>
              </View>
            ) : null}

            {isExpanded ? (
              <View style={styles.sets}>
                {entry.sets.map((set, index) => (
                  <View key={set.id} style={styles.setRow}>
                    <Text style={[styles.setLabel, { color: colors.textMuted }]}>
                      {`${t('workout.set')} ${index + 1}`}
                    </Text>
                    {BADGE_TYPES.includes(set.setType) ? (
                      <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
                        <Text style={[styles.badgeText, { color: colors.textMuted }]}>
                          {t(`workout.setTypeBadge.${set.setType}`)}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={[styles.setValue, { color: colors.text }]}>{formatSetLine(set, units)}</Text>
                    {set.rpe != null ? (
                      <Text style={[styles.setRpe, { color: colors.textMuted }]}>
                        {t('workout.rpeValue', { value: set.rpe })}
                      </Text>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('workout.unvalidateSet')}
                      disabled={!set.done}
                      hitSlop={8}
                      onPress={() => onToggleSetDone(set.id, set.done)}
                      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                    >
                      <Ionicons
                        name={set.done ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={set.done ? colors.success : colors.textMuted}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('workout.removeSet')}
                      hitSlop={8}
                      onPress={() => onRemoveSet(set.id)}
                      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                    >
                      <Ionicons name="remove-circle-outline" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => onAddSet(entry.exerciseId)}
                  style={({ pressed }) => [styles.addSetRow, pressed && styles.pressed]}
                >
                  <Text style={[styles.addSetLabel, { color: colors.accent }]}>{t('workout.addSet')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
  },
  cardCurrent: { borderWidth: 2 },
  cardDone: { opacity: 0.5 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  name: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 15 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  note: {
    fontFamily: fontFamily.body,
    fontStyle: 'italic',
    fontSize: 11,
    paddingHorizontal: 16,
    marginTop: -6,
    marginBottom: 6,
  },
  supersetTag: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    paddingHorizontal: 16,
    marginTop: -6,
    marginBottom: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 9,
    borderTopWidth: 1,
  },
  arrows: { flexDirection: 'column', gap: 2 },
  arrowBtn: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, alignItems: 'center' },
  actBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actBtnText: { fontFamily: fontFamily.bodyBold, fontSize: 11.5 },
  actBtnGhost: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  actBtnGhostText: { fontFamily: fontFamily.bodyBold, fontSize: 11.5 },
  sets: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setLabel: { fontFamily: fontFamily.body, fontSize: 13, width: 64 },
  setValue: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontFamily: fontFamily.bodyBold, fontSize: 10, letterSpacing: 0.3 },
  setRpe: { fontFamily: fontFamily.monoBold, fontSize: 11 },
  iconBtn: { padding: 2 },
  addSetRow: { paddingTop: 4, paddingBottom: 2 },
  addSetLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  pressed: { opacity: 0.7 },
});
