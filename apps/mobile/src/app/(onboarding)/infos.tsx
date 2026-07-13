import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SEXES, toIsoDate, type Sex } from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { Segment } from '@/components/Segment';
import { TextField } from '@/components/TextField';
import { upsertProfile, useProfile, type Profile } from '@/data/repositories/profile-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const NEXT = '/(onboarding)/pillars';

/** Découpe une date ISO (AAAA-MM-JJ) en parties de saisie. */
function splitIso(iso: string | null): { d: string; m: string; y: string } {
  if (!iso) return { d: '', m: '', y: '' };
  const [y, m, d] = iso.split('-');
  return { d: d ?? '', m: m ?? '', y: y ?? '' };
}

export default function OnboardingInfos() {
  const { profile, isLoading } = useProfile();
  // On attend la résolution de la requête locale (null au 1ᵉʳ rendu) avant de monter le
  // formulaire : sinon les champs se figent vides et, au rejeu, on n'affiche/pré-remplit
  // rien (même mécanisme que profile.tsx). fix/onboarding-rejeu-profil.
  if (isLoading) return null;
  return <InfosForm profile={profile} />;
}

function InfosForm({ profile }: { profile: Profile | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  // Valeurs initiales figées au montage : si un champ n'a pas bougé, on réécrit la valeur
  // du profil (lue au submit, donc résolue) plutôt qu'un blanc — même si `useProfile()`
  // renvoyait `null` au 1ᵉʳ rendu (la requête PowerSync se résout un tick plus tard).
  const initial = splitIso(profile?.birthDate ?? null);
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const initialFirstNameRef = useRef(profile?.firstName ?? '');
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'unspecified');
  const initialSexRef = useRef<Sex>(profile?.sex ?? 'unspecified');
  const [day, setDay] = useState(initial.d);
  const [month, setMonth] = useState(initial.m);
  const [year, setYear] = useState(initial.y);
  const initialDateRef = useRef(initial);

  // Poids/taille — anti-dérive : on fige la chaîne affichée au montage et on ne
  // reconvertit que si l'utilisateur l'a modifiée (évite les arrondis metric↔imperial).
  const weight0 = units.weightInputValue(profile?.weightKg);
  const [weight, setWeight] = useState(weight0);
  const initialWeightRef = useRef(weight0);
  const h0 = units.heightPartsFromCm(profile?.heightCm);
  const [heightA, setHeightA] = useState(h0.a);
  const [heightB, setHeightB] = useState(h0.b);
  const initialHeightRef = useRef(h0);

  const onContinue = async () => {
    const dateUnchanged =
      day === initialDateRef.current.d &&
      month === initialDateRef.current.m &&
      year === initialDateRef.current.y;
    await upsertProfile({
      firstName:
        firstName === initialFirstNameRef.current ? (profile?.firstName ?? null) : firstName.trim(),
      sex: sex === initialSexRef.current ? (profile?.sex ?? 'unspecified') : sex,
      birthDate: dateUnchanged
        ? (profile?.birthDate ?? null)
        : toIsoDate(Number(day), Number(month), Number(year)),
      weightKg:
        weight === initialWeightRef.current
          ? (profile?.weightKg ?? null)
          : units.parseWeightToKg(weight),
      heightCm:
        heightA === initialHeightRef.current.a && heightB === initialHeightRef.current.b
          ? (profile?.heightCm ?? null)
          : units.heightPartsToCm(heightA, heightB),
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
