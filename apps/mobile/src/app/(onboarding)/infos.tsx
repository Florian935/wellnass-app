import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SEXES, toDate, type Sex } from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { upsertProfile } from '@/data/repositories/profile-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const NEXT = '/(onboarding)/pillars';

export default function OnboardingInfos() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  const [firstName, setFirstName] = useState('');
  const [sex, setSex] = useState<Sex>('unspecified');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [weight, setWeight] = useState('');
  const [heightA, setHeightA] = useState('');
  const [heightB, setHeightB] = useState('');

  const onContinue = async () => {
    const birth = toDate(Number(day), Number(month), Number(year));
    await upsertProfile({
      firstName: firstName.trim(),
      sex,
      birthDate: birth ? birth.toISOString().slice(0, 10) : null,
      weightKg: units.parseWeightToKg(weight),
      heightCm: units.heightPartsToCm(heightA, heightB),
    });
    router.push(NEXT);
  };

  return (
    <OnboardingScaffold
      step={1}
      title={t('onboarding.infos.title')}
      subtitle={t('onboarding.infos.subtitle')}
      onSkip={() => router.push(NEXT)}
      onContinue={onContinue}
    >
      <TextField
        label={t('onboarding.infos.firstName')}
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
      />

      <View>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.infos.sex')}</Text>
        <Segment
          options={SEXES}
          value={sex}
          onChange={setSex}
          label={(option) => t(`onboarding.infos.sexes.${option}`)}
        />
      </View>

      <Text style={[styles.label, { color: colors.textMuted }]}>
        {t('onboarding.infos.birthDate')}
      </Text>
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <TextField label={t('auth.signUp.day')} value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} placeholder="JJ" />
        </View>
        <View style={styles.dateField}>
          <TextField label={t('auth.signUp.month')} value={month} onChangeText={setMonth} keyboardType="number-pad" maxLength={2} placeholder="MM" />
        </View>
        <View style={[styles.dateField, styles.yearField]}>
          <TextField label={t('auth.signUp.year')} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} placeholder="AAAA" />
        </View>
      </View>

      {units.system === 'imperial' ? (
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <TextField
              label={`${t('onboarding.infos.weight')} (${units.weightSymbol})`}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.dateField}>
            <TextField
              label={`${t('onboarding.infos.heightFeet')} (ft)`}
              value={heightA}
              onChangeText={setHeightA}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.dateField}>
            <TextField
              label={`${t('onboarding.infos.heightInches')} (in)`}
              value={heightB}
              onChangeText={setHeightB}
              keyboardType="number-pad"
            />
          </View>
        </View>
      ) : (
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <TextField
              label={`${t('onboarding.infos.weight')} (${units.weightSymbol})`}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.dateField}>
            <TextField
              label={`${t('onboarding.infos.height')} (cm)`}
              value={heightA}
              onChangeText={setHeightA}
              keyboardType="number-pad"
            />
          </View>
        </View>
      )}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginBottom: 6 },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1 },
  yearField: { flex: 1.4 },
});
