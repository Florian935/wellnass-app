/**
 * Le script du coach — US MUSCU-UX03, spec §5.14.
 *
 * Ce module ne contient **aucun texte** : il choisit une **clé i18n** et les variables à y injecter.
 * C'est ce qui permet au coach d'exister en FR comme en EN, d'être dit par la synthèse vocale du
 * téléphone (hors ligne) et d'être **toujours doublé par une légende écrite**.
 *
 * Trois caractères (réglage) : `motivant` (phrase complète), `sobre` (les chiffres, rien d'autre),
 * `muet` (aucune parole — la légende reste). Le jour où l'IA enrichira ces répliques (US à venir,
 * hors périmètre ici), elle produira **les mêmes clés avec les mêmes variables** : rien à recâbler.
 */

export const COACH_CHARACTERS = ['motivant', 'sobre', 'muet'] as const;
export type CoachCharacter = (typeof COACH_CHARACTERS)[number];

/** Les moments où le coach a le droit de parler (spec §5.14). */
export const COACH_EVENTS = [
  /** Avant la première série : l'enjeu du jour. */
  'brief',
  /** Au lancement d'une série : la consigne technique de l'exercice. */
  'setCue',
  /** Après validation : ce que valait la série. */
  'verdict',
  /** Record battu. */
  'record',
  /** Proposition d'alléger ou de charger la série suivante. */
  'adjust',
  /** Quelques secondes avant la fin du repos. */
  'restPrep',
  /** Exercice bouclé. */
  'exerciseDone',
  /** Dernière série de la séance. */
  'lastSet',
  /** Séance bouclée. */
  'sessionEnd',
] as const;
export type CoachEvent = (typeof COACH_EVENTS)[number];

export type CoachLine = {
  /** Clé i18n complète, par exemple `coach.motivant.verdict.heavier`. */
  key: string;
  /** Variables à injecter (déjà formatées par l'appelant : charges, reps, jour). */
  vars: Record<string, string | number>;
};

/**
 * Événements que le caractère **sobre** conserve : ce qui porte un chiffre utile sous la barre.
 * La consigne technique et les encouragements de fin de séance disparaissent — c'est le sens de
 * « sobre » : on garde ce qui informe, pas ce qui accompagne.
 */
const SOBRE_EVENTS: ReadonlySet<CoachEvent> = new Set<CoachEvent>([
  'verdict',
  'record',
  'adjust',
  'restPrep',
  'exerciseDone',
]);

/**
 * La réplique à dire, ou `null` si le coach se tait à ce moment-là.
 *
 * @param event     Le moment.
 * @param character Le caractère réglé par l'utilisateur.
 * @param variant   Précision du moment (`heavier`, `maxWeight`, `down`…), facultative.
 * @param vars      Variables de la phrase.
 */
export function pickCoachLine({
  event,
  character,
  variant = null,
  vars = {},
}: {
  event: CoachEvent;
  character: CoachCharacter;
  variant?: string | null;
  vars?: Record<string, string | number>;
}): CoachLine | null {
  if (character === 'muet') return null;
  if (character === 'sobre' && !SOBRE_EVENTS.has(event)) return null;

  const suffix = variant ? `.${variant}` : '';
  return { key: `coach.${character}.${event}${suffix}`, vars };
}

/** Parse tolérant du caractère persisté : toute valeur inconnue retombe sur `motivant`. */
export function parseCoachCharacter(value: string | null | undefined): CoachCharacter {
  return (COACH_CHARACTERS as readonly string[]).includes(value ?? '')
    ? (value as CoachCharacter)
    : 'motivant';
}
