/**
 * US MUSCU-UX05 — **« Le mur »** : les records **tombés**.
 *
 * Le hub affichait « À ta portée » — les records qu'on n'a pas encore battus — et **jamais** ceux
 * qui l'ont été. On montrait la carotte, jamais le trophée, alors que `personal_records` garde
 * chaque record avec sa date et sa valeur précédente depuis MUSC-09.
 *
 * ── Pourquoi une bande horizontale ──────────────────────────────────────────────────────────────
 * C'est le seul endroit de l'écran qui ne se lit pas de haut en bas. Le constat 3 de l'audit était
 * qu'une seule forme, répétée neuf fois, ne donne à l'œil aucune raison de s'arrêter ; casser le
 * rythme vertical une fois vaut mieux que de varier les rayons de bordure.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { useRecentRecords } from '@/data/repositories/strength-cards-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** `AAAA-MM-JJ` → `JJ/MM` (découpage direct : `new Date('AAAA-MM-JJ')` décalerait le jour). */
function dayMonth(dayKey: string): string {
  const [, mm, dd] = dayKey.split('-');
  return `${dd}/${mm}`;
}

type Props = { onOpenExercise: (exerciseId: string) => void };

export function RecordWall({ onOpenExercise }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { records, isLoading } = useRecentRecords();

  // Sans record, pas de mur : un mur vide serait un reproche.
  if (isLoading || records.length === 0) return null;

  return (
    <View style={styles.block} testID="record-wall">
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{t('strengthHub.wall.title')}</Text>
        <Text style={[styles.count, { color: colors.accent }]}>
          {t('strengthHub.wall.count', { count: records.length })}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {records.map((record) => {
          const gain = record.previous === null ? null : record.value - record.previous;
          return (
            <PressableScale
              key={record.id}
              haptic="select"
              onPress={() => onOpenExercise(record.exerciseId)}
              accessibilityRole="button"
              accessibilityLabel={t('strengthHub.wall.a11y', {
                exercise: record.exerciseName,
                value: units.formatWeight(record.value),
                date: dayMonth(record.achievedOn),
              })}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.date, { color: colors.textMuted }]}>
                {dayMonth(record.achievedOn)}
              </Text>
              <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
                {units.formatWeight(record.value)}
              </Text>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {record.exerciseName}
              </Text>
              {/* Sans valeur précédente, c'est un premier record : on ne fabrique pas de « +0 ». */}
              {gain !== null && gain > 0 ? (
                <Text style={[styles.gain, { color: colors.success }]}>
                  +{units.formatWeight(gain)}
                </Text>
              ) : (
                <Text style={[styles.gain, { color: colors.textMuted }]}>
                  {t('strengthHub.wall.first')}
                </Text>
              )}
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 9 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 16 },
  count: { fontFamily: fontFamily.bodyMedium, fontSize: 11.5 },
  strip: { gap: 8, paddingRight: 4 },
  card: { width: 118, borderWidth: 1, borderRadius: 16, padding: 12, gap: 1, minHeight: 44 },
  date: { fontFamily: fontFamily.mono, fontSize: 9.5 },
  value: { fontFamily: fontFamily.displayXBold, fontSize: 20, letterSpacing: -0.6, marginTop: 4 },
  name: { fontFamily: fontFamily.bodySemi, fontSize: 11 },
  gain: { fontFamily: fontFamily.bodyMedium, fontSize: 10.5, marginTop: 2 },
});
