/**
 * Widget 7.6 — Régularité (streak), décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : eyebrow + grand nombre + 🔥 + « jours d'affilée » ;
 *  - `wide`  : eyebrow + nombre à droite + bande de 7 jours (semaine courante) ;
 *  - `large` : eyebrow + nombre + bande de 7 jours (grandes pastilles ✓) + bandeau semaine.
 *
 * Pastille : jour actif → accent ; aujourd'hui inactif → contour accent ; futur → piste ;
 * passé inactif → surface. Données : `useStreakData` (current + last7, semaine lun→dim).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatDayFull, type WidgetSize } from '@wellness/shared';
import { WeekDots, type DayState } from '@/components/widgets/primitives';
import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { RowLine } from '@/components/widgets/RowLine';
import { WidgetSkeleton } from '@/components/widgets/WidgetSkeleton';
import { useStreakData, type WeekDay } from '@/data/repositories/dashboard-repository';
import { consumeJoker } from '@/data/repositories/streak-joker-repository';
import { localDayKey } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

/** Traduit un jour `WeekDay` en état de pastille (WeekDots). */
function dayState(day: WeekDay, todayKey: string): DayState {
  if (day.active) return 'done';
  if (day.isToday) return 'today';
  return day.key > todayKey ? 'future' : 'empty';
}

export function StreakCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { current, activeToday, last7, restorableGap, isLoading } = useStreakData();
  const [jokerBusy, setJokerBusy] = useState(false);
  const [jokerError, setJokerError] = useState(false);

  if (isLoading) return <WidgetSkeleton size={size} label={t('home.streak.eyebrow')} />;

  /**
   * US ACCUEIL-04 — la carte devient **tappable**, vers le bilan de la semaine.
   *
   * C'était un cul-de-sac : la carte la plus motivationnelle de l'accueil ne menait nulle part.
   * `/review` est la bonne destination — c'est l'écran qui explique la régularité — et le lien
   * lui donne au passage un **second point d'entrée** : INSIGHTS-02 avait relevé qu'il n'en avait
   * qu'un seul, enfoui dans Réglages › Suivi, la notification hebdomadaire n'y menant pas.
   */
  const openReview = () => router.push('/review');

  const isEmpty = current === 0;
  const labels = t('home.streak.days', { returnObjects: true }) as string[];
  const todayKey = localDayKey(new Date());
  const activeCount = last7.filter((d) => d.active).length;

  const suffix = isEmpty ? t('home.streak.empty') : t('home.streak.suffix', { count: current });

  // ── Bande ──────────────────────────────────────────────────────────────────
  if (size === 'row') {
    return (
      <RowLine
        eyebrow={t('home.streak.eyebrow')}
        value={`${current} 🔥`}
        trailing={suffix}
        trailingTone={isEmpty ? 'muted' : 'accent'}
        onPress={openReview}
        accessibilityLabel={`${t('home.streak.title')}. ${current} ${suffix}`}
      />
    );
  }

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={openReview} accessibilityLabel={t('home.streak.title')}>
        <Eyebrow>{t('home.streak.eyebrow')}</Eyebrow>
        <View style={styles.smallCenter}>
          <Text style={[styles.bigNum, { color: isEmpty ? colors.textMuted : colors.accent }]}>
            {current}
          </Text>
          <Text style={styles.flame}>🔥</Text>
        </View>
        <Text style={[styles.smallSub, { color: colors.textMuted }]}>{suffix}</Text>
      </WidgetFrame>
    );
  }

  /**
   * US STREAK-01 — proposition de joker.
   *
   * `restorableGap` est `null` la plupart du temps : rien ne s'affiche quand il n'y a rien à réparer,
   * quand le trou fait deux jours (interruption réelle), ou quand le joker du mois est déjà consommé.
   * On annonce **le nombre de jours sauvés** — sans ce chiffre la proposition n'aurait pas d'enjeu.
   */
  // `== null` et non `=== null` : un appelant (ou un mock) qui omet le champ ne doit pas faire
  // planter le widget — la proposition est optionnelle par nature.
  const jokerOffer =
    restorableGap == null ? null : (
      <Pressable
        onPress={async () => {
          setJokerBusy(true);
          setJokerError(false);
          try {
            await consumeJoker(restorableGap.day);
          } catch {
            setJokerError(true);
          } finally {
            setJokerBusy(false);
          }
        }}
        disabled={jokerBusy}
        accessibilityRole="button"
        accessibilityLabel={t('home.streak.jokerA11y', { count: restorableGap.streakIfUsed })}
        style={[
          styles.joker,
          {
            backgroundColor: withAlpha(colors.warnText, 0.09),
            borderColor: withAlpha(colors.warnText, 0.3),
          },
        ]}
      >
        <Text style={[styles.jokerTitle, { color: colors.warnText }]} maxFontSizeMultiplier={1.3}>
          {t('home.streak.jokerTitle')}
        </Text>
        <Text style={[styles.jokerBody, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
          {t('home.streak.jokerOffer', {
            count: restorableGap.streakIfUsed,
            date: formatDayFull(restorableGap.day),
          })}
        </Text>
        <Text style={[styles.jokerCta, { color: colors.accent }]} maxFontSizeMultiplier={1.3}>
          {t('home.streak.jokerUse')}
        </Text>
        {/* La règle est expliquée là où l'action est offerte : c'est le seul moment où elle compte. */}
        <Text style={[styles.jokerRule, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
          {t('home.streak.jokerRule')}
        </Text>
        {jokerError && (
          <Text style={[styles.jokerBody, { color: colors.danger }]} accessibilityRole="alert">
            {t('home.streak.jokerError')}
          </Text>
        )}
      </Pressable>
    );

  const dots = (tile: number, withCheck: boolean) => (
    <WeekDots
      tile={tile}
      days={last7.map((d, i) => {
        const state = dayState(d, todayKey);
        return {
          label: labels[i] ?? '',
          state,
          glyph: withCheck && state === 'done' ? '✓' : undefined,
        };
      })}
    />
  );

  /**
   * Bandeau de récapitulatif de la semaine.
   *
   * Il n'existait qu'en forme `large` ; ACCUEIL-04 le remonte en `wide`, qui est la forme par
   * défaut. C'est la densification de cette carte : la cellule passe d'environ 50 % à 90 %
   * d'occupation **sans changer de taille**, et le chiffre des jours actifs répond à la question
   * que les sept pastilles posent sans y répondre (« et donc, ça donne quoi cette semaine ? »).
   *
   * Effacé quand une proposition de joker est affichée : deux bandeaux superposés dans une même
   * cellule, dont un porte une action, se disputeraient l'attention.
   */
  const weekBanner =
    restorableGap != null ? null : (
      <View
        style={[
          styles.banner,
          { backgroundColor: withAlpha(colors.accent, 0.1), borderColor: withAlpha(colors.accent, 0.28) },
        ]}
      >
        <Text style={[styles.bannerTitle, { color: colors.accent }]} numberOfLines={1}>
          {activeToday
            ? t('home.streak.bannerActive', { count: activeCount })
            : t('home.streak.bannerIdle', { count: activeCount })}
        </Text>
      </View>
    );

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame
        pad={18}
        style={styles.wideCol}
        onPress={openReview}
        accessibilityLabel={t('home.streak.title')}
      >
        <View style={styles.wideHead}>
          <Eyebrow>{t('home.streak.eyebrow')}</Eyebrow>
          <View style={styles.wideNumRow}>
            <Text style={[styles.inlineNum, { color: colors.accent }]}>{current}</Text>
            <Text style={[styles.inlineSuffix, { color: colors.textMuted }]}>{suffix}</Text>
            <Text style={styles.flameSm}>🔥</Text>
          </View>
        </View>
        {dots(30, false)}
        {jokerOffer}
        {weekBanner}
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  return (
    <WidgetFrame
      pad={22}
      style={styles.largeCol}
      onPress={openReview}
      accessibilityLabel={t('home.streak.title')}
    >
      <Eyebrow>{t('home.streak.eyebrow')}</Eyebrow>
      <View style={styles.largeTop}>
        <Text style={[styles.largeNum, { color: colors.accent }]}>{current}</Text>
        <Text style={[styles.largeSuffix, { color: colors.textMuted }]}>{suffix} 🔥</Text>
      </View>
      {dots(38, true)}
      {jokerOffer}
      {/* Même bandeau que la forme `wide` — il n'existe qu'en un seul endroit depuis ACCUEIL-04,
          au lieu d'être recopié dans les deux formes. */}
      {weekBanner}
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  smallCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  bigNum: { fontFamily: fontFamily.displayXBold, fontSize: 52, letterSpacing: -2 },
  flame: { fontSize: 22 },
  smallSub: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  wideCol: { justifyContent: 'center', gap: 16 },
  wideHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  wideNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  inlineNum: { fontFamily: fontFamily.displayBold, fontSize: 22 },
  inlineSuffix: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  flameSm: { fontSize: 13 },
  largeCol: { gap: 18 },
  largeTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  largeNum: { fontFamily: fontFamily.displayXBold, fontSize: 46, letterSpacing: -1.6 },
  largeSuffix: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  banner: { marginTop: 'auto', borderWidth: 1, borderRadius: 16, padding: 14 },
  // Proposition de joker : cible confortable (>= 48 dp) et sens porté par le TEXTE, pas la couleur.
  joker: { borderWidth: 1, borderRadius: 14, padding: 13, gap: 4, minHeight: 48 },
  jokerTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  jokerBody: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  jokerCta: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 2 },
  jokerRule: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  bannerTitle: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
});
