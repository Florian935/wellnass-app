/**
 * Widget 7.6 — Régularité (streak), décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : eyebrow + grand nombre + 🔥 + « jours d'affilée » ;
 *  - `wide`  : eyebrow + nombre à droite + bande de 7 jours (semaine courante) ;
 *  - `large` : eyebrow + nombre + bande de 7 jours (grandes pastilles ✓) + bandeau semaine.
 *
 * Pastille : jour actif → accent ; aujourd'hui inactif → contour accent ; futur → piste ;
 * passé inactif → surface. Données : `useStreakData` (current + last7, semaine lun→dim).
 *
 * ── US SERIE-01 : la même carte, deux unités ────────────────────────────────────────────────────
 * Depuis SERIE-01 la carte sait se lire **en semaines** (`weekly.unit === 'week'`) : même nombre,
 * même flamme, mêmes trois formes — seules changent la bande (huit semaines au lieu de sept jours)
 * et le bandeau du bas (l'objectif de la semaine au lieu du décompte de jours actifs).
 *
 * 🔴 **Un seul composant, une prop d'unité.** La tentation était d'écrire une `WeeklyStreakCard` à
 * côté ; on aurait alors maintenu deux cartes — donc deux accessibilités, deux squelettes de
 * chargement, deux offres de joker — qui auraient divergé au premier correctif appliqué d'un seul
 * côté. Et **jamais les deux compteurs en même temps** (spec D2) : deux séries affichées côte à
 * côte, ce serait demander à l'utilisateur laquelle est la vraie.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AnimatedNumber, useLocaleSeparators } from '@/components/motion/AnimatedNumber';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatDayFull, type WidgetSize } from '@wellness/shared';
import { WeekDots, type DayState } from '@/components/widgets/primitives';
import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { RowLine } from '@/components/widgets/RowLine';
import { WidgetSkeleton } from '@/components/widgets/WidgetSkeleton';
import {
  useStreakData,
  type StreakWeekCell,
  type WeekDay,
} from '@/data/repositories/dashboard-repository';
import { consumeJoker } from '@/data/repositories/streak-joker-repository';
import { updateSettings } from '@/data/repositories/settings-repository';
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

/**
 * Traduit une semaine en état de pastille — la même grammaire visuelle que les jours.
 *
 * `rest` pour une semaine **transparente** : le glyphe « R » de la primitive dit déjà « en pause »
 * partout ailleurs dans l'app, et une semaine traversée par une période « vie réelle » est
 * exactement ça. La semaine en cours encore à valider prend `today` (contour, pas remplissage) :
 * elle court, on ne la juge pas — c'est la règle R3 rendue visible.
 */
function weekState(w: StreakWeekCell): DayState {
  if (w.active) return 'done';
  if (w.transparent) return 'rest';
  if (w.isCurrent) return 'today';
  return 'empty';
}

export function StreakCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const {
    current: dailyCurrent,
    activeToday,
    last7,
    restorableGap,
    weekly,
    isLoading,
  } = useStreakData();
  const separators = useLocaleSeparators();
  const [jokerBusy, setJokerBusy] = useState(false);
  const [jokerError, setJokerError] = useState(false);
  const [switchBusy, setSwitchBusy] = useState(false);

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

  // US SERIE-01 — l'unité pilote tout ce qui suit. Elle vient du repository et non d'un calcul
  // local : c'est la seule couche qui connaît à la fois le réglage et la série en cours.
  const isWeek = weekly.unit === 'week';
  const current = isWeek ? weekly.current : dailyCurrent;
  const isEmpty = current === 0;
  const labels = t('home.streak.days', { returnObjects: true }) as string[];
  const todayKey = localDayKey(new Date());
  const activeCount = last7.filter((d) => d.active).length;

  const suffix = isEmpty
    ? t(isWeek ? 'home.streak.emptyWeek' : 'home.streak.empty')
    : t(isWeek ? 'home.streak.suffixWeek' : 'home.streak.suffix', { count: current });

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
          {/*
            MOTION-01 (A1) : le seul chiffre de l'app qui change tout seul sous les yeux de
            l'utilisateur — au passage de minuit, ou à la clôture de la séance du jour. Il
            **transite** depuis sa valeur précédente au lieu d'être remplacé : c'est ce qui fait
            voir le jour gagné.

            Le nom accessible reste porté par la carte (`accessibilityLabel` de `WidgetFrame`),
            donc pas de doublon d'annonce ici.
          */}
          <AnimatedNumber
            value={current}
            {...separators}
            announce={false}
            style={[styles.bigNum, { color: isEmpty ? colors.textMuted : colors.accent }]}
          />
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

  /**
   * La bande : sept jours, ou huit semaines. **Même primitive**, donc mêmes couleurs, mêmes
   * contours et même comportement d'accessibilité dans les deux lectures.
   *
   * L'étiquette d'une semaine est le **quantième de son lundi** (« 04 », « 11 »…) : deux caractères
   * comme les abréviations de jours, donc aucune colonne ne se déforme, et ça reste rattachable au
   * calendrier — ce qu'un simple « S-3 » ne permet pas.
   */
  const dots = (tile: number, withCheck: boolean) =>
    isWeek ? (
      <WeekDots
        tile={tile}
        days={weekly.weeks.map((w) => {
          const state = weekState(w);
          return {
            label: w.key.slice(8, 10),
            state,
            glyph: withCheck && state === 'done' ? '✓' : undefined,
          };
        })}
      />
    ) : (
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
  /**
   * US SERIE-01 (D1) — **la bascule, proposée une fois et une seule**.
   *
   * On ne bascule personne d'office : quelqu'un qui tient 12 jours verrait son compteur passer à 2
   * du jour au lendemain, sans comprendre. Alors on demande — mais une seule fois, et en montrant
   * **les deux chiffres**, parce que le choix n'a de sens qu'en voyant ce qu'il change.
   *
   * 🔴 **Aucun drapeau « déjà vue » n'est stocké.** `streak_unit is null` veut dire « la question
   * n'a jamais été posée » ; répondre — *quelle que soit la réponse*, y compris « garder les
   * jours » — écrit la colonne, et `offerSwitch` retombe à faux pour toujours. Une seconde colonne
   * `switch_card_seen` aurait pu se désynchroniser du réglage qu'elle était censée accompagner.
   *
   * Effacée quand un joker est proposé : deux offres empilées dans une même carte se disputeraient
   * l'attention, et le joker est la plus urgente des deux (elle expire).
   */
  // Formes `row` et `small` exclues par construction : elles sont retournées plus haut, avant ce
  // point. Une proposition à deux boutons n'a de toute façon pas sa place dans une ligne de liste.
  const switchOfferVisible = weekly.offerSwitch && restorableGap == null;

  const chooseUnit = (unit: 'day' | 'week') => {
    setSwitchBusy(true);
    // Pas de `catch` qui laisse l'utilisateur dans le noir : en cas d'échec d'écriture la carte
    // reste telle quelle et la proposition reviendra au prochain rendu — c'est le comportement
    // voulu, la question n'a alors effectivement pas été tranchée.
    void updateSettings({ streakUnit: unit }).finally(() => setSwitchBusy(false));
  };

  const switchOffer = !switchOfferVisible ? null : (
    <View
      style={[
        styles.joker,
        {
          backgroundColor: withAlpha(colors.accent, 0.09),
          borderColor: withAlpha(colors.accent, 0.3),
        },
      ]}
    >
      <Text style={[styles.jokerTitle, { color: colors.accent }]} maxFontSizeMultiplier={1.3}>
        {t('home.streak.switchTitle')}
      </Text>
      <Text style={[styles.jokerBody, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
        {t('home.streak.switchBody', { days: dailyCurrent, weeks: weekly.current })}
      </Text>
      <Text style={[styles.jokerRule, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
        {t('home.streak.switchRule')}
      </Text>
      <View style={styles.switchRow}>
        <Pressable
          onPress={() => chooseUnit('week')}
          disabled={switchBusy}
          accessibilityRole="button"
          style={[styles.switchBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.switchBtnLabel, { color: colors.accentText }]} maxFontSizeMultiplier={1.3}>
            {t('home.streak.switchToWeek')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => chooseUnit('day')}
          disabled={switchBusy}
          accessibilityRole="button"
          style={[styles.switchBtn, { borderWidth: 1, borderColor: colors.border }]}
        >
          <Text style={[styles.switchBtnLabel, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
            {t('home.streak.switchKeepDay')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  /**
   * En lecture hebdomadaire, le bandeau porte **l'objectif de la semaine** (spec R8/R9).
   *
   * 🔴 Sans objectif réglé, il affiche le **compte nu** — « 3 activités cette semaine » — et jamais
   * une cible inventée. C'est la leçon d'`activity_level` (NUTRI-UX01), où un repli affiché comme
   * un choix a fini par surestimer une cible calorique de ~614 kcal/jour en silence.
   */
  const weekBannerText = isWeek
    ? weekly.goal == null
      ? t('home.streak.weekCount', { count: weekly.doneThisWeek })
      : weekly.goalMet
        ? t('home.streak.weekGoalMet', { count: weekly.goal })
        : t('home.streak.weekGoal', { done: weekly.doneThisWeek, goal: weekly.goal })
    : activeToday
      ? t('home.streak.bannerActive', { count: activeCount })
      : t('home.streak.bannerIdle', { count: activeCount });

  const weekBanner =
    restorableGap != null || switchOfferVisible ? null : (
      <View
        style={[
          styles.banner,
          { backgroundColor: withAlpha(colors.accent, 0.1), borderColor: withAlpha(colors.accent, 0.28) },
        ]}
      >
        <Text style={[styles.bannerTitle, { color: colors.accent }]} numberOfLines={1}>
          {weekBannerText}
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
        {switchOffer}
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
      {dots(isWeek ? 32 : 38, true)}
      {jokerOffer}
      {switchOffer}
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
  // Bascule d'unité : deux cibles côte à côte, chacune >= 44 dp de haut.
  switchRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  switchBtn: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  switchBtnLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13, textAlign: 'center' },
});
