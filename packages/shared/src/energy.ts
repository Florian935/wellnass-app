/**
 * US DEPENSE-01 — **le moteur de dépense**, commun aux trois sources : musculation, course et
 * activité libre.
 *
 * Analyse et chiffres : `docs/product/analyse-depense-activites-2026-09.md` (§4).
 * Spec : `docs/specs/functional/us/depense01-moteur-depense.md`.
 *
 * ── Une seule formule ───────────────────────────────────────────────────────────────────────────
 *
 *     dépense nette = (MET − 1) × métabolisme de repos par heure × heures actives
 *
 * - **MET** : l'intensité de l'activité, 1 = repos (Compendium of Physical Activities).
 * - **« − 1 »** : on retire le repos, **déjà compté dans la cible calorique**. C'est la convention
 *   « nette » que RN-01 avait déjà choisie pour la course ; la respecter partout évite d'avoir deux
 *   définitions de « dépense » dans la même application.
 * - **métabolisme de repos par heure** : celui de l'utilisateur (Mifflin-St Jeor ÷ 24). 🔴 **C'est
 *   là, et seulement là, qu'entrent l'âge, la taille, le poids et le sexe.** Le MET « standard »
 *   suppose 1 kcal/kg/h et surestime la dépense des personnes plus âgées ou plus lourdes ; la même
 *   heure de musculation vaut 370 kcal pour un homme de 30 ans et 80 kg, 260 pour une femme de
 *   45 ans et 60 kg, contre 400 et 300 au MET standard.
 *
 * ── 🔴 Le niveau d'entraînement n'entre PAS dans le calcul ───────────────────────────────────────
 * Et c'est une décision, pas un oubli. Un confirmé ne dépense pas plus *parce qu'il est* confirmé :
 * il dépense plus parce qu'il soulève plus lourd, enchaîne plus vite ou court plus vite — ce que les
 * entrées mesurent déjà (ressenti, densité, allure, dénivelé). Un facteur de niveau compterait deux
 * fois la même chose. La tentation reviendra à chaque relecture : elle est refusée ici une fois pour
 * toutes, et un test la fige.
 *
 * ── Ce que le module rend, et pourquoi une fourchette ────────────────────────────────────────────
 * Toute estimation sort en `{ kcal, low, high, confidence }`, arrondie à 10 kcal. Une valeur unique
 * au kcal près serait un mensonge : la littérature situe l'erreur individuelle d'une estimation par
 * MET autour de ±25 %, davantage en musculation sans fréquence cardiaque. **La cible calorique ne
 * retient que `low`** (décision D2) — les MET surestiment plus souvent qu'ils ne sous-estiment, et
 * une surestimation efface un déficit sans bruit.
 *
 * ⚠️ Les seuils de ce fichier (bornes de densité, plafond par série, largeurs de fourchette) sont des
 * **heuristiques proposées**, pas des valeurs sourcées : elles sont nommées, exportées et testées
 * pour pouvoir être recalibrées d'un seul endroit — même statut que `HIGH_VOLUME_MEDIAN_FACTOR`.
 */

import { activityTypeDef, isKnownActivityType, type ActivityIntensity } from './activity';
import { basalMetabolicRate } from './nutrition';
import type { Sex } from './profile';
import { EASY_KMH, MAX_INTENSITY_BONUS, NET_KCAL_PER_KG_KM, PER_KMH_BONUS } from './running';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Même échelle que la `Confidence` d'`explain.ts` — volontairement le même vocabulaire à l'écran.
 * Type distinct pour ne pas créer de dépendance entre le moteur et la couche d'explication.
 */
export type EnergyConfidence = 'high' | 'medium' | 'low';

export type EnergyEstimate = {
  /** Estimation centrale, arrondie à 10 kcal. */
  kcal: number;
  /** Bas de fourchette — **le seul chiffre que la cible calorique retient** (D2). */
  low: number;
  high: number;
  confidence: EnergyConfidence;
  /** MET retenu, `null` pour un chiffre venu d'une montre. */
  met: number | null;
  /** `device` = calories actives saisies par l'utilisateur ; aucune estimation n'a été faite. */
  source: 'estimate' | 'device';
};

export type RestingMetabolism = {
  /** kcal par heure au repos. */
  kcalPerHour: number;
  /**
   * `false` = repli sur le MET standard (1 kcal/kg/h), faute d'âge ou de taille. Le calcul reste
   * possible, mais la confiance tombe : c'est l'information que l'écran doit montrer.
   */
  personalised: boolean;
};

// ---------------------------------------------------------------------------
// Métabolisme de repos
// ---------------------------------------------------------------------------

/** Définition du MET : 1 MET ≈ 1 kcal par kilo et par heure. Repli quand le profil est incomplet. */
export const MET_STANDARD_KCAL_PER_KG_H = 1;

/**
 * Le métabolisme de repos horaire de l'utilisateur.
 *
 * 🔴 **`null` sans poids**, et c'est délibéré : il n'existe aucune valeur neutre pour un poids
 * (prendre 70 kg produirait une dépense fausse et parfaitement crédible — même règle que
 * `computeProteinDistribution`). L'écran affiche alors l'indisponibilité **et son remède**.
 *
 * Sans âge ou sans taille, on ne bloque pas : repli sur le MET standard, `personalised: false`.
 */
export function restingMetabolism(input: {
  sex?: Sex | null;
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
}): RestingMetabolism | null {
  const { sex, weightKg, heightCm, age } = input;
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return null;

  const complete =
    heightCm != null && Number.isFinite(heightCm) && heightCm > 0 &&
    age != null && Number.isFinite(age) && age > 0;

  if (!complete) {
    return { kcalPerHour: weightKg * MET_STANDARD_KCAL_PER_KG_H, personalised: false };
  }

  const bmr = basalMetabolicRate({
    sex: sex ?? 'unspecified',
    weightKg,
    heightCm: heightCm!,
    age: age!,
  });
  return { kcalPerHour: bmr / 24, personalised: true };
}

// ---------------------------------------------------------------------------
// Fourchettes
// ---------------------------------------------------------------------------

/**
 * Largeur de la fourchette par source (± part de l'estimation centrale).
 *
 * ⚠️ Ordres de grandeur tirés de la littérature, **non calibrés sur nos données** :
 * - `run` : la distance est mesurée et le coût par kilo et par kilomètre varie peu d'une personne à
 *   l'autre — c'est notre estimation la plus sûre ;
 * - `runNoGps` : sans distance, tout repose sur une allure déclarée ;
 * - `activity` : MET catalogue + intensité déclarée ;
 * - `strength` : la plus incertaine de toutes sans fréquence cardiaque (alternance effort/repos).
 */
export const ENERGY_SPREAD = {
  run: 0.15,
  runNoGps: 0.25,
  activity: 0.25,
  strength: 0.3,
} as const;

/** Arrondi d'affichage : au multiple de 10 le plus proche. « 372 kcal » serait un mensonge. */
export function roundEnergy(kcal: number): number {
  return Math.round(kcal / 10) * 10;
}

/**
 * Fabrique une estimation à partir d'une dépense nette brute. Exportée pour les appelants qui ont
 * déjà leur propre calcul (la course, qui part d'un coût au kilomètre et non d'un MET).
 */
export function toEnergyEstimate(input: {
  netKcal: number;
  spread: number;
  confidence: EnergyConfidence;
  met?: number | null;
}): EnergyEstimate {
  const net = Math.max(0, input.netKcal);
  return {
    kcal: roundEnergy(net),
    low: roundEnergy(net * (1 - input.spread)),
    high: roundEnergy(net * (1 + input.spread)),
    confidence: input.confidence,
    met: input.met ?? null,
    source: 'estimate',
  };
}

/**
 * La dépense **nette** d'un effort décrit par un MET et une durée.
 * `null` si la durée est nulle ou le MET ≤ 1 (aucun surcoût sur le repos).
 */
export function estimateMetEnergy(input: {
  met: number;
  minutes: number;
  resting: RestingMetabolism;
  spread: number;
  confidence: EnergyConfidence;
}): EnergyEstimate | null {
  const { met, minutes, resting, spread, confidence } = input;
  if (!Number.isFinite(met) || met <= 1) return null;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;

  const net = (met - 1) * resting.kcalPerHour * (minutes / 60);
  return toEnergyEstimate({ netKcal: net, spread, confidence, met });
}

/** Une confiance jamais supérieure à `medium` quand le profil est incomplet (spec R6). */
function cappedByProfile(confidence: EnergyConfidence, resting: RestingMetabolism): EnergyConfidence {
  if (resting.personalised) return confidence;
  return 'low';
}

// ---------------------------------------------------------------------------
// Musculation
// ---------------------------------------------------------------------------

/** MET de base selon le ressenti de séance (Compendium : musculation 3,5 → 6,0). */
export const STRENGTH_MET_LIGHT = 3.5;
export const STRENGTH_MET_MODERATE = 5.0;
export const STRENGTH_MET_VIGOROUS = 6.0;
/** Plafond : au-delà, on décrit un circuit training, pas une séance de musculation. */
export const STRENGTH_MET_MAX = 8.0;
/** Bonus de densité : des repos courts rapprochent la séance du circuit training. */
export const SHORT_REST_SECONDS = 60;
export const MEDIUM_REST_SECONDS = 120;
export const SHORT_REST_MET_BONUS = 1.5;
export const MEDIUM_REST_MET_BONUS = 0.5;
/** Temps de travail supposé d'une série, hors repos — sert à déduire le repos moyen. */
export const SECONDS_PER_SET = 40;
/**
 * Plafond de temps actif par série.
 *
 * 🔴 Ce n'est pas un détail de confort : une séance oubliée ouverte se clôt automatiquement au bout
 * de **3 heures** (`WORKOUT_AUTO_CLOSE_SECONDS`), et sans ce plafond elle produirait une dépense de
 * plus de 1 000 kcal pour 20 minutes de travail réel — ajoutée à la cible du jour.
 */
export const MINUTES_PER_SET_CAP = 4;

/**
 * Repos moyen entre séries, déduit de la durée et du nombre de séries.
 * `null` si une seule série (aucun intervalle) ou si la séance est plus courte que son travail.
 */
export function averageRestSeconds(input: {
  durationSeconds: number | null;
  totalSets: number;
}): number | null {
  const { durationSeconds, totalSets } = input;
  if (durationSeconds == null || durationSeconds <= 0 || totalSets < 2) return null;
  const workSeconds = totalSets * SECONDS_PER_SET;
  const gaps = totalSets - 1;
  const rest = (durationSeconds - workSeconds) / gaps;
  return rest > 0 ? rest : 0;
}

/**
 * MET d'une séance de musculation : le ressenti donne la base, la densité ajuste.
 *
 * Sans ressenti, on retient « modéré » — jamais la valeur haute : se tromper vers le haut gonfle la
 * cible calorique, se tromper vers le bas ne fait que sous-estimer un bonus.
 */
export function strengthSessionMet(input: {
  rpe: number | null;
  avgRestSeconds: number | null;
}): number {
  const { rpe, avgRestSeconds } = input;
  const base =
    rpe == null ? STRENGTH_MET_MODERATE
      : rpe <= 5 ? STRENGTH_MET_LIGHT
        : rpe <= 7 ? STRENGTH_MET_MODERATE
          : STRENGTH_MET_VIGOROUS;

  const bonus =
    avgRestSeconds == null ? 0
      : avgRestSeconds < SHORT_REST_SECONDS ? SHORT_REST_MET_BONUS
        : avgRestSeconds <= MEDIUM_REST_SECONDS ? MEDIUM_REST_MET_BONUS
          : 0;

  return Math.min(STRENGTH_MET_MAX, base + bonus);
}

/** Temps actif retenu : la durée réelle, **plafonnée** à `MINUTES_PER_SET_CAP` par série. */
export function strengthActiveMinutes(input: {
  durationSeconds: number | null;
  totalSets: number;
}): number {
  const { durationSeconds, totalSets } = input;
  if (durationSeconds == null || durationSeconds <= 0) return 0;
  const minutes = durationSeconds / 60;
  const cap = Math.max(0, totalSets) * MINUTES_PER_SET_CAP;
  return cap > 0 ? Math.min(minutes, cap) : minutes;
}

/**
 * Dépense d'une séance de musculation.
 *
 * ⚠️ `totalSets` compte **les échauffements** : ils coûtent de l'énergie et du temps, alors que le
 * volume (`computeVolume`) les exclut à juste titre. Les deux notions ne se recouvrent pas.
 */
export function estimateStrengthEnergy(input: {
  durationSeconds: number | null;
  totalSets: number;
  rpe: number | null;
  resting: RestingMetabolism | null;
}): EnergyEstimate | null {
  const { durationSeconds, totalSets, rpe, resting } = input;
  if (resting == null) return null;

  const minutes = strengthActiveMinutes({ durationSeconds, totalSets });
  if (minutes <= 0) return null;

  const met = strengthSessionMet({
    rpe,
    avgRestSeconds: averageRestSeconds({ durationSeconds, totalSets }),
  });

  return estimateMetEnergy({
    met,
    minutes,
    resting,
    spread: ENERGY_SPREAD.strength,
    // Sans ressenti, le MET est un défaut, pas une mesure : la confiance le dit.
    confidence: cappedByProfile(rpe == null ? 'low' : 'medium', resting),
  });
}

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------

/**
 * Dénivelé : **100 m de montée valent 1 km d'effort** (règle du « kilomètre-effort », usuelle en
 * trail). La descente est ignorée — elle coûte de l'énergie, mais bien moins, et aucune règle simple
 * ne la chiffre honnêtement.
 *
 * Constat C5 de l'analyse : un trail de 15 km avec 800 m de D+ était estimé comme 15 km à plat.
 */
export const KM_EFFORT_PER_ELEVATION_M = 1 / 100;

/** MET de course selon le ressenti, quand il n'y a **pas** de distance (tapis, montre oubliée). */
export function runMetFromRpe(rpe: number | null): number {
  if (rpe == null) return 8.3; // ≈ 8 km/h, allure de fond
  if (rpe <= 4) return 7.0;
  if (rpe <= 6) return 8.3;
  if (rpe <= 8) return 9.8; // ≈ 9,7 km/h
  return 11.0;
}

/**
 * Dépense d'une course. Deux chemins, et c'est le cœur de l'US côté course :
 *
 * 1. **avec distance** — on garde la formule de RN-01 (poids × km × coût net, plus un petit terme
 *    d'allure borné), en ajoutant le **dénivelé** en kilomètres-effort. Sans dénivelé, le résultat
 *    est **identique au centime près** à `estimateRunCalories` : un test de non-régression le fige ;
 * 2. **sans distance** — au lieu de rendre `0` (constat C4 : une heure de tapis ne valait rien), on
 *    repasse par le MET de course et la durée, avec une fourchette plus large et une confiance moindre.
 *
 * `null` sans poids ou sans rien de mesurable.
 */
export function estimateRunEnergy(input: {
  distanceM: number | null;
  durationSeconds: number | null;
  elevationGainM?: number | null;
  rpe?: number | null;
  /** Poids **à la date de la course** (constat C6), pas la dernière pesée. */
  weightKg: number | null;
  resting: RestingMetabolism | null;
}): EnergyEstimate | null {
  const { distanceM, durationSeconds, elevationGainM, rpe, weightKg, resting } = input;

  if (distanceM != null && distanceM > 0 && weightKg != null && weightKg > 0) {
    const distanceKm = distanceM / 1000;
    const climbKm =
      elevationGainM != null && Number.isFinite(elevationGainM) && elevationGainM > 0
        ? elevationGainM * KM_EFFORT_PER_ELEVATION_M
        : 0;

    // 🔴 L'allure se calcule sur la distance RÉELLE, jamais sur la distance-effort : gonfler la
    // distance puis en déduire une vitesse ferait payer deux fois le dénivelé.
    let intensityBonus = 0;
    if (durationSeconds != null && durationSeconds > 0) {
      const speedKmh = distanceKm / (durationSeconds / 3600);
      intensityBonus = Math.min(
        MAX_INTENSITY_BONUS,
        Math.max(0, (speedKmh - EASY_KMH) * PER_KMH_BONUS),
      );
    }

    const net = weightKg * (distanceKm + climbKm) * NET_KCAL_PER_KG_KM * (1 + intensityBonus);
    return toEnergyEstimate({ netKcal: net, spread: ENERGY_SPREAD.run, confidence: 'high', met: null });
  }

  if (resting == null) return null;
  if (durationSeconds == null || durationSeconds <= 0) return null;

  return estimateMetEnergy({
    met: runMetFromRpe(rpe ?? null),
    minutes: durationSeconds / 60,
    resting,
    spread: ENERGY_SPREAD.runNoGps,
    confidence: cappedByProfile(rpe == null ? 'low' : 'medium', resting),
  });
}

// ---------------------------------------------------------------------------
// Activité libre
// ---------------------------------------------------------------------------

/** Vitesse moyenne en km/h, ou `null` si l'un des deux manque. */
export function activitySpeedKmh(input: {
  distanceM: number | null;
  durationSeconds: number | null;
}): number | null {
  const { distanceM, durationSeconds } = input;
  if (distanceM == null || distanceM <= 0) return null;
  if (durationSeconds == null || durationSeconds <= 0) return null;
  return distanceM / 1000 / (durationSeconds / 3600);
}

/**
 * MET d'une activité : l'intensité déclarée par défaut, **affinée par la vitesse** quand la distance
 * a été saisie et que le type s'y prête (vélo, marche).
 *
 * Une vitesse mesurée l'emporte sur une intensité ressentie : « soutenu » à 12 km/h en vélo et
 * « soutenu » à 28 km/h ne coûtent pas la même chose, et seule la vitesse le sait.
 */
export function activityMet(input: {
  activityType: string;
  intensity: ActivityIntensity;
  speedKmh?: number | null;
}): number {
  const def = activityTypeDef(input.activityType);
  const declared = def.met[input.intensity];
  const speed = input.speedKmh;
  if (speed == null || !Number.isFinite(speed) || speed <= 0 || !def.distanceUseful) return declared;

  if (def.id === 'bike') {
    if (speed < 16) return def.met.light;
    if (speed < 19) return 6.8;
    if (speed < 22) return def.met.moderate;
    return def.met.vigorous;
  }
  if (def.id === 'walk') {
    if (speed < 4) return def.met.light;
    if (speed <= 5.5) return def.met.moderate;
    return def.met.vigorous;
  }
  return declared;
}

/**
 * Dépense d'une activité libre.
 *
 * `deviceKcal` (calories **actives** lues sur une montre) court-circuite tout : c'est une mesure, on
 * ne la « corrige » pas, et la fourchette se referme dessus. Décision D6 — les gens ont une montre,
 * et ignorer son chiffre ferait passer l'app pour fausse.
 */
export function estimateActivityEnergy(input: {
  activityType: string;
  intensity: ActivityIntensity;
  durationSeconds: number;
  distanceM?: number | null;
  deviceKcal?: number | null;
  resting: RestingMetabolism | null;
}): EnergyEstimate | null {
  const { activityType, intensity, durationSeconds, distanceM, deviceKcal, resting } = input;

  if (deviceKcal != null && Number.isFinite(deviceKcal) && deviceKcal > 0) {
    const kcal = Math.round(deviceKcal);
    return { kcal, low: kcal, high: kcal, confidence: 'high', met: null, source: 'device' };
  }

  if (resting == null) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

  const speedKmh = activitySpeedKmh({ distanceM: distanceM ?? null, durationSeconds });
  const met = activityMet({ activityType, intensity, speedKmh });

  return estimateMetEnergy({
    met,
    minutes: durationSeconds / 60,
    resting,
    spread: ENERGY_SPREAD.activity,
    // Un type hors catalogue retombe sur « Autre » : le MET n'est alors plus qu'un ordre de grandeur,
    // et la confiance doit le dire plutôt que d'afficher la même assurance qu'un vélo chronométré.
    confidence: cappedByProfile(isKnownActivityType(activityType) ? 'medium' : 'low', resting),
  });
}

// ---------------------------------------------------------------------------
// Ce que la cible calorique retient
// ---------------------------------------------------------------------------

/**
 * Somme des dépenses d'une journée **au bas de leur fourchette** (décision D2).
 *
 * 🔴 `low`, pas `kcal` : c'est LA règle de l'US côté nutrition, et la plus facile à « corriger » par
 * mégarde en relecture — le chiffre affiché à l'utilisateur est bien `kcal`, mais ce qu'on lui
 * autorise à manger en plus est `low`. Une estimation de montre (`source: 'device'`) a `low = kcal` :
 * elle entre donc en entier, ce qui est cohérent — c'est une mesure, pas une estimation.
 */
export function sumEnergyForTarget(estimates: ReadonlyArray<EnergyEstimate | null>): number {
  return estimates.reduce<number>((sum, e) => sum + (e ? e.low : 0), 0);
}
