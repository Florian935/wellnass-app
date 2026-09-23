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

import { kgToLb, lbToKg } from './units';

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

// ---------------------------------------------------------------------------
// Charges chargeables — MUSCU-FIX02, passe 2 (recette du 23/09/2026)
// ---------------------------------------------------------------------------
//
// La barre annonçait « 136,5 kg — dont 0,75 kg non chargeable » : la charge **proposée** par l'app
// (consigne du plan, dernière fois, suggestion, ajustement) ne tombait pas sur ce qu'on peut monter
// avec des disques de salle. Le plus petit disque courant est le 1,25 kg ; par paire, on charge
// donc par pas de **2,5 kg** au-dessus de la barre — 5 lb en livres. Une charge **saisie** par
// l'utilisateur n'est jamais retouchée : ces fonctions ne servent qu'à ce que l'app propose.

/** Pas de charge d'une barre : le plus léger disque, par paire, en centièmes d'unité. */
function loadStep(unit: PlateUnit): number {
  const plates = unit === 'lb' ? LB_PLATES : KG_PLATES;
  return cents(plates[plates.length - 1] ?? 1.25) * 2;
}

/**
 * La charge chargeable la plus proche de `total` (barre comprise). À égale distance, la plus
 * **légère** : on ne propose pas plus lourd que prévu. Une charge nulle, invalide ou qui ne dépasse
 * pas la barre est rendue telle quelle — il n'y a rien à charger.
 */
export function roundToLoadable({
  total,
  bar,
  unit = 'kg',
}: {
  total: number;
  bar: number;
  unit?: PlateUnit;
}): number {
  if (!Number.isFinite(total) || total <= bar) return total;
  const step = loadStep(unit);
  const diff = cents(total) - cents(bar);
  const k = Math.floor(diff / step);
  const rest = diff - k * step;
  return (cents(bar) + (rest * 2 > step ? k + 1 : k) * step) / 100;
}

/**
 * La charge chargeable **voisine** dans une direction — ce que font les boutons − / + sur un
 * exercice à la barre. Depuis une charge saisie non chargeable (136,5), on va à la voisine (137,5
 * ou 135), jamais un pas complet plus loin. Sous la barre, pas simples, jamais sous zéro, et la
 * montée s'arrête sur la barre seule.
 */
export function stepLoadable({
  total,
  bar,
  direction,
  unit = 'kg',
}: {
  total: number;
  bar: number;
  direction: 1 | -1;
  unit?: PlateUnit;
}): number {
  const step = loadStep(unit);
  const value = cents(Number.isFinite(total) ? total : 0);
  const base = cents(bar);
  if (direction === 1) {
    if (value < base) return Math.min(value + step, base) / 100;
    return (base + (Math.floor((value - base) / step) + 1) * step) / 100;
  }
  if (value <= base) return Math.max(0, value - step) / 100;
  return (base + (Math.ceil((value - base) / step) - 1) * step) / 100;
}

/** Réglage de barre dans l'unité de stockage : la barre en kg, et l'affichage en livres ou non. */
export type LoadableOptions = { barKg: number; imperial: boolean };

/**
 * `roundToLoadable` sur une charge **en kilos** (l'unité de stockage). En livres, l'arrondi se fait
 * sur les disques américains et une barre de 45 lb — comme le dessin de la barre — puis revient en
 * kilos ; une charge déjà chargeable en livres est rendue **inchangée**, sans dérive kg ↔ lb.
 */
export function loadableKg(totalKg: number, { barKg, imperial }: LoadableOptions): number {
  if (!imperial) return roundToLoadable({ total: totalKg, bar: barKg });
  const lb = kgToLb(totalKg);
  const rounded = roundToLoadable({ total: lb, bar: DEFAULT_BAR_LB, unit: 'lb' });
  return cents(rounded) === cents(lb) ? totalKg : lbToKg(rounded);
}

/** `stepLoadable` sur une charge en kilos — voir `loadableKg` pour les livres. */
export function stepLoadableKg(
  totalKg: number,
  direction: 1 | -1,
  { barKg, imperial }: LoadableOptions,
): number {
  if (!imperial) return stepLoadable({ total: totalKg, bar: barKg, direction });
  const lb = cents(kgToLb(totalKg)) / 100;
  return lbToKg(stepLoadable({ total: lb, bar: DEFAULT_BAR_LB, direction, unit: 'lb' }));
}

// ---------------------------------------------------------------------------
// Ce qui change sur la barre d'une série à l'autre — MUSCU-FIX02, passe 3
// ---------------------------------------------------------------------------
//
// Entre deux séries, on ne recharge pas une barre de zéro : on ajoute ou on retire. Dire « par
// côté : 25 + 25 + 5 + 2,5 » oblige à comparer de tête avec ce qui est déjà monté ; dire « ajoute
// 1,25 kg de chaque côté » est l'information qu'on cherche vraiment pendant le repos.

/** Ajout, retrait ou rien, **par côté** de la barre. */
export type BarChange = { direction: 'add' | 'remove' | 'same'; perSide: number };

/** Ce qui change sur la barre pour passer de `from` à `to` (charges totales, même unité). */
export function barChange({ from, to }: { from: number; to: number }): BarChange {
  const diff = cents(to) - cents(from);
  if (diff === 0) return { direction: 'same', perSide: 0 };
  return { direction: diff > 0 ? 'add' : 'remove', perSide: Math.abs(diff) / 2 / 100 };
}
