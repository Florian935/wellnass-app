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
