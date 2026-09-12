/**
 * US MUSCU-UX02 (catalogue MUSC-26 étendu) — **« vs ton habitude »** : la séance qui vient de finir,
 * rapportée à ce que la personne fait d'ordinaire.
 *
 * ── Pourquoi ce bloc est le cœur de l'US ─────────────────────────────────────────────────────────
 * « 5 892 kg » ne dit rien. Ni bien, ni mal. Un chiffre sans référence n'est pas une information,
 * c'est une décoration — et c'est le défaut principal du résumé d'avant : quatre agrégats, aucune
 * échelle. Le seul élément comparatif de l'ancien écran (l'écart par exercice) était aussi le seul
 * que les gens regardaient.
 *
 * ── Médiane, et non moyenne ──────────────────────────────────────────────────────────────────────
 * Même raison que `computeSessionDuration` : une séance oubliée ouverte trois heures, ou une séance
 * écourtée à cinq minutes, déplace une moyenne et laisse une médiane intacte. On compare à ce qui
 * est **habituel**, pas à ce qui est *moyen*.
 *
 * ── Comparer à des séances comparables ───────────────────────────────────────────────────────────
 * Les références sont **du même titre de séance** (« Haut du corps » vs « Haut du corps »), filtrées
 * en amont par la requête. Comparer un Haut du corps à un Jambes ferait osciller le tonnage de ±40 %
 * au gré de l'alternance, et l'écart ne dirait plus rien de la performance.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 */

/**
 * Références minimales sous lesquelles le bloc se tait (spec R5).
 *
 * Deux séances ne font pas une habitude : la « médiane » de deux valeurs est leur milieu, et le
 * moindre écart entre elles produirait un pourcentage spectaculaire sans aucun fondement.
 */
export const MIN_SESSIONS_FOR_COMPARISON = 3;

/** Références au-delà desquelles on n'écoute plus : l'habitude, c'est le passé récent. */
export const COMPARISON_WINDOW = 5;

/** Une séance de référence, réduite à ce que la comparaison lit. */
export type ReferenceSession = {
  volumeKg: number;
  durationSeconds: number | null;
  /** Ressenti de séance ramené en RPE 1-10. `null` = non saisi. */
  rpe: number | null;
};

/** La séance courante, dans le même vocabulaire. */
export type CurrentSession = ReferenceSession;

export type MetricComparison = {
  current: number;
  median: number;
  /** Écart relatif en %, arrondi à l'entier. Signé. `0` = strictement égal à la médiane. */
  deltaPercent: number;
};

export type SessionComparison = {
  volume: MetricComparison;
  /** Tonnage par minute. `null` si la durée manque ici ou dans trop de références. */
  density: MetricComparison | null;
  durationSeconds: MetricComparison | null;
  /** Charge sRPE = minutes × RPE (spec R7). `null` sans ressenti. */
  load: MetricComparison | null;
  /** Séances ayant réellement servi de référence. La carte l'affiche. */
  referenceCount: number;
};

/** Médiane d'une liste **non vide**. Copie avant tri : l'entrée appartient à l'appelant. */
function median(values: ReadonlyArray<number>): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Compare une valeur courante à la médiane de ses références.
 *
 * Rend `null` si moins de `MIN_SESSIONS_FOR_COMPARISON` références sont exploitables **pour cette
 * métrique précise** : le seuil porte sur ce qui a survécu au filtre, pas sur ce qui est entré.
 * Une personne qui a cinq séances de référence dont une seule chronométrée n'a pas d'habitude de
 * durée, même si elle a une habitude de tonnage.
 *
 * ⚠️ Une médiane nulle ou négative rend `null` plutôt qu'un pourcentage : diviser par zéro
 * donnerait `Infinity`, et « +∞ % de tonnage » est la pire façon d'annoncer une bonne nouvelle.
 */
function compareTo(current: number | null, references: ReadonlyArray<number | null>): MetricComparison | null {
  if (current === null || !Number.isFinite(current)) return null;

  const usable = references.filter((v): v is number => v !== null && Number.isFinite(v));
  if (usable.length < MIN_SESSIONS_FOR_COMPARISON) return null;

  const med = median(usable);
  if (med <= 0) return null;

  return { current, median: med, deltaPercent: Math.round(((current - med) / med) * 100) };
}

/** Charge sRPE d'une séance : minutes × RPE. `null` dès qu'une des deux manque (spec R7). */
function sessionLoad(session: ReferenceSession): number | null {
  if (session.durationSeconds === null || session.rpe === null) return null;
  if (!Number.isFinite(session.durationSeconds) || session.durationSeconds <= 0) return null;
  return (session.durationSeconds / 60) * session.rpe;
}

/** Densité d'une séance : tonnage par minute. `null` sans durée exploitable. */
function sessionDensity(session: ReferenceSession): number | null {
  if (session.durationSeconds === null || session.durationSeconds <= 0) return null;
  return session.volumeKg / (session.durationSeconds / 60);
}

/**
 * La séance courante rapportée à ses `COMPARISON_WINDOW` dernières devancières de même titre.
 *
 * `references` est attendu **sans la séance courante** — l'inclure la ferait se comparer à
 * elle-même et écraserait mécaniquement tous les écarts vers zéro.
 *
 * Rend `null` quand le tonnage lui-même n'est pas comparable : c'est la métrique socle, et un bloc
 * « vs ton habitude » qui n'aurait que la durée à montrer ne mérite pas d'exister.
 */
export function computeSessionComparison(input: {
  current: CurrentSession;
  /** Du plus récent au plus ancien ; seules les `COMPARISON_WINDOW` premières sont lues. */
  references: ReadonlyArray<ReferenceSession>;
}): SessionComparison | null {
  const window = input.references.slice(0, COMPARISON_WINDOW);

  const volume = compareTo(
    input.current.volumeKg,
    window.map((s) => s.volumeKg),
  );
  if (volume === null) return null;

  return {
    volume,
    density: compareTo(sessionDensity(input.current), window.map(sessionDensity)),
    durationSeconds: compareTo(
      input.current.durationSeconds,
      window.map((s) => s.durationSeconds),
    ),
    load: compareTo(sessionLoad(input.current), window.map(sessionLoad)),
    referenceCount: window.length,
  };
}
