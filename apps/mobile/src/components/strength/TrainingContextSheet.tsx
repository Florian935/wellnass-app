/**
 * « Deux questions pour mieux te proposer » — US GUID-01, volet B (décision D6).
 *
 * ── Pourquoi ici, et pas à l'onboarding ─────────────────────────────────────────────────────────
 * La décision de cadrage F impose un onboarding **minimal**, chaque étape skippable. Ajouter deux
 * champs au premier lancement, c'est du coût pour tout le monde : la question arrive avant que quoi
 * que ce soit ne l'ait rendue nécessaire, et elle se fait passer.
 *
 * Posée **devant la bibliothèque**, la même question devient un service : l'objet est visible
 * (« pour te proposer le bon programme »), la réponse change immédiatement ce qui s'affiche, et le
 * coût est payé au moment où il rapporte.
 *
 * ── Ce qu'elle répare ───────────────────────────────────────────────────────────────────────────
 * Le profil ne stockait **ni** niveau **ni** disponibilité. Faute de mieux, le tri des programmes
 * utilisait `workoutDisplayLevel` — une préférence d'affichage — comme proxy d'expérience. Deux
 * personnes au même objectif, un débutant à 2 créneaux et un confirmé à 5, recevaient exactement
 * les mêmes propositions.
 *
 * ── Elle ne se montre qu'une fois ───────────────────────────────────────────────────────────────
 * Déclenchée uniquement quand `training_level` est `null`. Répondre la referme pour toujours ;
 * « Plus tard » la referme pour cette session seulement — sans rien écrire, parce que `null` veut
 * dire « pas de réponse », et surtout pas « débutant ».
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  MAX_WEEKLY_AVAILABILITY,
  MIN_WEEKLY_AVAILABILITY,
  TRAINING_LEVELS,
  type TrainingLevel,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (level: TrainingLevel, weeklyAvailability: number) => void;
  colors: Palette;
};

const DAYS = Array.from(
  { length: MAX_WEEKLY_AVAILABILITY - MIN_WEEKLY_AVAILABILITY + 1 },
  (_, i) => i + MIN_WEEKLY_AVAILABILITY,
);

export function TrainingContextSheet({ visible, onClose, onSubmit, colors }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [level, setLevel] = useState<TrainingLevel | null>(null);
  const [days, setDays] = useState<number | null>(null);

  const complete = level !== null && days !== null;

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

          <Text style={[styles.title, { color: colors.text }]}>
            {t('trainingContext.sheetTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('trainingContext.sheetSubtitle')}
          </Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('trainingContext.levelLabel')}
          </Text>
          <View style={styles.options}>
            {TRAINING_LEVELS.map((option) => {
              const active = level === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${t(`trainingContext.levels.${option}.label`)} — ${t(
                    `trainingContext.levels.${option}.hint`,
                  )}`}
                  onPress={() => setLevel(option)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: colors.surface,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <View style={styles.optionTexts}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {t(`trainingContext.levels.${option}.label`)}
                    </Text>
                    <Text style={[styles.optionHint, { color: colors.textMuted }]}>
                      {t(`trainingContext.levels.${option}.hint`)}
                    </Text>
                  </View>
                  {active ? (
                    <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  ) : (
                    <View style={[styles.dot, { borderColor: colors.border, borderWidth: 1.5 }]} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('trainingContext.daysLabel')}
          </Text>
          <View style={styles.days}>
            {DAYS.map((n) => {
              const active = days === n;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t('trainingContext.daysA11y', { count: n })}
                  onPress={() => setDays(n)}
                  style={[
                    styles.day,
                    {
                      backgroundColor: active ? colors.accent : colors.surface,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      { color: active ? colors.accentText : colors.textMuted },
                    ]}
                  >
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Button
              label={t('trainingContext.submit')}
              disabled={!complete}
              onPress={() => {
                if (level !== null && days !== null) onSubmit(level, days);
              }}
            />
            {/* Ne rien écrire : `null` veut dire « pas de réponse », jamais « débutant ». */}
            <Button label={t('trainingContext.later')} variant="ghost" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  dismissZone: { flex: 1 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10 },
  grabber: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20, letterSpacing: -0.5 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, marginTop: 6 },
  label: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  options: { gap: 9 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  optionTexts: { flex: 1, gap: 2 },
  optionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  optionHint: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  dot: { width: 19, height: 19, borderRadius: 10 },
  days: { flexDirection: 'row', gap: 7 },
  day: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  dayLabel: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  footer: { marginTop: 22, gap: 6 },
});
