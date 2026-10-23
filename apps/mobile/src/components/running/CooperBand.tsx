/**
 * Le bandeau du test de 12 minutes, sur l'écran de course (US CARDIO-02, §3.2).
 *
 * « reste 7:42 » → « Plus qu'une minute » → « Test terminé » ; ou « Test interrompu par la pause ».
 * Il ne dit **pas** de distance à 12:00 : la mesure se fait sur la trace, à l'arrivée, et un chiffre
 * affiché ici pourrait différer de quelques mètres du chiffre retenu.
 */

import { formatMmSs, type CooperPhase } from '@wellness/shared';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = { phase: CooperPhase; remainingS: number };

export function CooperBand({ phase, remainingS }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const elapsed = 720 - remainingS;
  const progress = phase === 'done' ? 1 : Math.min(1, Math.max(0, elapsed / 720));

  const title =
    phase === 'done'
      ? t('running.cooper.band.done')
      : phase === 'interrupted'
        ? t('running.cooper.band.interrupted')
        : phase === 'lastMinute'
          ? t('running.cooper.band.lastMinute')
          : t('running.cooper.band.remaining', { time: formatMmSs(remainingS) });
  const body =
    phase === 'done'
      ? t('running.cooper.band.doneBody')
      : phase === 'interrupted'
        ? t('running.cooper.band.interruptedBody')
        : null;
  const side =
    phase === 'lastMinute'
      ? t('running.cooper.band.remaining', { time: formatMmSs(remainingS) })
      : phase === 'running'
        ? t('running.cooper.band.elapsed', { time: formatMmSs(elapsed) })
        : null;
  const background = phase === 'interrupted' ? colors.surfaceAlt : colors.accent;
  const ink = phase === 'interrupted' ? colors.text : colors.accentText;

  return (
    <View testID={`cooper-band-${phase}`} accessibilityRole="summary" style={[styles.band, { backgroundColor: background }]}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: ink }]}>{t('running.cooper.band.eyebrow')}</Text>
        {side ? <Text style={[styles.side, { color: ink }]}>{side}</Text> : null}
      </View>
      {/* Annoncé au lecteur d'écran à chaque changement de phase seulement : le compte à rebours, lui,
          change chaque seconde et couvrirait les annonces vocales pendant onze minutes. */}
      <Text
        accessibilityLiveRegion={phase === 'running' ? 'none' : 'polite'}
        style={[styles.title, { color: ink }]}
      >
        {title}
      </Text>
      {body ? <Text style={[styles.body, { color: ink }]}>{body}</Text> : null}
      <View style={[styles.track, { backgroundColor: phase === 'interrupted' ? colors.border : 'rgba(255,255,255,0.25)' }]}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: ink }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { marginHorizontal: 16, marginTop: 8, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  side: { fontFamily: fontFamily.monoBold, fontSize: 12 },
  title: { fontFamily: fontFamily.displaySemi, fontSize: 22, letterSpacing: -0.4 },
  body: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  fill: { height: 6, borderRadius: 3 },
});
