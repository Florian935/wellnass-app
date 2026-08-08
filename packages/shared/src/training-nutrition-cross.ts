/**
 * US APPORT-01 (roadmap 4.40, catalogue MN-20 / MN-16 / MN-15 / MN-10) — la nutrition en face de
 * l'entraînement.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * L'app savait dire ce que tu manges, et comment tu t'entraînes. Elle ne disait **jamais si l'un va
 * avec l'autre** — c'est le différenciateur que la vision revendique, et ce qu'aucune des trois apps
 * qu'on remplace ne sait faire.
 *
 * ── 🔴 Ce module ne DÉFINIT rien, il assemble ───────────────────────────────────────────────────
 * Trois calibrages existaient déjà dans le produit, et les recopier aurait marché aujourd'hui pour
 * diverger au premier ajustement, **sans que rien n'échoue** :
 *
 *  - **« jour d'entraînement »** vient de `isTrainingDay` (`training-day.ts`) et entre ici en
 *    **booléen déjà calculé**. Sa règle est non triviale — séance *terminée* (rétroactif), **ou**
 *    planifiée si le jour est aujourd'hui ou futur, « le passé n'est jamais anticipé ». Une
 *    définition naïve classerait les jours autrement que l'accueil et que le calcul de cible : deux
 *    endroits de l'app diraient des choses contradictoires sur la même journée, chacun ayant l'air
 *    juste ;
 *  - **la marge d'adhérence** est un **réglage utilisateur** (`adherenceMarginPct`, défaut 10) et
 *    entre en paramètre. En coder une ici donnerait deux taux d'adhérence différents dans la même
 *    app à qui a réglé la sienne à 5 % ;
 *  - **le groupement par repas** suit la convention de NUTR-16 : ordre des repas configurés, clés
 *    inconnues dans `OTHER_MEAL_KEY`, **en dernier**.
 *
 * ── 🔴 `kcal: null` n'est pas `kcal: 0` ─────────────────────────────────────────────────────────
 * Un jour sans aucune entrée n'est pas un jour à zéro calorie : c'est un jour où rien n'a été noté.
 * Les confondre fausse **tous les dénominateurs à la fois**, et vers le bas — donc de façon crédible.
 * Le type l'impose, et un test le fige sur **chacun** des quatre moteurs.
 *
 * ── On met côte à côte, on ne conclut pas (spec R5) ─────────────────────────────────────────────
 * Ce module rapproche deux chiffres. Il ne dit jamais « ton déficit explique ta stagnation » : il n'y
 * a ni contrôle, ni puissance statistique, ni causalité établie. Les six items du catalogue qui
 * corrèlent l'apport à la progression de force relèvent du moteur de corrélations, hors de ce lot.
 */

import { computeGoalAdherence, OTHER_MEAL_KEY, type MealConfigItem } from './nutrition';

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/**
 * Jours minimum **dans CHACUN des deux groupes** (spec R3).
 *
 * 🔴 Le seuil porte sur chaque groupe, **jamais sur le total** : 12 jours de repos et 1 de séance
 * font 13 jours et **aucune comparaison**. `if (days.length < MIN)` est l'erreur naturelle, et elle
 * produit un écart calculé sur une seule journée de séance.
 */
export const MIN_DAYS_PER_GROUP = 3;

/**
 * Facteur au-delà de la **médiane personnelle** qui fait un « gros volume » (spec D3).
 *
 * ⚠️ **Le seul nombre libre du lot** — et encore : il n'est pas absolu. Il n'existe aucun seuil
 * universel de volume, 15 000 kg·reps étant énorme pour un débutant et ordinaire pour un confirmé.
 * Médiane et non moyenne, pour la raison déjà rencontrée sur `computeSessionDuration` (EXEC-01) : une
 * séance exceptionnelle tirerait la moyenne et rendrait toutes les autres « faibles ».
 */
export const HIGH_VOLUME_MEDIAN_FACTOR = 1.25;

/**
 * Repère de littérature pour une prise de protéines, en g/kg de poids de corps (spec R7).
 *
 * ⚠️ **Affiché comme repère, jamais prescrit** — même règle que le 80/20 d'ALLURE-01. La borne
 * **basse** de la fourchette usuelle (0,3-0,4) est retenue volontairement : afficher la haute ferait
 * passer beaucoup de monde pour insuffisant.
 */
export const PROTEIN_PER_SERVING_G_PER_KG = 0.3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Un jour, vu des deux piliers à la fois. */
export type CrossDay = {
  dayKey: string;
  /** 🔴 `null` = jour **non journalisé**, distinct d'un jour à 0 kcal (spec R4). */
  kcal: number | null;
  /** Cible effective du jour, bonus des jours de séance **déjà appliqué par l'appelant**. */
  effectiveTarget: number | null;
  /** 🔴 Vient de `isTrainingDay` — jamais dérivé ici (spec D1). */
  isTrainingDay: boolean;
  /** Volume muscu du jour (kg·reps). `0` quand il n'y a pas eu de séance de musculation. */
  strengthVolume: number;
};

export type EnergyByDayType = {
  trainingAvgKcal: number;
  restAvgKcal: number;
  /** Écart signé : **positif = on mange plus les jours de séance**. Jamais plafonné. */
  deltaKcal: number;
  trainingDays: number;
  restDays: number;
};

export type AdherenceByDayType = {
  trainingPct: number;
  restPct: number;
  /** La marge **effectivement utilisée** — la carte doit pouvoir l'afficher (spec R2, D2). */
  marginPct: number;
  trainingDays: number;
  restDays: number;
};

export type LowFuelDay = {
  dayKey: string;
  strengthVolume: number;
  kcal: number;
  effectiveTarget: number;
};

export type ProteinServing = {
  mealKey: string;
  label: string | null;
  proteinG: number;
  /** Vrai si la prise atteint `PROTEIN_PER_SERVING_G_PER_KG` × poids de corps. */
  reachesReference: boolean;
};

export type ProteinDistribution = {
  servings: ProteinServing[];
  /** Nombre de prises atteignant le repère — le chiffre qui distingue « tout au dîner » (spec R6). */
  servingsAtReference: number;
  /** Grammes requis pour une prise, arrondis — affichés pour que le repère soit vérifiable. */
  referenceG: number;
  totalProteinG: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Les jours **journalisés** d'un groupe : ni `kcal` absent, ni valeur non finie (spec R4). */
function loggedOf(days: ReadonlyArray<CrossDay>): { kcal: number; effectiveTarget: number | null }[] {
  return days
    .filter((d) => d.kcal !== null && Number.isFinite(d.kcal))
    .map((d) => ({ kcal: d.kcal as number, effectiveTarget: d.effectiveTarget }));
}

/** Moyenne d'une liste non vide. L'appelant garantit qu'elle l'est (seuil par groupe). */
function mean(values: ReadonlyArray<number>): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Médiane d'une liste **non vide**. Copie avant tri : l'entrée vient d'un `useMemo`. */
function median(values: ReadonlyArray<number>): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Sépare les jours en deux groupes selon `isTrainingDay` (spec D1). */
function splitByDayType(days: ReadonlyArray<CrossDay>): {
  training: CrossDay[];
  rest: CrossDay[];
} {
  return {
    training: days.filter((d) => d.isTrainingDay),
    rest: days.filter((d) => !d.isTrainingDay),
  };
}

// ---------------------------------------------------------------------------
// MN-20 — bilan énergétique séance vs repos
// ---------------------------------------------------------------------------

/**
 * Ce qu'on mange les jours de séance, comparé aux jours de repos.
 *
 * Rend `null` tant que **chacun** des deux groupes n'atteint pas `MIN_DAYS_PER_GROUP` jours
 * **journalisés**.
 *
 * ⚠️ Une **course** compte comme jour d'entraînement, parce que `isTrainingDay` ne distingue pas les
 * piliers — et c'est voulu ici : la cible calorique s'applique aussi aux jours de course. L'asymétrie
 * avec `findLowFuelDays`, qui lit le volume **muscu**, est délibérée (spec D1).
 */
export function computeEnergyByDayType(days: ReadonlyArray<CrossDay>): EnergyByDayType | null {
  const { training, rest } = splitByDayType(days);
  const trainingLogged = loggedOf(training);
  const restLogged = loggedOf(rest);

  if (trainingLogged.length < MIN_DAYS_PER_GROUP) return null;
  if (restLogged.length < MIN_DAYS_PER_GROUP) return null;

  const trainingAvgKcal = mean(trainingLogged.map((d) => d.kcal));
  const restAvgKcal = mean(restLogged.map((d) => d.kcal));

  return {
    trainingAvgKcal: Math.round(trainingAvgKcal),
    restAvgKcal: Math.round(restAvgKcal),
    // Positif = on mange plus les jours de séance. Négatif est une information, pas une anomalie :
    // on ne plafonne pas, et on ne commente pas.
    deltaKcal: Math.round(trainingAvgKcal - restAvgKcal),
    trainingDays: trainingLogged.length,
    restDays: restLogged.length,
  };
}

// ---------------------------------------------------------------------------
// MN-16 — adhérence séance vs repos
// ---------------------------------------------------------------------------

/**
 * Le taux d'atteinte de la cible, comparé entre jours de séance et jours de repos.
 *
 * 🔴 **`marginPct` vient de l'appelant** — c'est `nutritionProfile.adherenceMarginPct ?? 10`, un
 * **réglage utilisateur** (spec D2). Le figer ici afficherait deux taux d'adhérence différents dans
 * la même app à qui a réglé la sienne à 5 %, tous les deux crédibles.
 *
 * `computeGoalAdherence` est **réutilisée** sur chaque groupe plutôt que refaite : c'est elle qui
 * définit « dans la cible », et deux définitions divergeraient au premier ajustement. Elle écarte
 * déjà les jours sans cible exploitable — on ne crée pas une seconde convention.
 */
export function computeAdherenceByDayType(
  days: ReadonlyArray<CrossDay>,
  marginPct: number,
): AdherenceByDayType | null {
  const { training, rest } = splitByDayType(days);
  const trainingLogged = loggedOf(training);
  const restLogged = loggedOf(rest);

  const trainingResult = computeGoalAdherence(trainingLogged, marginPct);
  const restResult = computeGoalAdherence(restLogged, marginPct);

  // Le seuil porte sur les jours **retenus par `computeGoalAdherence`** (donc avec une cible), pas
  // sur les jours journalisés : sans cible, il n'y a rien à atteindre.
  if (trainingResult.loggedDays < MIN_DAYS_PER_GROUP) return null;
  if (restResult.loggedDays < MIN_DAYS_PER_GROUP) return null;

  return {
    trainingPct: trainingResult.pct,
    restPct: restResult.pct,
    marginPct,
    trainingDays: trainingResult.loggedDays,
    restDays: restResult.loggedDays,
  };
}

// ---------------------------------------------------------------------------
// MN-15 — disponibilité énergétique les jours de gros volume
// ---------------------------------------------------------------------------

/**
 * Les journées où un gros volume de musculation a rencontré un apport bas.
 *
 * « Gros volume » se mesure **contre soi-même** : au-delà de `HIGH_VOLUME_MEDIAN_FACTOR` fois la
 * médiane personnelle des jours avec volume (spec D3). Aucun seuil absolu n'aurait de sens.
 *
 * 🔴 **Lit `strengthVolume`, PAS `isTrainingDay`.** Un jour de course est un jour d'entraînement pour
 * les deux analyses précédentes, mais il produit **zéro volume muscu** — donc jamais un gros volume.
 * L'asymétrie est délibérée ; une relecture pourrait la « corriger » par symétrie apparente.
 *
 * Rend `[]` quand rien n'est à signaler — y compris quand le volume est parfaitement régulier, ce qui
 * n'est pas un défaut.
 */
export function findLowFuelDays(days: ReadonlyArray<CrossDay>): LowFuelDay[] {
  const withVolume = days.filter((d) => d.strengthVolume > 0 && Number.isFinite(d.strengthVolume));
  if (withVolume.length === 0) return [];

  const threshold = median(withVolume.map((d) => d.strengthVolume)) * HIGH_VOLUME_MEDIAN_FACTOR;

  return withVolume
    .filter((d): d is CrossDay & { kcal: number; effectiveTarget: number } => {
      if (d.strengthVolume <= threshold) return false;
      // Un jour non journalisé n'est pas signalé : on ne sait pas ce qui a été mangé, et l'accuser
      // d'un apport bas serait inventer une donnée.
      if (d.kcal === null || !Number.isFinite(d.kcal)) return false;
      if (d.effectiveTarget === null || d.effectiveTarget <= 0) return false;
      return d.kcal < d.effectiveTarget;
    })
    .map((d) => ({
      dayKey: d.dayKey,
      strengthVolume: d.strengthVolume,
      kcal: d.kcal,
      effectiveTarget: d.effectiveTarget,
    }))
    .sort((a, b) => b.strengthVolume - a.strengthVolume || a.dayKey.localeCompare(b.dayKey));
}

// ---------------------------------------------------------------------------
// MN-10 — protéines fractionnées sur la journée
// ---------------------------------------------------------------------------

/**
 * La répartition des protéines entre les repas, et le nombre de prises atteignant le repère.
 *
 * Rend `null` **sans poids de corps** (spec D4) : les g/kg n'existent pas, et il n'y a **aucune
 * valeur neutre** pour le remplacer — prendre 70 kg par défaut produirait une répartition fausse et
 * parfaitement crédible. L'écran affiche alors l'indisponibilité **et son remède**.
 *
 * ⚠️ **Convention de repas de NUTR-16, pas une nouvelle** : l'ordre suit `configuredMeals`, et toute
 * clé inconnue rejoint `OTHER_MEAL_KEY`, **en dernier**. `resolveMealSplit` n'est pas réutilisée
 * telle quelle — elle rend des `avgKcalPerDay`, spécifiques aux calories — mais sa convention l'est.
 *
 * Le total n'est pas l'information (spec R6) : « 140 g » ne distingue pas un dîner unique de quatre
 * prises. C'est `servingsAtReference` qui porte le sens.
 */
export function computeProteinDistribution(input: {
  /** Protéines par clé de repas, déjà agrégées sur la fenêtre par l'appelant. */
  mealProtein: ReadonlyArray<{ mealKey: string; proteinG: number }>;
  configuredMeals: ReadonlyArray<MealConfigItem>;
  /** Dernière pesée connue. `null` → analyse impossible (D4). */
  bodyWeightKg: number | null;
}): ProteinDistribution | null {
  const { mealProtein, configuredMeals, bodyWeightKg } = input;
  if (bodyWeightKg === null || !Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) return null;
  if (mealProtein.length === 0) return null;

  const referenceG = PROTEIN_PER_SERVING_G_PER_KG * bodyWeightKg;
  const byKey = new Map<string, number>();
  for (const m of mealProtein) {
    if (!Number.isFinite(m.proteinG) || m.proteinG <= 0) continue;
    byKey.set(m.mealKey, (byKey.get(m.mealKey) ?? 0) + m.proteinG);
  }
  if (byKey.size === 0) return null;

  const configuredKeys = new Set(configuredMeals.map((m) => m.key));
  const servings: ProteinServing[] = [];

  const push = (mealKey: string, label: string | null, proteinG: number) => {
    servings.push({
      mealKey,
      label,
      proteinG: Math.round(proteinG),
      // Borne **inclusive** : une prise pile au repère l'atteint.
      reachesReference: proteinG >= referenceG,
    });
  };

  // L'ordre suit les repas configurés — jamais un tri par quantité décroissante, qui casserait la
  // lecture chronologique de la journée (même règle que NUTR-16 R4).
  for (const meal of configuredMeals) {
    const proteinG = byKey.get(meal.key);
    if (proteinG !== undefined) push(meal.key, meal.label, proteinG);
  }

  // Tout ce qui n'est pas configuré est regroupé en « Autre », **en dernier** (NUTR-16 R3).
  let otherG = 0;
  for (const [mealKey, proteinG] of byKey) {
    if (!configuredKeys.has(mealKey)) otherG += proteinG;
  }
  if (otherG > 0) push(OTHER_MEAL_KEY, null, otherG);

  // 🔴 `servings` n'est jamais vide ici : `byKey` est non vide (garde ci-dessus) et toutes ses
  // valeurs sont strictement positives, donc chaque clé est soit poussée comme repas configuré, soit
  // agrégée dans `otherG` — qui est alors lui-même positif. Défendre le cas vide serait du code mort,
  // et le dépôt les supprime plutôt que de figer un appel impossible par un test (cf. `bucketOf`
  // 04/08, `findFallbackDay` et `computeSessionDuration` 07/08).
  return {
    servings,
    servingsAtReference: servings.filter((s) => s.reachesReference).length,
    referenceG: Math.round(referenceG),
    totalProteinG: Math.round(servings.reduce((sum, s) => sum + s.proteinG, 0)),
  };
}
