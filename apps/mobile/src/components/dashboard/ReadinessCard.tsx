/**
 * Widget transverse Tier 0 — Score de forme / readiness global (US TRI-03), 3 formes.
 *
 * **Transverse** (`'always'`, comme `WellbeingCard`/`ReviewCard`) : contrairement aux widgets
 * conditionnels (`TrainingLoadAlertCard`/`OvertrainingGuardCard`, qui rendent `null` hors d'une
 * zone de risque), celui-ci a quelque chose à dire la plupart des jours dès qu'une composante a
 * des données. Rendu `null` seulement si les 3 composantes sont `unavailable` (spec R5).
 *  - `small` : eyebrow + emoji + titre du verdict ;
 *  - `wide`  : tuile emoji + titre + message ;
 *  - `large` : eyebrow + titre + message + détail des 3 composantes (spec R8 — jamais un verdict
 *    nu, toujours traçable jusqu'à sa source).
 *
 * Ton par verdict : `rest` reprend le ton « alerte douce » (warn) des autres garde-fous ; `ok` et
 * `push` restent sur la carte neutre (`tone="card"`), seule la teinte du texte/de la tuile change
 * (`success` pour `push`) — pas de 4ᵉ tone ajouté à `WidgetFrame` pour ce seul cas.
 *
 * Accessibilité (spec §8) : un seul bloc `accessible` par forme, pas des `Text` disjoints.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type {
  ReadinessComponent,
  ReadinessComponentState,
  ReadinessVerdict,
  WidgetSize,
} from '@wellness/shared';
import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useReadiness } from '@/data/repositories/dashboard-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

const VERDICT_EMOJI: Record<ReadinessVerdict, string> = { rest: '🌙', ok: '🙂', push: '⚡' };

type ComponentKey = 'load' | 'nutrition' | 'wellbeing';

/** Libellé d'état par composante — la nutrition (spec R2) n'a pas d'entrée `positive` : elle ne
 *  la produit jamais (pas de symétrie sur le surplus), volontairement absente ici plutôt que morte. */
const COMPONENT_STATE_I18N_KEY: Record<ComponentKey, Partial<Record<ReadinessComponentState, string>>> = {
  load: {
    positive: 'home.readiness.load.positive',
    neutral: 'home.readiness.load.neutral',
    negative: 'home.readiness.load.negative',
  },
  nutrition: {
    neutral: 'home.readiness.nutrition.neutral',
    negative: 'home.readiness.nutrition.negative',
  },
  wellbeing: {
    positive: 'home.readiness.wellbeing.positive',
    neutral: 'home.readiness.wellbeing.neutral',
    negative: 'home.readiness.wellbeing.negative',
  },
};

const REASON_I18N_KEY: Record<string, string> = {
  'insufficient-history': 'home.readiness.reason.insufficientHistory',
  'insufficient-logged-days': 'home.readiness.reason.insufficientLoggedDays',
  'no-recent-checkin': 'home.readiness.reason.noRecentCheckin',
};

function componentLine(
  t: (key: string) => string,
  key: ComponentKey,
  labelKey: string,
  component: ReadinessComponent,
): string {
  const label = t(labelKey);
  if (component.state === 'unavailable') {
    const reasonText = component.reason ? t(REASON_I18N_KEY[component.reason]!) : null;
    const unavailable = t('home.readiness.unavailable');
    return reasonText ? `${label} : ${unavailable} — ${reasonText}` : `${label} : ${unavailable}`;
  }
  const stateKey = COMPONENT_STATE_I18N_KEY[key][component.state];
  return `${label} : ${stateKey ? t(stateKey) : t('home.readiness.unavailable')}`;
}

export function ReadinessCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const result = useReadiness();

  if (!result.show || result.verdict == null) return null;

  const verdict = result.verdict;
  const emoji = VERDICT_EMOJI[verdict];
  const isRest = verdict === 'rest';
  const isPush = verdict === 'push';
  const tone = isRest ? 'warn' : 'card';
  const textColor = isRest ? colors.warnText : isPush ? colors.success : colors.text;
  const tileTint = isRest ? colors.accent : isPush ? colors.success : colors.textMuted;

  const title = t(`home.readiness.verdict.${verdict}.title`);
  const message = t(`home.readiness.verdict.${verdict}.message`);

  const lines = [
    componentLine(t, 'load', 'home.readiness.component.load', result.load),
    componentLine(t, 'nutrition', 'home.readiness.component.nutrition', result.nutrition),
    componentLine(t, 'wellbeing', 'home.readiness.component.wellbeing', result.wellbeing),
  ];

  const a11yLabel = `${title}. ${message} ${lines.join('. ')}`;

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} tone={tone}>
        <View accessible accessibilityLabel={a11yLabel} style={styles.smallCol}>
          <View style={styles.head}>
            <Eyebrow tone={isRest ? 'warn' : 'muted'}>{t('home.readiness.eyebrow')}</Eyebrow>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
          <Text style={[styles.smallTitle, { color: textColor }]} numberOfLines={3}>
            {title}
          </Text>
        </View>
      </WidgetFrame>
    );
  }

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} tone={tone}>
        <View accessible accessibilityLabel={a11yLabel} style={styles.wideRow}>
          <View style={[styles.tile, { backgroundColor: withAlpha(tileTint, 0.14) }]}>
            <Text style={styles.emojiLg}>{emoji}</Text>
          </View>
          <View style={styles.wideText}>
            <Text style={[styles.wideTitle, { color: textColor }]}>{title}</Text>
            <Text style={[styles.wideMessage, { color: colors.textMuted }]} numberOfLines={2}>
              {message}
            </Text>
          </View>
        </View>
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  return (
    <WidgetFrame pad={22} tone={tone}>
      <View accessible accessibilityLabel={a11yLabel} style={styles.largeCol}>
        <View style={styles.head}>
          <Eyebrow tone={isRest ? 'warn' : 'muted'}>{t('home.readiness.eyebrow')}</Eyebrow>
          <Text style={styles.emojiLg}>{emoji}</Text>
        </View>
        <Text style={[styles.largeTitle, { color: textColor }]}>{title}</Text>
        <Text style={[styles.largeMessage, { color: colors.textMuted }]}>{message}</Text>
        <View style={[styles.detail, { borderColor: colors.border }]}>
          {lines.map((line) => (
            <Text key={line} style={[styles.detailLine, { color: colors.textMuted }]}>
              {line}
            </Text>
          ))}
        </View>
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
  detail: { marginTop: 'auto', borderTopWidth: 1, paddingTop: 10, gap: 4 },
  detailLine: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
});
