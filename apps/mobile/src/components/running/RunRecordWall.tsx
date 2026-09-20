/**
 * US CARDIO-UX02 — **« Tes records »**, la bande horizontale du hub Course.
 *
 * Le pendant course de `strength/RecordWall`, et pour la même raison : le hub montrait la carotte
 * (les chronos **projetés** de `RunPredictionsCard`) et jamais le trophée. RUN-03 est livrée depuis
 * le 30/07 et ses records ne se voyaient que dans une section de `/running-history`.
 *
 * ── Pourquoi une bande, et pas une sixième carte empilée ─────────────────────────────────────────
 * C'est le seul bloc de l'écran qui ne se lit pas de haut en bas (règle R5 de MUSCU-UX05, reprise
 * ici) : le rythme vertical est cassé **une fois**, par un changement de direction, pas en faisant
 * varier les rayons de bordure. Et cinq distances tiennent en une ligne défilante là où elles
 * feraient cinq lignes dans une carte.
 *
 * ⚠️ `running_pace_records` ne garde **qu'une ligne par distance** : il n'y a pas d'historique, donc
 * pas de « +12 s depuis le précédent ». On affiche le chrono et sa date, et rien d'autre — la même
 * honnêteté que la scène d'arrivée, qui refuse de calculer un écart avec une estimation qu'elle n'a
 * pas gardée.
 *
 * 📌 **Mise à jour du 20/09/2026 (US EFFORT-01)** : cet avertissement est ce qui a fait naître
 * l'US. L'historique existe désormais, dans `run_efforts` — mais il alimente la **fiche d'une
 * sortie**, pas ce mur : ici on continue d'afficher le palmarès nu. Le rang et l'écart se lisent
 * là où ils ont du sens, sur la sortie qui vient d'être courue.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  formatDurationHms,
  localDayKey,
  CANONICAL_RECORD_DISTANCES,
  RECORD_DISTANCE_I18N_KEY,
} from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = { onOpen: () => void };

export function RunRecordWall({ onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { records, isLoading } = useRunningRecords();

  // US EFFORT-01, spec R3 — le mur reste aux **cinq** distances historiques. Le palmarès en porte
  // désormais huit (400 m, demi-mile et mile sont arrivés avec le journal des efforts) : sans ce
  // filtre, la bande passerait de 5 à 8 cartes. CARDIO-UX02 vient de dégonfler ce hub et
  // ADR-007 interdit de le regonfler — les trois nouvelles vivent dans la fiche d'une sortie.
  const shown = records.filter((r) => CANONICAL_RECORD_DISTANCES.includes(r.distanceKey));

  if (isLoading || shown.length === 0) return null;

  return (
    <View style={styles.wrap} testID="run-record-wall">
      <Text style={[styles.overline, { color: colors.textMuted }]}>
        {t('runningHub.records.title')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Pas de débord négatif : la bande reste dans la gouttière du corps (20 px, posée par
        // `StageScrollView`), exactement comme le mur muscu. Un `marginHorizontal` négatif ferait
        // passer les cartes sous la coulée de la scène, qui est peinte en absolu sur la même zone.
        contentContainerStyle={styles.row}
      >
        {shown.map((record) => (
          <PressableScale
            key={record.distanceKey}
            haptic="select"
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={t('runningHub.records.a11y', {
              distance: t(RECORD_DISTANCE_I18N_KEY[record.distanceKey]),
              time: formatDurationHms(record.bestTimeSeconds),
            })}
            style={[styles.cell, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.distance, { color: colors.accent }]} numberOfLines={1}>
              {t(RECORD_DISTANCE_I18N_KEY[record.distanceKey])}
            </Text>
            <Text style={[styles.time, { color: colors.text }]} numberOfLines={1}>
              {formatDurationHms(record.bestTimeSeconds)}
            </Text>
            <Text style={[styles.date, { color: colors.textMuted }]} numberOfLines={1}>
              {dayMonth(localDayKey(new Date(record.achievedAt)))}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

/** `AAAA-MM-JJ` → `JJ/MM` (découpage direct : `new Date('AAAA-MM-JJ')` décalerait le jour). */
function dayMonth(dayKey: string): string {
  const [, mm, dd] = dayKey.split('-');
  return `${dd}/${mm}`;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  overline: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { gap: 8, paddingRight: 4 },
  cell: { minWidth: 104, borderRadius: 16, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 13, gap: 2 },
  distance: { fontFamily: fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  time: { fontFamily: fontFamily.monoBold, fontSize: 16 },
  date: { fontFamily: fontFamily.mono, fontSize: 10.5 },
});
