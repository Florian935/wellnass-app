/**
 * US CLAV-01 — la **seule** formule d'évitement du clavier de l'app.
 *
 * ── Le défaut qu'elle corrige ───────────────────────────────────────────────────────────────────
 * Depuis Expo SDK 54, l'edge-to-edge est forcé sur Android : l'app dessine sous les barres système,
 * `android:windowSoftInputMode="adjustResize"` (toujours au manifeste) ne redimensionne plus la
 * fenêtre, et le clavier se pose **par-dessus** le bas de l'écran. Avant cette US, un seul écran
 * l'évitait (la séance, `useKeyboardHeight`) ; 43 surfaces de saisie restaient couvertes, dont 25 sans
 * aucun moyen d'amener leur dernier champ au-dessus du clavier.
 *
 * ── Pourquoi une mesure absolue, et pas `KeyboardAvoidingView` ──────────────────────────────────
 * `KeyboardAvoidingView` calcule `frame.y + frame.height − keyboard.screenY` avec un `frame` venu de
 * son `onLayout`, donc **relatif à son parent**, contre un `screenY` **absolu**. Sous un en-tête natif,
 * le décalage est court de la hauteur de l'en-tête — d'où `keyboardVerticalOffset`, à régler écran par
 * écran. Ici, le conteneur mesure **son bas dans la fenêtre** (`measureInWindow`) : le recouvrement est
 * juste sous un en-tête, au-dessus d'une barre d'onglets, dans une feuille, sans réglage par écran.
 *
 * Spec : docs/specs/functional/us/clav01-clavier-formulaires.md (§1, §4).
 */

import type { ViewStyle } from 'react-native';

/**
 * Ce que le clavier recouvre d'un conteneur, en points — 0 quand il est fermé.
 *
 * - `containerBottom` : bas du conteneur dans sa fenêtre (`measureInWindow` : `y + height`) ;
 * - `keyboardTop` : haut du clavier dans la fenêtre (`endCoordinates.screenY`). ⚠️ Sur Android, c'est
 *   le bas de la zone visible de la fenêtre (`getWindowVisibleDisplayFrame`), en coordonnées d'écran —
 *   identiques à celles de la fenêtre tant que l'app est en plein écran (écran partagé : hors périmètre).
 *
 * - `containerTop` (facultatif) : haut du conteneur. Le recouvrement ne dépasse jamais la hauteur du
 *   conteneur : un conteneur dont le haut serait sous le bord du clavier poserait sinon un padding plus
 *   grand que lui, que Yoga garderait, que `onLayout` remesurerait… sans fin (constat de la revue du
 *   23/10/2026 — inatteignable en portrait, borné quand même).
 *
 * Si la recette montre un jour que `screenY` est faux dans un cas (une feuille, une navigation), c'est
 * **ici** qu'il se corrige, une fois — jamais dans un écran.
 */
export function keyboardOverlap({
  containerTop,
  containerBottom,
  keyboardTop,
  visible,
}: {
  containerTop?: number;
  containerBottom: number;
  keyboardTop: number;
  visible: boolean;
}): number {
  if (!visible) return 0;
  if (!Number.isFinite(containerBottom) || !Number.isFinite(keyboardTop)) return 0;
  const edge =
    containerTop != null && Number.isFinite(containerTop)
      ? Math.max(keyboardTop, containerTop)
      : keyboardTop;
  return Math.max(0, Math.round(containerBottom - edge));
}

/**
 * Le padding bas que pose le conteneur.
 *
 * - `base` : le padding bas **de l'appelant** (son style) — conservé et additionné, jamais écrasé ;
 * - sans `safeAreaBottom`, le conteneur n'ajoute **que** le recouvrement : clavier fermé, il ne change
 *   rien à l'écran qui l'accueille ;
 * - avec `safeAreaBottom`, il **reprend** l'arête basse d'un `SafeAreaView` : l'inset clavier fermé
 *   (comme avant), et clavier ouvert le recouvrement **seul** — le clavier couvre déjà la barre de
 *   navigation, ajouter l'inset ferait flotter le contenu à `inset + clavier` du bord.
 */
export function bottomPadding({
  base,
  overlap,
  safeAreaBottom,
  inset,
}: {
  base: number;
  overlap: number;
  safeAreaBottom: boolean;
  inset: number;
}): number {
  return base + (safeAreaBottom ? Math.max(inset, overlap) : overlap);
}

/**
 * Le padding bas **résolu** d'un style aplati : `paddingBottom`, sinon `paddingVertical`, sinon
 * `padding`, sinon 0. Une valeur non numérique (pourcentage) compte pour 0 — aucun appelant n'en pose.
 */
export function resolveBottomPadding(style: ViewStyle | undefined | null): number {
  if (!style) return 0;
  const value = style.paddingBottom ?? style.paddingVertical ?? style.padding;
  return typeof value === 'number' ? value : 0;
}
