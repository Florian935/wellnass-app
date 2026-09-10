/**
 * Retours haptiques de l'app — une façade, pour deux raisons.
 *
 * ── 1. La spec le demandait, la muscu ne l'avait pas ─────────────────────────────────────────────
 * `navigation-ux.md` §4.2 : « Chaque série validée → animation + son (désactivable) ». L'écran de
 * séance n'en produisait **aucun** : la seule vibration du pilier marquait la *fin du repos*. Le
 * planning avait des retours pour le glisser-déposer, le running pour les intervalles ; le geste le
 * plus répété de l'app — 30 à 40 validations par séance — n'avait rien. On valide, rien ne bouge,
 * on vérifie que c'est passé.
 *
 * ── 2. `impactAsync` est déprécié sur Android, et l'app est Android d'abord ──────────────────────
 * La documentation Expo SDK 57 est explicite : sur Android, `impactAsync` / `notificationAsync`
 * passent par l'API `Vibrator`, **dépréciée**, et réclament la permission `VIBRATE`. La voie
 * recommandée est `performAndroidHapticsAsync`, qui s'aligne sur le modèle iOS et ne demande
 * aucune permission.
 *
 * Cette façade choisit donc la bonne API par plateforme, une fois, ici — plutôt que de disperser
 * la condition dans chaque appelant. Les appels existants (`planning`, `running`) ne sont pas
 * touchés : les migrer sort du périmètre de l'US MUSCU-UX01.
 *
 * Tout est **best-effort** : un appareil sans moteur haptique, ou un utilisateur qui a coupé le
 * retour système, ne doit jamais faire échouer l'action qu'il accompagne. D'où les `void` et les
 * `catch` silencieux — une validation de série qui planterait parce que le téléphone ne vibre pas
 * serait un défaut bien pire que l'absence de vibration.
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Exécute un retour haptique sans jamais propager d'erreur. */
function safely(run: () => Promise<unknown>): void {
  try {
    void run().catch(() => {
      // Pas de moteur haptique, retour système coupé, permission refusée : sans conséquence.
    });
  } catch {
    // Certaines implémentations lèvent de façon synchrone.
  }
}

/**
 * Confirme une action réussie et attendue — **la validation d'une série**.
 *
 * Discret par construction : répété quarante fois dans l'heure, un retour appuyé deviendrait
 * pénible. `Confirm` sur Android, `Success` ailleurs.
 */
export function hapticConfirm(): void {
  if (Platform.OS === 'android') {
    safely(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));
    return;
  }
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/**
 * Marque un franchissement notable — fin de repos, clôture de séance, record battu.
 * Plus appuyé que `hapticConfirm` : il arrive une fois, pas quarante.
 */
export function hapticMilestone(): void {
  if (Platform.OS === 'android') {
    safely(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press));
    return;
  }
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Accompagne un changement de sélection (pas à pas d'un stepper, bascule d'exercice). */
export function hapticSelect(): void {
  if (Platform.OS === 'android') {
    safely(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick));
    return;
  }
  safely(() => Haptics.selectionAsync());
}
