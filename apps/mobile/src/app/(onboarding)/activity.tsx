/**
 * Onboarding — niveau d'activité (US NUTRI-UX01, R1.1 / R1.2).
 *
 * ── Pourquoi cette étape existe ──────────────────────────────────────────────────────────────
 * Elle n'existait pas, et c'était le défaut le plus grave du pilier : le niveau d'activité est le
 * **multiplicateur du TDEE** (×1,2 à ×1,9), et six sites de code retombaient sur `'moderate'`
 * (×1,55) sans que personne n'ait jamais posé la question. Pour un sédentaire, l'objectif
 * calorique était surestimé de ~614 kcal/jour — assez pour annuler tout un déficit de sèche,
 * sans qu'aucun écran ne le signale.
 *
 * ── Deux choix d'écran ───────────────────────────────────────────────────────────────────────
 * • On décrit des **situations**, pas des facteurs : « travail assis, peu de marche » se
 *   reconnaît, « ×1,2 » se devine. Le facteur reste visible en petit, pour qui veut vérifier.
 * • « Passer » n'écrit **rien** : `activity_level` reste `null`, ce qui veut dire « pas encore
 *   répondu » et non « modéré ». Le profil nutritionnel affichera alors le repli comme un repli
 *   (R1.3), au lieu de le faire passer pour un choix.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_LEVELS, activityFactor, type ActivityLevel } from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { upsertNutritionProfile } from '@/data/repositories/nutrition-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const NEXT = '/(onboarding)/summary';
/** Le parcours compte 5 étapes quand celle-ci s'affiche (pilier nutrition actif). */
const TOTAL_WITH_ACTIVITY = 5;

export default function OnboardingActivity() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [level, setLevel] = useState<ActivityLevel | null>(null);

  const onContinue = async () => {
    // Rien n'est écrit sans choix : l'absence de réponse est une information, pas un défaut.
    if (level) await upsertNutritionProfile({ activityLevel: level });
    router.push(NEXT);
  };

  const formatFactor = (l: ActivityLevel) =>
    i18n.language === 'en'
      ? `×${activityFactor(l)}`
      : `×${activityFactor(l).toString().replace('.', ',')}`;

  return (
    <OnboardingScaffold
      step={5}
      total={TOTAL_WITH_ACTIVITY}
      title={t('onboarding.activity.title')}
      subtitle={t('onboarding.activity.subtitle')}
      onSkip={() => router.push(NEXT)}
      onContinue={onContinue}
    >
      <View style={styles.list}>
        {ACTIVITY_LEVELS.map((option: ActivityLevel) => {
          const selected = level === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t(`nutrition.activity.options.${option}`)} — ${t(
                `onboarding.activity.descriptions.${option}`,
              )}`}
              onPress={() => setLevel(option)}
              style={[
                styles.option,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <View style={styles.texts}>
                <View style={styles.headRow}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    {t(`nutrition.activity.options.${option}`)}
                  </Text>
                  <Text style={[styles.factor, { color: colors.textMuted }]}>
                    {formatFactor(option)}
                  </Text>
                </View>
                <Text style={[styles.description, { color: colors.textMuted }]}>
                  {t(`onboarding.activity.descriptions.${option}`)}
                </Text>
              </View>
              {selected ? (
                <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              ) : (
                <View style={[styles.dot, { borderColor: colors.border, borderWidth: 1.5 }]} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('onboarding.activity.hint')}</Text>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  texts: { flex: 1, gap: 3 },
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 16, flexShrink: 1 },
  factor: { fontFamily: fontFamily.mono, fontSize: 12 },
  description: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  dot: { width: 20, height: 20, borderRadius: 10 },
  hint: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
});
