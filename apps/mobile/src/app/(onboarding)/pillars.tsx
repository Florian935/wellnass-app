import { useRouter } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PILLARS, resolveActivePillars, type Pillar } from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { togglePillar, useSettings } from '@/data/repositories/settings-repository';
import { toggleWellbeingPillar } from '@/components/wellbeing/wellbeing-consent';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const NEXT = '/(onboarding)/goal';

export default function OnboardingPillars() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  // Tant que les réglages ne sont pas chargés, on suppose tous les piliers actifs.
  const activePillars = resolveActivePillars(settings?.activePillars);

  return (
    <OnboardingScaffold
      step={2}
      title={t('onboarding.pillars.title')}
      subtitle={t('onboarding.pillars.subtitle')}
      onSkip={() => router.push(NEXT)}
      onContinue={() => router.push(NEXT)}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {PILLARS.map((pillar: Pillar, i) => (
          <View
            key={pillar}
            style={[
              styles.row,
              i < PILLARS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: colors.text }]}>{t(`pillars.${pillar}`)}</Text>
            <Switch
              value={activePillars.includes(pillar)}
              onValueChange={() =>
                void togglePillar(pillar)
                  .then(({ activated }) => {
                    if (activated) void track(ANALYTICS_EVENTS.pillarActivated, { pillar });
                  })
                  // Écriture offline-first optimiste : l'interrupteur suit la base locale, qui a
                  // déjà répondu. ⚠️ Le `catch` n'est pas décoratif — c'est la panne de CYCLE-01
                  // (recette du 31/07/2026) : sans lui, un échec d'écriture remonte en rejet non
                  // capturé et l'interrupteur reste éteint **sans aucun message**.
                  .catch(() => undefined)
              }
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#ffffff"
              accessibilityLabel={t(`pillars.${pillar}`)}
            />
          </View>
        ))}
        {/* US BIEN-02 (D1) — le pilier Bien-être, éteint par défaut : l'activer demande un consentement. */}
        <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border }]}>
          <View style={styles.grow}>
            <Text style={[styles.label, { color: colors.text }]}>{t('pillars.wellbeing')}</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>{t('onboarding.pillars.wellbeingHint')}</Text>
          </View>
          <Switch
            testID="onboarding-wellbeing-pillar"
            value={settings?.wellbeingPillarEnabled === true}
            onValueChange={(next) => void toggleWellbeingPillar(t, next)}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#ffffff"
            accessibilityLabel={t('pillars.wellbeing')}
          />
        </View>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  grow: { flex: 1, minWidth: 0, paddingRight: 12 },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
});
