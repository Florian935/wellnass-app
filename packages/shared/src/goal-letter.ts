/**
 * US LETTRE-01 — les règles du mot écrit à son futur soi.
 * Réf. : docs/specs/functional/us/lettre01-lettre-futur-moi.md
 *
 * Module **pur** : aucune date implicite (`now` est une entrée), aucun texte d'interface, aucune
 * interprétation du contenu. La lettre est **la parole de l'utilisateur** : on la stocke et on la
 * rend telle quelle — jamais reformulée, jamais analysée, jamais envoyée à un service tiers (R7).
 */

/** Longueur maximale d'une lettre (D6) — tenue ici **et** par un `check` en base. */
export const LETTER_MAX_LENGTH = 1000;

/**
 * Longueur à partir de laquelle le compteur s'affiche (D6). En dessous, il n'apprend rien et
 * transforme une invitation à écrire en exercice de comptage.
 */
export const LETTER_COUNTER_FROM = 800;

/**
 * Texte prêt à écrire en base : blancs de bord retirés, `null` si rien d'utile ne reste.
 *
 * `null` **supprime** la lettre (spec §6) : effacer son texte et enregistrer doit faire disparaître
 * l'enveloppe, pas garder une lettre vide qui se proposerait à la relecture.
 */
export function normaliseLetter(text: string | null | undefined): string | null {
  if (text == null) return null;
  const trimmed = text.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Coupe à la limite (D6). La saisie s'arrête à l'écran ; ceci est le filet, pas le mécanisme. */
export function truncateLetter(text: string): string {
  return text.length <= LETTER_MAX_LENGTH ? text : text.slice(0, LETTER_MAX_LENGTH);
}

/** Le compteur n'apparaît qu'à l'approche de la limite (D6). */
export function shouldShowCounter(length: number): boolean {
  return length >= LETTER_COUNTER_FROM;
}

/**
 * Ancienneté de la lettre en **jours pleins** (R4), `null` si la date est illisible.
 *
 * Jamais négative : une date future (horloge décalée, synchro d'un autre appareil) compte pour 0
 * plutôt que d'afficher « il y a −3 jours ».
 */
export function letterAgeDays(writtenAt: string | null | undefined, now: Date): number | null {
  if (writtenAt == null) return null;
  const written = new Date(writtenAt).getTime();
  if (!Number.isFinite(written)) return null;
  const days = Math.floor((now.getTime() - written) / 86_400_000);
  return Math.max(0, days);
}
