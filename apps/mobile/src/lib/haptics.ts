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
 * ── 2. Pourquoi PAS `performAndroidHapticsAsync` (correctif de recette, 11/09/2026) ─────────────
 * Le premier jet de cette façade suivait la recommandation de la doc Expo SDK 57 : sur Android,
 * `impactAsync` / `notificationAsync` passent par l'API `Vibrator`, **dépréciée**, là où
 * `performAndroidHapticsAsync` ne demande aucune permission. Techniquement exact — et pourtant
 * **rien ne vibrait sur device** (recette §57.21).
 *
 * La raison est dans l'implémentation native : `performAndroidHapticsAsync` appelle
 * `View.performHapticFeedback(...)`, qu'Android **ignore silencieusement** quand le réglage
 * système « vibration au toucher » est désactivé — ce qu'il est, par défaut, sur beaucoup
 * d'appareils. Aucune erreur, aucun retour : l'appel réussit et ne fait rien. Deux limites
 * s'ajoutent : `HapticFeedbackConstants.CONFIRM` n'existe qu'à partir de l'API 30 (en dessous, le
 * module lève, et le `catch` ci-dessous avale), et le module ne remonte pas le booléen que
 * `performHapticFeedback` retourne — impossible de détecter l'échec pour se rabattre.
 *
 * On repasse donc par `Vibrator` : c'est ce que faisait `Vibration.vibrate()` avant cette US (la
 * vibration de fin de repos, elle, marchait), c'est ce qu'utilisent déjà `planning` et le guidage
 * de fractionné, et la permission `VIBRATE` est déclarée au manifeste depuis le début. Dépréciée
 * mais fonctionnelle vaut mieux que recommandée mais muette.
 *
 * Tout est **best-effort** : un appareil sans moteur haptique, ou un utilisateur qui a coupé le
 * retour système, ne doit jamais faire échouer l'action qu'il accompagne. D'où les `void` et les
 * `catch` silencieux — une validation de série qui planterait parce que le téléphone ne vibre pas
 * serait un défaut bien pire que l'absence de vibration.
 */

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
 * pénible — d'où l'impact `Light` (50 ms à amplitude 30) plutôt qu'un motif de notification.
 */
export function hapticConfirm(): void {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/**
 * Marque un franchissement notable — fin de repos, clôture de séance, record battu.
 * Plus appuyé que `hapticConfirm` : il arrive une fois, pas quarante.
 */
export function hapticMilestone(): void {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Accompagne un changement de sélection (pas à pas d'un stepper, bascule d'exercice). */
export function hapticSelect(): void {
  safely(() => Haptics.selectionAsync());
}
