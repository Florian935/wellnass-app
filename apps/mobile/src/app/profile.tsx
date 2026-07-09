import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GOALS, SEXES, toDate, type Goal, type Sex } from '@wellness/shared';
import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

function splitIso(iso: string | null): { d: string; m: string; y: string } {
  if (!iso) return { d: '', m: '', y: '' };
  const [y, m, d] = iso.split('-');
  return { d: d ?? '', m: m ?? '', y: y ?? '' };
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { profile } = useProfile();
  const units = useUnits();

  const initial = splitIso(profile?.birthDate ?? null);
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'unspecified');
  const [day, setDay] = useState(initial.d);
  const [month, setMonth] = useState(initial.m);
  const [year, setYear] = useState(initial.y);
  const [goal, setGoal] = useState<Goal | null>(profile?.mainGoal ?? null);

  // Weight — anti-drift: capture mount-time display string in a ref
  const weight0 = units.weightInputValue(profile?.weightKg);
  const [weight, setWeight] = useState(weight0);
  const initialWeightRef = useRef(weight0);

  // Height — anti-drift: capture mount-time display parts in a ref
  const h0 = units.heightPartsFromCm(profile?.heightCm);
  const [heightA, setHeightA] = useState(h0.a);
  const [heightB, setHeightB] = useState(h0.b);
  const initialHeightRef = useRef(h0);

  const onSave = async () => {
    const birth = toDate(Number(day), Number(month), Number(year));
    await upsertProfile({
      firstName: firstName.trim(),
      sex,
      birthDate: birth ? birth.toISOString().slice(0, 10) : null,
      weightKg:
        weight === initialWeightRef.current
          ? (profile?.weightKg ?? null)
          : units.parseWeightToKg(weight),
      heightCm:
        heightA === initialHeightRef.current.a && heightB === initialHeightRef.current.b
          ? (profile?.heightCm ?? null)
          : units.heightPartsToCm(heightA, heightB),
      mainGoal: goal,
    });
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
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

      <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.goal.title')}</Text>
      <Segment
        options={GOALS}
        value={goal ?? 'health'}
        onChange={setGoal}
        label={(option) => t(`onboarding.goal.options.${option}`)}
      />

      <View style={styles.footer}>
        <Button label={t('profile.save')} onPress={onSave} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginBottom: 6 },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1 },
  yearField: { flex: 1.4 },
  footer: { marginTop: 8 },
});
