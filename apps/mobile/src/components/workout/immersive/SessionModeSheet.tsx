/**
 * « Comment veux-tu t'entraîner ? » — US MUSCU-UX03, spec R-MO-3.
 *
 * ── Qui la voit, et qui ne la verra jamais ──────────────────────────────────────────────────────
 * **Uniquement** quelqu'un qui n'a encore jamais tranché **et** qui n'a aucune séance terminée.
 * Un utilisateur qui a déjà un historique garde le classique et découvre l'immersif par le
 * sélecteur de la carte du jour : son écran ne change pas sous ses yeux un matin, sans qu'il ait
 * rien demandé. C'est la contrepartie directe de « le classique reste » (décision D1).
 *
 * ── Rien n'est coché d'avance ───────────────────────────────────────────────────────────────────
 * Aucun des deux modes n'est présélectionné : la feuille pose une vraie question, elle ne pousse
 * pas une réponse. Seule « Retenir mon choix » est cochée, parce que c'est ce qu'on attend d'un
 * choix qu'on vient de faire — et qu'il se défait d'un toucher.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { WORKOUT_DISPLAY_MODES, type WorkoutDisplayMode } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Le mode choisi, et s'il faut le retenir comme préférence. */
  onPick: (mode: WorkoutDisplayMode, remember: boolean) => void;
  colors: Palette;
};

export function SessionModeSheet({ visible, onClose, onPick, colors }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<WorkoutDisplayMode | null>(null);
  const [remember, setRemember] = useState(true);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={styles.dismissZone}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.text }]}>{t('workoutMode.sheetTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('workoutMode.sheetSubtitle')}
          </Text>

          <View style={styles.options}>
            {WORKOUT_DISPLAY_MODES.map((option) => {
              const active = selected === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelected(option)}
                  style={[
                    styles.option,
                    {
                      borderColor: active ? colors.accent : colors.border,
                      backgroundColor: active ? `${colors.accent}12` : colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.optionName, { color: colors.text }]}>
                    {t(`workoutMode.${option}`)}
                  </Text>
                  <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                    {t(`workoutMode.${option}Desc`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            onPress={() => setRemember((value) => !value)}
            style={styles.remember}
          >
            <Ionicons
              name={remember ? 'checkbox' : 'square-outline'}
              size={20}
              color={remember ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.rememberLabel, { color: colors.textMuted }]}>
              {t('workoutMode.remember')}
            </Text>
          </Pressable>

          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ disabled: selected === null }}
            haptic="confirm"
            onPress={() => {
              if (selected) onPick(selected, remember);
            }}
            style={[
              styles.primary,
              { backgroundColor: selected ? colors.accent : colors.surfaceAlt },
            ]}
          >
            <Text
              style={[
                styles.primaryLabel,
                { color: selected ? colors.accentText : colors.textMuted },
              ]}
            >
              {selected
                ? t('workoutMode.start', { mode: t(`workoutMode.${selected}`) })
                : t('workoutMode.sheetTitle')}
            </Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0000008a' },
  dismissZone: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  grabber: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 24, letterSpacing: -0.8 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  options: { gap: 10, marginTop: 6 },
  option: { borderWidth: 1.5, borderRadius: 18, padding: 14, gap: 4 },
  optionName: { fontFamily: fontFamily.displaySemi, fontSize: 17 },
  optionDesc: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  rememberLabel: { fontFamily: fontFamily.body, fontSize: 13.5 },
  primary: {
    minHeight: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  primaryLabel: { fontFamily: fontFamily.bodyBold, fontSize: 17 },
});
