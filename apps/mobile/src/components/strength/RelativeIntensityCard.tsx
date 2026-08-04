import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { percentOfMax } from '@wellness/shared';
import { useExerciseRelativeIntensity } from '@/data/repositories/strength-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Intensité relative (%1RM) d'un exercice — US MUSCPWR-01, catalogue **MUSC-16**.
 *
 * Vit sur la **fiche exercice** et non sur l'écran de séance (décision D5) : l'écran de séance est
 * déjà dense (RPE, repos, progression, deload), et l'intensité relative est une analyse de fond, pas
 * une information de série.
 *
 * **Tier 1 conditionnel** : rend `null` sans 1RM connu (règle R2) — un pourcentage calculé sur un
 * maximum inventé serait pire que rien.
 */
export function RelativeIntensityCard({ exerciseId }: { exerciseId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { oneRmKg, lastSession, isLoading } = useExerciseRelativeIntensity(exerciseId);

  if (isLoading || oneRmKg === null || lastSession === null) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textMuted }]}>
        {t('strength.intensity.title')}
      </Text>

      <Text style={[styles.value, { color: colors.text }]}>
        {t('strength.intensity.percent', { percent: Math.round(lastSession.averagePercent) })}
      </Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {t('strength.intensity.basis', { oneRm: formatKg(oneRmKg) })}
      </Text>

      {lastSession.sets.map((set, index) => {
        const percent = percentOfMax(set.weightKg, oneRmKg);
        if (percent === null) return null;
        return (
          <View key={index} style={styles.barRow}>
            <Text style={[styles.barLabel, { color: colors.textMuted }]}>
              {t('strength.intensity.setLabel', {
                reps: set.reps,
                weight: formatKg(set.weightKg!),
              })}
            </Text>
            <View style={[styles.track, { backgroundColor: colors.track }]}>
              <View
                style={[
                  styles.fill,
                  {
                    // Au-dessus du 1RM connu, la barre est pleine ET verte : c'est un record, pas un
                    // débordement (règle R3 — le pourcentage affiché, lui, dépasse bien 100).
                    width: `${Math.min(100, percent)}%`,
                    backgroundColor: percent > 100 ? colors.success : colors.accent,
                  },
                ]}
              />
            </View>
            <Text style={[styles.barValue, { color: colors.text }]}>
              {t('strength.intensity.percent', { percent: Math.round(percent) })}
            </Text>
          </View>
        );
      })}

      <Text style={[styles.footnote, { color: colors.textMuted }]}>
        {t('strength.intensity.warmupExcluded')}
      </Text>
    </View>
  );
}

/** Une décimale au plus, et pas de « 100,0 kg » quand la valeur est ronde. */
function formatKg(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 2, marginTop: 14 },
  title: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  value: { fontFamily: fontFamily.displayXBold, fontSize: 25, letterSpacing: -0.5 },
  meta: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, marginBottom: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  barLabel: { fontFamily: fontFamily.body, fontSize: 11.5, flex: 0, minWidth: 76 },
  track: { flex: 1, height: 14, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  barValue: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11.5,
    minWidth: 42,
    textAlign: 'right',
  },
  footnote: { fontFamily: fontFamily.body, fontSize: 11, fontStyle: 'italic', marginTop: 6 },
});
