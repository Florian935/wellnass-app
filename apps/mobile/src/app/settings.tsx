import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  PILLARS,
  UNIT_SYSTEMS,
  type Pillar,
  type Theme,
  type UnitSystem,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { upsertProfile } from '@/data/repositories/profile-repository';
import { togglePillar, updateSettings, useSettings } from '@/data/repositories/settings-repository';
import { useAuthStore } from '@/stores/auth-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const THEME_OPTIONS = ['system', 'light', 'dark'] as const;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  // Defaults null-safe tant que les réglages ne sont pas chargés / synchronisés.
  const activePillars = settings?.activePillars ?? [...PILLARS];
  const theme = settings?.theme ?? 'system';
  const units = settings?.units ?? 'metric';
  const email = useAuthStore((s) => s.session?.user.email);
  const signOut = useAuthStore((s) => s.signOut);

  const relaunchOnboarding = async () => {
    // Réinitialise le drapeau d'onboarding via le profil ; la gate de routing
    // redirigera automatiquement vers l'onboarding.
    await upsertProfile({ onboardingCompletedAt: null });
    router.replace('/(onboarding)/intro');
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Profil */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {t('settings.profile.title')}
      </Text>
      <View style={styles.stack}>
        <Button label={t('settings.profile.edit')} variant="ghost" onPress={() => router.push('/profile')} />
        <Button label={t('settings.profile.relaunchOnboarding')} variant="ghost" onPress={() => void relaunchOnboarding()} />
      </View>

      {/* Piliers actifs (décision H) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.pillars.title')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {PILLARS.map((pillar: Pillar, i) => (
          <View
            key={pillar}
            style={[
              styles.row,
              i < PILLARS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t(`pillars.${pillar}`)}</Text>
            <Switch
              value={activePillars.includes(pillar)}
              onValueChange={() => void togglePillar(pillar)}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#ffffff"
              accessibilityLabel={t(`pillars.${pillar}`)}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('settings.pillars.hint')}</Text>

      {/* Apparence (thème) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.appearance.title')}
      </Text>
      <Segment
        options={THEME_OPTIONS}
        value={theme}
        onChange={(next: Theme) => void updateSettings({ theme: next })}
        label={(option) => t(`settings.appearance.${option}`)}
      />

      {/* Unités (item 1.15) */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.units.title')}
      </Text>
      <Segment
        options={UNIT_SYSTEMS}
        value={units}
        onChange={(next: UnitSystem) => void updateSettings({ units: next })}
        label={(option) => t(`settings.units.${option}`)}
      />
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('settings.units.hint')}</Text>

      {/* Compte */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.account.title')}
      </Text>
      {email ? <Text style={[styles.rowLabel, { color: colors.text }]}>{email}</Text> : null}
      <View style={styles.signOut}>
        <Button label={t('settings.account.signOut')} variant="ghost" onPress={() => void signOut()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  sectionTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  hint: { fontFamily: fontFamily.body, fontSize: 13, marginTop: 8, lineHeight: 18 },
  signOut: { marginTop: 12 },
  stack: { gap: 10 },
});
