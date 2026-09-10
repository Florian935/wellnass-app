/**
 * US ACCUEIL-02 — **zone 0 de l'accueil** : l'en-tête utile.
 *
 * ── Ce qu'il remplace ────────────────────────────────────────────────────────────────────────────
 * L'en-tête livré portait, dans cet ordre : « Bonjour {prénom} 👋 », **le nom de l'application en
 * Bricolage 28 px extra-bold**, la pastille de synchronisation, un bouton « Personnaliser » et
 * l'avatar. Trois défauts en un seul bloc :
 *
 *  1. le pixel le plus visible de l'écran le plus ouvert affichait une information que
 *     l'utilisateur possède déjà — il sait dans quelle app il est ;
 *  2. **aucune date** : un tableau de bord « du jour » qui ne disait jamais quel jour ;
 *  3. le salut était **figé** dans le JSON i18n (« Bonjour 👋 »), donc affiché tel quel à 22 h.
 *
 * La maquette validée, elle, mettait la date en clair depuis l'origine.
 *
 * ── Ce qu'il affiche ─────────────────────────────────────────────────────────────────────────────
 * La date en clair et l'état de synchronisation sur une ligne ; en dessous, une **accroche
 * contextuelle** dérivée de la même décision que la carte « maintenant » — de sorte que l'en-tête
 * et la carte ne puissent pas se contredire. « Personnaliser » descend en pied de grille (zone 4) :
 * c'est une action qu'on fait une fois, elle n'a pas à occuper le coin haut-droit en permanence.
 */

import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { dayMoment, type NowAction } from '@wellness/shared';

import { SyncStatus } from '@/components/SyncStatus';
import { useCurrentHour, useTodayDate } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Accroche du jour, en une ligne, dérivée de l'action du moment.
 *
 * Exportée pour être testable seule : c'est la phrase que l'utilisateur lit en premier chaque
 * matin, et la seule règle qui compte est qu'elle **ne réclame rien quand il n'y a rien à
 * réclamer** (même exigence de ton que la carte « vie réelle » de VIE-01).
 */
export function headlineKey(action: NowAction): { key: string; count?: number } {
  switch (action.kind) {
    case 'workout-active':
      return { key: 'home.headline.workoutActive' };
    case 'run-active':
      return { key: 'home.headline.runActive' };
    case 'session-today':
      return { key: 'home.headline.sessionToday' };
    case 'meal-due':
      return { key: `home.headline.meal.${action.meal}` };
    case 'weigh-in-due':
      return { key: 'home.headline.weighIn' };
    case 'wellbeing-due':
      return { key: 'home.headline.wellbeing' };
    case 'day-done':
      return { key: 'home.headline.dayDone' };
    case 'idle':
    default:
      return { key: `home.headline.idle.${action.kind === 'idle' ? action.moment : 'morning'}` };
  }
}

export function HomeHeader({
  action,
  firstName,
}: {
  action: NowAction;
  firstName: string;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const today = useTodayDate();
  const hour = useCurrentHour();

  // Date en clair, dans la langue courante. `toLocaleDateString` avec un fuseau implicite est
  // correct ici : `today` est déjà une date **locale** réactive (`useTodayDate`).
  const dateLabel = today.toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const { key, count } = headlineKey(action);
  const headline = t(key, { count: count ?? 0, name: firstName });

  // Le salut n'est plus une phrase figée : il suit le moment de la journée. Il n'apparaît que
  // lorsque l'accroche ne porte pas déjà une adresse directe, pour ne pas empiler deux entrées.
  const greeting = t(`home.greetingMoment.${dayMoment(hour)}`, { name: firstName });

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Text
          style={[styles.date, { color: colors.textMuted }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {dateLabel}
        </Text>
        <View style={styles.topRight}>
          <SyncStatus />
          <Link href="/settings" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.title')}
              hitSlop={10}
              style={StyleSheet.flatten([
                styles.avatar,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ])}
            >
              <Ionicons name="person-circle-outline" size={24} color={colors.text} />
            </Pressable>
          </Link>
        </View>
      </View>

      <Text
        style={[styles.headline, { color: colors.text }]}
        numberOfLines={2}
        maxFontSizeMultiplier={1.4}
        // L'accroche EST le titre de l'écran : elle doit être annoncée comme tel, et non comme un
        // texte quelconque après la date.
        accessibilityRole="header"
        accessibilityLabel={`${greeting}. ${headline}`}
      >
        {headline}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  date: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamily.monoBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: { fontFamily: fontFamily.displayXBold, fontSize: 26, letterSpacing: -0.7, lineHeight: 30 },
});
