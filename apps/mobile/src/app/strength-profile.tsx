/**
 * Profil musculation — US GUID-01, volet C §5.5.
 *
 * ── Pourquoi cet écran est neuf ─────────────────────────────────────────────────────────────────
 * La nutrition a son profil (`nutrition-profile.tsx`), la course aussi (`running-profile.tsx`). La
 * musculation n'en avait **aucun** : ses réglages étaient éparpillés entre les Réglages généraux
 * (deux niveaux d'affichage) et rien du tout pour le reste. C'est aussi ce qui explique qu'on n'ait
 * jamais eu d'endroit où demander le niveau d'entraînement — et qu'on ait fini par détourner une
 * préférence d'affichage pour en tenir lieu.
 *
 * Il porte le **contexte** d'entraînement : niveau et disponibilité, modifiables après la feuille
 * qui les a demandés devant la bibliothèque.
 *
 * ⚠️ **Pas de sélecteur de régime ici, et c'est délibéré** (constat de revue, 13/09/2026).
 * Aucun moteur du pilier Musculation ne consulte encore le régime : `dispositionFor` n'est lu que
 * pour les collisions de séances (pilier Course) et la carte de contradiction (pilier Nutrition).
 * Afficher un curseur accompagné d'un texte décrivant trois comportements qui ne se produisent pas
 * serait **exactement** le défaut que cette US corrige — un écran qui promet ce qu'il ne tient pas.
 * Le régime global choisi à l'onboarding s'appliquera à la musculation le jour où ses moteurs y
 * seront branchés ; le curseur par pilier reviendra ce jour-là, pas avant.
 *
 * L'objectif principal y figure en **lecture seule**, avec un lien vers le profil général : c'est
 * une donnée transverse aux trois piliers, la dupliquer en édition ici reviendrait à en faire trois
 * sources de vérité.
 */

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  MAX_WEEKLY_AVAILABILITY,
  MIN_WEEKLY_AVAILABILITY,
  TRAINING_LEVELS,
  pillarDefaults,
  type TrainingLevel,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const DAYS = Array.from(
  { length: MAX_WEEKLY_AVAILABILITY - MIN_WEEKLY_AVAILABILITY + 1 },
  (_, i) => i + MIN_WEEKLY_AVAILABILITY,
);

export default function StrengthProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { profile } = useProfile();

  const level = profile?.trainingLevel ?? null;
  const availability = profile?.weeklyAvailability ?? null;
  const defaults = pillarDefaults(profile?.mainGoal ?? null);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('trainingContext.levelLabel')}
      </Text>
      <View style={styles.options}>
        {TRAINING_LEVELS.map((option: TrainingLevel) => {
          const active = level === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${t(`trainingContext.levels.${option}.label`)} — ${t(
                `trainingContext.levels.${option}.hint`,
              )}`}
              onPress={() => void upsertProfile({ trainingLevel: option })}
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
      {level === null ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('trainingContext.levelUnset')}
        </Text>
      ) : null}

      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('trainingContext.daysLabel')}
      </Text>
      <View style={styles.days}>
        {DAYS.map((n) => {
          const active = availability === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t('trainingContext.daysA11y', { count: n })}
              onPress={() => void upsertProfile({ weeklyAvailability: n })}
              style={[
                styles.day,
                {
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[styles.dayLabel, { color: active ? colors.accentText : colors.textMuted }]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('strengthProfile.goalSection')}
      </Text>
      <Card>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textMuted }]}>
            {t('onboarding.goal.title')}
          </Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>
            {profile?.mainGoal
              ? t(`onboarding.goal.options.${profile.mainGoal}`)
              : t('onboarding.summary.none')}
          </Text>
        </View>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t(`onboarding.goal.hints.strength.${defaults.strength.progression}`)}
        </Text>
        <Button
          label={t('strengthProfile.editGoal')}
          variant="ghost"
          onPress={() => router.push('/profile')}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  section: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 14,
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontFamily: fontFamily.body, fontSize: 15 },
  rowValue: { fontFamily: fontFamily.bodySemi, fontSize: 15, flexShrink: 1, textAlign: 'right' },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
});
