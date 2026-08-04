import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SBD_LIFTS, emptySbdLifts, type SbdLift } from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useExercises } from '@/data/repositories/exercise-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { setSbdLift, useStrengthSection } from '@/data/repositories/strength-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Désignation des trois mouvements de force (US MUSCPWR-01, décision D3).
 *
 * Pourquoi désigner plutôt que reconnaître par nom : une correspondance automatique échouerait sur
 * « Squat barre basse », « Bench avec pause » ou tout exercice perso — exactement ce qu'utilise un
 * pratiquant de force. Cet écran est aussi **l'opt-in du module** : sans désignation, pas de total.
 */
export default function StrengthLiftsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const { settings } = useSettings();
  const { lifts } = useStrengthSection(i18n.language);
  const { exercises } = useExercises();
  const [picking, setPicking] = useState<SbdLift | null>(null);

  const current = settings?.sbdLifts ?? emptySbdLifts();

  const onPick = async (lift: SbdLift, exerciseId: string | null) => {
    await setSbdLift(lift, exerciseId, current);
    setPicking(null);
  };

  return (
    <Screen>
      <ScreenHeader title={t('strength.designate.title')} subtitle={t('strength.designate.subtitle')} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {SBD_LIFTS.map((lift) => {
          const designated = lifts.find((l) => l.lift === lift);
          return (
            <Pressable
              key={lift}
              onPress={() => setPicking(lift)}
              accessibilityRole="button"
              accessibilityLabel={t('strength.designate.pickA11y', {
                lift: t(`strength.sbd.lifts.${lift}`),
                current: designated?.name ?? t('strength.designate.none'),
              })}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.rowLabel, { color: colors.textMuted }]}>
                {t(`strength.sbd.lifts.${lift}`)}
              </Text>
              <View style={styles.rowValue}>
                <Text
                  style={[
                    styles.rowName,
                    { color: designated?.name ? colors.text : colors.warnText },
                    !designated?.name && styles.rowNameEmpty,
                  ]}
                >
                  {designated?.name ?? t('strength.designate.none')}
                </Text>
                {designated?.archived && (
                  <Text style={[styles.rowArchived, { color: colors.warnText }]}>
                    {t('strength.sbd.archived')}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          );
        })}

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('strength.designate.hint')}
        </Text>
      </ScrollView>

      {/* Sélecteur : la bibliothèque ET les exercices perso — indispensable pour les variantes de
          compétition, que la bibliothèque ne contient pas. */}
      <Modal visible={picking !== null} animationType="slide" transparent onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(null)} accessibilityElementsHidden />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.grab, { backgroundColor: colors.borderStrong }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {picking ? t('strength.designate.pickFor', { lift: t(`strength.sbd.lifts.${picking}`) }) : ''}
          </Text>

          <ScrollView style={styles.options} showsVerticalScrollIndicator={false}>
            {picking && current[picking] !== null && (
              <Pressable
                onPress={() => void onPick(picking, null)}
                accessibilityRole="button"
                style={[styles.option, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <Text style={[styles.optionName, { color: colors.danger }]}>
                  {t('strength.designate.clear')}
                </Text>
              </Pressable>
            )}

            {exercises.map((exercise) => {
              const selected = picking !== null && current[picking] === exercise.id;
              return (
                <Pressable
                  key={exercise.id}
                  onPress={() => picking && void onPick(picking, exercise.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? colors.surface : colors.background,
                      borderColor: selected ? colors.accent : colors.border,
                      borderWidth: selected ? 1.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.optionName, { color: colors.text }]}>{exercise.name}</Text>
                  {exercise.source === 'custom' && (
                    <Text style={[styles.optionTag, { color: colors.accent, borderColor: colors.accent }]}>
                      {t('strength.designate.custom')}
                    </Text>
                  )}
                  {selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32, gap: 7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  rowLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flex: 0,
    minWidth: 62,
  },
  rowValue: { flex: 1, gap: 2 },
  rowName: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  rowNameEmpty: { fontStyle: 'italic', fontFamily: fontFamily.body },
  rowArchived: { fontFamily: fontFamily.body, fontSize: 11.5, fontStyle: 'italic' },
  hint: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, marginTop: 6, paddingHorizontal: 4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    padding: 14,
    paddingBottom: 26,
    gap: 9,
    maxHeight: '80%',
  },
  grab: { width: 36, height: 4, borderRadius: 2, opacity: 0.45, alignSelf: 'center' },
  sheetTitle: { fontFamily: fontFamily.displayBold, fontSize: 16 },
  options: { maxHeight: 380 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 10,
    padding: 11,
    marginBottom: 5,
  },
  optionName: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  optionTag: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
});
