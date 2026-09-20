/**
 * US NUTRI-UX02 — « Le verdict de la semaine », en tête de l'onglet du même nom.
 *
 * ── Pourquoi une phrase avant les graphiques ─────────────────────────────────────────────────────
 * Onze analyses nutritionnelles étaient livrées, testées, et rangées derrière une icône sur
 * `Nutrition › Stats`. Les remonter sur l'écran du pilier ne suffisait pas : six cartes empilées
 * montrent des chiffres, elles ne disent pas ce qu'il faut en conclure. Cette carte porte la
 * conclusion ; les cartes en dessous deviennent sa justification, dans cet ordre-là.
 *
 * ── Ce qu'elle ne fait pas ───────────────────────────────────────────────────────────────────────
 * Elle ne calcule rien : `composeWeekVerdict` (brique pure, 14 tests) décide, et cette carte
 * traduit. Le partage n'est pas cosmétique — c'est ce qui permet de tester la règle « ne conclus
 * pas sous 4 jours loggés » sans monter un écran.
 *
 * 🔴 Fenêtre à **7 jours**, fixe, et non le sélecteur 7/30 de l'écran Stats : l'onglet s'appelle
 * « La semaine ». Un verdict sur 30 jours sous ce titre serait faux, et deux fenêtres différentes
 * sur le même écran feraient croire deux chiffres comparables — le défaut que NUTR-17 et l'écran
 * Stats ont déjà dû corriger une fois.
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  composeWeekVerdict,
  DEFAULT_MEAL_KEYS,
  resolveMealConfig,
  resolveMealSplit,
  type WeekRemark,
} from '@wellness/shared';
import { useRouter } from 'expo-router';
import { useGoalAdherence } from '@/data/repositories/dashboard-repository';
import { useMealTotals } from '@/data/repositories/journal-repository';
import { useNutritionProfile, useProteinPerKg } from '@/data/repositories/nutrition-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const WINDOW_DAYS = 7;

/** Nombre de jours en arrière, au format clé de jour locale — même convention que l'écran Stats. */
function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function WeekVerdictCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const router = useRouter();
  const adherence = useGoalAdherence(WINDOW_DAYS);
  /**
   * 🔴 `loggedDays` vient de **l'adhérence**, et plus de `useJournalCompletion` (passe 2, 20/09).
   *
   * Les deux comptent des « jours renseignés », mais **pas sur la même fenêtre** : NUTR-17 borne à
   * *hier* (aujourd'hui, encore incomplet, fausserait un taux d'assiduité), NUTR-10 inclut
   * aujourd'hui. La phrase mélangeait donc un numérateur sur 7 jours et un dénominateur sur 8, et
   * l'écran affichait deux comptes contradictoires : « 0 jours sur 5 » dans le verdict, « 4 jours
   * sur 7 » dans la carte de régularité juste en dessous.
   *
   * C'est **exactement** le défaut corrigé sur le hub Course le 19/09 — un repli qui vivait dans le
   * composant et ne pouvait donc valoir que pour lui. Le remède est le même : une seule source.
   */
  const { result: protein } = useProteinPerKg('7d');
  const { nutritionProfile } = useNutritionProfile();
  const { mealTotals } = useMealTotals(daysAgoKey(WINDOW_DAYS));

  const configuredMeals = useMemo(
    () => resolveMealConfig(nutritionProfile?.meals),
    [nutritionProfile?.meals],
  );
  const mealSplit = useMemo(
    () => resolveMealSplit(mealTotals, configuredMeals, adherence.loggedDays),
    [mealTotals, configuredMeals, adherence.loggedDays],
  );

  const verdict = useMemo(
    () =>
      composeWeekVerdict({
        loggedDays: adherence.loggedDays,
        daysInTarget: adherence.hasTarget ? adherence.daysInTarget : null,
        protein,
        mealSplit,
      }),
    [adherence.loggedDays, adherence.hasTarget, adherence.daysInTarget, protein, mealSplit],
  );

  // On ne montre pas un verdict en cours de calcul : une phrase qui change sous les yeux inspire
  // moins confiance que rien du tout.
  if (adherence.isLoading) return null;

  const { signal } = verdict;
  const good = signal.kind === 'onTrack';
  const unknown = signal.kind === 'notEnoughData';
  const tint = unknown ? colors.textMuted : good ? colors.accent : colors.warnText;

  const mealLabel = (key: string): string =>
    DEFAULT_MEAL_KEYS.includes(key as never)
      ? t(`journal.meals.${key}`)
      : (configuredMeals.find((m) => m.key === key)?.label ?? t('journal.meals.other'));

  const remarkText = (remark: WeekRemark): string =>
    remark.kind === 'protein'
      ? t(`nutrition.week.remarks.protein.${remark.status}`)
      : t('nutrition.week.remarks.heavyMeal', {
          meal: mealLabel(remark.mealKey),
          pct: remark.pct,
        });

  /**
   * L'action que le verdict pointe (passe 2). L'onglet était un **cul-de-sac** : il annonçait que
   * la semaine s'écartait de la cible, les cartes le confirmaient, et il n'y avait rien à faire
   * ensuite. Un diagnostic sans porte de sortie se lit une fois et ne se relit plus.
   *
   * Le choix suit le fait le plus actionnable : pas assez de données → remplir le journal ;
   * protéines hors fourchette → les réglages de macros ; sinon → la cible calorique.
   */
  const action = unknown
    ? { label: t('nutrition.week.action.log'), go: () => router.push('/food-picker') }
    : verdict.remarks.some((r) => r.kind === 'protein')
      ? { label: t('nutrition.week.action.macros'), go: () => router.push('/nutrition-profile') }
      : good
        ? null
        : { label: t('nutrition.week.action.target'), go: () => router.push('/nutrition-profile') };

  return (
    <View
      testID="week-verdict"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: tint }]}
    >
      <View style={styles.head}>
        <Ionicons
          name={unknown ? 'help-circle-outline' : good ? 'trending-up' : 'alert-circle-outline'}
          size={16}
          color={tint}
        />
        <Text style={[styles.eyebrow, { color: tint }]}>{t('nutrition.week.eyebrow')}</Text>
      </View>

      <Text style={[styles.headline, { color: colors.text }]}>
        {unknown
          ? t('nutrition.week.headline.notEnoughData')
          : t(`nutrition.week.headline.${signal.kind}`)}
      </Text>

      <Text style={[styles.detail, { color: colors.textMuted }]}>
        {unknown
          ? t('nutrition.week.detail.notEnoughData', {
              logged: signal.loggedDays,
              needed: signal.needed,
            })
          : t('nutrition.week.detail.adherence', {
              inTarget: signal.daysInTarget,
              logged: signal.loggedDays,
            })}
      </Text>

      {verdict.remarks.map((remark) => (
        <Text
          key={remark.kind}
          style={[styles.detail, { color: colors.textMuted }]}
        >
          {remarkText(remark)}
        </Text>
      ))}

      {action ? (
        <Pressable
          onPress={action.go}
          accessibilityRole="button"
          testID="week-verdict-action"
          style={[styles.action, { borderColor: tint }]}
        >
          <Text style={[styles.actionLabel, { color: tint }]}>{action.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={tint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 17, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 1.4 },
  headline: { fontFamily: fontFamily.displayBold, fontSize: 20, lineHeight: 26 },
  detail: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 20 },
  // Passe 2 — la porte de sortie : l'onglet annonçait un écart sans rien proposer.
  action: {
    marginTop: 4,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
});
