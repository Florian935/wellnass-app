/**
 * US BIEN-01 — la feuille de check-in (décision D7 : une feuille, pas un écran poussé).
 *
 * Pourquoi une feuille : le rituel doit tenir en ~10 s (critère de recette 1) et un aller-retour de
 * navigation coûte cher sur un geste quotidien. Même patron que `ExerciseFilterDrawer`.
 *
 * Trois points de conception à ne pas défaire :
 * 1. **le poids n'est pas stocké ici** — il passe par `logWeight()`, qui sait déjà mettre à jour la
 *    pesée du jour au lieu d'en créer une seconde (critère de recette 4) ;
 * 2. **rien n'est obligatoire** (décision D3) : le bouton reste actif dès qu'**un** indicateur ou le
 *    poids est renseigné, et un check-in vide n'écrit rien plutôt que de créer une ligne inutile ;
 * 3. **aucun effet ne réamorce l'état.** Le formulaire est monté à l'ouverture et porte une `key` :
 *    rouvrir la feuille le remonte, donc l'état initial se lit dans les props (pas de `setState`
 *    dans un `useEffect`, que le React Compiler refuse — cascades de rendus).
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  WELLBEING_INDICATORS,
  formatDayFull,
  isEmptyCheckin,
  type WellbeingCheckinInput,
  type WellbeingLevel,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { WellbeingScale } from '@/components/wellbeing/WellbeingScale';
import { logWeight, useLatestWeight } from '@/data/repositories/bodyweight-repository';
import { saveWellbeing, type WellbeingEntry } from '@/data/repositories/daily-wellbeing-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Jour visé (AAAA-MM-JJ) — aujourd'hui, ou un jour de rattrapage depuis l'historique. */
  logDate: string;
  /** Check-in déjà enregistré pour ce jour, s'il existe : on corrige au lieu de recréer. */
  existing: WellbeingEntry | null;
};

export function WellbeingCheckinSheet({ visible, onClose, logDate, existing }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('wellbeing.closeSheet')}
      />
      <View
        style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        {/* Monté seulement à l'ouverture, et remonté si le jour visé change : l'état initial vient
            des props, sans effet de réamorçage. */}
        {visible && (
          <CheckinForm
            key={`${logDate}:${existing?.id ?? 'new'}`}
            logDate={logDate}
            existing={existing}
            onDone={onClose}
          />
        )}
      </View>
    </Modal>
  );
}

function CheckinForm({
  logDate,
  existing,
  onDone,
}: {
  logDate: string;
  existing: WellbeingEntry | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { latest } = useLatestWeight();

  const [values, setValues] = useState<WellbeingCheckinInput>(() =>
    existing ? { mood: existing.mood, energy: existing.energy, stress: existing.stress } : {},
  );
  // `null` = champ non touché → on affiche la pesée du jour si elle existe. Dès que l'utilisateur
  // tape, sa saisie prime. Ce repli remplace l'ancien effet de pré-remplissage.
  const [weightText, setWeightText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sameDayWeightKg = latest && latest.logDate === logDate ? latest.weightKg : null;
  const weightValue =
    weightText ?? (sameDayWeightKg == null ? '' : String(units.toWeightValue(sameDayWeightKg)));

  const weightKg = units.parseWeightToKg(weightValue);
  const hasWeight = weightKg != null && weightKg > 0;
  // Une pesée déjà enregistrée et non modifiée n'a pas besoin d'être réécrite.
  const weightChanged = hasWeight && weightKg !== sameDayWeightKg;
  const canSave = !isEmptyCheckin(values) || hasWeight;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!isEmptyCheckin(values)) await saveWellbeing(logDate, values);
      if (weightChanged && weightKg != null) await logWeight(logDate, weightKg);
      onDone();
    } catch {
      // Un échec doit se voir : sans ça l'utilisateur croit avoir enregistré (leçon CONF-06).
      setError(t('wellbeing.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{t('wellbeing.checkinTitle')}</Text>
      <Text style={[styles.day, { color: colors.textMuted }]}>{formatDayFull(logDate)}</Text>

      {WELLBEING_INDICATORS.map((indicator) => (
        <WellbeingScale
          key={indicator}
          indicator={indicator}
          value={values[indicator] ?? null}
          onChange={(level: WellbeingLevel) =>
            // Retaper le niveau déjà choisi le retire : c'est le seul moyen de corriger une erreur
            // de tap sans quitter la feuille.
            setValues((prev) => ({
              ...prev,
              [indicator]: prev[indicator] === level ? null : level,
            }))
          }
        />
      ))}

      <View style={[styles.weightCard, { borderColor: colors.border }]}>
        <View style={styles.grow}>
          <Text style={[styles.weightLabel, { color: colors.text }]}>
            {t('wellbeing.weightLabel')}
          </Text>
          <Text style={[styles.weightHint, { color: colors.textMuted }]}>
            {t('wellbeing.weightHint')}
          </Text>
        </View>
        <TextInput
          value={weightValue}
          onChangeText={setWeightText}
          keyboardType="decimal-pad"
          placeholder={units.weightSymbol}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('wellbeing.weightLabel')}
          maxFontSizeMultiplier={1.4}
          style={[styles.weightInput, { color: colors.text, borderColor: colors.border }]}
        />
      </View>

      {error !== null && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <Button label={t('wellbeing.save')} onPress={submit} disabled={!canSave} loading={saving} />
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('wellbeing.partialHint')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '88%',
  },
  content: { padding: 20, gap: 14 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  day: { fontFamily: fontFamily.body, fontSize: 13, marginTop: -10 },
  weightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
  },
  grow: { flex: 1, minWidth: 0 },
  weightLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  weightHint: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 2 },
  weightInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 96,
    textAlign: 'right',
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
  },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  hint: { fontFamily: fontFamily.body, fontSize: 12 },
});
