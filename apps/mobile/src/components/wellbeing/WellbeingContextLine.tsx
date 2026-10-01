/**
 * US BIEN-04 — la ligne « contexte » des bilans : ce que l'état du jour était, là où l'on relit une
 * séance, une sortie ou une journée.
 *
 * Le constat qui l'a fait naître (planche « Le contexte dans une sortie », 01/10/2026) : le bilan d'une
 * séance ratée ne disait jamais « nuit de 5 h 40 la veille ». Cette ligne le dit — et, quand le lien
 * du Labo a assez de cas, ajoute **ce que ça fait d'habitude** (« après une nuit courte, ton tonnage
 * baisse en moyenne de 9 % »). Elle **explique**, elle ne juge pas : jamais « tu aurais dû ».
 *
 * Rien pilier éteint, rien sans check-in ce jour-là : une ligne vide n'existe pas.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { isPoorNight, isSleepMinutes, isWellbeingLevel, type WellbeingLinkId } from '@wellness/shared';

import { formatMinutes } from '@/components/lab/lab-format';
import { useLevelLabel } from '@/components/wellbeing/WellbeingScale';
import { useCrossLinks } from '@/data/repositories/cross-links-repository';
import { useWellbeingForDay } from '@/data/repositories/daily-wellbeing-repository';
import { useWellbeingPillar } from '@/data/repositories/wellbeing-pillar-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** Le jour de la séance, de la sortie ou de la journée (AAAA-MM-JJ). */
  dayKey: string | null;
  /** Le pilier du bilan : choisit le lien « d'habitude » à citer. */
  pillar: 'strength' | 'running' | 'nutrition';
};

const NIGHT_LINK: Record<Props['pillar'], WellbeingLinkId> = {
  strength: 'nightStrength',
  running: 'nightRunning',
  nutrition: 'nightIntake',
};

export function WellbeingContextLine({ dayKey, pillar }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const levelLabel = useLevelLabel();
  const { enabled } = useWellbeingPillar();
  const { entry } = useWellbeingForDay(dayKey ?? '');
  const crossLinks = useCrossLinks();

  if (!enabled || dayKey === null || entry === null) return null;

  const facts: string[] = [];
  if (isSleepMinutes(entry.sleepMinutes)) {
    facts.push(
      isWellbeingLevel(entry.sleepQuality)
        ? t('wellbeingHub.context.nightWithQuality', { value: formatMinutes(entry.sleepMinutes), quality: levelLabel('sleepQuality', entry.sleepQuality).toLocaleLowerCase() })
        : t('wellbeingHub.context.night', { value: formatMinutes(entry.sleepMinutes) }),
    );
  } else if (isWellbeingLevel(entry.sleepQuality)) {
    facts.push(t('wellbeingHub.context.quality', { quality: levelLabel('sleepQuality', entry.sleepQuality).toLocaleLowerCase() }));
  }
  if (isWellbeingLevel(entry.energy)) facts.push(t('wellbeingHub.context.energy', { level: levelLabel('energy', entry.energy).toLocaleLowerCase() }));
  if (isWellbeingLevel(entry.motivation) && pillar !== 'nutrition') {
    facts.push(t('wellbeingHub.context.motivation', { level: levelLabel('motivation', entry.motivation).toLocaleLowerCase() }));
  }
  for (const tag of ['sick', 'travel', 'busyDay', 'lateNight'] as const) {
    if (entry[tag]) facts.push(t(`wellbeing.tags.${tag}`).toLocaleLowerCase());
  }
  if (facts.length === 0) return null;

  // Ce que ça fait d'habitude — seulement si la nuit de ce jour-là était courte ou agitée, et que le
  // lien a assez de cas pour le dire (« probable » ou « solide »).
  const link = crossLinks?.wellbeing?.links.find((l) => l.id === NIGHT_LINK[pillar]) ?? null;
  const usual =
    isPoorNight(entry) === true && link !== null && (link.status === 'probable' || link.status === 'solid') && link.delta !== null
      ? t(`wellbeingHub.context.usual.${pillar}`, {
          delta: link.delta > 0 ? `+${link.delta}` : `${link.delta}`.replace('-', '−'),
          count: link.exposed,
        })
      : null;

  return (
    <View style={[styles.box, { borderColor: colors.pillarWellbeing, backgroundColor: colors.surface }]} testID="wellbeing-context-line">
      <Text style={[styles.overline, { color: colors.pillarWellbeing }]}>{t('wellbeingHub.context.overline')}</Text>
      <Text style={[styles.facts, { color: colors.text }]}>{facts.join(' · ')}</Text>
      {usual !== null ? <Text style={[styles.usual, { color: colors.text }]}>{usual}</Text> : null}
      <Pressable onPress={() => router.push('/wellbeing-hub?section=journal')} accessibilityRole="link" hitSlop={8}>
        <Text style={[styles.link, { color: colors.accent }]}>{t('wellbeingHub.context.open')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1.5, borderRadius: 16, padding: 14, gap: 4 },
  overline: { fontFamily: fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  facts: { fontFamily: fontFamily.bodySemi, fontSize: 14, lineHeight: 20 },
  usual: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  link: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 4 },
});
