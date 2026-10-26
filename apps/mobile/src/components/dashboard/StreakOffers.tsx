/**
 * US ACCUEIL-08 — **les deux offres de la série**, déménagées de la carte Régularité dans « Ta
 * semaine » quand la Régularité a quitté la grille.
 *
 *  - **le joker** (STREAK-01) : un jour manqué, isolé, récent, et un joker encore disponible ce
 *    mois-ci (`restorableGap`) — on annonce le nombre de jours sauvés, sans quoi la proposition
 *    n'aurait pas d'enjeu ;
 *  - **la bascule en semaines** (SERIE-01, D1) : proposée une fois et une seule, en montrant les
 *    deux chiffres. Répondre — quelle que soit la réponse — écrit `streak_unit` : la question ne
 *    revient pas.
 *
 * Une seule offre à la fois : le joker, qui expire, passe devant. Rien ne s'affiche quand il n'y a
 * rien à proposer — le cas courant.
 *
 * Les faits arrivent par props (`useHomeScene` les lit une fois) : la carte ne relit pas la série.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDayFull, type RestorableGap } from '@wellness/shared';
import { consumeJoker } from '@/data/repositories/streak-joker-repository';
import { updateSettings } from '@/data/repositories/settings-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

export type StreakOffersProps = {
  /** Série en jours et en semaines : la bascule montre les deux chiffres. */
  dailyCurrent: number;
  weeklyCurrent: number;
  /** Le jour manqué que le joker peut rattraper, ou `null`. */
  restorableGap: RestorableGap | null;
  /** La bascule en semaines est à proposer (une fois, SERIE-01). */
  offerSwitch: boolean;
};

export function StreakOffers({ dailyCurrent, weeklyCurrent, restorableGap, offerSwitch }: StreakOffersProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [jokerBusy, setJokerBusy] = useState(false);
  const [jokerError, setJokerError] = useState(false);
  const [switchBusy, setSwitchBusy] = useState(false);

  if (restorableGap !== null) {
    return (
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
          styles.offer,
          { backgroundColor: withAlpha(colors.warnText, 0.09), borderColor: withAlpha(colors.warnText, 0.3) },
        ]}
        testID="streak-joker-offer"
      >
        <Text style={[styles.title, { color: colors.warnText }]} maxFontSizeMultiplier={1.3}>
          {t('home.streak.jokerTitle')}
        </Text>
        <Text style={[styles.body, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
          {t('home.streak.jokerOffer', {
            count: restorableGap.streakIfUsed,
            date: formatDayFull(restorableGap.day),
          })}
        </Text>
        <Text style={[styles.cta, { color: colors.accent }]} maxFontSizeMultiplier={1.3}>
          {t('home.streak.jokerUse')}
        </Text>
        {/* La règle est expliquée là où l'action est offerte : c'est le seul moment où elle compte. */}
        <Text style={[styles.rule, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
          {t('home.streak.jokerRule')}
        </Text>
        {jokerError ? (
          <Text style={[styles.body, { color: colors.danger }]} accessibilityRole="alert">
            {t('home.streak.jokerError')}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  if (!offerSwitch) return null;

  const chooseUnit = (unit: 'day' | 'week') => {
    setSwitchBusy(true);
    // En cas d'échec d'écriture, la proposition reviendra au prochain rendu — la question n'a alors
    // effectivement pas été tranchée.
    void updateSettings({ streakUnit: unit }).finally(() => setSwitchBusy(false));
  };

  return (
    <View
      style={[styles.offer, { backgroundColor: withAlpha(colors.accent, 0.09), borderColor: withAlpha(colors.accent, 0.3) }]}
      testID="streak-switch-offer"
    >
      <Text style={[styles.title, { color: colors.accent }]} maxFontSizeMultiplier={1.3}>
        {t('home.streak.switchTitle')}
      </Text>
      <Text style={[styles.body, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
        {t('home.streak.switchBody', { days: dailyCurrent, weeks: weeklyCurrent })}
      </Text>
      <Text style={[styles.rule, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
        {t('home.streak.switchRule')}
      </Text>
      <View style={styles.switchRow}>
        <Pressable
          onPress={() => chooseUnit('week')}
          disabled={switchBusy}
          accessibilityRole="button"
          style={[styles.switchBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.switchLabel, { color: colors.accentText }]} maxFontSizeMultiplier={1.3}>
            {t('home.streak.switchToWeek')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => chooseUnit('day')}
          disabled={switchBusy}
          accessibilityRole="button"
          style={[styles.switchBtn, { borderWidth: 1, borderColor: colors.border }]}
        >
          <Text style={[styles.switchLabel, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
            {t('home.streak.switchKeepDay')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Cible confortable (>= 48 dp) et sens porté par le TEXTE, pas la couleur.
  offer: { borderWidth: 1, borderRadius: 14, padding: 13, gap: 4, minHeight: 48, marginTop: 10 },
  title: { fontFamily: fontFamily.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  cta: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 2 },
  rule: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  // Bascule d'unité : deux cibles côte à côte, chacune >= 44 dp de haut.
  switchRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  switchBtn: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  switchLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13, textAlign: 'center' },
});
