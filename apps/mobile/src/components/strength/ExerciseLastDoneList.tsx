/**
 * Historique › Par exercice : la dernière fois de chaque exercice — US MUSCU-UX07, R7 (repris de A).
 *
 * Pour qui s'entraîne sans programme, « la dernière fois » ne peut pas vivre dans une carte du jour :
 * elle vit ici. Un champ de recherche (insensible à la casse et aux accents), puis chaque exercice
 * pratiqué, du plus récent au plus ancien, avec sa date, sa séance, sa dernière fois (R3) et son
 * record de charge. Appui → la fiche de l'exercice.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatLastPerformance } from '@wellness/shared';
import type { ExerciseLastDone } from '@/data/repositories/workout-repository';
import { formatShortDay, useLastPerfFormat } from '@/hooks/useLastPerfFormat';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Minuscules, sans accents : « couche » trouve « Développé couché ». */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

type Props = {
  items: readonly ExerciseLastDone[];
  onOpen: (exerciseId: string) => void;
};

export function ExerciseLastDoneList({ items, onOpen }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const format = useLastPerfFormat();
  const [query, setQuery] = useState('');

  const needle = normalizeSearch(query);
  const shown = needle === '' ? items : items.filter((item) => normalizeSearch(item.name ?? '').includes(needle));

  return (
    <View style={styles.block}>
      <Text nativeID="history-exercise-search-label" style={[styles.label, { color: colors.textMuted }]}>
        {t('history.byExercise.search')}
      </Text>
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          testID="history-exercise-search"
          accessibilityLabelledBy="history-exercise-search-label"
          accessibilityLabel={t('history.byExercise.search')}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {shown.length === 0 ? (
          <Text style={[styles.none, { color: colors.textMuted }]}>{t('history.byExercise.none')}</Text>
        ) : (
          shown.map((item) => {
            const name = item.name?.trim() || '—';
            const when = t('history.byExercise.when', {
              date: formatShortDay(item.finishedAt, i18n.language),
              session: item.sessionName?.trim() || t('history.freeSession'),
            });
            const last = formatLastPerformance(item.sets, format) ?? '—';
            const record =
              item.recordKg != null
                ? t('history.byExercise.record', {
                    value:
                      item.recordReps != null
                        ? `${units.formatWeight(item.recordKg)} × ${item.recordReps}`
                        : units.formatWeight(item.recordKg),
                  })
                : null;
            return (
              <Pressable
                key={item.exerciseId}
                testID={`exercise-last-${item.exerciseId}`}
                onPress={() => onOpen(item.exerciseId)}
                accessibilityRole="button"
                accessibilityLabel={[name, when, last, record].filter(Boolean).join(' · ')}
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.border }, pressed && styles.pressed]}
              >
                <View style={styles.rowHead}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[styles.when, { color: colors.textMuted }]} numberOfLines={1}>
                    {when}
                  </Text>
                </View>
                <Text style={[styles.last, { color: colors.text }]} numberOfLines={1}>
                  {last}
                </Text>
                {record ? <Text style={[styles.record, { color: colors.warnText }]}>{record}</Text> : null}
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: { flex: 1, minHeight: 44, fontFamily: fontFamily.body, fontSize: 15 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginTop: 4 },
  none: { padding: 16, fontFamily: fontFamily.body, fontSize: 13.5 },
  row: { gap: 4, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.7 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1, fontFamily: fontFamily.bodyBold, fontSize: 15 },
  when: { fontFamily: fontFamily.body, fontSize: 12 },
  last: { fontFamily: fontFamily.mono, fontSize: 13 },
  record: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
});
