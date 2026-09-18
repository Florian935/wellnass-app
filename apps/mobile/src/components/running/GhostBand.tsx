/**
 * US FANT-01 — la bande « fantôme » de l'écran de suivi (spec §3, §9).
 *
 * Ne rend **rien** sans fantôme : une course sans fantôme choisi doit afficher exactement l'écran
 * d'avant (spec R5 de la recette, critère 1).
 *
 * ⚠️ **Aucune information portée par la seule couleur** (CONF-07) : le signe, le mot (avance /
 * retard) et l'étiquette d'accessibilité disent la même chose que la teinte. La bande est annoncée
 * d'un bloc par TalkBack.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { GhostGap } from '@wellness/shared';

import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Mètres → yards en réglage impérial (spec §7 : l'écart suit les unités, à l'écran comme à la voix). */
export function formatGapDistance(
  meters: number,
  system: 'metric' | 'imperial',
): { value: string; symbol: string } {
  const abs = Math.abs(meters);
  const converted = system === 'imperial' ? Math.round(abs * 1.09361) : abs;
  return { value: String(converted), symbol: system === 'imperial' ? 'yd' : 'm' };
}

export function GhostBand({ gap, ghostDate }: { gap: GhostGap | null; ghostDate: string | null }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();

  if (gap === null || ghostDate === null) return null;

  const { value, symbol } = formatGapDistance(gap.meters, units.system);
  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
  }).format(new Date(ghostDate));

  // Les nombres sont formatés AVANT `t()` (piège n° 3 de bonnes-pratiques.md).
  const gapLabel =
    gap.status === 'level'
      ? t('running.ghost.level')
      : gap.meters >= 0
        ? t('running.ghost.ahead', { meters: `${value} ${symbol}` })
        : t('running.ghost.behind', { meters: `${value} ${symbol}` });

  const main =
    gap.status === 'finished' ? t('running.ghost.finished', { gap: gapLabel }) : gapLabel;

  const seconds =
    gap.seconds !== null && gap.status !== 'level'
      ? t('running.ghost.seconds', { seconds: String(Math.abs(gap.seconds)) })
      : null;

  const tone =
    gap.status === 'ahead' ? colors.success : gap.status === 'behind' ? colors.accent : colors.textMuted;

  return (
    <View
      accessible
      accessibilityLabel={t('running.ghost.a11y', { date: dateLabel, gap: main })}
      style={[styles.band, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
        {t('running.ghost.selected', { date: dateLabel })}
      </Text>
      <View style={styles.row}>
        <Text style={[styles.gap, { color: tone }]} maxFontSizeMultiplier={1.4}>
          {main}
        </Text>
        {seconds ? (
          <Text style={[styles.seconds, { color: colors.textMuted }]}>{seconds}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pas de `height` : la bande grandit avec la police système (recette à 1,5×).
  band: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 2,
  },
  label: {
    fontFamily: fontFamily.monoBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  gap: { fontFamily: fontFamily.displayBold, fontSize: 20, letterSpacing: -0.4 },
  seconds: { fontFamily: fontFamily.body, fontSize: 13 },
});
