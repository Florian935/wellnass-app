/**
 * US NUTRI-UX02 — « la bibliothèque n'est pas arrivée sur cet appareil ».
 *
 * ── Le silence que ce composant remplace ─────────────────────────────────────────────────────────
 * Jusqu'ici, une base d'aliments vide et une recherche infructueuse produisaient **exactement le
 * même écran** : « Aucun aliment trouvé. » C'est ce silence qui a laissé passer, pendant des jours,
 * une panne de réplication — 3 246 aliments côté cloud, zéro sur le téléphone, et un écran qui
 * affirmait simplement que le saumon n'existait pas. Personne ne cherche une panne de synchro
 * quand l'app lui dit que son aliment n'est pas dans la base.
 *
 * ── Trois causes, trois messages ─────────────────────────────────────────────────────────────────
 * Le composant ne dit pas « il y a un problème » : il dit **lequel**, à partir de l'état réel de
 * PowerSync. C'est la différence entre un message d'erreur et un message utile.
 *
 *  1. `!hasSynced` — la **première synchro n'est pas finie**. Rien d'anormal : c'est le cas normal
 *     d'une installation neuve, et il se résout tout seul. On demande de patienter.
 *  2. `hasSynced && !connected` — **hors ligne**, et la base n'a jamais été reçue. L'app reste
 *     utilisable (créer un aliment, scanner), mais elle ne peut rien inventer.
 *  3. `hasSynced && connected` — la synchro s'est terminée, l'appareil est en ligne, et la
 *     bibliothèque est quand même vide. **C'est le cas qui accuse la configuration, pas
 *     l'utilisateur** : les aliments ne sont pas publiés vers cet appareil. C'est le message qui
 *     aurait fait gagner les jours perdus en septembre.
 *
 * 🔴 **Aucun bouton « relancer la synchro ».** Les API qui forceraient un re-téléchargement complet
 * (`disconnectAndClear`) jettent aussi la **file d'écritures en attente** : un utilisateur hors
 * réseau depuis le matin y perdrait sa journée de repas pour régler un problème qui n'est pas le
 * sien. Un écran qui nomme précisément la panne vaut mieux qu'un bouton qui peut détruire des
 * données.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStatus } from '@powersync/react';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** La cause à afficher, dérivée de l'état de synchro. Exportée pour le test. */
export type LibraryMissingCause = 'syncing' | 'offline' | 'notPublished';

export function resolveLibraryMissingCause(status: {
  hasSynced?: boolean;
  connected?: boolean;
}): LibraryMissingCause {
  if (!status.hasSynced) return 'syncing';
  if (!status.connected) return 'offline';
  return 'notPublished';
}

type Props = {
  /** Nombre d'aliments de bibliothèque présents localement — affiché tel quel, sans arrondi. */
  count: number;
};

export function LibraryNotice({ count }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = useStatus();
  const cause = resolveLibraryMissingCause(status);

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="alert"
      testID="library-notice"
    >
      <View style={[styles.icon, { backgroundColor: colors.track }]}>
        <Ionicons
          name={cause === 'syncing' ? 'cloud-download-outline' : 'cloud-offline-outline'}
          size={26}
          color={colors.warnText}
        />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t('journal.library.title')}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {t(`journal.library.${cause}`)}
      </Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {t('journal.library.localCount', { count })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 24,
  },
  body: { fontFamily: fontFamily.body, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  meta: { fontFamily: fontFamily.mono, fontSize: 11, textAlign: 'center', marginTop: 2 },
});
