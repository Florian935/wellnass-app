/**
 * US MESUR-01 — feuille de saisie des mensurations.
 *
 * Même patron que `WellbeingCheckinSheet` (BIEN-01) : un formulaire monté à l'ouverture avec une
 * `key`, donc **aucun `setState` dans un effet** — le React Compiler le refuse, et le contourner
 * fabriquait des cascades de rendus.
 *
 * Deux partis pris qui font la différence à l'usage :
 * 1. **tous les champs sont pré-remplis avec le dernier relevé.** On mesure rarement du premier coup,
 *    et repartir de la valeur connue montre l'écart en direct ;
 * 2. **vider un champ retire la mesure de cette date** — c'est le seul moyen de corriger une saisie
 *    erronée, et ça ne touche que cette mesure.
 */

import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  MEASUREMENT_KINDS,
  MEASUREMENT_MAX_CM,
  MEASUREMENT_MIN_CM,
  formatDayFull,
  isValidMeasurementCm,
  localDayKey,
  type MeasurementKind,
  type MeasurementPoint,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import {
  saveMeasurements,
  type MeasurementInput,
} from '@/data/repositories/body-measurement-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Dernier relevé connu de chaque mesure, pour le pré-remplissage. */
  latest: Partial<Record<MeasurementKind, MeasurementPoint>>;
};

export function MeasurementSheet({ visible, onClose, latest }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('measurements.closeSheet')}
      />
      <View
        style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        {visible && <MeasurementForm latest={latest} onDone={onClose} />}
      </View>
    </Modal>
  );
}

function MeasurementForm({
  latest,
  onDone,
}: {
  latest: Partial<Record<MeasurementKind, MeasurementPoint>>;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  const logDate = localDayKey(new Date());

  /** Valeur initiale de chaque champ, dans l'unité **affichée** (pas en cm). */
  const initial = useMemo(() => {
    const out: Partial<Record<MeasurementKind, string>> = {};
    for (const kind of MEASUREMENT_KINDS) {
      const point = latest[kind];
      if (point) out[kind] = String(units.toCircumferenceValue(point.valueCm));
    }
    return out;
  }, [latest, units]);

  const [texts, setTexts] = useState<Partial<Record<MeasurementKind, string>>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Seules les mesures **modifiées** partent en écriture — on ne réécrit pas ce qui n'a pas bougé. */
  const changed = useMemo(() => {
    const out: MeasurementInput = {};
    for (const kind of MEASUREMENT_KINDS) {
      const text = texts[kind] ?? '';
      if (text === (initial[kind] ?? '')) continue;

      const cm = units.parseCircumferenceToCm(text);
      // Champ vidé → `null` = retrait de la mesure pour cette date.
      out[kind] = text.trim() === '' ? null : cm;
    }
    return out;
  }, [texts, initial, units]);

  const touched = Object.keys(changed).length > 0;
  // Une valeur saisie mais illisible (« abc ») ressort en `null` alors que le champ n'est pas vide :
  // on refuse d'enregistrer plutôt que d'effacer silencieusement la mesure.
  const hasBadInput = MEASUREMENT_KINDS.some((kind) => {
    const text = texts[kind] ?? '';
    return text.trim() !== '' && units.parseCircumferenceToCm(text) === null;
  });
  /**
   * Valeur lisible mais **hors bornes** (500 cm). Contrôlée ici et pas seulement au dépôt : sans
   * ça, la valeur se parse, le bouton reste actif, l'écriture échoue et l'utilisateur reçoit
   * « n'ont pas pu être enregistrées, **réessaie** » — un conseil faux, puisque réessayer avec la
   * même valeur échouera toujours (constaté en recette device du 31/07/2026).
   */
  const hasOutOfRange = MEASUREMENT_KINDS.some((kind) => {
    const text = texts[kind] ?? '';
    if (text.trim() === '') return false;
    const cm = units.parseCircumferenceToCm(text);
    return cm !== null && !isValidMeasurementCm(cm);
  });

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveMeasurements(logDate, changed);
      onDone();
    } catch {
      setError(t('measurements.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{t('measurements.sheetTitle')}</Text>
      <Text style={[styles.day, { color: colors.textMuted }]}>{formatDayFull(logDate)}</Text>

      <View style={[styles.card, { borderColor: colors.border }]}>
        {MEASUREMENT_KINDS.map((kind, index) => {
          const point = latest[kind];
          const text = texts[kind] ?? '';
          const cm = units.parseCircumferenceToCm(text);
          const delta =
            point && cm !== null ? Math.round((cm - point.valueCm) * 10) / 10 : null;

          return (
            <View
              key={kind}
              style={[
                styles.row,
                index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
              ]}
            >
              <Text
                style={[styles.label, { color: colors.text }]}
                numberOfLines={2}
                maxFontSizeMultiplier={1.3}
              >
                {t(`measurements.kinds.${kind}`)}
              </Text>

              {/* Le delta vit à côté du champ : l'écart avec le dernier relevé est l'information
                  qui donne du sens à la saisie. Porté par le TEXTE (signe), pas par la couleur. */}
              {delta !== null && delta !== 0 && (
                <Text
                  style={[
                    styles.delta,
                    { color: delta < 0 ? colors.success : colors.warnText },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  {delta > 0 ? `+${delta}` : String(delta)}
                </Text>
              )}

              <TextInput
                value={text}
                onChangeText={(next) => setTexts((prev) => ({ ...prev, [kind]: next }))}
                keyboardType="decimal-pad"
                placeholder={units.circumferenceSymbol}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={t('measurements.a11yField', {
                  kind: t(`measurements.kinds.${kind}`),
                  unit: units.circumferenceSymbol,
                })}
                maxFontSizeMultiplier={1.4}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />
            </View>
          );
        })}
      </View>

      {error !== null && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {hasBadInput && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {t('measurements.invalidValue')}
        </Text>
      )}
      {!hasBadInput && hasOutOfRange && (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {t('measurements.outOfRange', {
            min: units.formatCircumference(MEASUREMENT_MIN_CM),
            max: units.formatCircumference(MEASUREMENT_MAX_CM),
          })}
        </Text>
      )}

      <Button
        label={t('measurements.save')}
        onPress={submit}
        disabled={!touched || hasBadInput || hasOutOfRange}
        loading={saving}
      />
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('measurements.optionalHint')}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '88%' },
  content: { padding: 20, gap: 14 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  day: { fontFamily: fontFamily.body, fontSize: 13, marginTop: -10 },
  card: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, minHeight: 56 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 14, flex: 1 },
  delta: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, minWidth: 42, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 92,
    textAlign: 'right',
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
  },
  error: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  hint: { fontFamily: fontFamily.body, fontSize: 12 },
});
