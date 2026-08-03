/**
 * Widget conditionnel temporel — Parcours « 7 jours pour démarrer » (US ACTIV-01), 3 formes.
 *
 * Rendu seulement les 7 jours suivant la fin de l'onboarding, ou jusqu'à une fermeture explicite
 * (`useActivationPath().show`) — même patron que les widgets Tier 2 (`TrainingLoadAlertCard`), à
 * ceci près que sa condition est **aussi** déclarée dans `isWidgetActive`
 * (`(tabs)/index.tsx`, spec R4) pour éviter le trou de grille que ce simple `null` interne ne
 * suffit pas à effacer.
 *
 *  - `small` : eyebrow (jour N/7) + titre ;
 *  - `wide`  : jour + titre + description + action + passer ;
 *  - `large` : idem + description complète.
 *
 * Le thème du jour (§2/§2 ter de la spec) pilote le contenu et, pour les jours pilier-spécifiques
 * ou les replis universels qui ont une cible naturelle, le deep-link de l'action principale. Les
 * jours purement informationnels (2/6/7) n'ont pas de bouton d'action.
 */

import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ActivationDayTheme, WidgetSize } from '@wellness/shared';
import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { dismissActivationPath } from '@/data/repositories/profile-repository';
import { useActivationPath } from '@/data/repositories/activation-path-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Route de l'action principale du jour, ou `null` pour un jour purement informationnel. */
function ctaRoute(theme: ActivationDayTheme, day: number): Href | null {
  if (theme.kind === 'pillar') {
    if (theme.pillar === 'strength') return '/(tabs)/strength';
    if (theme.pillar === 'running') return '/(tabs)/running';
    return '/(tabs)/nutrition';
  }
  if (day === 3) return '/goals'; // repli « fixe-toi un objectif » (OBJ-01)
  if (day === 4) return '/wellbeing';
  if (day === 6) return '/history'; // partage depuis le détail d'une séance/course (PARTAGE-01)
  return null; // jours 2/5/7 : informationnel, aucune cible unique naturelle
}

export function ActivationPathCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { show, day, theme, completed } = useActivationPath();

  if (!show || day == null || theme == null) return null;

  const title = t(`activationPath.day${day}.title`);
  const description = t(`activationPath.day${day}.description`);
  const ctaLabel = t(`activationPath.day${day}.cta`);
  const progress = t('activationPath.progress', { day, total: 7 });
  const route = ctaRoute(theme, day);

  const onPressCta = () => {
    if (route) router.push(route);
  };
  const onDismiss = () => void dismissActivationPath();

  const a11yLabel = `${progress}. ${title}. ${description}${completed ? ` ${t('activationPath.doneBadge')}` : ''}`;

  const dismissButton = (
    <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.dismiss, { color: colors.textMuted }]}>
        {t('activationPath.dismiss')}
      </Text>
    </Pressable>
  );

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={route ? onPressCta : undefined}>
        <View accessible accessibilityLabel={a11yLabel} style={styles.smallCol}>
          <Eyebrow>{progress}</Eyebrow>
          <Text style={[styles.smallTitle, { color: colors.text }]} numberOfLines={3}>
            {title}
          </Text>
        </View>
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  if (size === 'large') {
    return (
      <WidgetFrame pad={22}>
        <View accessible accessibilityLabel={a11yLabel} style={styles.largeCol}>
          <View style={styles.head}>
            <Eyebrow>{progress}</Eyebrow>
            {completed ? (
              <Text style={[styles.doneBadge, { color: colors.success }]}>
                {t('activationPath.doneBadge')}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.largeTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.largeMessage, { color: colors.textMuted }]}>{description}</Text>
          <View style={styles.footRow}>
            {route ? (
              <Pressable
                onPress={onPressCta}
                style={[styles.cta, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
              >
                <Text style={[styles.ctaLabel, { color: colors.accentText }]}>{ctaLabel}</Text>
              </Pressable>
            ) : null}
            {dismissButton}
          </View>
        </View>
      </WidgetFrame>
    );
  }

  // ── Rectangle (défaut) ────────────────────────────────────────────────────────
  return (
    <WidgetFrame pad={18}>
      <View accessible accessibilityLabel={a11yLabel} style={styles.wideCol}>
        <View style={styles.head}>
          <Eyebrow>{progress}</Eyebrow>
          {completed ? (
            <Text style={[styles.doneBadge, { color: colors.success }]}>
              {t('activationPath.doneBadge')}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.wideTitle, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.wideMessage, { color: colors.textMuted }]} numberOfLines={2}>
          {description}
        </Text>
        <View style={styles.footRow}>
          {route ? (
            <Pressable
              onPress={onPressCta}
              style={[styles.cta, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
            >
              <Text style={[styles.ctaLabel, { color: colors.accentText }]}>{ctaLabel}</Text>
            </Pressable>
          ) : null}
          {dismissButton}
        </View>
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  doneBadge: { fontFamily: fontFamily.bodyBold, fontSize: 11.5 },
  smallCol: { flex: 1, gap: 6, justifyContent: 'space-between' },
  smallTitle: { fontFamily: fontFamily.bodyBold, fontSize: 14, lineHeight: 18 },
  wideCol: { gap: 6 },
  wideTitle: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  wideMessage: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  largeCol: { gap: 8, flex: 1 },
  largeTitle: { fontFamily: fontFamily.bodyBold, fontSize: 18, marginTop: 4 },
  largeMessage: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  footRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cta: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  ctaLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  dismiss: { fontFamily: fontFamily.body, fontSize: 12.5, textDecorationLine: 'underline' },
});
