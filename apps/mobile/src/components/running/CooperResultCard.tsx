/**
 * « Ton test de 12 minutes », en tête de l'arrivée (US CARDIO-02, §3.2, R8, R11, R12).
 *
 * La distance à 12:00 est **mesurée sur la trace** (`measureCooperTest`), pas lue sur le chrono :
 * elle ne dépend ni du moment du Stop, ni de l'écran resté allumé. L'allure n'est écrite qu'au choix
 * du coureur (« Retenir cette allure ») ; « Pas cette fois » ne l'écrit pas. Les deux effacent le
 * marqueur — et seulement eux : quitter l'arrivée sans choisir laisse la mesure proposée dans la
 * porte du test (R8).
 */

import { formatMmSs } from '@wellness/shared';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { TrainingPaceList } from '@/components/running/TrainingPaceList';
import { upsertRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useUnits } from '@/hooks/useUnits';
import { useCooperMeasure } from '@/running/cooper-measure';
import { useCooperTest } from '@/stores/cooper-test-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * « 2 400 m » en métrique (l'unité du test de Cooper), des miles en impérial. L'espace insécable fine
 * de `Intl` (U+202F) est remplacée : certaines polices de l'app ne la dessinent pas.
 */
function testDistanceLabel(meters: number, system: 'metric' | 'imperial', locale: string, formatDistance: (km: number) => string) {
  if (system === 'imperial') return formatDistance(meters / 1000);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(meters).replace(/\u202f/g, '\u00a0')} m`;
}

export function CooperResultCard({ runId }: { runId: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { measure } = useCooperMeasure(runId);
  const clear = useCooperTest((s) => s.clear);
  const lock = useActionLock();
  const [outcome, setOutcome] = useState<{ kind: 'saved'; sPerKm: number } | { kind: 'dismissed' } | null>(null);

  if (outcome?.kind === 'dismissed') return null;

  if (outcome?.kind === 'saved') {
    return (
      <View
        testID="cooper-result-saved"
        accessibilityRole="alert"
        style={[styles.saved, { backgroundColor: colors.surfaceAlt }]}
      >
        <Ionicons name="checkmark" size={18} color={colors.accent} />
        <Text style={[styles.savedText, { color: colors.text }]}>
          {t('running.cooper.result.saved', { pace: units.formatPace(outcome.sPerKm) })}
        </Text>
      </View>
    );
  }

  if (!measure) return null;

  const retain = (sPerKm: number) =>
    void lock(async () => {
      await upsertRunnerProfile({ ref5kPaceSPerKm: sPerKm });
      clear();
      setOutcome({ kind: 'saved', sPerKm });
    });
  const dismiss = () => {
    clear();
    setOutcome({ kind: 'dismissed' });
  };

  return (
    <View testID="cooper-result" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>{t('running.cooper.result.eyebrow')}</Text>

      {measure.status === 'ok' ? (
        <>
          <View>
            <Text testID="cooper-result-distance" style={[styles.distance, { color: colors.text }]}>
              {testDistanceLabel(measure.distanceM, units.system, i18n.language, units.formatDistance)}
            </Text>
            <Text style={[styles.caption, { color: colors.textMuted }]}>{t('running.cooper.result.caption')}</Text>
          </View>
          <View style={[styles.preview, { backgroundColor: colors.surfaceAlt }]}>
            {/* Le libellé groupé ne couvre que la ligne de l'allure : les quatre allures, dessous,
                restent lues une à une. */}
            <View
              style={styles.paceRow}
              accessible
              accessibilityLabel={t('running.refPace.preview.a11y', {
                pace: units.formatPace(measure.sPerKm),
                time: formatMmSs(measure.sPerKm * 5),
              })}
            >
              <Text style={[styles.paceLabel, { color: colors.accent }]}>{t('running.cooper.result.pace')}</Text>
              <Text testID="cooper-result-pace" style={[styles.pace, { color: colors.accent }]}>
                {units.formatPace(measure.sPerKm)}
              </Text>
              <Text style={[styles.caption, { color: colors.text }]}>
                {t('running.refPace.preview.equivalent', { time: formatMmSs(measure.sPerKm * 5) })}
              </Text>
            </View>
            <TrainingPaceList refSPerKm={measure.sPerKm} />
          </View>
          <View style={styles.actions}>
            <View style={styles.grow}>
              <Button
                testID="cooper-result-retain"
                label={t('running.refPace.save')}
                onPress={() => retain(measure.sPerKm)}
                haptic="confirm"
              />
            </View>
            <Button
              testID="cooper-result-dismiss"
              label={t('running.cooper.result.dismiss')}
              variant="ghost"
              onPress={dismiss}
            />
          </View>
        </>
      ) : (
        <View style={styles.failed}>
          <Text style={[styles.failedTitle, { color: colors.text }]}>
            {measure.status === 'incomplete'
              ? t('running.cooper.result.incompleteTitle')
              : measure.status === 'interrupted'
                ? t('running.cooper.result.interruptedTitle')
                : t('running.cooper.result.eyebrow')}
          </Text>
          <Text testID="cooper-result-why" style={[styles.body, { color: colors.text }]}>
            {measure.status === 'incomplete'
              ? t('running.cooper.result.incomplete', { time: formatMmSs(measure.lastSeconds) })
              : measure.status === 'interrupted'
                ? t('running.cooper.result.interrupted')
                : measure.status === 'noTrack'
                  ? t('running.cooper.result.noTrack')
                  : t('running.cooper.result.outOfRange', { pace: units.formatPace(measure.sPerKm) })}
          </Text>
          <Text style={[styles.caption, { color: colors.textMuted }]}>{t('running.cooper.result.recorded')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1.5, padding: 16, gap: 12 },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  distance: { fontFamily: fontFamily.monoBold, fontSize: 34 },
  caption: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  preview: { borderRadius: 16, padding: 12, gap: 10 },
  paceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  paceLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  pace: { fontFamily: fontFamily.monoBold, fontSize: 22 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  failed: { gap: 6 },
  failedTitle: { fontFamily: fontFamily.displaySemi, fontSize: 19, letterSpacing: -0.3 },
  body: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, padding: 12 },
  savedText: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 13.5, lineHeight: 19 },
});
