/**
 * US AUTRE-01 — les **autres activités** : celles qui ne sont ni une séance de musculation ni une
 * course, et que l'app ignorait complètement (vélo, natation, rando, sports collectifs…).
 *
 * Ce fichier porte **le catalogue et la ligne de données**. Le calcul de dépense vit dans
 * [`energy.ts`](./energy.ts) — il est commun aux trois sources (muscu, course, activité) et n'a rien
 * de spécifique aux activités manuelles.
 *
 * ── 🔴 `activityType` n'a PAS de contrainte en base ──────────────────────────────────────────────
 * Le catalogue est **applicatif et destiné à grossir** (le padel manque au Compendium 2011, les
 * sports d'hiver sont regroupés…). Un `CHECK` imposerait une migration à chaque ajout et, surtout,
 * **bloquerait la file d'upload PowerSync** si un client plus récent écrivait un type que le serveur
 * ne connaît pas encore. Même raisonnement que `pain_reports.zone` (DOUL-01) et
 * `food_entries.meal_type`. Une valeur inconnue à la lecture retombe sur `other`, elle ne fait jamais
 * disparaître la ligne.
 *
 * ── ⚠️ Les MET viennent du Compendium of Physical Activities ─────────────────────────────────────
 * Valeurs de l'édition Ainsworth 2011, **à revérifier dans la table Herrmann 2024** avant de les
 * figer (analyse `docs/product/analyse-depense-activites-2026-09.md` §10). Elles sont déclarées ici,
 * en un seul endroit, précisément pour qu'une relecture puisse les corriger sans toucher au reste.
 * Le **padel** n'existe pas dans l'édition 2011 : il partage la ligne du tennis, et c'est dit.
 *
 * ── Ce que le catalogue NE contient pas, volontairement ──────────────────────────────────────────
 * Ni ménage, ni jardinage, ni bricolage : ces dépenses du quotidien font partie du **socle hors
 * sport** (`SPORT_FREE_LEVELS`, nutrition.ts). Les compter en plus rouvrirait le double comptage par
 * une autre porte — le défaut même que cette US répare.
 */

import { z } from 'zod';
import { syncFieldsSchema, utcTimestampSchema } from './sync';

// ---------------------------------------------------------------------------
// Intensité déclarée
// ---------------------------------------------------------------------------

/**
 * L'intensité telle que l'utilisateur la déclare, au **test de la parole** :
 * *tranquille* = je peux chanter · *soutenu* = je peux parler · *intense* = quelques mots à la fois.
 *
 * Trois choix, pas cinq : personne ne sait distinguer « assez intense » de « très intense » sans
 * cardiofréquencemètre, et une échelle plus fine donnerait une fausse impression de précision.
 */
export const ACTIVITY_INTENSITIES = ['light', 'moderate', 'vigorous'] as const;
export const activityIntensitySchema = z.enum(ACTIVITY_INTENSITIES);
export type ActivityIntensity = z.infer<typeof activityIntensitySchema>;

/**
 * Ressenti (RPE 1-10) prérempli par l'intensité déclarée.
 *
 * 🔴 C'est **lui** qui alimente la charge d'entraînement (`sessionLoad` = RPE × minutes, méthode de
 * Foster) : sans ressenti, une activité pèserait **zéro** dans l'ACWR et le garde-fou de charge, et
 * trois heures de vélo passeraient pour du repos. L'utilisateur peut le corriger ; le préremplir
 * garantit qu'il existe toujours.
 */
export const ACTIVITY_INTENSITY_RPE: Record<ActivityIntensity, number> = {
  light: 3,
  moderate: 5,
  vigorous: 8,
};

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/** Sollicitation dominante — lue par le détecteur de collisions (COLLIS-01), pas par le calcul. */
export type ActivityFocus = 'legs' | 'upper' | 'full';

export type ActivityTypeDef = {
  /** Clé stable, écrite en base et utilisée comme clé i18n (`activity.types.<id>`). */
  id: string;
  /** MET par intensité déclarée (Compendium 2011, à revérifier — voir en-tête). */
  met: Record<ActivityIntensity, number>;
  /**
   * La distance apporte-t-elle une information ? Elle donne une **vitesse**, donc une tranche de MET
   * plus juste que l'intensité déclarée (vélo, marche). Ailleurs elle n'apprend rien d'exploitable.
   */
  distanceUseful: boolean;
  /**
   * `ExerciseType` de Health Connect pour l'écriture de la séance.
   *
   * 🔴 Valeurs relevées dans `react-native-health-connect/src/constants.ts` (`ExerciseType`), **pas
   * devinées**. ⚠️ Ne pas confondre avec `ExerciseSegmentType`, une autre énumération du même
   * paquet où les mêmes noms portent d'autres nombres (piège déjà documenté dans health-connect.ts).
   * `0` = `OTHER_WORKOUT`, le repli honnête quand Health Connect n'a pas le sport.
   */
  exerciseType: number;
  focus: ActivityFocus;
};

/** Repli universel : type inconnu, ou sport absent du catalogue. */
export const OTHER_ACTIVITY_TYPE = 'other';

/**
 * Le catalogue de départ — 22 entrées.
 *
 * L'ordre est celui de la grille de saisie : les plus fréquents d'abord. Il n'est pas alphabétique à
 * dessein — « Vélo » et « Marche » couvrent la majorité des saisies réelles.
 */
export const ACTIVITY_TYPES: readonly ActivityTypeDef[] = [
  { id: 'bike', met: { light: 4.0, moderate: 8.0, vigorous: 10.0 }, distanceUseful: true, exerciseType: 8, focus: 'legs' },
  { id: 'swim', met: { light: 5.3, moderate: 5.8, vigorous: 9.8 }, distanceUseful: true, exerciseType: 74, focus: 'full' },
  { id: 'walk', met: { light: 3.0, moderate: 4.3, vigorous: 5.0 }, distanceUseful: true, exerciseType: 79, focus: 'legs' },
  { id: 'hike', met: { light: 5.3, moderate: 6.0, vigorous: 7.8 }, distanceUseful: true, exerciseType: 37, focus: 'legs' },
  { id: 'row', met: { light: 4.8, moderate: 7.0, vigorous: 8.5 }, distanceUseful: true, exerciseType: 54, focus: 'full' },
  { id: 'yoga', met: { light: 2.5, moderate: 3.0, vigorous: 4.0 }, distanceUseful: false, exerciseType: 83, focus: 'full' },
  { id: 'team_sport', met: { light: 6.0, moderate: 7.0, vigorous: 10.0 }, distanceUseful: false, exerciseType: 64, focus: 'legs' },
  { id: 'racket', met: { light: 5.0, moderate: 7.3, vigorous: 8.0 }, distanceUseful: false, exerciseType: 76, focus: 'full' },
  { id: 'bike_indoor', met: { light: 3.5, moderate: 6.8, vigorous: 8.8 }, distanceUseful: false, exerciseType: 9, focus: 'legs' },
  { id: 'elliptical', met: { light: 4.0, moderate: 5.0, vigorous: 7.0 }, distanceUseful: false, exerciseType: 25, focus: 'full' },
  { id: 'pilates', met: { light: 2.5, moderate: 3.0, vigorous: 3.8 }, distanceUseful: false, exerciseType: 48, focus: 'full' },
  { id: 'dance', met: { light: 4.8, moderate: 5.5, vigorous: 7.3 }, distanceUseful: false, exerciseType: 16, focus: 'legs' },
  { id: 'basketball', met: { light: 5.5, moderate: 6.5, vigorous: 8.0 }, distanceUseful: false, exerciseType: 5, focus: 'legs' },
  { id: 'handball', met: { light: 7.0, moderate: 8.0, vigorous: 12.0 }, distanceUseful: false, exerciseType: 35, focus: 'full' },
  { id: 'badminton', met: { light: 4.5, moderate: 5.5, vigorous: 7.0 }, distanceUseful: false, exerciseType: 2, focus: 'full' },
  { id: 'squash', met: { light: 6.0, moderate: 7.3, vigorous: 12.0 }, distanceUseful: false, exerciseType: 66, focus: 'full' },
  { id: 'climbing', met: { light: 5.0, moderate: 5.8, vigorous: 7.5 }, distanceUseful: false, exerciseType: 51, focus: 'upper' },
  { id: 'boxing', met: { light: 5.5, moderate: 7.8, vigorous: 12.8 }, distanceUseful: false, exerciseType: 11, focus: 'upper' },
  { id: 'martial_arts', met: { light: 5.3, moderate: 7.8, vigorous: 10.3 }, distanceUseful: false, exerciseType: 44, focus: 'full' },
  { id: 'hiit', met: { light: 4.3, moderate: 6.0, vigorous: 8.0 }, distanceUseful: false, exerciseType: 36, focus: 'full' },
  { id: 'ski', met: { light: 4.3, moderate: 5.3, vigorous: 9.0 }, distanceUseful: false, exerciseType: 61, focus: 'legs' },
  { id: OTHER_ACTIVITY_TYPE, met: { light: 3.5, moderate: 5.5, vigorous: 8.0 }, distanceUseful: false, exerciseType: 0, focus: 'full' },
];

/** Les 8 types proposés d'emblée dans la grille de saisie ; le reste vit derrière « Tout voir ». */
export const FREQUENT_ACTIVITY_TYPES: readonly string[] = ACTIVITY_TYPES.slice(0, 8).map((a) => a.id);

const BY_ID = new Map(ACTIVITY_TYPES.map((a) => [a.id, a]));

/**
 * Définition d'un type, **jamais `null`** : une clé inconnue (client plus récent, catalogue élagué)
 * retombe sur `other` plutôt que de faire disparaître l'activité de l'historique et des totaux.
 */
export function activityTypeDef(id: string | null | undefined): ActivityTypeDef {
  return (id != null ? BY_ID.get(id) : undefined) ?? BY_ID.get(OTHER_ACTIVITY_TYPE)!;
}

/** Vrai si la clé existe réellement au catalogue (pour distinguer un repli d'un vrai « Autre »). */
export function isKnownActivityType(id: string | null | undefined): boolean {
  return id != null && BY_ID.has(id);
}

// ---------------------------------------------------------------------------
// Ligne de données
// ---------------------------------------------------------------------------

/**
 * Ligne `activities` — une activité saisie à la main.
 *
 * 🔴 **La dépense n'est pas stockée** (décision D3 de l'analyse) : elle est recalculée à la lecture,
 * avec le **poids à la date** de l'activité. C'est ce qui corrige le défaut constaté sur les courses
 * (constat C6), où la dernière pesée réécrivait l'estimation des jours passés. Seul `deviceKcal` —
 * un chiffre que l'utilisateur a lu sur sa montre — est conservé tel quel : c'est une mesure, pas une
 * estimation, et rien ne permettrait de la recalculer.
 */
export const activityRowSchema = syncFieldsSchema.extend({
  /** Clé du catalogue. Sans contrainte en base — voir l'en-tête. */
  activityType: z.string().min(1).max(64),
  /** Début de l'activité (UTC). Le **jour** de rattachement s'en déduit en heure locale. */
  startedAt: utcTimestampSchema,
  durationSeconds: z.number().int().positive(),
  intensity: activityIntensitySchema,
  /** Ressenti 1-10, prérempli depuis l'intensité et corrigeable. Alimente la charge sRPE. */
  rpe: z.number().int().min(1).max(10).nullable().default(null),
  /** Distance en mètres, facultative (vélo, marche, natation…). */
  distanceM: z.number().nonnegative().nullable().default(null),
  /** Calories **actives** lues sur une montre : remplacent l'estimation quand elles existent. */
  deviceKcal: z.number().int().nonnegative().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type ActivityRow = z.infer<typeof activityRowSchema>;

/** Vue applicative d'une activité (camelCase, déjà résolue) — ce que manipulent écrans et calculs. */
export type Activity = {
  id: string;
  activityType: string;
  startedAt: string;
  durationSeconds: number;
  intensity: ActivityIntensity;
  rpe: number | null;
  distanceM: number | null;
  deviceKcal: number | null;
  notes: string | null;
};

// ---------------------------------------------------------------------------
// Habitudes
// ---------------------------------------------------------------------------

export type ActivityHabit = {
  activityType: string;
  durationSeconds: number;
  intensity: ActivityIntensity;
  /** Nombre de fois où cette combinaison exacte a été saisie dans la fenêtre observée. */
  count: number;
};

/**
 * « Tes habituelles » : les combinaisons (type, durée, intensité) les plus répétées, pour proposer un
 * vélotaf de 25 minutes en un geste.
 *
 * ⚠️ Une combinaison qui n'a servi **qu'une fois** n'est pas une habitude : le seuil est à 2, sinon
 * la rangée afficherait simplement la dernière saisie, déguisée en routine. Tri par fréquence puis
 * par récence — à égalité, la plus récente d'abord.
 */
export function activityHabits(
  activities: ReadonlyArray<Pick<Activity, 'activityType' | 'durationSeconds' | 'intensity' | 'startedAt'>>,
  limit = 3,
): ActivityHabit[] {
  const map = new Map<string, ActivityHabit & { lastAt: string }>();
  for (const a of activities) {
    const key = `${a.activityType}|${a.durationSeconds}|${a.intensity}`;
    const found = map.get(key);
    if (found) {
      found.count += 1;
      if (a.startedAt > found.lastAt) found.lastAt = a.startedAt;
    } else {
      map.set(key, {
        activityType: a.activityType,
        durationSeconds: a.durationSeconds,
        intensity: a.intensity,
        count: 1,
        lastAt: a.startedAt,
      });
    }
  }
  return [...map.values()]
    .filter((h) => h.count >= 2)
    .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
    .slice(0, limit)
    .map(({ lastAt: _lastAt, ...habit }) => habit);
}
