import { z } from 'zod';

/**
 * Système d'unités choisi par l'utilisateur. **Indépendant de la langue** (ne jamais coupler
 * `lang === 'en'` avec `imperial` — voir modele-donnees.md §3.1).
 */
export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;

export const unitSystemSchema = z.enum(UNIT_SYSTEMS);
export type UnitSystem = z.infer<typeof unitSystemSchema>;

// Facteurs de conversion exacts.
export const LB_PER_KG = 2.2046226218;
export const MI_PER_KM = 0.6213711922;
export const CM_PER_IN = 2.54;

/** Poids : kilogrammes ↔ livres. Le stockage reste **toujours en métrique** (SI). */
export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}
export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/**
 * Circonférences corporelles : centimètres ↔ pouces (US MESUR-01).
 *
 * ⚠️ **Ne pas confondre avec `cmToFtIn`**, qui sert à la **taille** d'une personne et rend des
 * pieds-pouces. Un tour de bras de 35 cm vaut **13,8 in**, pas « 1 ft 1,8 in » : une circonférence
 * s'exprime en pouces décimaux.
 *
 * Le stockage reste **toujours en centimètres** — convertir au stockage ferait dériver l'historique
 * à chaque bascule du réglage d'unités.
 */
export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}
export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

/** Distance : kilomètres ↔ miles. */
export function kmToMi(km: number): number {
  return km * MI_PER_KM;
}
export function miToKm(mi: number): number {
  return mi / MI_PER_KM;
}

/** Symboles d'unité (universels, non traduits). */
export const unitSymbol = {
  metric: { weight: 'kg', distance: 'km' },
  imperial: { weight: 'lb', distance: 'mi' },
} as const satisfies Record<UnitSystem, { weight: string; distance: string }>;

export type Measurement = { value: number; unit: string };

/**
 * Convertit un poids **stocké en kg** vers le système d'affichage.
 * `fractionDigits` par défaut 1.
 */
export function displayWeight(kg: number, system: UnitSystem, fractionDigits = 1): Measurement {
  const value = system === 'imperial' ? kgToLb(kg) : kg;
  return { value: round(value, fractionDigits), unit: unitSymbol[system].weight };
}

/** Convertit une distance **stockée en km** vers le système d'affichage. */
export function displayDistance(km: number, system: UnitSystem, fractionDigits = 2): Measurement {
  const value = system === 'imperial' ? kmToMi(km) : km;
  return { value: round(value, fractionDigits), unit: unitSymbol[system].distance };
}

function round(value: number, fractionDigits: number): number {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

/** cm -> pieds + pouces (pouce le plus proche, avec report de retenue à 12). */
export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_IN);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

/** pieds + pouces -> cm (SI). */
export function ftInToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_IN;
}

/** Allure s/km -> s par unité affichée (mile en impérial). */
export function paceToSystem(sPerKm: number, system: UnitSystem): number {
  return system === 'imperial' ? sPerKm / MI_PER_KM : sPerKm;
}

/** Secondes par unité -> "M:SS" ; placeholder si nul/négatif/NaN. */
export function formatPaceMMSS(secondsPerUnit: number | null, noData: string): string {
  if (secondsPerUnit == null || !Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0) {
    return noData;
  }
  const total = Math.round(secondsPerUnit);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Parse un nombre tolérant (virgule ou point) ; null si vide/invalide/notation scientifique. */
function parseNumberLoose(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null; // rejette 1e2, "abc", "Infinity", "1.2.3", etc.
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Texte saisi dans l'unité `system` -> kg (SI) ; null si vide/invalide/négatif/zéro. */
export function parseWeightToKg(text: string, system: UnitSystem): number | null {
  const n = parseNumberLoose(text);
  if (n === null || n <= 0) return null;
  return system === 'imperial' ? lbToKg(n) : n;
}

/** Texte saisi dans l'unité `system` -> km (SI) ; null si vide/invalide/négatif/zéro. */
export function parseDistanceToKm(text: string, system: UnitSystem): number | null {
  const n = parseNumberLoose(text);
  if (n === null || n <= 0) return null;
  return system === 'imperial' ? miToKm(n) : n;
}

/**
 * Deux champs de taille -> cm (SI).
 * - metric  : `a` = cm (champ unique), `b` ignoré.
 * - imperial: `a` = pieds, `b` = pouces.
 * Renvoie null si aucune valeur exploitable.
 */
export function heightPartsToCm(a: string, b: string, system: UnitSystem): number | null {
  if (system === 'metric') {
    return parseNumberLoose(a);
  }
  const ft = parseNumberLoose(a);
  const inch = parseNumberLoose(b);
  if (ft === null && inch === null) return null;
  return ftInToCm(ft ?? 0, inch ?? 0);
}

/**
 * Parse "M:SS" (secondes 0-59) saisi dans l'unité `system` -> s/km (SI).
 * Retourne null si vide, invalide, ou hors plage de course à pied (2:30 à 12:00 /km).
 */
export function parsePaceToSPerKm(text: string, system: UnitSystem): number | null {
  const t = text.trim();
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(t); // M:SS, secondes 00-59
  if (!m) return null;
  const perDisplayUnit = Number(m[1]) * 60 + Number(m[2]);
  const sPerKm = system === 'imperial' ? perDisplayUnit * MI_PER_KM : perDisplayUnit;
  // Garde de plausibilité (course à pied) : 2:30 à 12:00 /km.
  if (sPerKm < 150 || sPerKm > 720) return null;
  return sPerKm;
}

/** s/km -> "M:SS" dans l'unité `system` (sans symbole), pour pré-remplir un champ. */
export function formatPaceValue(sPerKm: number, system: UnitSystem): string {
  return formatPaceMMSS(paceToSystem(sPerKm, system), '');
}

/** Élargissement de bande (secondes) quand toutes les valeurs d'allure sont égales. */
const PACE_AXIS_FLAT_PAD_S = 30;

/**
 * Échelle d'un axe Y d'allure, cohérente avec ses libellés.
 *
 * `react-native-gifted-charts` trace toujours les points sur SA propre échelle
 * (`0 → maxValue`, chaque valeur diminuée de `yAxisOffset`). Fournir seulement
 * `yAxisLabelTexts` ne fait que remplacer le TEXTE des graduations sans bouger
 * l'échelle → labels et points désalignés. Ce helper calcule conjointement l'échelle
 * ET les libellés pour que le point d'allure X tombe pile sur son libellé.
 *
 * Retour :
 *  - `maxValue`    = plage utile (`max - min`) : haut de l'axe une fois l'offset appliqué.
 *  - `yAxisOffset` = `min` : la lib soustrait cette valeur à chaque point (bas de l'axe = min).
 *  - `stepValue`   = `(max - min) / sections` : hauteur d'une graduation.
 *  - `labels`      = `sections + 1` libellés, **ordre bas→haut** (index 0 = min ; la lib
 *                    mappe `labels[sections - i]` sur la i-ème section tracée du haut).
 *
 * Cas `min === max` (une seule course ou valeurs égales) : bande élargie de ±30 s pour
 * éviter `stepValue = 0` et des graduations identiques, courbe centrée. Jamais de division
 * par zéro. L'orientation n'est pas inversée (secondes basses en bas → point bas = plus
 * rapide = « ligne descendante = progrès »).
 *
 * @param values   valeurs d'allure (secondes par unité) des points tracés.
 * @param sections nombre de sections de l'axe (= `noOfSections` passé au LineChart).
 * @param format   formateur d'un libellé (ex. `formatPaceMMSS(v, '')` → "M:SS").
 */
export function buildPaceYAxis(
  values: number[],
  sections: number,
  format: (value: number) => string,
  /**
   * Demi-largeur de la bande ouverte quand toutes les valeurs sont égales, **dans l'unité des
   * valeurs**. Le défaut (30) est en secondes d'allure, d'où le nom historique de la fonction —
   * mais rien ici n'est propre à l'allure. Un appelant en centimètres ou en kilogrammes doit passer
   * sa propre valeur : 30 cm de marge autour d'un tour de taille écraserait la courbe.
   */
  flatPad: number = PACE_AXIS_FLAT_PAD_S,
): { labels: string[]; maxValue: number; yAxisOffset: number; stepValue: number } {
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  // Bande élargie quand plat, sinon plage réelle.
  const min = rawMin === rawMax ? rawMin - flatPad : rawMin;
  const max = rawMin === rawMax ? rawMax + flatPad : rawMax;

  const range = max - min;
  const stepValue = range / sections;

  // Libellés du bas (min) vers le haut (max) : labels[i] = min + step*i.
  const labels = Array.from({ length: sections + 1 }, (_, i) => format(min + stepValue * i));

  return { labels, maxValue: range, yAxisOffset: min, stepValue };
}
