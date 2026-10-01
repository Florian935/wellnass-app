/**
 * US BIEN-02 — activer le pilier Bien-être, c'est consentir (RGPD, article 9).
 *
 * La nuit, l'humeur, le stress, la maladie, l'alcool sont des **données de santé**. Le pilier ne
 * s'active donc jamais sur un simple interrupteur : une confirmation dit ce qui sera enregistré, où, et
 * comment le reprendre. La désactivation, elle, est immédiate — refuser ne doit coûter aucun geste de
 * plus que d'accepter. Un seul point d'entrée pour l'onboarding, les Réglages et l'écran du pilier.
 */

import { Alert } from 'react-native';
import type { TFunction } from 'i18next';

import { updateSettings } from '@/data/repositories/settings-repository';

/** Demande le consentement, puis active. Rend `true` si le pilier a été activé. */
export function confirmWellbeingActivation(t: TFunction): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(t('wellbeingHub.consent.title'), t('wellbeingHub.consent.body'), [
      { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      {
        text: t('wellbeingHub.consent.confirm'),
        onPress: () => {
          // ⚠️ Le `catch` n'est pas décoratif (panne CYCLE-01) : un échec d'écriture doit se lire
          // « non activé », jamais rester un rejet non capturé.
          updateSettings({ wellbeingPillarEnabled: true })
            .then(() => resolve(true))
            .catch(() => resolve(false));
        },
      },
    ], {
      // Android : toucher à côté ferme l'alerte sans passer par un bouton. C'est un refus.
      cancelable: true,
      onDismiss: () => resolve(false),
    });
  });
}

/** Active ou désactive le pilier depuis un interrupteur. Désactiver garde les données (aucune suppression). */
export async function toggleWellbeingPillar(t: TFunction, next: boolean): Promise<boolean> {
  if (next) return confirmWellbeingActivation(t);
  try {
    await updateSettings({ wellbeingPillarEnabled: false });
  } catch {
    // Même règle : l'interrupteur suit la base locale, qui n'a pas changé.
  }
  return false;
}
