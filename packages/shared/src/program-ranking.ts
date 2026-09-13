import type { TrainingLevel } from './guidance';
import type { ProgramLevel } from './program';
import type { WorkoutDisplayLevel } from './workout-display';

/**
 * US GUID-01 volet B — l'ordre des programmes proposés à un compte neuf.
 *
 * ── Ce que ce module remplace ────────────────────────────────────────────────────────────────────
 * `SuggestedPrograms.tsx` triait sur `workoutDisplayLevel`, une **préférence d'affichage**, en
 * l'assumant explicitement dans son en-tête : « le profil ne stocke ni [le niveau] ni [la
 * fréquence] […] proxy assumé ». « Je veux voir peu d'informations pendant ma séance » était donc
 * lu comme « je débute », et un pratiquant confirmé qui aimait les écrans épurés recevait des
 * programmes débutants.
 *
 * Le niveau déclaré (`training_level`) et la disponibilité (`weekly_availability`) existent
 * désormais. Le proxy survit en **dernier repli**, pour ne pas dégrader les comptes qui n'ont pas
 * encore répondu.
 *
 * ── Pourquoi l'objectif n'entre PAS dans ce tri ──────────────────────────────────────────────────
 * On pourrait vouloir biaiser vers les programmes « hypertrophie » quand l'objectif est la prise de
 * masse. `programs.goal` est un champ de **texte libre** : aucune valeur normalisée, aucune
 * garantie de vocabulaire entre deux programmes éditoriaux. Trier dessus reviendrait à faire
 * correspondre des chaînes au hasard, et à produire un ordre qui *semble* réfléchi sans l'être.
 * Le jour où `programs.goal` devient une énumération, ce module est le bon endroit — pas avant.
 */

/** Le minimum dont le tri a besoin : tout `ProgramListItem` en est un. */
export type RankableProgram = {
  id: string;
  name: string;
  level: ProgramLevel | null;
  /** Nombre de séances du programme = sa fréquence hebdomadaire cible. */
  sessionCount: number | null;
};

export type RankingContext = {
  /** Le vrai signal, quand il a été demandé. */
  trainingLevel: TrainingLevel | null | undefined;
  /** Le proxy historique — dernier repli seulement. */
  displayLevel: WorkoutDisplayLevel | null | undefined;
  /** Jours d'entraînement disponibles par semaine, si déclarés. */
  weeklyAvailability: number | null | undefined;
};

/** Ordre de repli quand le niveau visé ne donne pas assez de programmes. */
const LEVEL_FALLBACK: Record<ProgramLevel, readonly ProgramLevel[]> = {
  beginner: ['beginner', 'intermediate', 'advanced'],
  intermediate: ['intermediate', 'beginner', 'advanced'],
  advanced: ['advanced', 'intermediate', 'beginner'],
};

/**
 * Le niveau visé, du meilleur signal au repli.
 *
 * Exporté parce que l'interface l'affiche (« Programmes pour ton niveau : intermédiaire ») : le
 * libellé et le tri doivent venir du **même** calcul, sinon ils divergent au premier changement.
 */
export function preferredProgramLevel(context: RankingContext): ProgramLevel {
  if (context.trainingLevel) return context.trainingLevel;
  // Repli historique : le niveau d'affichage, faute de mieux. Conservé pour ne pas dégrader les
  // comptes antérieurs à GUID-01, jamais utilisé quand le vrai niveau existe.
  if (context.displayLevel === 'detailed') return 'advanced';
  if (context.displayLevel === 'normal') return 'intermediate';
  return 'beginner';
}

/**
 * Filtre de disponibilité — **qui ne vide jamais la liste**.
 *
 * Quelqu'un qui déclare 2 jours et à qui l'on répond « aucun programme » a reçu une punition pour
 * avoir répondu honnêtement. Si le filtre ne laisse rien, il est ignoré : mieux vaut une
 * proposition imparfaite qu'un écran vide, et l'utilisateur voit le nombre de séances sur chaque
 * ligne pour juger lui-même.
 */
export function fitsAvailability<T extends RankableProgram>(
  programs: readonly T[],
  weeklyAvailability: number | null | undefined,
): readonly T[] {
  if (weeklyAvailability == null) return programs;
  const fitting = programs.filter(
    (p) => p.sessionCount == null || p.sessionCount <= weeklyAvailability,
  );
  return fitting.length > 0 ? fitting : programs;
}

/**
 * Les programmes, du plus pertinent au moins pertinent. Tri **stable** et déterministe : à contexte
 * égal, le même ordre — une suggestion qui change d'ordre à chaque rendu n'inspire rien.
 */
export function rankSuggestedPrograms<T extends RankableProgram>(
  programs: readonly T[],
  context: RankingContext,
): T[] {
  const order = LEVEL_FALLBACK[preferredProgramLevel(context)];
  const candidates = fitsAvailability(programs, context.weeklyAvailability);

  return [...candidates].sort((a, b) => {
    // Niveau inconnu en dernier, jamais confondu avec « débutant ».
    const rank = (p: T) => (p.level ? order.indexOf(p.level) : order.length);
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}
