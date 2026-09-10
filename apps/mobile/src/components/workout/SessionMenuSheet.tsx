/**
 * US MUSCU-UX01 — le menu de séance (⋮), et ce qu'il rapatrie.
 *
 * ── Le niveau d'affichage remonte des Réglages ───────────────────────────────────────────────────
 * Il se choisissait à l'onboarding, puis se modifiait dans une section perdue au milieu d'un écran
 * de Réglages de 984 lignes. Autant dire : jamais. Il pilote pourtant ce que montre l'écran de
 * séance — c'est donc **dans la séance** qu'il doit se régler, là où on voit ce qu'il change.
 *
 * Le rendre accessible ici n'est possible que parce que la barre d'action est fixe (règle R4-1) :
 * changer de niveau ne déplace plus le bouton de validation, donc l'essayer ne coûte rien.
 *
 * ── « Mettre en pause » disait un état qui n'existe pas ──────────────────────────────────────────
 * MUSC-F6 est explicite : quitter l'écran ne demande aucune confirmation, la séance reste `active`
 * en base, **sans état « pause » distinct**, et reste reprenable jusqu'à la clôture automatique à
 * 3 h. Le libellé promettait donc un mécanisme inexistant. « Quitter et reprendre plus tard »
 * décrit ce qui se passe vraiment.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WORKOUT_DISPLAY_LEVELS, type WorkoutDisplayLevel } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import type { Palette } from '@/theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  level: WorkoutDisplayLevel;
  onChangeLevel: (level: WorkoutDisplayLevel) => void;
  /** Repos de l'exercice courant, en secondes — affiché à titre de repère. */
  restSeconds: number;
  onOpenRest: () => void;
  onAddExercise: () => void;
  /** Clôture la séance depuis le menu — la seule issue quand il reste des séries non faites. */
  onFinish: () => void;
  onLeave: () => void;
  onAbandon: () => void;
  colors: Palette;
};

/**
 * Une ligne du menu. Définie **au niveau module** : la déclarer dans le corps du composant
 * recréerait un type de composant à chaque rendu (`react-hooks/static-components`), et React
 * démonterait puis remonterait la ligne à chaque ouverture.
 */
function MenuRow({
  icon,
  label,
  value,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  colors: Palette;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={19} color={colors.text} />
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      {value ? <Text style={[styles.rowValue, { color: colors.textMuted }]}>{value}</Text> : null}
    </Pressable>
  );
}

export function SessionMenuSheet({
  visible,
  onClose,
  level,
  onChangeLevel,
  restSeconds,
  onOpenRest,
  onAddExercise,
  onFinish,
  onLeave,
  onAbandon,
  colors,
}: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: `${colors.panel}6b` }]}
        accessibilityLabel={t('common.close')}
        onPress={onClose}
      >
        {/* Pressable interne : absorbe le tap pour qu'un geste dans la feuille ne la ferme pas. */}
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]}>
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />

            {/* Niveau d'affichage — rapatrié des Réglages */}
            <View style={styles.section}>
              <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
                {t('workout.displayLevel.title')}
              </Text>
              <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
                {WORKOUT_DISPLAY_LEVELS.map((option) => {
                  const selected = option === level;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => onChangeLevel(option)}
                      style={[
                        styles.segmentItem,
                        selected && { backgroundColor: colors.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentLabel,
                          { color: selected ? colors.accentText : colors.textMuted },
                        ]}
                      >
                        {t(`workout.displayLevel.levels.${option}.label`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                {t(`workout.displayLevel.levels.${level}.description`)}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View>
              <MenuRow
                icon="timer-outline"
                label={t('workout.menu.rest')}
                value={t('workout.restSeconds', { count: restSeconds })}
                colors={colors}
                onPress={() => {
                  onClose();
                  onOpenRest();
                }}
              />
              <MenuRow
                icon="add"
                label={t('workout.addExercise')}
                colors={colors}
                onPress={() => {
                  onClose();
                  onAddExercise();
                }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.actions}>
              {/* ⚠️ La barre du bas ne devient « Terminer » **qu'une fois toutes les séries
                  validées**. Écourter une séance — cas courant : on s'arrête avant la fin — n'a
                  donc pas d'autre issue que ce bouton. Sans lui, la seule sortie serait
                  d'abandonner, et de tout perdre. */}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  onFinish();
                }}
                style={({ pressed }) => [
                  styles.finishBtn,
                  { backgroundColor: colors.accent },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.finishLabel, { color: colors.accentText }]}>
                  {t('workout.finishSession')}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  onLeave();
                }}
                style={({ pressed }) => [
                  styles.leaveBtn,
                  { borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.leaveLabel, { color: colors.text }]}>
                  {t('workout.leave.later')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  onAbandon();
                }}
                style={({ pressed }) => [styles.abandonBtn, pressed && styles.pressed]}
              >
                <Text style={[styles.abandonLabel, { color: colors.danger }]}>
                  {t('workout.leave.abandon')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '82%' },
  sheetContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26, gap: 16 },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  section: { gap: 9 },
  eyebrow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  segment: { flexDirection: 'row', gap: 6, borderRadius: 13, padding: 4 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  segmentLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  divider: { height: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13 },
  rowLabel: { flex: 1, fontFamily: fontFamily.body, fontSize: 15 },
  rowValue: { fontFamily: fontFamily.mono, fontSize: 13 },
  actions: { gap: 10 },
  finishBtn: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  leaveBtn: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveLabel: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  abandonBtn: { alignItems: 'center', paddingVertical: 8 },
  abandonLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  pressed: { opacity: 0.8 },
});
