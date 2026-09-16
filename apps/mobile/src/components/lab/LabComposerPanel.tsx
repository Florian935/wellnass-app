/**
 * US LABO-01 — onglet « Composer » : régler ses piliers ensemble, et voir ce que ça change.
 *
 * ⚠️ **Ce que cet écran n'affiche pas** : aucune projection de chrono. Le prototype montrait
 * « 10 km −25 s » ; ce chiffre venait d'un coefficient inventé. Ici, on n'affiche que ce qu'un
 * calcul testé produit : la projection de force (« Et si… », DASH-01), le ratio de charge (META-19),
 * la cible calorique et la variation de poids qui en découle, les protéines et les glucides.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  LAB_PROJECTION_WEEKS,
  type LabComposerResult,
  type LabDoses,
  type LabLever,
  type Pillar,
} from '@wellness/shared';

import { Lens } from './Lens';
import { formatDecimal } from './lab-format';
import { Stepper } from './Stepper';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  doses: LabDoses;
  result: LabComposerResult;
  best: { lever: LabLever; direction: 1 | -1; deltaKg: number }[];
  activePillars: readonly Pillar[];
  onStep: (lever: LabLever, direction: 1 | -1) => void;
  onReset: () => void;
  hasChanges: boolean;
};

export function LabComposerPanel({ doses, result, best, activePillars, onStep, onReset, hasChanges }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = i18n.language;

  const levers: { lever: LabLever; value: string; visible: boolean }[] = [
    { lever: 'strengthSessions', value: t('lab.composer.sessions', { count: doses.strengthSessions }), visible: activePillars.includes('strength') },
    { lever: 'runningFrequency', value: t('lab.composer.outings', { count: doses.runningFrequency }), visible: activePillars.includes('running') },
    { lever: 'proteinGPerKg', value: t('lab.composer.gPerKg', { value: formatDecimal(doses.proteinGPerKg, locale) }), visible: activePillars.includes('nutrition') },
    { lever: 'objective', value: t(`nutrition.objective.options.${doses.objective}`), visible: activePillars.includes('nutrition') },
    { lever: 'sleep', value: t(`lab.composer.sleepValue.${doses.sleep}`), visible: true },
  ];

  return (
    <View style={styles.panel}>
      {/* Ce que ça donne */}
      <View style={styles.cards}>
        {result.sbd ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="lab-composer-sbd">
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('lab.composer.sbd', { weeks: LAB_PROJECTION_WEEKS })}</Text>
            <Text style={[styles.cardValue, { color: colors.text }]}>{t('lab.composer.kg', { value: result.sbd.projectedKg })}</Text>
            <Text style={[styles.cardNote, { color: colors.textMuted }]}>
              {t('lab.composer.range', { low: result.sbd.lowKg, high: result.sbd.highKg })}
            </Text>
            {result.sbd.deltaKg !== 0 ? (
              <Text style={[styles.cardDelta, { color: result.sbd.deltaKg > 0 ? colors.success : colors.warnText }]}>
                {t('lab.composer.deltaKg', { value: result.sbd.deltaKg > 0 ? `+${result.sbd.deltaKg}` : `${result.sbd.deltaKg}` })}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('lab.composer.sbd', { weeks: LAB_PROJECTION_WEEKS })}</Text>
            <Text style={[styles.cardNote, { color: colors.textMuted }]}>{t('lab.composer.noHistory')}</Text>
          </View>
        )}

        {result.load ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="lab-composer-load">
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('lab.composer.load')}</Text>
            <Text style={[styles.cardValue, { color: colors.text }]}>{formatDecimal(result.load.ratio, locale, 2)}</Text>
            <Text style={[styles.cardNote, { color: result.load.zone === 'risk' ? colors.danger : colors.textMuted }]}>
              {t(`lab.composer.loadZone.${result.load.zone}`)}
            </Text>
          </View>
        ) : null}

        {result.kcalTarget !== null ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="lab-composer-kcal">
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('lab.composer.kcal')}</Text>
            <Text style={[styles.cardValue, { color: colors.text }]}>{result.kcalTarget}</Text>
            <Text style={[styles.cardNote, { color: colors.textMuted }]}>
              {t('lab.composer.weightChange', { value: formatDecimal(result.weightChangeKg, locale), weeks: LAB_PROJECTION_WEEKS })}
            </Text>
          </View>
        ) : null}

        {result.proteinGPerDay !== null ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="lab-composer-protein">
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('lab.composer.protein')}</Text>
            <Text style={[styles.cardValue, { color: colors.text }]}>{t('lab.composer.gPerDay', { value: result.proteinGPerDay })}</Text>
            <Text style={[styles.cardNote, { color: result.proteinStatus === 'low' ? colors.warnText : colors.textMuted }]}>
              {t(`lab.composer.proteinStatus.${result.proteinStatus}`)}
            </Text>
          </View>
        ) : null}

        {result.carbTarget ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="lab-composer-carbs">
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('lab.composer.carbs')}</Text>
            <Text style={[styles.cardValue, { color: colors.text }]}>
              {t('lab.composer.carbsRange', { min: result.carbTarget.min, max: result.carbTarget.max })}
            </Text>
            <Text style={[styles.cardNote, { color: colors.textMuted }]}>{t('lab.composer.carbsNote')}</Text>
          </View>
        ) : null}
      </View>

      {/* Le réglage le plus rentable */}
      {best.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('lab.composer.best')}</Text>
          {best.map((step) => (
            <View key={`${step.lever}${step.direction}`} style={[styles.bestRow, { borderColor: colors.border }]}>
              <View style={styles.bestBody}>
                <Text style={[styles.bestLabel, { color: colors.text }]}>
                  {t(`lab.composer.step.${step.lever}.${step.direction === 1 ? 'up' : 'down'}`)}
                </Text>
                <Text style={[styles.bestEffect, { color: colors.success }]}>{t('lab.composer.bestEffect', { value: step.deltaKg })}</Text>
              </View>
              <Stepper
                label={t(`lab.composer.step.${step.lever}.${step.direction === 1 ? 'up' : 'down'}`)}
                onPress={() => onStep(step.lever, step.direction)}
                icon="arrow-forward"
              />
            </View>
          ))}
        </View>
      ) : null}

      {/* Les leviers */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('lab.composer.levers')}</Text>
          {hasChanges ? (
            <Text accessibilityRole="button" onPress={onReset} style={[styles.reset, { color: colors.textMuted }]}>
              {t('lab.composer.reset')}
            </Text>
          ) : null}
        </View>
        {levers
          .filter((l) => l.visible)
          .map(({ lever, value }) => (
            <View key={lever} style={[styles.lever, { borderColor: colors.border }]} testID={`lab-lever-${lever}`}>
              <Text style={[styles.leverName, { color: colors.text }]}>{t(`lab.composer.lever.${lever}`)}</Text>
              <View style={styles.leverControls}>
                <Stepper label={t('lab.composer.decrease', { lever: t(`lab.composer.lever.${lever}`) })} onPress={() => onStep(lever, -1)} icon="remove" />
                <Text style={[styles.leverValue, { color: colors.text }]}>{value}</Text>
                <Stepper label={t('lab.composer.increase', { lever: t(`lab.composer.lever.${lever}`) })} onPress={() => onStep(lever, 1)} icon="add" />
              </View>
            </View>
          ))}
      </View>

      {/* Les croisements de la formule */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('lab.composer.crossings')}</Text>
        {result.crossings.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('lab.composer.noCrossing')}</Text>
        ) : (
          result.crossings.map((crossing) => (
            <View
              key={crossing.kind}
              testID={`lab-crossing-${crossing.kind}`}
              style={[
                styles.crossing,
                {
                  backgroundColor: colors.surface,
                  borderColor: crossing.tone === 'guard' ? colors.danger : crossing.tone === 'tension' ? colors.warnText : colors.success,
                },
              ]}
            >
              <Lens pair={crossing.pair} />
              <View style={styles.crossingBody}>
                <Text style={[styles.crossingTitle, { color: colors.text }]}>{t(`lab.crossings.${crossing.kind}.title`, crossing.values)}</Text>
                <Text style={[styles.crossingText, { color: colors.textMuted }]}>{t(`lab.crossings.${crossing.kind}.text`, crossing.values)}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.honest, { color: colors.textMuted }]}>{t('lab.composer.honest')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 20 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 1, flexBasis: '45%', borderRadius: 16, borderWidth: 1, padding: 12, gap: 2 },
  cardLabel: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  cardValue: { fontFamily: fontFamily.displayXBold, fontSize: 22 },
  cardNote: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 15 },
  cardDelta: { fontFamily: fontFamily.monoBold, fontSize: 11.5 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  reset: { fontFamily: fontFamily.body, fontSize: 12.5, textDecorationLine: 'underline' },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', padding: 10 },
  bestBody: { flex: 1, gap: 2 },
  bestLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  bestEffect: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  lever: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, paddingVertical: 8 },
  leverName: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14 },
  leverControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leverValue: { minWidth: 104, textAlign: 'center', fontFamily: fontFamily.mono, fontSize: 12.5 },
  crossing: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, padding: 10 },
  crossingBody: { flex: 1, gap: 2 },
  crossingTitle: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  crossingText: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  empty: { fontFamily: fontFamily.body, fontSize: 13 },
  honest: { fontFamily: fontFamily.body, fontSize: 12, fontStyle: 'italic', lineHeight: 16 },
});
