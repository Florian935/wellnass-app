/**
 * US CARDIO-UX02 — **« Le fil du jour »** du pilier Course.
 *
 * Le jumeau de `strength/DayThread` : une bande d'une ligne, pas une carte. C'est la seule chose de
 * l'écran qui change tous les jours. L'audit du 19/09 a relevé côté course le même défaut que côté
 * muscu — la scène a **cinq** états pendant que le corps du hub rendait exactement les mêmes blocs
 * dans les cinq cas.
 *
 * Elle porte **un** insight, jamais trois, et se tait quand il n'y a rien à dire.
 *
 * ── La seule chose qu'elle fait de plus que sa jumelle ───────────────────────────────────────────
 * Elle **formate `seconds`** avant l'interpolation. `InsightCandidate.metrics` n'accepte que des
 * nombres (c'est la contrainte qui garantit qu'aucune carte n'affirme sans chiffre), et un chrono
 * de record vaut 1 450 — qu'on ne peut pas écrire tel quel dans une phrase. Le même parti pris que
 * `ExplainSheet.formatValue`, qui rend chaque étape dans son unité plutôt que de stocker du texte.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDurationHms, type InsightId } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { useRunningThread } from '@/data/repositories/run-cards-repository';
import { fontFamily } from '@/theme/fonts';
import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/useTheme';

type Props = { onPress: () => void };

/** L'icône dit la nature du signal — pas sa gravité : la bande n'alerte jamais. */
const ICON: Partial<Record<InsightId, keyof typeof Ionicons.glyphMap>> = {
  run_record_recent: 'trophy-outline',
  pace_trend: 'trending-up-outline',
  polarisation: 'pie-chart-outline',
};

export function RunThread({ onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { thread, isLoading } = useRunningThread();

  if (isLoading || thread === null) return null;

  const label = t(`insights.cards.${thread.id}.title`, {
    ...thread.metrics,
    subject: thread.subject,
    // `context` est le mécanisme natif d'i18next : il cherche `title_up` puis retombe sur `title`.
    // C'est déjà la forme des clés `body_up` / `body_down` du dépôt — on n'invente pas un second
    // schéma de suffixe.
    context: thread.variant,
    count: Object.values(thread.metrics)[0] ?? 0,
    time: thread.metrics.seconds != null ? formatDurationHms(thread.metrics.seconds) : '',
  });

  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="running-day-thread"
      style={[
        styles.band,
        { backgroundColor: withAlpha(colors.accent, 0.14), borderColor: colors.accent },
      ]}
    >
      <Ionicons name={ICON[thread.id] ?? 'flash-outline'} size={17} color={colors.accent} />
      <Text style={[styles.text, { color: colors.text }]} numberOfLines={2}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={15} color={colors.accent} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 12,
    minHeight: 48,
  },
  text: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 12.5, lineHeight: 17 },
});
