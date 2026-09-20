/**
 * Le verdict de la semaine (US NUTRI-UX02) — une phrase, avant les graphiques.
 *
 * ── Pourquoi cette brique existe ─────────────────────────────────────────────────────────────────
 * Onze analyses nutritionnelles sont livrées et testées depuis des mois, et **aucune n'était sur
 * l'écran du pilier** : elles vivaient toutes derrière une icône, sur `Nutrition › Stats`. Les
 * remonter dans un onglet ne suffit pas — six cartes empilées ne disent pas *ce qu'il faut en
 * conclure*. Cette brique compose la conclusion, et les cartes deviennent sa justification.
 *
 * ── Ce qu'elle ne fait PAS ───────────────────────────────────────────────────────────────────────
 * Elle ne rédige aucune phrase : elle rend des **faits typés**, et l'écran les traduit (règle i18n
 * du dépôt, décision G). Un verdict rédigé ici serait français, ou anglais, mais pas les deux.
 *
 * Elle ne juge pas non plus une semaine qu'elle ne connaît pas : sous `MIN_LOGGED_DAYS` jours
 * renseignés, elle rend `notEnoughData` et **rien d'autre**. C'est la règle qui compte — un
 * « 100 % dans la cible » calculé sur un seul jour loggé est faux au point d'être nuisible, et
 * c'est exactement ce que produirait une moyenne non gardée.
 */

import { MIN_LOGGED_DAYS } from './bodyweight';
import type { ProteinPerKg } from './protein-target';

/**
 * Nombre minimal de jours renseignés avant de conclure quoi que ce soit sur une semaine.
 *
 * 🔴 **Réutilisé, pas redéfini.** `bodyweight.ts` porte déjà ce seuil (4 jours sur 7) pour l'alerte
 * déficit × volume de MN-02, et le Labo en a une troisième copie (`LAB_MIN_LOGGED_DAYS`). En poser
 * une quatrième aurait garanti qu'un jour, deux écrans de la même app se mettent à répondre
 * différemment à la question « ai-je assez de données ? » — sans que rien ne casse.
 */
export { MIN_LOGGED_DAYS };

/**
 * Part des jours loggés dans la cible à partir de laquelle on parle de cap tenu.
 *
 * 60 %, et non 80 : la cible porte une marge de tolérance que l'utilisateur règle lui-même
 * (`adherenceMarginPct`), donc « dans la cible » est déjà une fourchette. Exiger 80 % par-dessus
 * reviendrait à empiler deux exigences et à annoncer un échec à quelqu'un qui tient son plan
 * quatre jours sur sept — le contraire de l'effet recherché.
 */
export const ON_TRACK_RATIO = 0.6;

/**
 * Part des calories du jour à partir de laquelle un repas est signalé comme dominant.
 *
 * 38 % : au-delà, un repas pèse plus du tiers de la journée sur une répartition à trois repas, ce
 * qui est le signal que NUTR-16 cherchait à rendre visible (« le dîner trop lourd, le grignotage du
 * soir »). En deçà, la répartition n'a rien d'anormal et la remarque serait du bruit.
 */
export const HEAVY_MEAL_PCT = 38;

/** Le fait principal : est-ce que la semaine tient son cap ? */
export type WeekSignal =
  | { kind: 'notEnoughData'; loggedDays: number; needed: number }
  | { kind: 'onTrack'; daysInTarget: number; loggedDays: number }
  | { kind: 'offTrack'; daysInTarget: number; loggedDays: number };

/**
 * Les faits secondaires, dans l'ordre où ils méritent d'être lus.
 *
 * 🔴 La remarque sur les protéines **ne porte plus les chiffres** (passe 2, 20/09/2026). Elle les
 * portait, et la carte `ProteinPerKgCard` les redisait trois centimètres plus bas, en plus gros,
 * avec sa fourchette et son badge « insuffisant ». Un verdict qui recopie la carte qu'il annonce
 * n'ajoute rien : il nomme désormais **le poste**, la carte porte **la mesure**.
 */
export type WeekRemark =
  | { kind: 'protein'; status: ProteinPerKg['status'] }
  | { kind: 'heavyMeal'; mealKey: string; pct: number };

export type WeekVerdict = { signal: WeekSignal; remarks: WeekRemark[] };

export type WeekVerdictInput = {
  /** Jours réellement renseignés sur la fenêtre (NUTR-17). */
  loggedDays: number;
  /** Jours dans la cible parmi eux (NUTR-10). `null` = aucune cible définie. */
  daysInTarget: number | null;
  /** Ratio protéines/poids et son statut (MN-06). `null` = pas de pesée, donc rien à dire. */
  protein: ProteinPerKg | null;
  /** Répartition par repas (NUTR-16), parts en pourcentage. */
  mealSplit: ReadonlyArray<{ mealKey: string; pct: number }>;
};

/**
 * Compose le verdict. Rend toujours un objet : c'est à l'appelant de décider s'il affiche la carte,
 * et `notEnoughData` est une information utile (« remplis ton journal ») et non une absence.
 */
export function composeWeekVerdict(input: WeekVerdictInput): WeekVerdict {
  const { loggedDays, daysInTarget, protein, mealSplit } = input;

  if (loggedDays < MIN_LOGGED_DAYS || daysInTarget == null) {
    // 🔴 Aucune remarque dans ce cas, même si les protéines sont connues : une moyenne de g/kg sur
    // deux jours loggés hérite exactement du défaut qu'on refuse au chiffre principal.
    return {
      signal: { kind: 'notEnoughData', loggedDays, needed: MIN_LOGGED_DAYS },
      remarks: [],
    };
  }

  const signal: WeekSignal =
    daysInTarget / loggedDays >= ON_TRACK_RATIO
      ? { kind: 'onTrack', daysInTarget, loggedDays }
      : { kind: 'offTrack', daysInTarget, loggedDays };

  const remarks: WeekRemark[] = [];
  // 🔴 Seul un statut **hors fourchette** mérite une remarque. Dire « tes protéines sont dans ta
  // fourchette » dans un verdict revient à occuper la place avec une non-information : le verdict
  // est l'endroit où l'on dit ce qui cloche, la carte celui où l'on vérifie que tout va bien.
  if (protein && protein.status !== 'in') {
    remarks.push({ kind: 'protein', status: protein.status });
  }

  // Le repas le plus lourd, et lui seul : signaler deux repas dominants sur une journée à trois
  // repas ne désigne plus rien.
  const heaviest = [...mealSplit].sort((a, b) => b.pct - a.pct)[0];
  if (heaviest && heaviest.pct >= HEAVY_MEAL_PCT) {
    remarks.push({ kind: 'heavyMeal', mealKey: heaviest.mealKey, pct: heaviest.pct });
  }

  return { signal, remarks };
}
