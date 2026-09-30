/**
 * US ECHO-01 — l'écho d'un lien dans un pilier : une ligne, qui renvoie à la fiche du Labo.
 *
 * ── La règle (décision du 30/09/2026) ────────────────────────────────────────────────────────────
 * Une analyse qui a besoin de deux piliers pour exister vit au Labo. Le pilier n'en garde qu'un
 * **écho** : le lien le plus pressant qui le concerne, en une phrase, et seulement s'il demande
 * quelque chose (garde-fou ou à régler). Un lien qui tient ne fait pas d'écho — le pilier n'a rien à
 * en dire, et la page reste celle du pilier.
 *
 * `moved` : sur un écran d'où des cartes croisées ont déménagé (Stats nutrition), quand aucun lien
 * ne demande rien, une ligne sobre dit où elles sont parties — sinon leur disparition se lirait
 * comme une perte.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { CrossLinkId, CrossLinkSurface } from '@wellness/shared';

import { LinkLens } from './LinkLens';
import { linkTexts, stateTone } from './link-format';
import { linkHref } from './link-routes';
import { useCrossLinkEcho, useCrossLinks } from '@/data/repositories/cross-links-repository';
import { hapticSelect } from '@/lib/haptics';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  surface: CrossLinkSurface;
  /** Le lien vers lequel des cartes ont déménagé de cet écran. */
  moved?: CrossLinkId;
};

export function CrossLinkEcho({ surface, moved }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const echo = useCrossLinkEcho(surface);
  const shared = useCrossLinks();

  if (echo !== null) {
    const texts = linkTexts(t, i18n.language, echo);
    const tone = stateTone(colors, echo.state);
    return (
      <Pressable
        testID={`lab-echo-${surface}`}
        accessibilityRole="link"
        accessibilityLabel={t('lab.echo.a11y', { pair: texts.pair, short: texts.short })}
        onPress={() => {
          hapticSelect();
          router.push(linkHref(echo.id));
        }}
        style={[styles.echo, { backgroundColor: colors.surface, borderColor: tone.border }]}
      >
        <View style={[styles.lensBox, { backgroundColor: colors.surfaceAlt }]}>
          <LinkLens lens={echo.lens} size={30} />
        </View>
        <View style={styles.body}>
          <View style={styles.overlineRow}>
            <Text style={[styles.overline, { color: colors.pillarLab }]} numberOfLines={1}>
              {t('lab.echo.overline', { pair: texts.pair })}
            </Text>
            <View style={[styles.dot, { backgroundColor: tone.dot }]} />
            <Text style={[styles.state, { color: tone.text }]}>{texts.state}</Text>
          </View>
          <Text style={[styles.short, { color: colors.text }]}>{texts.short}</Text>
          <Text style={[styles.cta, { color: colors.pillarLab }]}>{t('lab.echo.cta')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
    );
  }

  const movedLink = moved === undefined || shared === null ? null : (shared.links.find((l) => l.id === moved) ?? null);
  if (movedLink === null) return null;
  return (
    <Pressable
      testID={`lab-echo-${surface}-moved`}
      accessibilityRole="link"
      onPress={() => {
        hapticSelect();
        router.push(linkHref(movedLink.id));
      }}
      style={[styles.moved, { borderColor: colors.border }]}
    >
      <LinkLens lens={movedLink.lens} size={26} />
      <View style={styles.body}>
        <Text style={[styles.movedText, { color: colors.textMuted }]}>{t('lab.echo.moved')}</Text>
        <Text style={[styles.cta, { color: colors.pillarLab }]}>
          {t('lab.echo.movedCta', { question: t(`lab.links.${movedLink.id}.question`) })}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  echo: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1.5, padding: 14, minHeight: 64 },
  lensBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overline: { flexShrink: 1, fontFamily: fontFamily.monoBold, fontSize: 10, letterSpacing: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  state: { fontFamily: fontFamily.bodyBold, fontSize: 11 },
  short: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 19 },
  cta: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  moved: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', padding: 14 },
  movedText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
});
