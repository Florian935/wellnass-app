/**
 * Retours haptiques de l'app — une façade, et l'histoire de deux correctifs.
 *
 * ── 1. La spec le demandait, la muscu ne l'avait pas ─────────────────────────────────────────────
 * `navigation-ux.md` §4.2 : « Chaque série validée → animation + son (désactivable) ». L'écran de
 * séance n'en produisait **aucun** : la seule vibration du pilier marquait la *fin du repos*. Le
 * planning avait des retours pour le glisser-déposer, le running pour les intervalles ; le geste le
 * plus répété de l'app — 30 à 40 validations par séance — n'avait rien. On valide, rien ne bouge,
 * on vérifie que c'est passé.
 *
 * ── 2. Deux tentatives ratées avec `expo-haptics`, et pourquoi ──────────────────────────────────
 * **Tentative A — `performAndroidHapticsAsync`** (la recommandation de la doc Expo SDK 57, puisque
 * `Vibrator` y est annoncé déprécié). Muette sur device : l'implémentation native appelle
 * `View.performHapticFeedback(...)`, qu'Android **ignore silencieusement** quand le réglage système
 * « vibration au toucher » est coupé. S'y ajoutent `HapticFeedbackConstants.CONFIRM` réservé à
 * l'API ≥ 30, et l'absence de remontée du booléen d'échec — donc aucun repli possible.
 *
 * **Tentative B — `impactAsync` / `notificationAsync`** (le chemin `Vibrator`, celui du planning).
 * Muette aussi, pour une raison **complètement différente** : expo-haptics ne demande pas une
 * vibration, il impose une **forme d'onde à amplitude fixe**. `impactAsync('light')` vaut
 * `createWaveform(timings = [0, 50], amplitudes = [0, 30])` — soit **30 sur 255, 12 % de la
 * puissance du moteur** pendant 50 ms. `notificationAsync('success')` n'est guère mieux (50 et 60,
 * ~20 %). Sur le LRA d'un Pixel 6a, c'est en dessous du seuil de perception, téléphone en main.
 *
 * ── 3. Ce qu'on utilise, et pourquoi c'est le bon choix ─────────────────────────────────────────
 * `Vibration` de **React Native**. Son module natif appelle
 * `VibrationEffect.createOneShot(durée, VibrationEffect.DEFAULT_AMPLITUDE)` : l'amplitude est celle
 * que le constructeur juge nominale pour son moteur, pas un 12 % arbitraire. C'est précisément
 * l'API qui marchait **avant** cette US (la fin de repos faisait `Vibration.vibrate()`), c'est
 * celle du guidage de fractionné, et la permission `VIBRATE` est au manifeste depuis le début.
 *
 * On ne règle donc plus que **la durée** — le seul paramètre qui distingue vraiment un tic d'une
 * confirmation. C'est aussi le seul qui se raisonne : l'amplitude perçue dépend du moteur, la
 * durée non.
 *
 * ⚠️ Trois choses restent hors de notre contrôle, et aucune n'est un défaut de l'app : un appareil
 * sans moteur haptique, le mode « Ne pas déranger » total, et le curseur système de retour tactile
 * à zéro. D'où le `try/catch` : une validation de série qui planterait parce que le téléphone ne
 * vibre pas serait un défaut bien pire que l'absence de vibration.
 */

import { Vibration } from 'react-native';

/**
 * Durées, en millisecondes. Ce sont les **seuls** réglages de ce module.
 *
 * Bornes utiles : en dessous de ~15 ms un LRA n'a pas le temps de monter en régime et on ne sent
 * rien ; au-delà de ~50 ms, un retour répété quarante fois dans l'heure devient agaçant.
 */
const DURATION_MS = {
  /** Validation d'une série — bref, mais franc. Répété 30 à 40 fois par séance. */
  confirm: 30,
  /** Fin de repos, clôture de séance, record battu — arrive une fois, peut se permettre d'insister. */
  milestone: 140,
  /** Pas d'un stepper, bascule d'exercice — le plus discret des trois. */
  select: 15,
} as const;

/** Déclenche une vibration sans jamais propager d'erreur. */
function safely(durationMs: number): void {
  try {
    Vibration.vibrate(durationMs);
  } catch {
    // Pas de moteur haptique, retour système coupé, permission refusée : sans conséquence.
  }
}

/**
 * Confirme une action réussie et attendue — **la validation d'une série**.
 *
 * Discret par construction : répété quarante fois dans l'heure, un retour appuyé deviendrait
 * pénible.
 */
export function hapticConfirm(): void {
  safely(DURATION_MS.confirm);
}

/**
 * Marque un franchissement notable — fin de repos, clôture de séance, record battu.
 * Plus appuyé que `hapticConfirm` : il arrive une fois, pas quarante.
 */
export function hapticMilestone(): void {
  safely(DURATION_MS.milestone);
}

/** Accompagne un changement de sélection (pas à pas d'un stepper, bascule d'exercice). */
export function hapticSelect(): void {
  safely(DURATION_MS.select);
}
