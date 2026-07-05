import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useProfileStore } from '@/stores/profile-store';
import { useSettingsStore } from '@/stores/settings-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function OnboardingSummary() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const profile = useProfileStore();
  const activePillars = useSettingsStore((s) => s.activePillars);
  const completeOnboarding = useProfileStore((s) => s.completeOnboarding);

  const finish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const pillarsLabel =
    activePillars.length > 0
      ? activePillars.map((p) => t(`pillars.${p}`)).join(' · ')
      : t('onboarding.summary.none');

  return (
    <FormScreen>
      <ScreenHeader
        title={t('onboarding.summary.title')}
        subtitle={t('onboarding.summary.subtitle')}
      />
      <Card>
        {profile.firstName ? (
          <Row label={t('onboarding.infos.firstName')} value={profile.firstName} />
        ) : null}
        <Row label={t('onboarding.summary.pillars')} value={pillarsLabel} />
        <Row
          label={t('onboarding.goal.title')}
          value={
            profile.goal ? t(`onboarding.goal.options.${profile.goal}`) : t('onboarding.summary.none')
          }
        />
      </Card>
      <Text style={[styles.note, { color: colors.textMuted }]}>{t('onboarding.summary.note')}</Text>
      <View style={styles.footer}>
        <Button label={t('onboarding.summary.cta')} onPress={finish} />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontFamily: fontFamily.body, fontSize: 15 },
  rowValue: { fontFamily: fontFamily.bodySemi, fontSize: 15, flexShrink: 1, textAlign: 'right' },
  note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  footer: { marginTop: 'auto' },
});
