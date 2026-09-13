/**
 * Disques à mettre de chaque côté de la barre — US MUSCU-UX03 (mode immersif), spec §5.5.
 *
 * La charge cesse d'être un nombre abstrait : l'écran montre **ce qu'il faut charger**, et l'ajout
 * d'un disque se voit. Calcul volontairement bête et déterministe (algorithme glouton du plus lourd
 * au plus léger), parce que c'est exactement ce que fait quelqu'un devant un rack.
 *
 * ⚠️ **Calcul en centièmes.** 82,5 − 20 = 62,5 ; divisé par deux, 31,25 : trois soustractions de
 * flottants plus loin, `31.25 - 25 - 5 - 1.25` vaut `3.5527e-15` et non `0`. Tout le calcul se fait
 * donc en entiers (centièmes d'unité), et ne revient en décimal qu'à la sortie.
 */

/** Unité de charge — la même que celle de l'app (`units`). */
export type PlateUnit = 'kg' | 'lb';

/** Disques disponibles, du plus lourd au plus léger. Paires olympiques usuelles. */
export const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
export const LB_PLATES = [45, 35, 25, 10, 5, 2.5] as const;

/** Barres proposées au réglage (spec §6). La première est le défaut. */
export const KG_BARS = [20, 15, 10] as const;
export const LB_BARS = [45, 35] as const;

export const DEFAULT_BAR_KG = 20;
export const DEFAULT_BAR_LB = 45;

export type PlateLoad = {
  /** Disques d'un côté, du plus lourd au plus léger. Vide si rien à charger. */
  perSide: number[];
  /** Ce qui n'est pas chargeable avec les disques disponibles (0 dans la quasi-totalité des cas). */
  remainder: number;
  /** Vrai quand la charge vaut (ou n'atteint pas) la barre seule. */
  barOnly: boolean;
};

const cents = (value: number): number => Math.round(value * 100);

/**
 * Décompose une charge totale en disques par côté.
 *
 * @param total Charge totale **barre comprise**, dans l'unité donnée.
 * @param bar   Poids de la barre (réglage utilisateur).
 * @param unit  `kg` ou `lb` — change la série de disques disponibles.
 *
 * Charge inférieure ou égale à la barre → `barOnly`, aucun disque. Charge nulle ou négative → idem
 * (l'écran n'affiche alors pas de barre du tout, c'est à l'appelant d'en décider).
 */
export function computePlates({
  total,
  bar,
  unit = 'kg',
}: {
  total: number | null;
  bar: number;
  unit?: PlateUnit;
}): PlateLoad {
  const plates = unit === 'lb' ? LB_PLATES : KG_PLATES;
  if (total === null || !Number.isFinite(total) || total <= bar) {
    return { perSide: [], remainder: 0, barOnly: true };
  }

  let left = Math.round((cents(total) - cents(bar)) / 2);
  const perSide: number[] = [];
  for (const plate of plates) {
    const step = cents(plate);
    while (left >= step) {
      perSide.push(plate);
      left -= step;
    }
  }
  return { perSide, remainder: left / 100, barOnly: false };
}

/** Total effectivement chargé (barre + disques des deux côtés) — utile aux tests et aux libellés. */
export function loadedTotal({ perSide, bar }: { perSide: number[]; bar: number }): number {
  const sum = perSide.reduce((acc, plate) => acc + cents(plate), 0);
  return (cents(bar) + sum * 2) / 100;
}
