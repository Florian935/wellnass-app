/**
 * US NARR-01 — l'IA raconte le dossier d'enquête, et **ne peut pas inventer un chiffre**.
 * Réf. : docs/specs/functional/us/narr01-narration-dossier.md
 *
 * ── Ce que ce module garantit ─────────────────────────────────────────────────────────────────
 * L'invite système de la fonction Edge demande déjà au modèle de n'employer que les chiffres qu'on
 * lui donne. Ici, on **vérifie qu'il a obéi** : chaque nombre du texte rendu doit correspondre à une
 * valeur du dossier. C'est toute la différence entre une promesse et une garantie — et c'est la
 * seule raison pour laquelle cette surface peut exister dans une app qui affiche des chiffres de
 * santé.
 *
 * ── Le vrai point dur ─────────────────────────────────────────────────────────────────────────
 * Ce n'est pas d'attraper un chiffre inventé, c'est de **ne pas rejeter un résumé juste**. Un
 * garde-fou qui refuse tout est aussi inutile qu'un garde-fou absent : personne ne le garderait
 * branché huit jours. D'où `expandAllowedNumbers`, qui admet les écritures différentes d'une même
 * valeur (0,34 lu « 34 % », 82,47 arrondi en « 82,5 »), et une tolérance d'arrondi assumée.
 *
 * ⚠️ **Portée du garde-fou : les nombres, et eux seuls.** Un modèle peut encore écrire une phrase
 * fausse sans aucun chiffre, ou recommander autre chose que l'expérience du moteur. La spec le dit
 * (D4), l'écran le dit, et l'expérience proposée reste affichée à part.
 */

/** Au-delà, ce n'est plus un résumé. */
export const NARRATION_MAX_CHARS = 400;

/**
 * US PRISME-01 — un bilan du soir ou de la semaine raconte plus de faits qu'un dossier d'enquête :
 * trois ou quatre phrases, d'où un plafond un peu plus haut. Au-delà, ce n'est plus un bilan.
 */
export const BILAN_MAX_CHARS = 500;

/** Langue du texte à vérifier : elle décide du sens de la virgule (PRISME-01 R3). */
export type NarrationLang = 'fr' | 'en';

/** En deçà, la réponse est tronquée ou vide. */
export const NARRATION_MIN_CHARS = 20;

/**
 * Tolérance d'arrondi absolue : « 82,47 » peut s'écrire « 82,5 ».
 *
 * 0,51 et non 0,5 : un modèle qui arrondit 82,5 en 83 fait un écart de 0,5 pile, et le refuser
 * serait refuser un arrondi correct.
 */
export const NARRATION_ABS_TOLERANCE = 0.51;

/** Tolérance relative, pour les grands nombres (un volume de 12 480 kg écrit « 12 500 »). */
export const NARRATION_REL_TOLERANCE = 0.01;

/** Un fait du dossier, tel que l'écran l'affiche déjà : un libellé traduit et ses chiffres. */
export type NarrationFact = {
  /** Libellé déjà traduit — le module ne fabrique aucun texte d'interface. */
  label: string;
  /** La phrase de constat, telle qu'affichée (elle contient les chiffres en toutes lettres). */
  detail: string;
  /** Les valeurs citées, qui alimentent la liste des nombres autorisés. */
  values: readonly number[];
};

/** Le dossier, réduit à ce qui part vers le modèle. Aucun journal brut, aucune identité (R4). */
export type NarrationDossier = {
  /** Le constat, déjà traduit (« Développé couché : 80 kg depuis 4 semaines »). */
  headline: string;
  /** Les suspects retenus, du plus fort au plus faible. */
  facts: readonly NarrationFact[];
  /** Les facteurs vérifiés et écartés, déjà traduits. */
  cleared: readonly string[];
  /** Les facteurs non jugeables faute de données, déjà traduits. */
  missing: readonly string[];
  /** L'expérience proposée par le moteur, déjà traduite. `null` s'il n'y en a pas. */
  experiment: string | null;
};

export type NarrationVerdict =
  | { ok: true; text: string }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'unknownNumber'; offending: number };

/**
 * Tous les nombres écrits **en chiffres** dans un texte.
 *
 * Gère l'écriture française (virgule décimale, espace des milliers, parfois insécable) et les
 * formes composées qu'un coach emploie : « 5:32/km » rend 5 et 32, « 6 h 05 » rend 6 et 5. On
 * extrait donc des **composants**, pas des grandeurs : c'est volontaire, parce que chaque composant
 * doit de toute façon venir du dossier.
 *
 * Les nombres écrits en toutes lettres (« trois semaines ») ne sont pas vus — et c'est assumé :
 * vérifier des mots demanderait un lexique par langue pour un risque quasi nul (personne n'invente
 * une statistique en toutes lettres).
 *
 * 🔴 **En anglais, la virgule sépare les milliers** (PRISME-01 R3) : `Intl.NumberFormat('en')`
 * écrit « 12,480 kg ». Lu comme une décimale, un « 12,900 » inventé donnerait 12,9 — à 0,42 de 12,48,
 * sous la tolérance d'arrondi, donc accepté. Seule une virgule suivie d'**exactement trois** chiffres
 * est un séparateur ; « 12,48 » reste une décimale. Le français est la langue par défaut : rien ne
 * change pour les appelants existants.
 */
export function extractNumbers(text: string, lang: NarrationLang = 'fr'): number[] {
  // Espaces fines/insécables employées comme séparateur de milliers → rien, pour recoller 12 480.
  let normalised = text
    .replace(/(\d)[   ](?=\d{3}\b)/g, '$1')
    .replace(/(\d)\s(?=\d{3}\b)/g, '$1');
  if (lang === 'en') normalised = normalised.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');

  const found: number[] = [];
  for (const match of normalised.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const value = Number(match[0].replace(',', '.'));
    if (Number.isFinite(value)) found.push(value);
  }
  return found;
}

/**
 * Les écritures acceptables d'une même valeur.
 *
 * Un dossier porte 0,34 ; le modèle écrira « 34 % ». Il porte 82,47 ; le modèle écrira « 82,5 » ou
 * « 82 ». Refuser ces formes reviendrait à exiger du modèle qu'il recopie nos décimales — et à
 * rejeter, en pratique, à peu près tous les résumés justes.
 */
export function expandAllowedNumbers(values: readonly number[]): number[] {
  const out = new Set<number>();

  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const abs = Math.abs(value);
    out.add(abs);
    out.add(Math.round(abs));
    out.add(Math.round(abs * 10) / 10);
    // Un ratio se lit en pourcentage : 0,34 → 34. On n'élargit que pour les valeurs ≤ 10, sinon on
    // autoriserait 8 200 au motif que le dossier porte 82.
    if (abs <= 10) {
      out.add(Math.round(abs * 100));
      out.add(Math.round(abs * 1000) / 10);
    }
    // Une durée décimale lue en minutes et secondes : 5,53 min ↔ « 5:32 ». On admet la partie
    // entière ET les secondes — `Math.round` seul rendrait 6, jamais 5.
    const whole = Math.floor(abs);
    if (abs !== whole) {
      out.add(whole);
      out.add(Math.round((abs - whole) * 60));
    }
  }

  return [...out].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
}

/** Vrai si `value` correspond à l'une des valeurs autorisées, à la tolérance d'arrondi près. */
function isAllowed(value: number, allowed: readonly number[]): boolean {
  return allowed.some((reference) => {
    const gap = Math.abs(value - reference);
    return gap <= NARRATION_ABS_TOLERANCE || gap <= Math.abs(reference) * NARRATION_REL_TOLERANCE;
  });
}

/**
 * Le verdict sur un texte de modèle.
 *
 * 🔴 **Le refus est total.** Un seul nombre inconnu jette tout le résumé, sans tentative de
 * réparation. Garder les phrases « propres » demanderait au lecteur de deviner lesquelles le sont —
 * et ré-interroger le modèle masquerait la fréquence du défaut, qui est justement ce qu'on veut
 * pouvoir constater (spec D3).
 */
export function checkNarration(
  text: string,
  allowed: readonly number[],
  options: { lang?: NarrationLang; maxChars?: number } = {},
): NarrationVerdict {
  const maxChars = options.maxChars ?? NARRATION_MAX_CHARS;
  const trimmed = text.trim();
  if (trimmed.length < NARRATION_MIN_CHARS || trimmed.length > maxChars) {
    return { ok: false, reason: 'invalid' };
  }

  const expanded = expandAllowedNumbers(allowed);
  for (const value of extractNumbers(trimmed, options.lang)) {
    if (!isAllowed(value, expanded)) return { ok: false, reason: 'unknownNumber', offending: value };
  }

  return { ok: true, text: trimmed };
}

/**
 * La liste de référence du garde-fou : tout ce que le modèle a **effectivement sous les yeux**.
 *
 * 🔴 On ne se contente pas des valeurs brutes (`fact.values`), on relit aussi **le texte du
 * dossier**. Sans ça, le premier faux refus arrive tout de suite : le dossier stocke 365 minutes de
 * sommeil et l'affiche « 6 h 05 » ; un modèle qui recopie honnêtement « 6 h 05 » citerait alors deux
 * nombres — 6 et 5 — introuvables dans les valeurs brutes, et son résumé serait jeté.
 *
 * La règle qui en découle est simple et sûre : **le modèle ne peut citer que ce qu'on lui a donné**,
 * et tout ce qu'on lui a donné est autorisé.
 */
export function dossierNumbers(dossier: NarrationDossier): number[] {
  const fromText = [
    dossier.headline,
    ...dossier.facts.map((fact) => `${fact.label} ${fact.detail}`),
    ...dossier.cleared,
    ...dossier.missing,
    dossier.experiment ?? '',
  ].flatMap((line) => extractNumbers(line));

  return [...fromText, ...dossier.facts.flatMap((fact) => [...fact.values])];
}

/**
 * L'invite : le dossier en bloc DONNÉES, et la consigne.
 *
 * Elle vit ici, en FR et en EN, plutôt que dans les locales : ce n'est pas du texte d'interface mais
 * un **contrat technique** avec le modèle, versionné avec le garde-fou qu'il accompagne. Le changer
 * sans relire les tests du garde-fou n'aurait aucun sens.
 */
export function buildNarrationPrompt(
  dossier: NarrationDossier,
  lang: 'fr' | 'en',
): { context: string; question: string } {
  const fr = lang === 'fr';

  const lines: string[] = [];
  lines.push(fr ? `CONSTAT : ${dossier.headline}` : `FINDING: ${dossier.headline}`);

  lines.push('');
  lines.push(fr ? 'PISTES RETENUES (de la plus forte à la plus faible) :' : 'LEADS (strongest first):');
  for (const fact of dossier.facts) lines.push(`- ${fact.label} : ${fact.detail}`);

  if (dossier.cleared.length > 0) {
    lines.push('');
    lines.push(fr ? 'PISTES ÉCARTÉES (vérifiées, sans écart) :' : 'RULED OUT (checked, no gap):');
    for (const item of dossier.cleared) lines.push(`- ${item}`);
  }

  if (dossier.missing.length > 0) {
    lines.push('');
    lines.push(
      fr ? 'NON JUGEABLES (données insuffisantes) :' : 'NOT ASSESSABLE (not enough data):',
    );
    for (const item of dossier.missing) lines.push(`- ${item}`);
  }

  if (dossier.experiment !== null) {
    lines.push('');
    lines.push(fr ? `EXPÉRIENCE PROPOSÉE : ${dossier.experiment}` : `SUGGESTED TEST: ${dossier.experiment}`);
  }

  const question = fr
    ? [
        'Résume ce dossier en deux ou trois phrases, pour la personne concernée.',
        "N'emploie QUE les chiffres ci-dessus, tels quels. N'en calcule aucun autre.",
        'Ce sont des associations sur ses propres données, pas des preuves : ne conclus pas à une cause.',
        "Ne propose rien d'autre que l'expérience indiquée, si elle est indiquée.",
        '350 caractères au maximum.',
      ].join(' ')
    : [
        'Summarize this file in two or three sentences, for the person concerned.',
        'Use ONLY the numbers above, as they are. Do not compute any others.',
        'These are associations in their own data, not proof: do not conclude a cause.',
        'Do not suggest anything other than the test listed, if one is listed.',
        '350 characters maximum.',
      ].join(' ');

  return { context: lines.join('\n'), question };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// US PRISME-01 — les bilans racontés par Prisme (soir, semaine)
// ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Un bilan, réduit à ce qui part vers le modèle. Même grammaire que le dossier d'enquête (des faits
 * traduits et leurs valeurs), mais sans suspects ni pistes écartées : un bilan constate, il
 * n'enquête pas. Construit par `prisme-dossiers.ts`, jamais à la main dans un écran.
 */
export type BilanDossier = {
  /** « Ta journée du vendredi 2 octobre », « Ta semaine du 21 au 27 septembre ». */
  headline: string;
  /** Les faits **affichés** à l'écran, déjà traduits, avec leurs valeurs. */
  facts: readonly NarrationFact[];
  /** La décision du moteur, déjà traduite (bilan hebdo). `null` le soir. */
  decision: string | null;
  /** Période « vie réelle » (VIE-01) : la consigne interdit tout reproche (R12). */
  realLife: boolean;
};

/**
 * La liste de référence du garde-fou pour un bilan : tout ce que le modèle a sous les yeux, texte
 * compris — même règle que `dossierNumbers` (« 6 h 05 » donne 6 et 5).
 */
export function bilanNumbers(dossier: BilanDossier, lang: NarrationLang = 'fr'): number[] {
  // Le dossier est écrit dans la langue de l'app : il se relit avec les mêmes règles que le texte du
  // modèle. Relu à la française, un « 12,480 kg » anglais autorisait 12,48 — donc un « 12 » inventé (R3).
  const fromText = [
    dossier.headline,
    ...dossier.facts.map((fact) => `${fact.label} ${fact.detail}`),
    dossier.decision ?? '',
  ].flatMap((line) => extractNumbers(line, lang));

  return [...fromText, ...dossier.facts.flatMap((fact) => [...fact.values])];
}

/**
 * L'invite d'un bilan, FR et EN. Contrat technique avec le modèle, versionné avec le garde-fou : la
 * consigne demande ce que le garde-fou vérifie (n'employer que ces chiffres), et ce qu'il ne peut
 * pas vérifier (ne rien calculer, ne rien recommander d'autre, ne rien reprocher).
 */
export function buildBilanPrompt(
  dossier: BilanDossier,
  lang: NarrationLang,
  usage: 'evening' | 'week',
): { context: string; question: string } {
  const fr = lang === 'fr';

  const lines: string[] = [];
  lines.push(fr ? `BILAN : ${dossier.headline}` : `SUMMARY: ${dossier.headline}`);
  lines.push('');
  lines.push(fr ? 'FAITS :' : 'FACTS:');
  for (const fact of dossier.facts) lines.push(`- ${fact.label} : ${fact.detail}`);
  if (dossier.decision !== null) {
    lines.push('');
    lines.push(fr ? `DÉCISION DU BILAN : ${dossier.decision}` : `ENGINE DECISION: ${dossier.decision}`);
  }

  const sentences = fr
    ? [
        usage === 'evening'
          ? 'Raconte cette journée en trois ou quatre phrases, à la personne concernée, en la tutoyant.'
          : 'Raconte cette semaine en trois ou quatre phrases, à la personne concernée, en la tutoyant.',
        "N'emploie QUE les chiffres ci-dessus, tels quels. Ne calcule aucun écart, aucun total, aucun pourcentage.",
        'Commence par ce qui a été fait. Pas de diagnostic, pas de culpabilisation, pas d’injonction.',
      ]
    : [
        usage === 'evening'
          ? 'Tell this day in three or four sentences, to the person concerned.'
          : 'Tell this week in three or four sentences, to the person concerned.',
        'Use ONLY the numbers above, as they are. Do not compute any difference, total or percentage.',
        'Start with what was done. No diagnosis, no guilt, no orders.',
      ];

  if (dossier.decision !== null) {
    sentences.push(
      fr
        ? 'Tu peux citer la décision du bilan ; ne fais aucune autre recommandation.'
        : 'You may quote the engine decision; make no other recommendation.',
    );
  }
  if (dossier.realLife) {
    sentences.push(
      fr
        ? 'La personne traverse une période « vie réelle » (vacances, maladie, déplacement) : aucun reproche, aucune comparaison.'
        : 'The person is in a “real life” period (holiday, illness, travel): no reproach, no comparison.',
    );
  }
  sentences.push(fr ? `${BILAN_MAX_CHARS - 50} caractères au maximum.` : `${BILAN_MAX_CHARS - 50} characters maximum.`);

  return { context: lines.join('\n'), question: sentences.join(' ') };
}
