/**
 * Utilitaires couleur pour les widgets / mini-graphes.
 *
 * `withAlpha` applique une opacité à une couleur hex (#rgb / #rrggbb) et renvoie une
 * chaîne `rgba(...)`. Sert aux surfaces teintées accent (« soft ») qui doivent suivre
 * l'accent dynamique du menu actif, et aux dégradés de zone des sparklines.
 */

/** Convertit `#rgb` / `#rrggbb` en triplet `[r,g,b]` (0–255). Repli noir si non hex. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }
  if (h.length !== 6) return [0, 0, 0];
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Renvoie `rgba(r,g,b,alpha)` à partir d'une couleur hex et d'une opacité [0,1]. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
