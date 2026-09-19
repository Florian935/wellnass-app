/**
 * US CARDIO-UX02 — **« Ton allure »**, la carte dominante du hub Course.
 *
 * C'est la plus grande carte de l'écran, et la seule posée sur un `PillarPanel` : elle porte la
 * question qui donne envie de rouvrir l'app demain — *est-ce que je cours plus vite ?* — et elle
 * ramène le bleu du pilier dans le corps de la page, ce qui était l'autre moitié du retour de
 * Florian (voir l'en-tête de `PillarPanel`).
 *
 * ── Deux visages, choisis par les données ────────────────────────────────────────────────────────
 *  - `onboarding` : la **meilleure allure tenue** et le volume parcouru. Un débutant n'a pas deux
 *    fenêtres de 30 jours à comparer, mais il a des kilomètres — et c'est le moment où l'app risque
 *    le plus d'être désinstallée. Même raisonnement que le visage `onboarding` de « Tes charges ».
 *  - `established` : l'écart d'allure médian entre les 30 derniers jours et les 30 précédents,
 *    plus la tendance longue (90 j) en second plan.
 *
 * ── Deux détails de lecture qui ne sont pas des détails ──────────────────────────────────────────
 *  1. **La courbe est retournée** : une allure qui baisse est un progrès, donc une ligne qui monte.
 *     Tracer l'allure brute ferait descendre la courbe quand le coureur s'améliore — l'exact
 *     contraire de ce que l'œil comprend. Même parti pris que les barres de `RunSplitsCard`
 *     (« une barre haute = rapide »).
 *  2. **Le signe est celui du produit, pas celui du nombre** : `deltaSPerKm` est positif quand on
 *     accélère, alors que l'allure, elle, a baissé. La brique s'en charge (`pace-progress.ts`),
 *     l'écran n'a plus qu'à choisir la flèche.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PACE_WINDOW_DAYS, type PaceTrendKind } from '@wellness/shared';
import { Sparkline } from '@/components/widgets/primitives';
import { PanelGlass, PillarPanel, usePanelInk } from '@/components/stage/PillarPanel';
import { usePaceProgress } from '@/data/repositories/run-cards-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';

type Props = { onPress: () => void };

/** La flèche d'un sens. Jamais seule porteuse de l'information — le texte le dit aussi. */
const ARROW: Record<'up' | 'flat' | 'down', keyof typeof Ionicons.glyphMap> = {
  up: 'arrow-up',
  flat: 'remove',
  down: 'arrow-down',
};

/** Les mêmes libellés de tendance que `/running-history` — un verdict n'a pas deux noms. */
const TREND_KEY: Record<PaceTrendKind, string> = {
  improving: 'running.history.trendImproving',
  declining: 'running.history.trendDeclining',
  stable: 'running.history.trendStable',
};

export function PaceProgressCard({ onPress }: Props) {
  const { t } = useTranslation();
  const ink = usePanelInk('running');
  const units = useUnits();
  const { progress, series, isLoading } = usePaceProgress();

  // Une carte qui n'a rien à dire ne dit rien : elle ne s'excuse pas.
  if (isLoading || progress.kind === 'empty') return null;

  if (progress.kind === 'onboarding') {
    return (
      <PillarPanel
        pillar="running"
        title={t('runningHub.pace.title.onboarding')}
        meta={t('runningHub.pace.runs', { count: progress.runs })}
        onPress={onPress}
        testID="pace-progress-card"
      >
        <Text style={[styles.hero, { color: ink.ink }]}>
          {units.formatPace(progress.bestPaceSPerKm)}
        </Text>
        <Text style={[styles.caption, { color: ink.inkMuted }]}>
          {t('runningHub.pace.onboardingCaption', {
            distance: units.formatDistance(progress.totalDistanceM / 1000),
          })}
        </Text>
        <Curve series={series} color={ink.accent} />
      </PillarPanel>
    );
  }

  const delta = Math.abs(progress.deltaSPerKm);
  // Sur le panneau, le vert et l'ambre de la palette ne sont pas garantis lisibles : les encres de
  // scène le sont (mesurées par `theme/__tests__/stage.test.ts`). On module donc l'intensité, pas
  // la teinte — et le sens reste porté par la flèche ET par la phrase.
  const toneColor = progress.direction === 'flat' ? ink.inkMuted : ink.ink;

  return (
    <PillarPanel
      pillar="running"
      title={t('runningHub.pace.title.established')}
      meta={t('runningHub.pace.window', { days: PACE_WINDOW_DAYS })}
      onPress={onPress}
      testID="pace-progress-card"
    >
      <View style={styles.heroRow}>
        <Text style={[styles.hero, { color: ink.ink }]}>
          {units.formatPace(progress.currentPaceSPerKm)}
        </Text>
        <View style={styles.deltaRow}>
          <Ionicons name={ARROW[progress.direction]} size={16} color={toneColor} />
          <Text style={[styles.delta, { color: toneColor }]}>
            {t('runningHub.pace.delta', { count: delta })}
          </Text>
        </View>
      </View>

      <Text style={[styles.caption, { color: ink.inkMuted }]}>
        {t(`runningHub.pace.caption.${progress.direction}`, {
          previous: units.formatPace(progress.previousPaceSPerKm),
        })}
      </Text>

      <Curve series={series} color={ink.accent} />

      <View style={styles.foot}>
        <PanelGlass ink={ink} style={styles.cell}>
          <Text style={[styles.cellLabel, { color: ink.inkMuted }]} numberOfLines={1}>
            {t('runningHub.pace.trendLabel')}
          </Text>
          <Text style={[styles.cellValue, { color: ink.ink }]} numberOfLines={1}>
            {t(TREND_KEY[progress.trend])}
          </Text>
        </PanelGlass>
        <PanelGlass ink={ink} style={styles.cell}>
          <Text style={[styles.cellLabel, { color: ink.inkMuted }]} numberOfLines={1}>
            {t('runningHub.pace.sampleLabel')}
          </Text>
          <Text style={[styles.cellValue, { color: ink.ink }]} numberOfLines={1}>
            {t('runningHub.pace.sample', {
              current: progress.runsCurrent,
              previous: progress.runsPrevious,
            })}
          </Text>
        </PanelGlass>
      </View>
    </PillarPanel>
  );
}

/**
 * La ligne des 90 derniers jours, **retournée** pour que « plus haut » veuille dire « plus vite ».
 *
 * `max − valeur` plutôt que `−valeur` : `Sparkline` normalise sur l'étendue de la série, donc les
 * deux donnent le même tracé — mais des valeurs positives se relisent sans avoir à se rappeler
 * qu'on a inversé un signe.
 */
function Curve({ series, color }: { series: number[]; color: string }) {
  if (series.length < 2) return null;
  const max = Math.max(...series);
  return (
    <View style={styles.curve}>
      <Sparkline values={series.map((v) => max - v)} height={64} color={color} area showDot />
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  hero: { fontFamily: fontFamily.displayXBold, fontSize: 40, letterSpacing: -1.6 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  delta: { fontFamily: fontFamily.monoBold, fontSize: 15 },
  caption: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 18 },
  curve: { marginTop: 2 },
  foot: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1 },
  cellLabel: { fontFamily: fontFamily.bodySemi, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4 },
  cellValue: { fontFamily: fontFamily.monoBold, fontSize: 13 },
});
