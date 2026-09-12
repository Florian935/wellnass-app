/**
 * US MUSCU-UX02 (catalogue MUSC-15 / MUSC-30) — **où est parti le volume** : force, hypertrophie
 * ou endurance.
 *
 * La question que ça répond : « mon travail réel correspond-il à l'objectif que je me suis fixé ? »
 * Quelqu'un qui vise la force et passe 80 % de son tonnage en séries de 12 le découvre ici, et
 * nulle part ailleurs dans l'app.
 *
 * ── Pondéré par le VOLUME, pas par le nombre de séries (spec R8) ─────────────────────────────────
 * Trois séries de 15 répétitions à 12 kg et trois séries de 5 à 100 kg font « 50/50 » en comptant
 * les séries — alors que les secondes représentent près de six fois plus de travail. Compter les
 * séries donnerait donc une lecture inverse de la réalité à tout pratiquant qui finit ses séances
 * par des exercices d'isolation légers, c'est-à-dire presque tout le monde.
 *
 * ⚠️ **Limite connue, assumée : les séries au poids du corps ne contribuent pas.** Sans charge, leur
 * tonnage est nul, donc elles ne pèsent sur aucune plage. Une séance 100 % poids du corps rend donc
 * `null` et le bloc disparaît (spec R2) — c'est honnête, mais c'est un angle mort pour qui
 * s'entraîne en callisthénie. Le corriger demanderait de pondérer par un poids de corps estimé,
 * donc de décider quelle fraction du corps chaque mouvement déplace : hors périmètre ici.
 *
 * Les séries **à la durée** n'ont pas de répétitions et sont hors sujet par nature : elles sont
 * ignorées sans bruit.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 */

import { sharesOf } from './shares';

/**
 * Les trois plages, dans leur **ordre canonique** — celui de l'affichage, de la plus lourde à la
 * plus légère. Ce n'est pas l'ordre de `sharesOf`, qui trie par taille : voir la fin du calcul.
 */
export const REP_RANGES = ['strength', 'hypertrophy', 'endurance'] as const;
export type RepRange = (typeof REP_RANGES)[number];

/** Bornes en répétitions, inclusives. `max: null` = pas de borne haute. */
export const REP_RANGE_BOUNDS: Record<RepRange, { min: number; max: number | null }> = {
  strength: { min: 1, max: 5 },
  hypertrophy: { min: 6, max: 12 },
  endurance: { min: 13, max: null },
};

export type RepRangeShare = {
  range: RepRange;
  volumeKg: number;
  /** Part entière du tonnage. La somme des parts vaut exactement 100. */
  percent: number;
};

/** La plage d'un nombre de répétitions. `null` si le compte n'est pas exploitable. */
function rangeOf(reps: number | null): RepRange | null {
  if (reps === null || !Number.isFinite(reps) || reps <= 0) return null;
  if (reps <= REP_RANGE_BOUNDS.strength.max!) return 'strength';
  if (reps <= REP_RANGE_BOUNDS.hypertrophy.max!) return 'hypertrophy';
  return 'endurance';
}

/**
 * Répartition du tonnage de la séance entre les trois plages, dans l'ordre canonique.
 *
 * Rend `null` quand aucun tonnage n'est exploitable (séance vide, 100 % poids du corps, ou
 * uniquement des séries à la durée) : l'écran se tait plutôt que d'afficher une barre vide.
 *
 * Une plage **non travaillée est absente** du résultat, jamais présente à 0 % — une zone qu'on n'a
 * pas touchée n'est pas une information, c'est du bruit visuel (règle héritée de `sharesOf`).
 *
 * Échauffements exclus (spec R4) : ils sont légers par construction et tireraient artificiellement
 * le tonnage vers l'endurance.
 */
export function computeRepRangeSplit(input: {
  sets: ReadonlyArray<{
    setType: string;
    reps: number | null;
    weightKg: number | null;
    done: boolean;
  }>;
}): RepRangeShare[] | null {
  const volumeByRange = new Map<string, number>();

  for (const set of input.sets) {
    if (!set.done || set.setType === 'warmup') continue;
    const range = rangeOf(set.reps);
    if (range === null) continue;
    const volume = (set.reps ?? 0) * (set.weightKg ?? 0);
    if (volume <= 0) continue;
    volumeByRange.set(range, (volumeByRange.get(range) ?? 0) + volume);
  }

  // `sharesOf` porte l'arrondi qui somme à 100 exactement — la même mécanique que les types de
  // séries et les zones d'allure. L'implémenter ici une seconde fois divergerait au premier
  // ajustement, et personne ne saurait laquelle des barres est juste.
  const shares = sharesOf(volumeByRange);
  if (shares === null) return null;

  // `sharesOf` trie par part décroissante ; on repasse dans l'ordre canonique. Une plage de
  // répétitions a un ordre naturel (lourd → léger) que l'utilisateur lit comme une échelle : la
  // trier par taille ferait sauter l'endurance avant la force d'une séance à l'autre.
  const byRange = new Map(shares.map((s) => [s.key, s]));
  return REP_RANGES.flatMap((range) => {
    const share = byRange.get(range);
    return share ? [{ range, volumeKg: share.count, percent: share.percent }] : [];
  });
}
