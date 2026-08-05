/**
 * US COLLIS-01 (roadmap 3.57) — bandeau de conflit de séquençage, sur le jour de la **course**.
 *
 * C'est elle qu'on propose de déplacer : la séance de musculation est l'ancre du programme et ne
 * bouge jamais.
 *
 * ⚠️ **On constate, on ne prescrit pas** — ton de GARDE-01, déjà validé. « Séance jambes lourde la
 * veille » et non « tu vas te blesser ». Aucune formulation n'est construite ici : tout vient de
 * l'i18n, où les phrases se relisent d'un coup.
 *
 * ⚠️ **Le bandeau porte toujours ses chiffres** (spec R4) : « 12 séries sur les jambes », jamais
 * une affirmation nue. Une alerte sans chiffre n'est pas vérifiable par celui qui la lit.
 *
 * Sans jour de repli, le bandeau **reste** et dit pourquoi — informer même quand on ne peut rien
 * proposer, c'est la dégradation propre de « jamais un blocage ».
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SessionConflict } from '@wellness/shared';

import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Clé i18n du jour de la semaine (`common.weekday.mon`…), déjà utilisée par l'écran de planning. */
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function weekdayKeyOf(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return WEEKDAY_KEYS[new Date(y!, m! - 1, d!).getDay()]!;
}

export function SessionConflictBanner({
  conflict,
  onSwap,
}: {
  conflict: SessionConflict;
  onSwap: (dayKey: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const title = t('planning.conflict.title');
  const body = t('planning.conflict.body', {
    legSets: conflict.legSets,
    runType: t(`running.sessionType.${conflict.runType}`),
  });
  const suggested = conflict.suggestedDayKey;
  const swapLabel =
    suggested === null ? null : t('planning.conflict.swap', { day: t(`common.weekday.${weekdayKeyOf(suggested)}`) });

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors.warn, borderColor: colors.warnBorder, borderLeftColor: colors.warnText },
      ]}
    >
      {/* ⚠️ `accessible` porte sur ce bloc de texte SEULEMENT, pas sur la racine. Sur Android, un
          conteneur `accessible` absorbe ses enfants focusables : le bouton d'échange y perdrait son
          focus propre, son rôle « bouton » et son action de double-tap. C'est le seul endroit du
          dépôt où un Pressable cohabite avec un bloc accessible — trouvé en revue de code. */}
      <View accessible accessibilityLabel={`${title}. ${body}`}>
        <Text style={[styles.title, { color: colors.warnText }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.warnText }]}>{body}</Text>
      </View>
      {suggested !== null && swapLabel !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={swapLabel}
          onPress={() => onSwap(suggested)}
          style={[styles.button, { backgroundColor: colors.warnText }]}
        >
          <Text style={[styles.buttonText, { color: colors.surface }]}>{swapLabel}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.noSlot, { color: colors.warnText }]}>
          {t('planning.conflict.noSlot')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Aucune hauteur fixe : le bandeau grandit avec la police système (recette à 1,5×).
  banner: { borderWidth: 1, borderLeftWidth: 3, borderRadius: 12, padding: 11, marginTop: 8, gap: 3 },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 13.5, lineHeight: 18 },
  body: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  button: { alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 7, marginTop: 6 },
  buttonText: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  noSlot: { fontFamily: fontFamily.body, fontSize: 11.5, fontStyle: 'italic', marginTop: 4 },
});
