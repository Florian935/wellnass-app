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
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { AuroraGlows } from '@/components/stage/matter/AuroraGlows';
import { fontFamily } from '@/theme/fonts';
import type { AuroraMoment } from '@/theme/stage';

type Props = {
  /** La salutation — « Bonjour Florian », « Content de te revoir »… (`greetingKind`). */
  greeting: string;
  /** La phrase du jour (`daySentence`) — elle dérive de la même décision que la carte du moment. */
  sentence: string;
  dateLabel: string;
  /** La lumière d'Aurore, selon l'heure (`auroraMoment`). */
  glowMoment: AuroraMoment;
  /** Posé à droite de la date : la pastille de synchro et l'accès aux réglages. */
  trailing?: ReactNode;
  /** Ce que porte le ciel sous la phrase du jour. */
  children?: ReactNode;
};

export function HomeStage({ greeting, sentence, dateLabel, glowMoment, trailing, children }: Props) {
  const stage = useStageTheme('home');

  return (
    <PillarStage pillar="home" testID="home-stage" matter={<AuroraGlows moment={glowMoment} />}>
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
        <Text style={[styles.sentence, { color: stage.ink }]} maxFontSizeMultiplier={1.4}>
          {sentence}
        </Text>
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
