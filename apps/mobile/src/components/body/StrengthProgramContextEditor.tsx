import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  EQUIPMENTS,
  STRENGTH_SESSION_MINUTES,
  type Equipment,
  type StrengthProgramContext,
} from '@wellness/shared';

import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { BodyTrainingButton } from './BodyTrainingButton';

type Props = {
  draft: StrengthProgramContext;
  onChange: (context: StrengthProgramContext) => void;
  onSave: () => void;
  onOpenProfile: () => void;
  dirty: boolean;
  saving: boolean;
  disabled?: boolean;
};

export function StrengthProgramContextEditor({
  draft,
  onChange,
  onSave,
  onOpenProfile,
  dirty,
  saving,
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const toggleEquipment = (equipment: Equipment) => {
    const selected = draft.equipment;
    if (selected === null) {
      onChange({ ...draft, equipment: [equipment] });
      return;
    }
    const next = selected.includes(equipment)
      ? selected.filter((value) => value !== equipment)
      : EQUIPMENTS.filter((value) => [...selected, equipment].includes(value));
    onChange({ ...draft, equipment: next.length === 0 ? null : next });
  };

  const valueText = (value: string | number | null, key?: string) => {
    if (value === null) return t('strengthProgramFinder.context.toConfirm');
    return key ? t(`${key}.${value}`) : String(value);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t('strengthProgramFinder.context.title')}
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('strengthProgramFinder.context.savedHint')}
      </Text>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('strengthProgramFinder.context.level')}
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {valueText(draft.level, 'running.programLevel')}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('strengthProgramFinder.context.availability')}
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {draft.weeklyAvailability === null
              ? t('strengthProgramFinder.context.toConfirm')
              : t('strengthProgramFinder.context.days', {
                  count: draft.weeklyAvailability,
                })}
          </Text>
        </View>
      </View>
      <BodyTrainingButton
        label={t('strengthProgramFinder.context.editProfile')}
        onPress={onOpenProfile}
        disabled={saving}
      />

      <Text style={[styles.section, { color: colors.text }]}>
        {t('strengthProgramFinder.context.duration')}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {STRENGTH_SESSION_MINUTES.map((minutes) => {
          const selected = draft.sessionMinutes === minutes;
          const label = t('strengthProgramFinder.context.minutesChoice', { count: minutes });
          return (
            <Pressable
              key={minutes}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected, disabled: disabled || saving }}
              disabled={disabled || saving}
              onPress={() => onChange({ ...draft, sessionMinutes: minutes })}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: selected ? colors.accent : colors.borderStrong,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? colors.accentText : colors.text }]}>
                {t('strengthProgramFinder.context.minutes', { count: minutes })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.section, { color: colors.text }]}>
        {t('strengthProgramFinder.context.equipment')}
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('strengthProgramFinder.context.equipmentHint')}
      </Text>
      <View style={styles.chips}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={t('strengthProgramFinder.context.allEquipment')}
          accessibilityState={{ checked: draft.equipment === null, disabled: disabled || saving }}
          disabled={disabled || saving}
          onPress={() => onChange({ ...draft, equipment: null })}
          style={[
            styles.chip,
            {
              backgroundColor: draft.equipment === null ? colors.accent : colors.surface,
              borderColor: draft.equipment === null ? colors.accent : colors.borderStrong,
            },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: draft.equipment === null ? colors.accentText : colors.text },
            ]}
          >
            {t('strengthProgramFinder.context.allEquipment')}
          </Text>
        </Pressable>
        {EQUIPMENTS.map((equipment) => {
          const checked = draft.equipment?.includes(equipment) ?? false;
          return (
            <Pressable
              key={equipment}
              accessibilityRole="checkbox"
              accessibilityLabel={t(`equipment.${equipment}`)}
              accessibilityState={{ checked, disabled: disabled || saving }}
              disabled={disabled || saving}
              onPress={() => toggleEquipment(equipment)}
              style={[
                styles.chip,
                {
                  backgroundColor: checked ? colors.accent : colors.surface,
                  borderColor: checked ? colors.accent : colors.borderStrong,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: checked ? colors.accentText : colors.text }]}>
                {t(`equipment.${equipment}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <BodyTrainingButton
        label={t(
          saving
            ? 'strengthProgramFinder.context.saving'
            : 'strengthProgramFinder.context.save',
        )}
        onPress={onSave}
        primary
        disabled={disabled || saving || !dirty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 12 },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 20, lineHeight: 26 },
  section: { fontFamily: fontFamily.bodyBold, fontSize: 16, lineHeight: 22, marginTop: 4 },
  hint: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  summary: { gap: 8 },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  label: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  value: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 14,
    lineHeight: 21,
    flexShrink: 1,
    textAlign: 'right',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  chipText: { fontFamily: fontFamily.bodySemi, fontSize: 14, lineHeight: 20 },
});
