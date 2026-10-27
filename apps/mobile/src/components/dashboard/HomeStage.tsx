/**
 * US DASH-01 — la scène de l'accueil (spec §4.1), devenue **le ciel** avec ACCUEIL-07/08.
 *
 * ── US ACCUEIL-07 — la scène dit vrai, et prend la teinte Aurore ─────────────────────────────────
 * Deux lignes en tête : la **salutation** (avec le prénom) et la **phrase du jour**, qui ne répète
 * plus la carte « maintenant » (constat 6). La matière est faite des deux lueurs d'Aurore
 * (`AuroraGlows`), posées sous le contenu.
 *
 * ── US ACCUEIL-08 — le ciel de « Ta journée » ────────────────────────────────────────────────────
 * La scène ne porte plus de « moments » à elle (check-in, série en jeu, anneaux) : le check-in et la
 * série sont dans l'action du moment, au fil « Ta journée » ; la semaine a sa carte. Elle porte ce
 * que l'écran lui confie en `children` — « Écouter mon brief », la séance en cours, puis les trois
 * cadrans, la carte « retour » ou « Premiers pas » (voir `HomeSky`, `HomeDials`).
 *
 * ── US ACCUEIL-09 — le mouvement ─────────────────────────────────────────────────────────────────
 * Les lueurs suivent l'heure et respirent (`AuroraGlows`, souffle coupé hors focus — R4) ; la phrase
 * du jour se réécrit en fondu.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { AuroraGlows } from '@/components/stage/matter/AuroraGlows';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { useLoopActive } from '@/hooks/useLoopActive';
import { DURATION } from '@/theme/motion';
import { fontFamily } from '@/theme/fonts';

type Props = {
  /** La salutation — « Bonjour Florian », « Content de te revoir »… (`greetingKind`). */
  greeting: string;
  /** La phrase du jour (`daySentence`) — elle dérive de la même décision que la carte du moment. */
  sentence: string;
  dateLabel: string;
  /** L'heure décimale de l'écran : les lueurs se dosent sur elle (`auroraDose`, ACCUEIL-09). */
  glowHour: number;
  /** Posé à droite de la date : la pastille de synchro et l'accès aux réglages. */
  trailing?: ReactNode;
  /** Ce que porte le ciel sous la phrase du jour. */
  children?: ReactNode;
};

export function HomeStage({ greeting, sentence, dateLabel, glowHour, trailing, children }: Props) {
  const stage = useStageTheme('home');
  // R4 de DASH-01 : le souffle des lueurs ne tourne que sur l'accueil au premier plan.
  const breathing = useLoopActive('home');
  const reduced = useAppReducedMotion();

  return (
    <PillarStage pillar="home" testID="home-stage" matter={<AuroraGlows hour={glowHour} active={breathing} />}>
      <View>
        <View style={styles.topRow}>
          <Text style={[styles.eyebrow, { color: stage.inkMuted }]} numberOfLines={1}>
            {dateLabel}
          </Text>
          {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>
        <Text
          style={[styles.greeting, { color: stage.ink }]}
          numberOfLines={2}
          maxFontSizeMultiplier={1.4}
          // La salutation EST le titre de l'écran : annoncée comme tel, pas comme un texte après la date.
          accessibilityRole="header"
        >
          {greeting}
        </Text>
        {/* US ACCUEIL-09 — la phrase du jour se réécrit en fondu quand la décision change (un visage
            choisi, un repas noté) : la clé est la phrase elle-même, l'entrée ne rejoue qu'à un vrai
            changement de texte. */}
        <Animated.Text
          key={sentence}
          entering={reduced ? undefined : FadeIn.duration(DURATION.base)}
          style={[styles.sentence, { color: stage.ink }]}
          maxFontSizeMultiplier={1.4}
        >
          {sentence}
        </Animated.Text>
      </View>
      {children}
    </PillarStage>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: {
    fontFamily: fontFamily.monoBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  greeting: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -1.1, marginTop: 8 },
  sentence: { fontFamily: fontFamily.bodyMedium, fontSize: 15.5, lineHeight: 22, marginTop: 6 },
});
