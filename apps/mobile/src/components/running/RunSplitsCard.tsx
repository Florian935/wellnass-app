/**
 * US DASH-01 (§4.3) — le **km par km** de la dernière sortie, dans le hub.
 *
 * La donnée existait déjà (`computeKmSplits`, posée par ALLURE-01) mais ne se voyait que dans
 * l'analyse d'une course, à trois écrans du hub, ou en miniature dans un grand widget sans
 * échelle ni chiffres. Ici chaque kilomètre est **touchable** : un tap affiche son temps et son
 * écart à la référence — la plage d'allure visée si la séance en avait une, sinon l'allure moyenne
 * de la sortie. Sans trace GPS exploitable, la carte se tait (jamais de barres vides).
 */

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { computeKmSplits, decodeTrack } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { DenseTile } from '@/components/stage/DenseTile';
import { useRun, useRunTarget } from '@/data/repositories/run-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** En dessous de deux kilomètres pleins, « km par km » n'est pas une lecture, c'est une valeur. */
const MIN_SPLITS = 2;
const BAR_MAX_HEIGHT = 64;
const BAR_MIN_HEIGHT = 10;

type Props = {
  runId: string | null;
  plannedSessionId: string | null;
  onOpen: () => void;
};

export function RunSplitsCard({ runId, plannedSessionId, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const [selectedKm, setSelectedKm] = useState<number | null>(null);

  // Hooks inconditionnels : les deux requêtes se replient sur une chaîne vide quand il n'y a rien.
  const { run } = useRun(runId ?? undefined);
  const target = useRunTarget(plannedSessionId);

  const track = run?.gpsTrack ?? null;
  const splits = useMemo(() => (track ? computeKmSplits(decodeTrack(track)) : []), [track]);

  /**
   * La référence à laquelle chaque kilomètre se compare : le **milieu de la plage visée** quand la
   * séance en avait une (c'est la question qu'on se pose après une séance à allure imposée), sinon
   * l'allure moyenne des splits — qui dit au moins si on a accéléré ou ralenti.
   */
  const reference = useMemo(() => {
    const min = target?.targetPaceMinSPerKm ?? null;
    const max = target?.targetPaceMaxSPerKm ?? null;
    if (min != null && max != null) return { seconds: (min + max) / 2, fromTarget: true };
    if (min != null) return { seconds: min, fromTarget: true };
    if (splits.length === 0) return null;
    return { seconds: splits.reduce((sum, s) => sum + s.seconds, 0) / splits.length, fromTarget: false };
  }, [target?.targetPaceMinSPerKm, target?.targetPaceMaxSPerKm, splits]);

  if (splits.length < MIN_SPLITS || !reference) return null;

  const slowest = Math.max(...splits.map((s) => s.seconds));
  const fastestKm = splits.reduce((best, s) => (s.seconds < best.seconds ? s : best), splits[0]!).km;
  const selected = splits.find((s) => s.km === selectedKm) ?? null;
  const delta = selected ? Math.round(selected.seconds - reference.seconds) : 0;

  return (
    <DenseTile
      title={t('stage.running.splits.title')}
      meta={t('stage.running.splits.meta', { count: splits.length })}
      onPress={onOpen}
      accessibilityHint={t('stage.running.splits.hint')}
      testID="run-splits-card"
    >
      <View style={styles.bars}>
        {splits.map((split) => {
          // Une barre **haute = rapide** : l'œil lit une performance, pas une durée.
          const ratio = slowest > 0 ? split.seconds / slowest : 1;
          const height = BAR_MIN_HEIGHT + (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) * (1 - ratio + 0.35);
          const isSelected = split.km === selectedKm;
          const isFastest = split.km === fastestKm;
          return (
            <PressableScale
              key={split.km}
              haptic="select"
              // Sélectionner deux fois le même kilomètre le désélectionne : pas d'état piégé.
              onPress={() => setSelectedKm((current) => (current === split.km ? null : split.km))}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t('stage.running.splits.kmA11y', {
                km: split.km,
                pace: units.formatPace(split.seconds),
              })}
              style={styles.barCol}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.min(BAR_MAX_HEIGHT, height),
                    backgroundColor: isSelected
                      ? colors.accent
                      : isFastest
                        ? colors.success
                        : colors.track,
                  },
                ]}
              />
              <Text style={[styles.barLabel, { color: isSelected ? colors.text : colors.textMuted }]}>
                {split.km}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <Text style={[styles.detail, { color: colors.text }]}>
        {selected
          ? t(delta === 0 ? 'stage.running.splits.onPace' : delta < 0 ? 'stage.running.splits.faster' : 'stage.running.splits.slower', {
              km: selected.km,
              pace: units.formatPace(selected.seconds),
              seconds: Math.abs(delta),
            })
          : t(reference.fromTarget ? 'stage.running.splits.hintTarget' : 'stage.running.splits.hintAverage', {
              pace: units.formatPace(Math.round(reference.seconds)),
            })}
      </Text>
    </DenseTile>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, minHeight: BAR_MAX_HEIGHT + 18 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 5, minWidth: 6 },
  barLabel: { fontFamily: fontFamily.mono, fontSize: 10 },
  detail: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 18 },
});
