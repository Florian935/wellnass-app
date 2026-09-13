/**
 * « Ce que valait la série » — US MUSCU-UX03, spec §5.3 et §5.4.
 *
 * ── Une règle de ton, pas de couleur ────────────────────────────────────────────────────────────
 * Une série en dessous de la dernière fois n'est **jamais rouge**. Elle est neutre, et elle est
 * factuelle : « 6 reps · mardi 8 ». Rouge, elle dirait « tu as échoué » — alors qu'un jour de moins
 * bonne forme n'est pas un échec, et qu'une app qui juge, on la désinstalle.
 *
 * Un record écrase le verdict : on ne dit pas « +2,5 kg vs mardi » quand on vient de battre son
 * record de charge, on dit le record.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { LiveRecord, SetVerdict } from '@wellness/shared';
import { RECORD_AMBER } from '@/components/workout/immersive/theme';
import type { useUnits } from '@/hooks/useUnits';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

type Props = {
  verdict: SetVerdict;
  record: LiveRecord | null;
  /** Nom du jour de référence, déjà localisé (« mardi », « 02/08 »). */
  dayLabel?: string | null;
  units: ReturnType<typeof useUnits>;
  colors: Palette;
};

export function VerdictChip({ verdict, record, dayLabel = null, units, colors }: Props) {
  const { t } = useTranslation();

  if (record) {
    return (
      <View style={[styles.chip, { borderColor: `${RECORD_AMBER}66`, backgroundColor: `${RECORD_AMBER}1c` }]}>
        <Ionicons name="trophy" size={14} color={RECORD_AMBER} />
        <Text style={[styles.text, { color: RECORD_AMBER }]}>
          {t(
            record.type === 'max_weight'
              ? 'immersive.record.pillWeight'
              : 'immersive.record.pill1rm',
            {
              value: units.formatWeight(record.value),
              previous: units.formatWeight(record.previous),
            },
          )}
        </Text>
      </View>
    );
  }

  // Un échauffement ne se compare à rien : aucune pastille, et c'est voulu.
  if (verdict.kind === 'warmup') return null;

  const day = dayLabel;
  const positive = verdict.kind === 'heavier' || verdict.kind === 'moreReps' || verdict.kind === 'longer';

  const label = (() => {
    switch (verdict.kind) {
      case 'heavier':
        return t(day ? 'immersive.verdict.heavierDay' : 'immersive.verdict.heavier', {
          delta: units.formatWeight(Math.abs(verdict.deltaKg ?? 0)),
          day,
        });
      case 'moreReps':
        return t(day ? 'immersive.verdict.moreRepsDay' : 'immersive.verdict.moreReps', {
          count: Math.abs(verdict.deltaReps ?? 0),
          day,
        });
      case 'longer':
        return t(day ? 'immersive.verdict.longerDay' : 'immersive.verdict.longer', {
          count: Math.abs(verdict.deltaSeconds ?? 0),
          day,
        });
      case 'equal':
        return day ? t('immersive.verdict.equalDay', { day }) : t('immersive.verdict.equal');
      case 'below': {
        // On rappelle la valeur de référence plutôt qu'un écart signé : « −2 reps » se lit comme
        // une sanction, « 6 reps · mardi 8 » comme un fait.
        const reference = verdict.reference;
        if (verdict.deltaSeconds !== null && reference?.durationSeconds != null) {
          return t('immersive.verdict.belowDuration', {
            now: reference.durationSeconds + verdict.deltaSeconds,
            before: reference.durationSeconds,
            day,
          });
        }
        if (verdict.deltaKg !== null && reference?.weightKg != null) {
          return t('immersive.verdict.belowWeight', {
            now: units.formatWeight(reference.weightKg + verdict.deltaKg),
            before: units.formatWeight(reference.weightKg),
            day,
          });
        }
        if (verdict.deltaReps !== null && reference?.reps != null) {
          return t('immersive.verdict.belowReps', {
            now: reference.reps + verdict.deltaReps,
            before: reference.reps,
            day,
          });
        }
        return t('immersive.verdict.equal');
      }
      case 'first':
      default:
        return t('immersive.verdict.first');
    }
  })();

  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: positive ? `${colors.success}66` : colors.border,
          backgroundColor: positive ? `${colors.success}1c` : colors.surfaceAlt,
        },
      ]}
    >
      <Text style={[styles.text, { color: positive ? colors.success : colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
});
