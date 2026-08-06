/**
 * US VIE-01 — feuille de déclaration d'une période « mode vie réelle ».
 *
 * Même patron que `GoalFormSheet` / `MeasurementSheet` : le formulaire est **monté à l'ouverture**
 * (rendu conditionnel dans la `Modal`), donc aucun `setState` dans un effet — le React Compiler le
 * refuse.
 *
 * ── Deux choix d'ergonomie assumés ────────────────────────────────────────────────────────────────
 * 1. **Aucun sélecteur de date.** La durée se choisit parmi 3 (décision D3) et le début parmi 3
 *    décalages relatifs, tous en `<Segment>`. On reprend le raisonnement d'OBJ-01 : « une période se
 *    pense en durée, pas en date », et surtout cela évite une **dépendance native** — ce qui garde
 *    l'US recettable sur l'APK existant, contrairement à PARTAGE-01 / RUN-F2a / MUSC-F9.
 * 2. **Le cas nominal est un seul tap.** Les valeurs par défaut (7 jours, à partir d'aujourd'hui)
 *    sont celles de la grande majorité des cas : ouvrir puis valider suffit.
 */

import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  REAL_LIFE_DURATIONS,
  REAL_LIFE_MAX_BACKDATE_DAYS,
  addDays,
  localDayKey,
  validateRealLifePeriod,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { Segment } from '@/components/Segment';
import {
  RealLifePeriodValidationError,
  startRealLifePeriod,
} from '@/data/repositories/real-life-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Décalages de début proposés, en jours dans le passé.
 *
 * Bornés par `REAL_LIFE_MAX_BACKDATE_DAYS` (décision D5) : la dernière option est **exactement** la
 * borne, donc l'UI ne peut pas produire une saisie que la validation refuserait.
 */
const START_OFFSETS = [0, 3, REAL_LIFE_MAX_BACKDATE_DAYS] as const;

type Props = { visible: boolean; onClose: () => void };

export function RealLifeSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('realLife.close')}
      />
      <View
        style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        {visible && <RealLifeForm onDone={onClose} />}
      </View>
    </Modal>
  );
}

function RealLifeForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [durationDays, setDurationDays] = useState<number>(7);
  const [startOffset, setStartOffset] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { startedOn, endsOn } = useMemo(() => {
    const now = new Date();
    const start = localDayKey(addDays(now, -startOffset));
    // Bornes **incluses** : une période de 7 jours qui commence aujourd'hui finit à J+6.
    return { startedOn: start, endsOn: localDayKey(addDays(now, durationDays - 1 - startOffset)) };
  }, [durationDays, startOffset]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      // ⚠️ Jamais `void` : c'est ce qui avait rendu la panne de CYCLE-01 invisible (écriture en échec,
      // erreur avalée, interrupteur qui reste éteint sans message).
      await startRealLifePeriod({ startedOn, endsOn });
      onDone();
    } catch (err) {
      setError(
        err instanceof RealLifePeriodValidationError
          ? t(`realLife.errors.${err.reason}`, { count: REAL_LIFE_MAX_BACKDATE_DAYS })
          : t('realLife.errors.failed'),
      );
    } finally {
      setSaving(false);
    }
  };

  // Garde de cohérence : l'UI borne déjà les choix, donc ceci ne devrait jamais bloquer. On le calcule
  // quand même — c'est gratuit, et ça évite de proposer un bouton qui échouera.
  const invalid =
    validateRealLifePeriod({ startedOn, endsOn, todayKey: localDayKey(new Date()) }) !== null;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: colors.text }]}>{t('realLife.title')}</Text>
      <Text style={[styles.intro, { color: colors.textMuted }]}>{t('realLife.intro')}</Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('realLife.duration.label')}</Text>
      <Segment<string>
        options={REAL_LIFE_DURATIONS.map(String)}
        value={String(durationDays)}
        onChange={(next) => setDurationDays(Number(next))}
        label={(option) => t('realLife.duration.days', { count: Number(option) })}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('realLife.startedOn')}</Text>
      <Segment<string>
        options={START_OFFSETS.map(String)}
        value={String(startOffset)}
        onChange={(next) => setStartOffset(Number(next))}
        label={(option) =>
          Number(option) === 0
            ? t('realLife.startToday')
            : t('realLife.startDaysAgo', { count: Number(option) })
        }
      />
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('realLife.retroHint', { count: REAL_LIFE_MAX_BACKDATE_DAYS })}
      </Text>

      {error !== null && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <Button
        label={t('realLife.submit')}
        onPress={submit}
        disabled={invalid}
        loading={saving}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '90%' },
  content: { padding: 20, gap: 10 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  intro: { fontFamily: fontFamily.body, fontSize: 13.5, marginBottom: 4 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 14, marginTop: 6 },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5 },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
