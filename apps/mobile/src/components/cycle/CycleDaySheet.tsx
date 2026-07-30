/**
 * US CYCLE-01 — feuille de saisie d'un jour (flux + symptômes).
 *
 * Même patron que `WellbeingCheckinSheet` : une feuille, pas un écran poussé — la saisie doit rester
 * un geste court.
 *
 * Trois points de conception à ne pas défaire :
 * 1. **Rien n'est obligatoire.** Un jour sans flux ni symptôme est une saisie **valide** : c'est
 *    ainsi qu'on efface une saisie précédente. Refuser rendrait la correction impossible.
 * 2. **Liste fermée de symptômes, aucun champ libre** (R7) — risque disproportionné sur une donnée
 *    de santé sensible, et inexploitable en croisement.
 * 3. **Aucun effet ne réamorce l'état** : le formulaire porte une `key`, rouvrir la feuille le
 *    remonte. Pas de `setState` dans un `useEffect` (le React Compiler le refuse).
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  MENSTRUAL_FLOWS,
  MENSTRUAL_SYMPTOMS,
  formatDayFull,
  type MenstrualFlow,
  type MenstrualSymptom,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import {
  saveMenstrualDailyLog,
  type MenstrualDailyLog,
} from '@/data/repositories/menstrual-cycle-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Jour visé (AAAA-MM-JJ). */
  logDate: string;
  /** Journal déjà enregistré pour ce jour, s'il existe : on corrige au lieu de recréer. */
  existing: MenstrualDailyLog | null;
};

export function CycleDaySheet({ visible, onClose, logDate, existing }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('cycle.sheet.close')}
      >
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.background }]}
          onPress={() => undefined}
        >
          {visible && (
            <Form
              key={`${logDate}:${existing?.id ?? 'new'}`}
              logDate={logDate}
              existing={existing}
              onClose={onClose}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Form({
  logDate,
  existing,
  onClose,
}: {
  logDate: string;
  existing: MenstrualDailyLog | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [flow, setFlow] = useState<MenstrualFlow | null>(existing?.flow ?? null);
  const [symptoms, setSymptoms] = useState<MenstrualSymptom[]>(existing?.symptoms ?? []);
  const [saving, setSaving] = useState(false);

  const toggleSymptom = (s: MenstrualSymptom) =>
    setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const onSave = async () => {
    setSaving(true);
    try {
      await saveMenstrualDailyLog(logDate, { flow, symptoms });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: colors.text }]}>{t('cycle.sheet.title')}</Text>
      <Text style={[styles.date, { color: colors.textMuted }]}>{formatDayFull(logDate)}</Text>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('cycle.sheet.flow')}</Text>
          <Text style={[styles.optional, { color: colors.textMuted }]}>
            {t('cycle.sheet.optionalSingle')}
          </Text>
        </View>
        <View style={styles.grid}>
          {MENSTRUAL_FLOWS.map((f) => {
            const on = flow === f;
            return (
              <Pressable
                key={f}
                // Un second appui **désélectionne** : sans ça, on ne pourrait pas corriger une
                // erreur de flux sans supprimer toute la ligne.
                onPress={() => setFlow(on ? null : f)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[
                  styles.choice,
                  {
                    backgroundColor: on ? colors.accent : colors.surface,
                    borderColor: on ? colors.accent : colors.borderStrong,
                  },
                ]}
              >
                <Text
                  style={[styles.choiceText, { color: on ? colors.accentText : colors.text }]}
                  maxFontSizeMultiplier={1.3}
                >
                  {t(`cycle.flow.${f}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('cycle.sheet.symptoms')}
          </Text>
          <Text style={[styles.optional, { color: colors.textMuted }]}>
            {t('cycle.sheet.optionalMulti')}
          </Text>
        </View>
        <View style={styles.chips}>
          {MENSTRUAL_SYMPTOMS.map((s) => {
            const on = symptoms.includes(s);
            return (
              <Pressable
                key={s}
                onPress={() => toggleSymptom(s)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: on ? colors.accent : colors.surface,
                    borderColor: on ? colors.accent : colors.borderStrong,
                  },
                ]}
              >
                <Text
                  style={[styles.chipText, { color: on ? colors.accentText : colors.text }]}
                  maxFontSizeMultiplier={1.3}
                >
                  {t(`cycle.symptoms.${s}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Button label={t('cycle.sheet.save')} onPress={() => void onSave()} disabled={saving} />
      <Button label={t('cycle.sheet.cancel')} variant="ghost" onPress={onClose} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%' },
  body: { padding: 22, gap: 14 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 22 },
  date: { fontFamily: fontFamily.body, fontSize: 13, marginTop: -8 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7 },
  optional: { fontFamily: fontFamily.body, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  choiceText: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontFamily: fontFamily.bodyMedium, fontSize: 13 },
});
