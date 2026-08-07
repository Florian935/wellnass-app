/**
 * US EXEC-01 (roadmap 3.58, catalogue MUSC-26) — durée de séance : médiane, tendance, aberrantes.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── Médiane et pas moyenne, et ce n'est pas un détail ────────────────────────────────────────────
 * Une séance oubliée ouverte pendant six heures est le cas **normal**, pas le cas rare : il suffit
 * de fermer l'app sans terminer. Avec une moyenne, une seule de ces séances rendrait toutes les
 * autres « courtes » et la tendance ininterprétable. La médiane l'absorbe (spec R9).
 *
 * ── Et on dit combien de séances ont été écartées ────────────────────────────────────────────────
 * Les durées implausibles sortent du calcul, mais leur **nombre** est rendu (spec R10). Sans lui,
 * l'utilisateur lit une médiane calculée sur moins de séances qu'il n'en a faites, sans que rien ne
 * l'explique — et c'est le genre d'écart silencieux qui fait perdre confiance dans tout l'écran.
 */

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/** Séances plausibles requises sous lesquelles l'analyse se tait (spec R3). */
export const MIN_SESSIONS_FOR_DURATION = 5;

/** En deçà, ce n'est pas une séance : c'est une ouverture d'écran refermée aussitôt. */
export const MIN_PLAUSIBLE_SESSION_SECONDS = 5 * 60;

/** Au-delà, la séance a été oubliée ouverte — personne ne soulève de la fonte pendant 4 h. */
export const MAX_PLAUSIBLE_SESSION_SECONDS = 4 * 60 * 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DurationResult = {
  /** Médiane des durées plausibles, en secondes. */
  medianSeconds: number;
  /**
   * Écart entre la médiane de la moitié **récente** et celle de la moitié ancienne, en secondes.
   * Positif = les séances s'allongent.
   *
   * Non nullable : `MIN_SESSIONS_FOR_DURATION` garantit deux moitiés non vides (voir le calcul).
   */
  trendSeconds: number;
  /** Séances retenues dans le calcul. */
  sessionCount: number;
  /** Séances écartées comme implausibles — **affiché** dès qu'il est non nul (spec R10). */
  excludedCount: number;
};

// ---------------------------------------------------------------------------
// Calcul
// ---------------------------------------------------------------------------

/** Vrai si la durée est exploitable : finie, et dans les bornes de plausibilité. */
function isPlausible(seconds: number | null): seconds is number {
  if (seconds === null || !Number.isFinite(seconds)) return false;
  return seconds >= MIN_PLAUSIBLE_SESSION_SECONDS && seconds <= MAX_PLAUSIBLE_SESSION_SECONDS;
}

/**
 * Médiane d'une liste **non vide**. Sur un nombre pair d'éléments, moyenne des deux centrales.
 *
 * La liste est copiée avant tri : trier l'entrée en place modifierait le tableau de l'appelant, et
 * ici cet appelant est un `useMemo` dont la donnée vient de la base.
 */
function median(values: ReadonlyArray<number>): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Médiane, tendance et nombre d'aberrantes sur la fenêtre.
 *
 * `sessions` est attendu **du plus ancien au plus récent** : c'est cet ordre qui définit les deux
 * moitiés de la tendance. L'appelant l'obtient par le `ORDER BY started_at` de la requête.
 *
 * Rend `null` quand il reste moins de `MIN_SESSIONS_FOR_DURATION` séances **plausibles** — le seuil
 * porte sur ce qui a survécu au filtre, pas sur ce qui est entré : cinq séances dont quatre
 * aberrantes ne font pas une médiane.
 */
export function computeSessionDuration(input: {
  /** Durées en secondes, du plus ancien au plus récent. `null` = séance sans durée enregistrée. */
  sessions: ReadonlyArray<number | null>;
}): DurationResult | null {
  const plausible = input.sessions.filter(isPlausible);
  const excludedCount = input.sessions.length - plausible.length;

  if (plausible.length < MIN_SESSIONS_FOR_DURATION) return null;

  // Moitié ancienne / moitié récente. Sur un nombre impair, la séance centrale va au passé : la
  // tendance décrit « où j'en suis maintenant », et la moitié récente doit rester la plus pure.
  //
  // ⚠️ **Les deux moitiés sont non vides par construction** : le garde ci-dessus impose au moins
  // `MIN_SESSIONS_FOR_DURATION` (= 5) séances plausibles, donc `cut ≥ 2`. Défendre le cas vide
  // serait du code mort, et le dépôt les supprime plutôt que d'écrire un test qui fige un appel
  // impossible (cf. `bucketOf` le 04/08/2026, `findFallbackDay` le 07/08/2026).
  //
  // 🔴 **Ce qui rend l'invariant fragile, et donc ce qu'il faut savoir avant d'y toucher** :
  // abaisser `MIN_SESSIONS_FOR_DURATION` en dessous de **2** viderait `older`, et `median([])`
  // rendrait `NaN` — un `NaN` affiché tel quel, ou pire arrondi à 0, donnerait une carte mensongère.
  // Le seuil n'est donc pas seulement un choix produit : c'est aussi ce qui tient ce calcul.
  const cut = Math.floor(plausible.length / 2);
  const older = plausible.slice(0, cut);
  const recent = plausible.slice(cut);

  return {
    medianSeconds: median(plausible),
    trendSeconds: median(recent) - median(older),
    sessionCount: plausible.length,
    excludedCount,
  };
}
