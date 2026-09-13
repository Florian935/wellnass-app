/**
 * Les **options de la série** — type, intensité, note, superset — derrière un repli unique.
 *
 * ── Pourquoi ce fichier existe (US MUSCU-UX03) ──────────────────────────────────────────────────
 * Ce bloc vivait dans `CurrentSetCard` (mode classique). Le mode immersif a besoin **exactement du
 * même** : mêmes contrôles, mêmes libellés, même règle de visibilité par niveau. Le dupliquer aurait
 * garanti une divergence à la première évolution (un type de série ajouté d'un côté seulement).
 * Il est donc extrait tel quel, et les deux modes l'appellent.
 *
 * Comportement inchangé par rapport à MUSC-F13 / MUSCU-UX01 : quel supplément apparaît à quel niveau
 * reste porté par `workoutFieldVisibility`, le repli est fermé par défaut (ces réglages servent à
 * quelques séries par séance), et retaper une valeur d'intensité déjà posée l'efface.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { workoutFieldVisibility, type SetType, type WorkoutDisplayLevel } from '@wellness/shared';
import { useIntensity } from '@/hooks/useIntensity';
import { fontFamily } from '@/theme/fonts';
import type { Palette } from '@/theme/colors';
import type { SupersetLinkState } from '@/components/workout/CurrentSetCard';

/**
 * Types de série proposés. `warmup` a son propre raccourci (visible dès `normal`) et `superset`
 * n'est plus un type à basculer depuis la recette du 20/07/2026 : la liaison passe par une action
 * qui nomme le partenaire.
 */
const TYPE_CHIPS: SetType[] = ['normal', 'dropset', 'failure', 'duration', 'bodyweight'];

type Props = {
  level: WorkoutDisplayLevel;
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
  colors: Palette;
};

export function SetOptions({
  level,
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
  colors,
}: Props) {
  const { t } = useTranslation();
  const intensity = useIntensity();
  const vis = workoutFieldVisibility(level);
  const [open, setOpen] = useState(false);

  const hasExtras = vis.typeSelector || vis.rpe || vis.note || vis.superset;
  if (!hasExtras) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [
          styles.extrasToggle,
          { borderColor: colors.border },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="options-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.extrasLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {t('workout.extras.title')}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>

      {open ? (
        <View style={styles.extras}>
          {vis.typeSelector ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.typeRow}
            >
              {TYPE_CHIPS.map((type) => {
                const active = setType === type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => onSetType(type)}
                    style={({ pressed }) => [
                      styles.typeChip,
                      { backgroundColor: active ? colors.accent : colors.surfaceAlt },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: active ? colors.accentText : colors.textMuted },
                      ]}
                    >
                      {t(`workout.setType.${type}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {vis.rpe ? (
            <View style={styles.rpeBlock}>
              <Text style={[styles.extrasFieldLabel, { color: colors.textMuted }]}>
                {t('workout.rpeLabel', { scale: intensity.label })}
              </Text>
              <View style={styles.rpePills}>
                {intensity.choices.map((n) => {
                  const active = intensity.toDisplay(rpe) === n;
                  return (
                    <Pressable
                      key={n}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={t('intensity.a11yChoice', {
                        scale: intensity.label,
                        value: n,
                      })}
                      // Retaper la valeur déjà posée l'efface : c'est la seule façon de
                      // revenir en arrière sans un bouton « effacer » de plus.
                      onPress={() => onSetRpe(active ? null : intensity.toStored(n))}
                      style={({ pressed }) => [
                        styles.rpePill,
                        {
                          backgroundColor: active ? colors.accent : colors.surface,
                          borderColor: active ? colors.accent : colors.border,
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rpePillText,
                          { color: active ? colors.accentText : colors.textMuted },
                        ]}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {vis.note && note !== undefined ? (
            <View style={[styles.noteRow, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="create-outline" size={14} color={colors.textMuted} />
              <TextInput
                value={note ?? ''}
                onChangeText={onChangeNote}
                onBlur={onBlurNote}
                placeholder={t('workout.exerciseNote.placeholder')}
                placeholderTextColor={colors.textMuted}
                style={[styles.noteInput, { color: colors.text }]}
              />
            </View>
          ) : null}

          {vis.superset && supersetLink ? (
            <View style={styles.supersetRow}>
              {supersetLink.status === 'linkable' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onRequestLinkSuperset}
                  style={({ pressed }) => [
                    styles.supersetBtn,
                    { borderColor: colors.accent },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="link-outline" size={14} color={colors.accent} />
                  <Text style={[styles.supersetText, { color: colors.accent }]}>
                    {t('workout.superset.link')}
                  </Text>
                </Pressable>
              ) : (
                <>
                  <Ionicons
                    name={supersetLink.status === 'linked' ? 'link-outline' : 'warning-outline'}
                    size={14}
                    color={colors.accent}
                  />
                  <Text style={[styles.supersetText, { color: colors.accent, flex: 1 }]}>
                    {supersetLink.status === 'linked'
                      ? t('workout.superset.linked', { name: supersetLink.partnerName })
                      : t('workout.superset.orphaned')}
                  </Text>
                  <Pressable accessibilityRole="button" hitSlop={6} onPress={onUnlinkSuperset}>
                    <Text style={[styles.supersetUnlink, { color: colors.textMuted }]}>
                      {t('workout.superset.remove')}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  extrasToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  extrasLabel: { flex: 1, fontFamily: fontFamily.body, fontSize: 13 },
  extras: { gap: 12 },
  typeRow: { gap: 6, paddingRight: 4 },
  typeChip: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 },
  typeChipText: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  rpeBlock: { gap: 7 },
  extrasFieldLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  rpePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rpePill: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpePillText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noteInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 13, padding: 0 },
  supersetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  supersetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  supersetText: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  supersetUnlink: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  pressed: { opacity: 0.8 },
});
