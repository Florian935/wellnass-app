/**
 * US LABO-02 — la carte d'un lien dans l'onglet Croiser.
 *
 * Trois formes, selon l'état — parce qu'un lien qui demande quelque chose ne se lit pas comme un lien
 * qui tient :
 *  - **garde-fou / à régler** : la question, le verdict, deux chiffres (un par côté du lien), et le
 *    geste. Un geste qui écrit se met « prêt » et passe par la feuille (R4) ; un geste qui ouvre part
 *    tout de suite.
 *  - **ça tient** : une ligne, la question et ce qui tient. On le dit aussi : c'est ce qui rend le
 *    Labo agréable à ouvrir.
 *  - **à découvrir** : en pointillé, ce qui manque et où on en est. Jamais un zéro à la place d'un trou.
 *
 * Toucher la carte ouvre la fiche du lien (LABO-03).
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CrossLink, CrossLinkAction } from '@wellness/shared';

import { LinkLens } from './LinkLens';
import { figureTexts, formatLinkValues, linkTexts, stateTone } from './link-format';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  link: CrossLink;
  /** Le geste principal est « prêt » (en attente de la feuille). */
  staged: boolean;
  /** Le geste principal est déjà dans le plan. */
  applied: boolean;
  onOpenLink: (link: CrossLink) => void;
  onAction: (link: CrossLink, action: CrossLinkAction) => void;
};

/** Le libellé d'un geste, dans les mots de ce qu'il fait. */
export function actionLabel(t: ReturnType<typeof useTranslation>['t'], locale: string, action: CrossLinkAction): string {
  if (action.type === 'council') return t('lab.links.routes.council');
  if (action.type === 'open') return t(`lab.links.routes.${action.route}`);
  const p = action.proposal;
  // Une proposition qui ouvre un écran s'annonce par l'écran ; une qui écrit, par ce qu'elle fait.
  if (p.action.type === 'open') return t(`lab.links.routes.${p.action.target}`);
  return t(`lab.proposals.${p.kind}.action`, formatLinkValues(p.values, locale, t));
}

/** Vrai si le geste écrit dans le plan (donc passe par la feuille). */
export function actionWrites(action: CrossLinkAction | undefined): boolean {
  return action?.type === 'proposal' && action.proposal.action.type !== 'open';
}

export function CrossLinkCard({ link, staged, applied, onOpenLink, onAction }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = i18n.language;
  const texts = linkTexts(t, locale, link);
  const tone = stateTone(colors, link.state);
  const primary = link.actions[0];

  if (link.state === 'holds') {
    return (
      <Pressable
        testID={`lab-link-${link.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('lab.cross.open', { question: texts.question })}
        accessibilityHint={`${texts.state}. ${texts.short}`}
        onPress={() => onOpenLink(link)}
        style={[styles.compact, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <LinkLens lens={link.lens} />
        <View style={styles.compactBody}>
          <Text style={[styles.compactQuestion, { color: colors.text }]}>{texts.question}</Text>
          <Text style={[styles.compactShort, { color: colors.textMuted }]}>{texts.short}</Text>
        </View>
        <View style={styles.stateInline}>
          <View style={[styles.dot, { backgroundColor: tone.dot }]} />
          <Text style={[styles.stateInlineText, { color: tone.text }]}>{texts.state}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
    );
  }

  if (link.state === 'discover') {
    const have = link.missing?.have ?? 0;
    const need = Math.max(1, link.missing?.need ?? 1);
    return (
      <Pressable
        testID={`lab-link-${link.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('lab.cross.open', { question: texts.question })}
        accessibilityHint={texts.missing ?? undefined}
        onPress={() => onOpenLink(link)}
        style={[styles.dashed, { borderColor: colors.textMuted }]}
      >
        <View style={styles.row}>
          <LinkLens lens={link.lens} dashed />
          <Text style={[styles.compactQuestion, { color: colors.text, flex: 1 }]}>{texts.question}</Text>
        </View>
        {texts.missing !== null ? <Text style={[styles.missing, { color: colors.textMuted }]}>{texts.missing}</Text> : null}
        <View style={styles.row}>
          <View style={[styles.meter, { backgroundColor: colors.border }]}>
            <View style={[styles.meterFill, { width: `${Math.round((Math.min(have, need) / need) * 100)}%`, backgroundColor: colors.pillarLab }]} />
          </View>
          {texts.meter !== null ? <Text style={[styles.meterText, { color: colors.textMuted }]}>{texts.meter}</Text> : null}
        </View>
      </Pressable>
    );
  }

  // Garde-fou ou à régler : la carte entière, avec son geste.
  const figures = link.figures.slice(0, 2).map((f) => figureTexts(t, locale, f));
  const writes = actionWrites(primary);
  const gestureLabel = applied ? t('lab.cross.applied') : staged ? t('lab.cross.staged') : primary ? actionLabel(t, locale, primary) : null;

  return (
    <View testID={`lab-link-${link.id}`} style={[styles.big, { backgroundColor: colors.surface, borderColor: tone.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('lab.cross.open', { question: texts.question })}
        onPress={() => onOpenLink(link)}
        style={styles.bigBody}
      >
        <View style={styles.row}>
          <LinkLens lens={link.lens} />
          <Text style={[styles.pair, { color: colors.textMuted }]} numberOfLines={1}>
            {texts.pair}
          </Text>
          <View style={[styles.chip, { borderColor: tone.border }]}>
            <View style={[styles.dot, { backgroundColor: tone.dot }]} />
            <Text style={[styles.chipText, { color: tone.text }]}>{texts.state}</Text>
          </View>
        </View>
        <Text style={[styles.question, { color: colors.text }]}>{texts.question}</Text>
        <Text style={[styles.verdict, { color: colors.text }]}>{texts.verdict}</Text>
        {figures.length > 0 ? (
          <View style={styles.figures}>
            {figures.map((f, i) => (
              <View key={i} style={[styles.figure, { backgroundColor: colors.background }]}>
                <Text style={[styles.figureValue, { color: colors.text }]}>{f.value}</Text>
                <Text style={[styles.figureLabel, { color: colors.textMuted }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
      {primary && gestureLabel !== null ? (
        <View style={styles.gestureRow}>
          <Pressable
            testID={`lab-link-${link.id}-action`}
            accessibilityRole="button"
            accessibilityState={{ selected: staged, disabled: applied }}
            disabled={applied}
            onPress={() => onAction(link, primary)}
            style={[
              styles.gesture,
              applied
                ? { borderColor: colors.success, backgroundColor: 'transparent' }
                : staged
                  ? { borderColor: colors.pillarLab, backgroundColor: colors.pillarLab }
                  : { borderColor: colors.pillarLab, backgroundColor: 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.gestureText,
                { color: applied ? colors.success : staged ? colors.background : colors.pillarLab },
              ]}
            >
              {gestureLabel}
            </Text>
          </Pressable>
          {writes && !staged && !applied ? <Ionicons name="create-outline" size={16} color={colors.textMuted} accessibilityElementsHidden /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  big: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  bigBody: { padding: 16, paddingBottom: 12, gap: 10 },
  pair: { flex: 1, fontFamily: fontFamily.monoBold, fontSize: 10.5, letterSpacing: 1.1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 13, paddingHorizontal: 9, minHeight: 26 },
  chipText: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  question: { fontFamily: fontFamily.displayBold, fontSize: 19, lineHeight: 23, letterSpacing: -0.3 },
  verdict: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  figures: { flexDirection: 'row', gap: 8 },
  figure: { flex: 1, borderRadius: 14, padding: 10, gap: 3 },
  figureValue: { fontFamily: fontFamily.monoBold, fontSize: 16 },
  figureLabel: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
  gestureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  gesture: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  gestureText: { fontFamily: fontFamily.bodyBold, fontSize: 14.5, textAlign: 'center' },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, padding: 14, paddingRight: 12, minHeight: 64 },
  compactBody: { flex: 1, gap: 3 },
  compactQuestion: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 19 },
  compactShort: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  stateInline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stateInlineText: { fontFamily: fontFamily.bodyBold, fontSize: 11.5 },
  dashed: { borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', padding: 14, gap: 10 },
  missing: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  meter: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3 },
  meterText: { fontFamily: fontFamily.monoBold, fontSize: 11 },
});
