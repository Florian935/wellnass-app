/**
 * Widget conditionnel Tier 2 — Divergence muscu/course (US MR-08), 3 formes.
 *
 * Widget **conditionnel** : rendu seulement si `useConcurrentTrainingInterference().show` (un
 * pilier nettement au-dessus de sa moyenne 4 semaines pendant que l'autre est nettement en
 * dessous). Ton **informatif** (`tone="card"`, pas `"warn"`) — ce n'est pas une alerte de
 * sécurité comme `TrainingLoadAlertCard`, juste un constat chiffré (même patron que
 * `ActivityLevelSuggestionCard`).
 *  - `small` : eyebrow + ⚖️ + titre ;
 *  - `wide`  : tuile ⚖️ + titre + message ;
 *  - `large` : eyebrow + titre + message + hint.
 *
 * **Bidirectionnel** (spec R4) : le titre est statique, seul le message change selon la
 * direction (`runningLabel`/`strengthLabel` interpolés en `up`/`down`). Gardé par pilier dans le
 * hook (`strength` ET `running`, appliqué là, pas ici). Accessibilité : un seul bloc `accessible`,
 * pas des `Text` disjoints.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WidgetSize } from '@wellness/shared';
import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useConcurrentTrainingInterference } from '@/data/repositories/dashboard-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

export function ConcurrentTrainingInterferenceCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const interference = useConcurrentTrainingInterference();

  if (!interference.show) return null;

  const runningLabel = t('home.concurrentTrainingInterference.runningLabel');
  const strengthLabel = t('home.concurrentTrainingInterference.strengthLabel');
  const { up, down } =
    interference.direction === 'runningUpStrengthDown'
      ? { up: runningLabel, down: strengthLabel }
      : { up: strengthLabel, down: runningLabel };

  const title = t('home.concurrentTrainingInterference.title');
  const message = t('home.concurrentTrainingInterference.message', { up, down });
  const hint = t('home.concurrentTrainingInterference.hint');
  const a11yLabel = `${title}. ${message} ${hint}`;

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} tone="card">
        <View accessible accessibilityLabel={a11yLabel} style={styles.smallCol}>
          <View style={styles.head}>
            <Eyebrow>{t('home.concurrentTrainingInterference.eyebrow')}</Eyebrow>
            <Text style={styles.emoji}>⚖️</Text>
          </View>
          <Text style={[styles.smallTitle, { color: colors.text }]} numberOfLines={3}>
            {title}
          </Text>
        </View>
      </WidgetFrame>
    );
  }

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} tone="card">
        <View accessible accessibilityLabel={a11yLabel} style={styles.wideRow}>
          <View style={[styles.tile, { backgroundColor: withAlpha(colors.accent, 0.14) }]}>
            <Text style={styles.emojiLg}>⚖️</Text>
          </View>
          <View style={styles.wideText}>
            <Text style={[styles.wideTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.wideMessage, { color: colors.textMuted }]} numberOfLines={3}>
              {message}
            </Text>
          </View>
        </View>
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  return (
    <WidgetFrame pad={22} tone="card">
      <View accessible accessibilityLabel={a11yLabel} style={styles.largeCol}>
        <View style={styles.head}>
          <Eyebrow>{t('home.concurrentTrainingInterference.eyebrow')}</Eyebrow>
          <Text style={styles.emojiLg}>⚖️</Text>
        </View>
        <Text style={[styles.largeTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.largeMessage, { color: colors.textMuted }]}>{message}</Text>
        <Text style={[styles.hint, { color: colors.accent }]}>{hint}</Text>
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emoji: { fontSize: 15 },
  emojiLg: { fontSize: 22 },
  smallCol: { flex: 1, justifyContent: 'space-between' },
  smallTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 19, marginTop: 'auto' },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  wideText: { flex: 1, gap: 2 },
  wideTitle: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  wideMessage: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  largeCol: { gap: 8, flex: 1 },
  largeTitle: { fontFamily: fontFamily.bodyBold, fontSize: 18, marginTop: 4 },
  largeMessage: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, fontStyle: 'italic', marginTop: 'auto' },
});
