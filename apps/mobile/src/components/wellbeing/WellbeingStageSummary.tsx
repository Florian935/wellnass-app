/**
 * US BIEN-02 / BIEN-04 — la forme du jour, posée dans la scène du pilier (onglet Aujourd'hui).
 *
 * Le verdict est celui du score de forme (TRI-03, `useReadiness`) — jamais un second calcul : le même
 * mot qu'à l'accueil. Le pilier n'y ajoute que **les raisons du jour** (nuit, énergie, stress de la
 * veille, envie, malade), en pastilles, chacune avec sa flèche ET son mot (jamais la couleur seule).
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hasMorningCheckin } from '@wellness/shared';

import { useStageTheme } from '@/components/stage/PillarStage';
import { useReadiness } from '@/data/repositories/dashboard-repository';
import { useTodayWellbeing } from '@/data/repositories/daily-wellbeing-repository';
import { useWellbeingDay } from '@/data/repositories/wellbeing-pillar-repository';
import { fontFamily } from '@/theme/fonts';

export function WellbeingStageSummary() {
  const { t } = useTranslation();
  const stage = useStageTheme('wellbeing');
  const readiness = useReadiness();
  const { entry } = useTodayWellbeing();
  const { day } = useWellbeingDay();
  const morningDone = hasMorningCheckin(entry);

  const verdict = readiness.show && readiness.verdict !== null ? readiness.verdict : null;
  const signals = day?.signals ?? [];

  return (
    <View style={[styles.box, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]} testID="wellbeing-stage-summary" accessible>
      <Text style={[styles.overline, { color: stage.inkMuted }]}>{t('home.readiness.eyebrow')}</Text>
      <Text style={[styles.verdict, { color: stage.ink }]}>
        {verdict === null ? t('wellbeingHub.stage.noVerdict') : t(`home.readiness.verdict.${verdict}.title`)}
      </Text>
      <Text style={[styles.message, { color: stage.inkMuted }]}>
        {!morningDone ? t('wellbeingHub.stage.morningFirst') : verdict === null ? t('wellbeingHub.stage.noVerdictHint') : t('wellbeingHub.stage.suggestion')}
      </Text>
      {signals.length > 0 ? (
        <View style={styles.chips}>
          {signals.map((s) => (
            <View key={s.code} style={[styles.chip, { borderColor: stage.glassBorder }]}>
              <Text style={[styles.chipText, { color: stage.ink }]}>
                {s.tone === 'down' ? '↓ ' : '↑ '}
                {t(`wellbeingHub.signals.${s.code}`)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 4 },
  overline: { fontFamily: fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  verdict: { fontFamily: fontFamily.displayBold, fontSize: 24, letterSpacing: -0.4 },
  message: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
});
