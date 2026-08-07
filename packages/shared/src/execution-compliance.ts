/**
 * US EXEC-01 (roadmap 3.58, catalogue MUSC-33) — écart entre la prescription et le réalisé.
 *
 * L'app savait dire ce qui avait été fait ; elle ne savait rien dire de **l'écart avec ce qui était
 * prévu**. C'est pourtant là que vit l'information utile quand on suit un programme : une séance à
 * 80 % de la charge prescrite, ou une prescription systématiquement dépassée (le programme est trop
 * facile) sont deux signaux qu'aucune courbe de tonnage ne donne.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── Deux taux, deux dénominateurs, et c'est le cœur du module ────────────────────────────────────
 * La charge et les répétitions ne se mesurent **pas sur le même nombre de séries**, parce que la
 * cible de répétitions est du **texte libre** (spec R6) et que toutes ne se parsent pas. Masquer cet
 * écart de base derrière un dénominateur unique rendrait les deux pourcentages incomparables — et
 * ferait passer un taux calculé sur 12 séries pour un taux calculé sur 87. Les deux comptes sortent
 * donc d'ici, et la carte les affiche.
 *
 * ── On constate, on ne prescrit pas ──────────────────────────────────────────────────────────────
 * Ton de GARDE-01 et de DOUL-01, déjà validé. Ce module rend des nombres ; il ne dit jamais quoi en
 * faire. En particulier un ratio > 1 n'est **pas** écrêté : dépasser sa prescription est un fait
 * intéressant, pas une anomalie à corriger.
 */

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/**
 * Nombre de séances de programme sous lequel l'analyse se tait (spec R3).
 *
 * Un taux d'exécution calculé sur une séance n'est pas une tendance, c'est un accident. Zéro est une
 * réponse valable — une moyenne sur n=1 est un mensonge.
 */
export const MIN_SESSIONS_FOR_COMPLIANCE = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Une série réalisée, réduite à ce dont le calcul a besoin. */
export type CompliancePlannedSet = {
  /**
   * 🔴 La charge prescrite **au moment de la séance** (`workout_sets.planned_weight_kg`), et non
   * `exercise_plans.target_weight_kg` (spec R7).
   *
   * Le plan a pu changer depuis : comparer un réalisé d'il y a trois semaines à une prescription
   * modifiée hier afficherait **un écart qui n'a jamais existé**. C'est aussi ce qui rend l'analyse
   * calculable sans jointure — tout est sur la même ligne.
   */
  plannedWeightKg: number | null;
  weightKg: number | null;
  reps: number | null;
  /** Texte libre saisi à la main : « 10 », « 8-12 », « AMRAP », « max », vide… (spec R6). */
  targetReps: string | null;
  /** Série réellement validée. Une série non faite n'est pas une série ratée (spec R5). */
  done: boolean;
};

export type ComplianceInput = {
  /**
   * Une entrée par séance **de programme**. Les séances libres sont exclues **en amont**, par la
   * requête (spec R4) : elles n'ont aucune prescription, et les compter ferait chuter le taux de
   * quelqu'un qui s'entraîne beaucoup hors programme — l'inverse exact du signal recherché.
   */
  sessions: ReadonlyArray<{ sets: ReadonlyArray<CompliancePlannedSet> }>;
};

export type ComplianceResult = {
  /** Réalisé / prescrit sur la charge. `null` = rien de mesurable, jamais 0. */
  loadRatio: number | null;
  /** Séries ayant réellement servi au calcul de la charge — la carte l'affiche (spec R2). */
  loadSetCount: number;
  /** Réalisé / prescrit sur les répétitions. `null` = rien de mesurable. */
  repsRatio: number | null;
  /** Séries ayant réellement servi au calcul des reps. Différent de `loadSetCount` par nature. */
  repsSetCount: number;
  /** Séances de programme dans la fenêtre, y compris celles sans série exploitable. */
  sessionCount: number;
};

// ---------------------------------------------------------------------------
// Parsing des répétitions cibles
// ---------------------------------------------------------------------------

/** Un entier strictement positif, ou `null`. Écarte `NaN`, les décimaux et les valeurs ≤ 0. */
function positiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Interprète une cible de répétitions en fourchette `[min, max]`.
 *
 * ⚠️ **Parsing tolérant, échec silencieux** (spec R6). Le champ `exercise_plans.target_reps` est un
 * texte libre sans validation de format : on y trouvera « 10 », « 8-12 », « 8 à 12 », « AMRAP »,
 * « max », « 3x10 » et du vide.
 *
 * Deux formes seulement sont reconnues : un entier, et `a-b`. **Tout le reste rend `null`**, et
 * l'appelant exclut alors la série du calcul — sans message, et **sans la compter comme un écart**.
 * Inventer une interprétation d'« AMRAP » produirait des écarts fantômes sur les programmes les
 * mieux écrits, et un faux reproche est pire qu'un silence.
 *
 * Une fourchette saisie à l'envers (« 12-8 ») est remise à l'endroit : c'est une faute de frappe,
 * pas une intention, et la refuser fabriquerait précisément le faux écart qu'on cherche à éviter.
 */
export function parseTargetReps(raw: string | null): { min: number; max: number } | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const single = positiveInt(trimmed);
  if (single !== null) return { min: single, max: single };

  const range = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
  if (range === null) return null;

  const a = positiveInt(range[1]!);
  const b = positiveInt(range[2]!);
  if (a === null || b === null) return null;

  return { min: Math.min(a, b), max: Math.max(a, b) };
}

// ---------------------------------------------------------------------------
// Calcul
// ---------------------------------------------------------------------------

/**
 * Ratio réalisé/prescrit d'une série, ou `null` si la série n'est pas mesurable.
 *
 * 🔴 **La garde sur `prescribed <= 0` n'est pas défensive, elle est nécessaire** : une série au
 * poids du corps porte `plannedWeightKg = 0`, et `0 / 0` vaut `NaN`. Un `NaN` affiché tel quel — ou
 * pire, arrondi à 0 — donnerait une carte mensongère. Précédent réel dans ce dépôt :
 * `bestSegmentTimeFromSamples` a écrit un record « NaN seconde » en base (corrigé le 04/08/2026).
 */
function ratioOf(actual: number | null, prescribed: number | null): number | null {
  if (actual === null || prescribed === null) return null;
  if (!Number.isFinite(actual) || !Number.isFinite(prescribed)) return null;
  if (prescribed <= 0) return null;
  return actual / prescribed;
}

/**
 * Ratio d'une série sur les répétitions, rapporté à **la borne franchie** de la fourchette.
 *
 * Un réalisé **dans** l'intervalle est conforme (ratio 1) : c'est tout l'intérêt d'écrire « 8-12 »
 * plutôt que « 10 ». En dessous, on rapporte à la borne basse ; au-dessus, à la borne haute — de
 * sorte que l'écart affiché soit l'écart réellement constaté, et non un écart à un milieu que
 * personne n'a prescrit.
 */
function repsRatioOf(reps: number | null, target: { min: number; max: number }): number | null {
  if (reps === null || !Number.isFinite(reps)) return null;
  if (reps >= target.min && reps <= target.max) return 1;
  return reps < target.min ? ratioOf(reps, target.min) : ratioOf(reps, target.max);
}

/** Moyenne d'une liste, ou `null` si elle est vide — jamais `NaN`, jamais 0 par défaut. */
function meanOrNull(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Le taux d'exécution de la charge et des répétitions sur la fenêtre.
 *
 * Rend `null` sous `MIN_SESSIONS_FOR_COMPLIANCE` (spec R3). Au-dessus, rend toujours un objet —
 * **y compris quand les deux taux sont `null`** : c'est l'écran qui décide de se taire, et il a
 * besoin de `sessionCount` pour le dire honnêtement plutôt que de disparaître sans explication.
 *
 * La pondération est **par série**, pas par séance : une séance de 10 séries pèse dix fois plus
 * qu'une séance d'une série. C'est le taux d'exécution des séries, pas la moyenne des moyennes.
 */
export function computeExecutionCompliance(input: ComplianceInput): ComplianceResult | null {
  const { sessions } = input;
  if (sessions.length < MIN_SESSIONS_FOR_COMPLIANCE) return null;

  const loadRatios: number[] = [];
  const repsRatios: number[] = [];

  for (const session of sessions) {
    for (const s of session.sets) {
      // Spec R5 — une série non validée n'a pas été ratée, elle n'a pas eu lieu. La compter en
      // échec ferait d'une séance abandonnée un problème d'exécution, alors que c'est un problème
      // d'assiduité — et l'assiduité a déjà sa propre carte sur cet écran.
      if (!s.done) continue;

      const load = ratioOf(s.weightKg, s.plannedWeightKg);
      if (load !== null) loadRatios.push(load);

      const target = parseTargetReps(s.targetReps);
      if (target !== null) {
        const reps = repsRatioOf(s.reps, target);
        if (reps !== null) repsRatios.push(reps);
      }
    }
  }

  return {
    loadRatio: meanOrNull(loadRatios),
    loadSetCount: loadRatios.length,
    repsRatio: meanOrNull(repsRatios),
    repsSetCount: repsRatios.length,
    sessionCount: sessions.length,
  };
}
