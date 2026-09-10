/**
 * US CARDIO-UX01 (R8 / constats F27, F34) — écrire une séance en une ligne, et la relire d'un mot.
 *
 * ── Le mur ───────────────────────────────────────────────────────────────────────────────────────
 * L'éditeur de segment demandait **14 contrôles** — nature (5 puces), répétitions, bascule
 * distance/durée + champ, %VMA, deux champs d'allure, bascule progressive, deux champs de chrono
 * cible, nature de récupération (4 puces), clé de groupe + répétitions, bascule de récup + champ —
 * **tous dépliés en permanence**. Soit 42 contrôles pour la séance de trois segments d'un plan
 * réel, et 70 pour une séance à cinq. Pour une séance qu'un coureur décrit à l'oral en huit mots :
 * « 2 km d'échauffement, 6 fois 400, 200 de récup, 1 km de retour au calme. »
 *
 * Ce module fait de ces huit mots une entrée valide.
 *
 * ── Ce qu'il n'est pas ───────────────────────────────────────────────────────────────────────────
 * Ce n'est **pas** un langage. La grammaire est **close** et volontairement petite : elle couvre
 * les formes qu'on écrit sur un carnet d'entraînement, rien de plus. Une ligne non reconnue
 * **n'écrit rien** et le dit (règle R8-1) — elle ne produit jamais une structure partielle, qui
 * serait pire que pas de structure du tout : l'utilisateur croirait avoir saisi sa séance.
 */

import { DEFAULT_SEGMENT_KIND, type SegmentKind } from './running-paces';

/** Un segment produit par la lecture d'une ligne — le sous-ensemble que la grammaire peut exprimer. */
export type ParsedSegment = {
  kind: SegmentKind;
  reps: number;
  fastDistanceM: number | null;
  fastDurationSeconds: number | null;
  recoveryDistanceM: number | null;
  recoveryDurationSeconds: number | null;
};

/** Résultat de la lecture d'une ligne : tout ou rien. */
export type SessionLineResult =
  | { ok: true; segments: ParsedSegment[] }
  | {
      ok: false;
      /** Le morceau exact qui n'a pas été compris — c'est lui qu'on montre à l'utilisateur. */
      token: string;
      /** Position 1-based du morceau dans la ligne, pour dire « le 3ᵉ bloc ». */
      index: number;
    };

/** Un segment vide, à compléter. */
function emptySegment(kind: SegmentKind = DEFAULT_SEGMENT_KIND): ParsedSegment {
  return {
    kind,
    reps: 1,
    fastDistanceM: null,
    fastDurationSeconds: null,
    recoveryDistanceM: null,
    recoveryDurationSeconds: null,
  };
}

/**
 * Mots-clés de nature, en français et en anglais, formes longues et abrégées.
 *
 * Bilingue dès l'écriture (décision G) : la saisie en une ligne serait inutilisable si elle
 * n'acceptait que le français. Les abréviations sont celles des carnets — « éch », « rac », « wu »,
 * « cd ».
 */
const KIND_WORDS: ReadonlyArray<{ words: readonly string[]; kind: SegmentKind }> = [
  { words: ['ech', 'echauffement', 'wu', 'warmup', 'warm'], kind: 'warmup' },
  { words: ['rac', 'calme', 'retouraucalme', 'cd', 'cooldown', 'cool'], kind: 'cooldown' },
  { words: ['gammes', 'drills'], kind: 'drills' },
  { words: ['recup', 'recuperation', 'recovery', 'rec'], kind: 'recovery' },
  { words: ['corps', 'work', 'tempo', 'seuil'], kind: 'work' },
];

/**
 * Normalise un mot pour la comparaison : minuscules, sans accent, sans ponctuation.
 *
 * `String.normalize('NFD')` puis retrait des diacritiques : « Échauffement » et « echauffement »
 * doivent se lire pareil, et personne ne tape les accents dans un champ de saisie rapide.
 */
function normalize(word: string): string {
  return (
    word
      .toLowerCase()
      // Décomposition NFD puis retrait des marques combinantes : « Échauffement » et
      // « echauffement » doivent se lire pareil, et personne ne tape les accents dans un champ
      // de saisie rapide. Plage écrite en échappements Unicode, jamais en caractères littéraux —
      // des marques combinantes collées dans un littéral de regex sont illisibles et se perdent
      // au moindre copier-coller.
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      // ⚠️ `/` et `,` sont CONSERVÉS : le premier sépare la fraction de sa récupération
      // (« 6x400/200 »), le second est le séparateur décimal français (« 1,5km »). Les retirer
      // faisait lire « 6x400200 » et « 15km » — deux séances qui n'ont rien à voir.
      .replace(/[^a-z0-9:.,/]/g, '')
  );
}

/** Reconnaît un mot de nature, ou `null`. */
function matchKind(word: string): SegmentKind | null {
  const normalized = normalize(word);
  for (const entry of KIND_WORDS) {
    if (entry.words.includes(normalized)) return entry.kind;
  }
  return null;
}

/**
 * Lit une quantité : `2km`, `400m`, `12min`, `45s`, `1:30`.
 *
 * Rend `null` si ce n'est pas une quantité — c'est ce qui permet à l'appelant de distinguer un
 * mot de nature d'une valeur.
 */
function parseAmount(
  raw: string,
  /**
   * Un nombre **nu** vaut-il des mètres ?
   *
   * `false` partout, **sauf à l'intérieur d'un bloc de répétitions**. « 6x400 » désigne
   * universellement 6 × 400 **mètres** — convention de piste, écrite ainsi sur tous les carnets
   * d'entraînement, y compris anglo-saxons. Refuser cette forme rendrait la saisie en une ligne
   * inutilisable pour la séance la plus courante qui existe.
   *
   * Hors bloc de répétitions, en revanche, « 400 » reste ambigu (400 m ou 400 s ?) et est refusé :
   * deviner écrirait une séance que l'utilisateur n'a pas décrite (règle R8-1).
   */
  bareAsMeters = false,
): { distanceM: number } | { durationSeconds: number } | null {
  const text = normalize(raw);
  if (text === '') return null;

  // `m:ss` — un chrono, donc une durée.
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(text);
  if (clock) {
    return { durationSeconds: Number(clock[1]) * 60 + Number(clock[2]) };
  }

  const withUnit = /^(\d+(?:[.,]\d+)?)(km|m|min|mn|s|h)$/.exec(text);
  if (withUnit) {
    const value = Number(withUnit[1]!.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return null;
    switch (withUnit[2]) {
      case 'km':
        return { distanceM: Math.round(value * 1000) };
      case 'm':
        return { distanceM: Math.round(value) };
      case 'min':
      case 'mn':
        return { durationSeconds: Math.round(value * 60) };
      case 's':
        return { durationSeconds: Math.round(value) };
      case 'h':
        return { durationSeconds: Math.round(value * 3600) };
    }
  }

  // Nombre nu : mètres dans un bloc de répétitions (convention de piste), refusé ailleurs.
  if (bareAsMeters) {
    const bare = /^(\d+)$/.exec(text);
    if (bare) {
      const value = Number(bare[1]);
      if (Number.isFinite(value) && value > 0) return { distanceM: Math.round(value) };
    }
  }

  return null;
}

/**
 * Lit un bloc de répétitions : `6x400`, `6x400/200`, `3x2min/90s`, `10 x 400m`.
 *
 * La récupération après `/` est facultative — beaucoup de séances la laissent implicite.
 */
function parseReps(raw: string): ParsedSegment | null {
  const text = normalize(raw);
  const match = /^(\d+)x(.+)$/.exec(text);
  if (!match) return null;

  const reps = Number(match[1]);
  if (!Number.isInteger(reps) || reps < 1 || reps > 99) return null;

  const [fastPart, recoveryPart] = match[2]!.split('/');
  const fast = parseAmount(fastPart ?? '', true);
  if (fast === null) return null;

  const segment = emptySegment('work');
  segment.reps = reps;
  if ('distanceM' in fast) segment.fastDistanceM = fast.distanceM;
  else segment.fastDurationSeconds = fast.durationSeconds;

  if (recoveryPart !== undefined && recoveryPart !== '') {
    const recovery = parseAmount(recoveryPart, true);
    // Une récupération illisible invalide tout le bloc : l'ignorer silencieusement écrirait un
    // fractionné sans récup, ce qui est une autre séance.
    if (recovery === null) return null;
    if ('distanceM' in recovery) segment.recoveryDistanceM = recovery.distanceM;
    else segment.recoveryDurationSeconds = recovery.durationSeconds;
  }

  return segment;
}

/**
 * Lit une séance écrite en une ligne (règle R8-1).
 *
 * Grammaire, close :
 *   `<ligne>   ::= <bloc> ('+' <bloc>)*`
 *   `<bloc>    ::= <quantité> <nature>? | <reps> 'x' <quantité> ('/' <quantité>)?`
 *   `<quantité>::= <n>('km'|'m'|'min'|'s'|'h') | <m>:<ss>`
 *
 * Exemples qui marchent — ce sont ceux d'un carnet d'entraînement :
 *   `2km ech + 6x400/200 + 1km rac`
 *   `15min ech + 3x2min/90s + 10min cd`
 *   `4x30s gammes + 5km tempo`
 *
 * Tout ou rien : le premier morceau non compris interrompt la lecture et rend son texte exact,
 * pour que le message d'erreur montre **où** ça coince plutôt que de dire « saisie invalide ».
 */
export function parseSessionLine(line: string): SessionLineResult {
  const parts = line
    .split('+')
    .map((p) => p.trim())
    .filter((p) => p !== '');

  if (parts.length === 0) {
    return { ok: false, token: '', index: 1 };
  }

  const segments: ParsedSegment[] = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;

    // On sépare les **mots de nature** du reste, puis on recolle le reste sans espaces.
    //
    // Cette partition est ce qui fait marcher les deux formes d'écriture réelles d'un seul
    // coup : « 6 x 400 / 200 » (l'expression est éclatée par des espaces) et « 4x30s gammes »
    // (une nature suit l'expression). Compacter la ligne entière donnait « 4x30sgammes », dont
    // la quantité était illisible ; ne pas la compacter du tout cassait « 6 x 400 ».
    const words = part.split(/\s+/).filter((w) => w !== '');
    const kindWords: SegmentKind[] = [];
    const amountWords: string[] = [];
    for (const word of words) {
      const kind = matchKind(word);
      if (kind !== null) kindWords.push(kind);
      else amountWords.push(word);
    }
    const expression = amountWords.join('');
    // La dernière nature citée gagne : « 2km ech » n'en a qu'une, et deux seraient une faute de
    // frappe dont on ne peut rien déduire de mieux.
    const kind = kindWords.length > 0 ? kindWords[kindWords.length - 1]! : null;

    // 1. Un bloc de répétitions : `6x400/200`. On l'essaie d'abord, il est non ambigu.
    const reps = parseReps(expression);
    if (reps !== null) {
      if (kind !== null) reps.kind = kind;
      segments.push(reps);
      continue;
    }

    // 2. Une quantité simple : `2km`, `12min`.
    const amount = parseAmount(expression);
    if (amount !== null) {
      const segment = emptySegment(kind ?? DEFAULT_SEGMENT_KIND);
      if ('distanceM' in amount) segment.fastDistanceM = amount.distanceM;
      else segment.fastDurationSeconds = amount.durationSeconds;
      segments.push(segment);
      continue;
    }

    // 3. Rien de compris : on s'arrête et on dit où.
    return { ok: false, token: part, index: i + 1 };
  }

  return { ok: true, segments };
}

// ---------------------------------------------------------------------------
// Modèles de séance (constat F34)
// ---------------------------------------------------------------------------

/**
 * Catalogue court de séances types.
 *
 * ── Pourquoi un catalogue, et pourquoi court ─────────────────────────────────────────────────────
 * Il existait une bibliothèque de **programmes** (3 publiés) et **rien** au niveau de la séance :
 * pas de séances types, pas de duplication, pas de saisie abrégée. Chaque `6 × 400 m` du monde se
 * resaisissait à la main, 42 contrôles à la fois.
 *
 * Six entrées, pas soixante : un catalogue long redevient un écran à parcourir, c'est-à-dire le
 * problème qu'on essaie de résoudre. Elles couvrent les formes qui reviennent le plus, et la
 * saisie en une ligne couvre tout le reste.
 *
 * Chaque modèle est **une ligne de la grammaire ci-dessus** — pas une structure en dur. Un modèle
 * qui ne se lirait pas serait un modèle qu'on ne peut pas modifier à la main, et le test le
 * vérifie pour les six.
 */
export const SESSION_TEMPLATES: ReadonlyArray<{
  /** Clé i18n du nom affiché (`running.templates.<id>`). */
  id: string;
  /** La séance, écrite dans la grammaire. */
  line: string;
}> = [
  { id: 'intervals6x400', line: '2km ech + 6x400/200 + 1km rac' },
  { id: 'intervals10x400', line: '2km ech + 10x400/200 + 1km rac' },
  { id: 'intervals3x1000', line: '2km ech + 3x1000/400 + 1km rac' },
  { id: 'pyramid', line: '2km ech + 1x200 + 1x400 + 1x600 + 1x400 + 1x200 + 1km rac' },
  { id: 'tempo20', line: '15min ech + 20min tempo + 10min rac' },
  { id: 'drills', line: '2km ech + 4x30s gammes + 5km corps + 1km rac' },
];
