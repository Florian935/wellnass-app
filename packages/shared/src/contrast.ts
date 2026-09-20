/**
 * US CONF-07 — calcul de contraste WCAG 2.1, pur et sans dépendance.
 *
 * La palette elle-même vit côté mobile (`apps/mobile/src/theme/colors.ts`, pas dans ce paquet) :
 * ce module n'expose que les deux fonctions qui permettent de la **mesurer**. Le test qui parcourt
 * la palette et échoue sous le seuil vit à côté d'elle (`apps/mobile/src/theme/__tests__/contrast.test.ts`).
 */

/** Convertit un canal sRGB (0-255) en composante linéarisée, selon la formule WCAG 2.1. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Luminance relative d'une couleur hexadécimale (`#rrggbb`, avec ou sans `#`), selon WCAG 2.1.
 * Renvoie `null` si la chaîne n'est pas un hex à 6 chiffres exploitable.
 */
export function relativeLuminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1]!;
  const r = linearize(parseInt(value.slice(0, 2), 16));
  const g = linearize(parseInt(value.slice(2, 4), 16));
  const b = linearize(parseInt(value.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * **Chroma** d'une couleur : l'écart entre son canal le plus fort et son canal le plus faible,
 * de 0 (un gris) à 255 (une primaire pure). C'est un proxy de saturation, volontairement grossier.
 *
 * ── Pourquoi cette fonction existe (US NUTRI-UX02, 20/09/2026) ───────────────────────────────────
 * Le dépôt a diagnostiqué **deux fois** le même défaut à la main, dans deux commentaires de
 * `theme/pillar.ts` : une teinte de pilier qui produit une surface **moins colorée que la surface
 * neutre qu'elle remplace**. La course en septembre (chroma 16 contre 18), la nutrition aujourd'hui
 * (17 contre 18). Les deux fois, rien n'avait échoué : les tests de contraste passaient — c'est
 * même la propriété de `tintPreservingLuminance` que de les faire passer —, et la seule alerte a
 * été l'œil de Florian sur une recette.
 *
 * Nommer la mesure permet au test-garde de `theme/__tests__/contrast.test.ts` de la vérifier, au
 * lieu de la redécouvrir au prochain pilier.
 *
 * ⚠️ Ce n'est **pas** une mesure perceptuelle (ni HSL, ni LCh) : à luminance égale elle suffit à
 * comparer des surfaces entre elles, ce qui est tout ce qu'on lui demande. Ne pas l'utiliser pour
 * décider qu'une couleur est « belle » ou pour trier des teintes de clartés différentes.
 *
 * Renvoie `null` si la chaîne n'est pas un hex à 6 chiffres exploitable.
 */
export function chroma(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1]!;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/**
 * Ratio de contraste WCAG 2.1 entre deux couleurs hexadécimales — toujours ≥ 1 (ordre des
 * arguments sans importance). Renvoie `null` si l'une des deux couleurs est illisible.
 */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Teinte à luminance constante — le socle des palettes par pilier
// ---------------------------------------------------------------------------

/** `#rrggbb` → `[r, g, b]` en 0-255, ou `null` si la chaîne n'est pas exploitable. */
function toChannels(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1]!;
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/** `[r, g, b]` → `#rrggbb`, bornés et arrondis. */
function toHex(channels: readonly number[]): string {
  return (
    '#' +
    channels
      .map((c) =>
        Math.max(0, Math.min(255, Math.round(c)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Luminance relative WCAG de canaux bruts (évite un aller-retour par la chaîne hex). */
function luminanceOf(channels: readonly number[]): number {
  return (
    0.2126 * linearize(channels[0]!) +
    0.7152 * linearize(channels[1]!) +
    0.0722 * linearize(channels[2]!)
  );
}

/**
 * Teinte `base` vers `tint` **sans changer sa clarté** : la couleur rendue a (à l'arrondi près) la
 * **luminance relative de `base`**.
 *
 * ── Pourquoi cette contrainte, et pas un simple mélange ──────────────────────────────────────────
 * Les palettes par pilier (US MUSCU-UX04) teintent les surfaces — cartes, fond, pistes — vers la
 * couleur du pilier. Un mélange ordinaire les **assombrit**, et la palette claire ne peut pas se le
 * permettre : ses paires de texte sont à **4,53-4,55** pour un seuil WCAG AA de 4,5. Mesuré, un
 * mélange à 10 % vers le bordeaux faisait tomber `textMuted` / `surface` à 4,13 — six paires sous le
 * seuil d'un coup, dans un thème que CONF-07 venait de rendre conforme.
 *
 * À luminance constante, le rapport de contraste de **n'importe quelle** encre contre cette surface
 * est conservé par construction : on ne déplace que la teinte. Le garde-fou reste mesuré par
 * `apps/mobile/src/theme/__tests__/contrast.test.ts`, qui compare chaque palette de pilier à la
 * palette neutre et refuse toute régression.
 *
 * @param amount part de `tint` dans le mélange, 0 (aucune teinte) à 1.
 * @returns la couleur teintée, ou `null` si l'une des deux entrées est illisible.
 */
export function tintPreservingLuminance(base: string, tint: string, amount: number): string | null {
  const from = toChannels(base);
  const to = toChannels(tint);
  if (from === null || to === null) return null;

  const t = Math.max(0, Math.min(1, amount));
  const mixed = from.map((c, i) => c + (to[i]! - c) * t);
  const target = luminanceOf(from);

  // Phase 1 — un facteur multiplicatif commun aux trois canaux : il conserve la teinte du mélange,
  // et la luminance croît avec lui de façon monotone, donc une dichotomie converge.
  let low = 0;
  let high = 8;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (luminanceOf(mixed.map((c) => Math.min(255, c * mid))) < target) low = mid;
    else high = mid;
  }
  const scaled = mixed.map((c) => Math.min(255, c * ((low + high) / 2)));

  // Phase 2 — la mise à l'échelle sature à 255 : une teinte profonde ne peut PAS atteindre la
  // clarté d'une surface presque blanche en gardant sa saturation. Mesuré : viser #fffaf2
  // (luminance 0,96) depuis le bordeaux #6b0028 plafonne très en dessous, et le résultat sortait
  // 13 points de contraste plus loin que la base — l'inverse exact du contrat.
  // On finit donc le chemin vers le **blanc**, qui atteint toujours la cible : la teinte se
  // désature en pastel au lieu de s'assombrir, ce qui est précisément ce qu'on veut d'un thème clair.
  if (luminanceOf(scaled) >= target - 1e-9) {
    return toHex(scaled);
  }
  let lowWhite = 0;
  let highWhite = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lowWhite + highWhite) / 2;
    if (luminanceOf(scaled.map((c) => c + (255 - c) * mid)) < target) lowWhite = mid;
    else highWhite = mid;
  }
  const whitened = (lowWhite + highWhite) / 2;
  return toHex(scaled.map((c) => c + (255 - c) * whitened));
}

/**
 * Rend `color` lisible sur `background` : si le rapport de contraste est déjà au-dessus de
 * `minRatio`, la couleur est rendue telle quelle ; sinon elle est assombrie (fond clair) ou
 * éclaircie (fond sombre) **juste assez** pour atteindre le seuil, teinte conservée.
 *
 * ── Pourquoi c'est nécessaire ────────────────────────────────────────────────────────────────────
 * Le réglage « Couleurs des menus » stocke **une** couleur par menu, utilisée dans les deux thèmes.
 * Aucune couleur ne peut être lisible à la fois sur une carte presque blanche et sur une carte
 * presque noire : `#e07a98` fait 5,2:1 en sombre et 2,5:1 en clair. Le réglage posait donc, selon
 * le thème, un accent hors seuil — et c'était vrai avant comme après l'alignement de ses valeurs
 * par défaut. La couleur choisie doit être **adaptée au fond**, pas seulement bien choisie.
 *
 * @returns la couleur ajustée, ou `null` si l'une des deux entrées est illisible.
 */
export function readableOn(color: string, background: string, minRatio = 4.5): string | null {
  const from = toChannels(color);
  const onto = toChannels(background);
  if (from === null || onto === null) return null;

  const ratioTo = (channels: readonly number[]): number => {
    const a = luminanceOf(channels);
    const b = luminanceOf(onto);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };

  if (ratioTo(from) >= minRatio) return color;

  // Un fond clair se quitte par le noir, un fond sombre par le blanc. Le seuil 0,18 est le gris
  // moyen perceptuel : au-dessus on assombrit, en dessous on éclaircit.
  const target = luminanceOf(onto) > 0.18 ? [0, 0, 0] : [255, 255, 255];
  // Les candidats sont ARRONDIS avant mesure : une couleur hex a des canaux entiers, et chercher
  // le seuil en virgule flottante rendait une couleur qui, une fois arrondie, retombait à 4,47.
  const blended = (m: number) => from.map((c, i) => Math.round(c + (target[i]! - c) * m));

  // Le contraste croît de façon monotone quand on s'éloigne du fond : dichotomie sur le mélange.
  if (ratioTo(blended(1)) < minRatio) return toHex(target);
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (ratioTo(blended(mid)) < minRatio) low = mid;
    else high = mid;
  }
  return toHex(blended(high));
}
