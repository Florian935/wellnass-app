/**
 * US EFFORT-01 — « Tes meilleurs efforts », sur la fiche d'une sortie.
 *
 * ── Ce que cette carte répare ───────────────────────────────────────────────────────────────────
 * Jusqu'ici, la fin d'une course n'affichait **quelque chose que si un record tombait**
 * (`CelebrationCard`). Sinon : rien. Une sortie honnête, rapide, mais sans record, ne racontait
 * strictement rien — alors qu'un 2ᵉ ou 3ᵉ meilleur temps est une information motivante et que le
 * calcul existait déjà.
 *
 * Elle **se tait** quand il n'y a rien à dire (course sur tapis, trace trop courte) : une ligne
 * honnête, jamais un bloc vide. Budget d'écran oblige — `analysis.tsx` porte déjà la carte, les
 * splits, le réalisé par fraction et les trois lectures d'ALLURE-01 (ADR-007, INSIGHTS-02).
 *
 * 🔴 Le **rattrapage** est déclenché ici, et pas ailleurs : c'est le premier écran qui a besoin des
 * rangs, donc le seul endroit où leur calcul se justifie. Sans lui, le premier effort de chaque
 * distance s'afficherait « 1ᵉʳ » à quelqu'un qui a déjà couru quarante fois.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  formatDurationHms,
  ordinalCategory,
  RECORD_DISTANCE_I18N_KEY,
  type RecordDistanceKey,
} from '@wellness/shared';

import { Card } from '@/components/Card';
import {
  backfillRunEfforts,
  useRunEfforts,
  type RankedRunEffort,
} from '@/data/repositories/run-effort-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * `runId` accepte `undefined` : il vient de `useLocalSearchParams`, qui ne peut rien garantir. La
 * carte se tait alors, comme le reste de l'écran — plutôt qu'un `!` qui déplacerait le problème.
 */
type Props = { runId: string | null | undefined; hasTrack: boolean };

/** Formate un écart en secondes : « 9 s » ou « 1 min 12 ». */
function formatGap(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded} s`;
  const min = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${min} min` : `${min} min ${rest}`;
}

export function RunEffortsCard({ runId, hasTrack }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { efforts, isLoading } = useRunEfforts(runId);

  // Un seul déclenchement par montage — le verrou du repository protège des appels concurrents,
  // ce ref protège des rendus successifs.
  const backfillTriggered = useRef(false);
  useEffect(() => {
    if (isLoading || backfillTriggered.current) return;
    backfillTriggered.current = true;
    backfillRunEfforts().catch((err) => {
      console.warn('[RunEffortsCard] rattrapage des efforts échoué :', err);
    });
  }, [isLoading]);

  /**
   * « 2ᵉ » / « 2nd » — jamais une concaténation, l'anglais changerait de suffixe.
   *
   * ⚠️ Le résultat se passe à i18n sous le nom **`rank`**, jamais `ordinal` : `ordinal` est une
   * option **réservée** d'i18next (un booléen, pour les pluriels ordinaux), et l'utiliser comme
   * variable d'interpolation ne compile pas.
   */
  const rankLabel = (n: number) =>
    t(`run.efforts.ordinal.${ordinalCategory(n, i18n.language)}`, { n });

  const distanceLabel = (key: RecordDistanceKey) => t(RECORD_DISTANCE_I18N_KEY[key]);

  // La carte se tait plutôt que d'afficher un bloc vide.
  if (!runId || isLoading) return null;
  if (efforts.length === 0) {
    if (hasTrack) return null;
    return (
      <Card>
        <Text style={[styles.title, { color: colors.text }]}>{t('run.efforts.title')}</Text>
        <Text style={[styles.muted, { color: colors.textMuted }]}>{t('run.efforts.noTrack')}</Text>
      </Card>
    );
  }

  const best = efforts.reduce((a, b) => (a.rank <= b.rank ? a : b));
  const hasRecord = best.rank === 1;
  const inTopThree = efforts.filter((e) => e.rank <= 3).length;

  return (
    <Card>
      <Text style={[styles.title, { color: colors.text }]}>{t('run.efforts.title')}</Text>

      {/* Le bandeau qui porte tout le sens de l'US : une sortie sans record a quand même
          quelque chose à dire. */}
      <View style={[styles.hero, { backgroundColor: colors.panel }]}>
        <Text style={[styles.heroOverline, { color: colors.panelMuted }]}>
          {hasRecord ? t('run.efforts.recordToday') : t('run.efforts.noRecordToday')}
        </Text>
        <Text style={[styles.heroLine, { color: colors.panelText }]}>
          {hasRecord
            ? t('run.efforts.recordLine', { distance: distanceLabel(best.distanceKey) })
            : t('run.efforts.stillSomething', {
                distance: distanceLabel(best.distanceKey),
                rank: rankLabel(best.rank),
              })}
        </Text>
        {!hasRecord ? (
          <Text style={[styles.heroGap, { color: colors.panelAccent }]}>
            {t('run.efforts.gap', { gap: formatGap(best.gapSeconds) })}
          </Text>
        ) : null}
      </View>

      <View style={styles.counters}>
        <View style={[styles.counter, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.counterValue, { color: colors.text }]}>{efforts.length}</Text>
          <Text style={[styles.counterLabel, { color: colors.textMuted }]}>
            {t('run.efforts.countDistances')}
          </Text>
        </View>
        <View style={[styles.counter, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.counterValue, { color: colors.amber }]}>{inTopThree}</Text>
          <Text style={[styles.counterLabel, { color: colors.textMuted }]}>
            {t('run.efforts.countTopThree')}
          </Text>
        </View>
      </View>

      {efforts.map((effort) => (
        <EffortRow
          key={effort.id}
          effort={effort}
          label={distanceLabel(effort.distanceKey)}
          rankLabel={rankLabel(effort.rank)}
          colors={colors}
          t={t}
        />
      ))}
    </Card>
  );
}

function EffortRow({
  effort,
  label,
  rankLabel,
  colors,
  t,
}: {
  effort: RankedRunEffort;
  label: string;
  rankLabel: string;
  colors: ReturnType<typeof useTheme>['colors'];
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const isRecord = effort.rank === 1;
  return (
    <View
      style={[styles.row, { borderTopColor: colors.border }]}
      accessible
      accessibilityLabel={t('run.efforts.a11yRow', {
        rank: rankLabel,
        distance: label,
        time: formatDurationHms(effort.timeSeconds),
      })}
    >
      <View
        style={[
          styles.badge,
          { backgroundColor: isRecord ? colors.amber : colors.surfaceAlt },
        ]}
      >
        <Text style={[styles.badgeText, { color: isRecord ? '#ffffff' : colors.textMuted }]}>
          {effort.rank}
        </Text>
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rowNote, { color: colors.textMuted }]}>
          {isRecord
            ? t('run.efforts.isRecord')
            : t('run.efforts.gap', { gap: formatGap(effort.gapSeconds) })}
        </Text>
      </View>
      <Text style={[styles.rowTime, { color: colors.text }]}>
        {formatDurationHms(effort.timeSeconds)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fontFamily.displaySemi, fontSize: 15, marginBottom: 10 },
  muted: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  hero: { borderRadius: 14, padding: 14, gap: 4 },
  heroOverline: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroLine: { fontFamily: fontFamily.displaySemi, fontSize: 17, lineHeight: 23 },
  heroGap: { fontFamily: fontFamily.bodyMedium, fontSize: 13 },
  counters: { flexDirection: 'row', gap: 8, marginTop: 12 },
  counter: { flexGrow: 1, flexBasis: 0, borderRadius: 12, padding: 10 },
  counterValue: { fontFamily: fontFamily.displayBold, fontSize: 22 },
  counterLabel: { fontFamily: fontFamily.body, fontSize: 11, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    marginTop: 4,
    borderTopWidth: 1,
  },
  badge: {
    width: 28,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fontFamily.displayBold, fontSize: 13 },
  rowMain: { flexGrow: 1, flexBasis: 0 },
  rowLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  rowNote: { fontFamily: fontFamily.body, fontSize: 11, marginTop: 1 },
  rowTime: { fontFamily: fontFamily.monoBold, fontSize: 16 },
});
